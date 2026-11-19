import { APPLICANT_REVIEWS_STORAGE_KEY } from "../constants.ts";
import { NO_REVIEWS, type ApplicantDecisions, type ApplicantReviews } from "./applicants.ts";
import { parseApplicantReviews, serializeApplicantReviews } from "./reviews.ts";
import { SAMPLE_APPLICANTS } from "./sampleApplicants.ts";

// 지원자 관리의 가림 결정을 브라우저 localStorage 에 JSON 으로 저장하고 불러온다. 브라우저에서만 호출한다.
// 실패 처리는 전형 준비의 평가 기준 저장(lib/prep/storage.ts)과 같은 규칙이다.
//
// 읽기와 쓰기는 모두 try/catch 로 감싼다. 저장소 읽기 결과는 둘로 나눈다.
// - 읽음: 값이 없거나 JSON 이 아니거나 모양이 틀리면 "저장한 결정 없음"(lib/applicants/reviews.ts 의 확인). 저장소의 값은 지우지 않는다.
// - 읽지 못함: getItem 이나 localStorage 접근 자체가 예외를 던짐. 저장소에 무엇이 있는지 모르므로 쓰지 않는다(덮어써서 다른 결정을 잃지 않게).
//   화면에는 이 페이지를 연 뒤 마지막으로 읽는 데 성공한 값을 보여 준다. 한 번도 읽지 못했으면 저장한 결정이 없는 모습이다.
//
// 쓰지 않았거나 쓰기가 실패한 결정은 이 페이지의 메모리에만 둔다(지원자마다. 새로고침하면 사라진다).
// - 화면에는 메모리에 둔 결정이 저장소의 결정보다 먼저 보인다(저장된 것처럼 상태·숫자가 바뀐다).
// - 메모리에 둔 결정이 있는 동안 화면은 "저장하지 못함" 안내를 보여 준다(hasUnsavedApplicantReviews). 다음 저장이 성공하면
//   메모리에 둔 결정도 같이 저장하고 안내가 사라진다.
// 저장할 때는 저장소를 그 순간 다시 읽고 그 지원자의 결정만 바꿔 쓴다(다른 탭이 저장한 다른 지원자의 결정을 지우지 않게).
// 다른 탭의 변경은 구독하지 않는다(storage 이벤트 없음). 화면이 다시 그려질 때 저장소를 다시 읽으면서 반영된다.
// 화면은 useSyncExternalStore 로 읽는다. 내용이 같으면 같은 객체를 돌려준다.

const listeners = new Set<() => void>();

/** 마지막으로 읽는 데 성공한(또는 쓴) 저장 문자열(undefined: 이 페이지에서 아직 한 번도 읽지 못함)과 그 결정 */
let lastRaw: string | null | undefined;
let lastReviews: ApplicantReviews = NO_REVIEWS;
/** 저장소에 쓰지 못해 메모리에만 둔 결정 (지원자 코드 → 결정) */
let memoryReviews: ApplicantReviews = NO_REVIEWS;
/** 마지막으로 만든 화면 결정과 그것을 만든 재료 */
let composed: { stored: ApplicantReviews; memory: ApplicantReviews; value: ApplicantReviews } | null = null;

/** 결정이 바뀔 때 알림을 받는다. 구독을 끝내는 함수를 돌려준다. */
export function subscribeApplicantReviews(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * 화면에 보이는 결정: 마지막으로 읽은 저장소의 결정 위에 메모리에만 둔 결정을 지원자마다 덮어쓴 것. 저장소를 다시 읽는다.
 * 읽지 못하면 이 페이지에서 마지막으로 읽은 값을 쓰고, 한 번도 읽지 못했으면 메모리에만 둔 결정뿐이다(없으면 빈 값).
 */
export function loadApplicantReviews(): ApplicantReviews {
  readReviews();
  return composeReviews();
}

/** 저장소에 쓰지 못해 메모리에만 둔 결정이 있는지 */
export function hasUnsavedApplicantReviews(): boolean {
  return Object.keys(memoryReviews).length > 0;
}

/**
 * 지원자 한 명의 결정을 저장한다. 저장소를 이 순간 다시 읽고, 읽은 값에 그 지원자의 결정(과 메모리에만 두었던 결정)을 바꿔 넣어 쓴다.
 * 읽지 못하면 쓰지 않는다. 쓰지 않았거나 쓰지 못한 결정은 메모리에만 둔다. 저장소에 저장했으면 true.
 */
export function saveApplicantReview(code: string, decisions: ApplicantDecisions): boolean {
  const read = readReviews();
  const pending: ApplicantReviews = { ...memoryReviews, [code]: decisions };
  const saved = read.ok && writeReviews({ ...read.reviews, ...pending });
  memoryReviews = saved ? NO_REVIEWS : pending;
  notify();
  return saved;
}

/** 저장소를 읽는다. 읽으면 "마지막으로 읽은 값"을 바꾸고 그 값을, 읽지 못하면 그 값을 그대로 두고 ok: false 를 돌려준다. */
function readReviews(): { ok: true; reviews: ApplicantReviews } | { ok: false; reviews?: undefined } {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(APPLICANT_REVIEWS_STORAGE_KEY);
  } catch {
    return { ok: false };
  }
  if (raw !== lastRaw) {
    lastRaw = raw;
    lastReviews = raw === null ? NO_REVIEWS : parseApplicantReviews(parseJson(raw), SAMPLE_APPLICANTS);
  }
  return { ok: true, reviews: lastReviews };
}

/** 결정을 쓴다. 쓰면 그 값을 "마지막으로 읽은 값"으로 삼고 true, 예외가 나면 false. */
function writeReviews(reviews: ApplicantReviews): boolean {
  const raw = serializeApplicantReviews(reviews);
  try {
    window.localStorage.setItem(APPLICANT_REVIEWS_STORAGE_KEY, raw);
  } catch {
    return false;
  }
  lastRaw = raw;
  lastReviews = parseApplicantReviews(JSON.parse(raw), SAMPLE_APPLICANTS);
  return true;
}

/** 화면 결정 = 마지막으로 읽은 결정 + 메모리에만 둔 결정. 재료가 같으면 같은 객체를 돌려준다. */
function composeReviews(): ApplicantReviews {
  if (composed !== null && composed.stored === lastReviews && composed.memory === memoryReviews) return composed.value;
  const value = hasUnsavedApplicantReviews() ? { ...lastReviews, ...memoryReviews } : lastReviews;
  composed = { stored: lastReviews, memory: memoryReviews, value };
  return value;
}

/** JSON 이 아니면 undefined (확인 함수가 "저장한 결정 없음"으로 본다) */
function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function notify() {
  listeners.forEach((listener) => listener());
}
