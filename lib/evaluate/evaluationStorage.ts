import { EVALUATIONS_STORAGE_KEY } from "../constants.ts";
import {
  NO_EVALUATIONS,
  parseEvaluations,
  serializeEvaluations,
  type EvaluationRecord,
  type Evaluations,
} from "./evaluation.ts";

// 평가하기의 내 평가(점수·수정 사유·종합 의견·세부 평가 항목 응답·상태)를 브라우저 localStorage 에 JSON 으로 저장하고 불러온다.
// 브라우저에서만 호출한다. 실패 처리는 지원자 관리의 가림 결정(lib/applicants/reviewStorage.ts)과 같은 규칙이다.
//
// 총평 화면과 세부 항목 평가 화면은 주소가 달라 화면 상태를 나누어 갖지 못하므로, 고칠 때마다 바로 저장소에 쓴다
// (화면을 오가도, 새로고침해도 남는다). 상태(평가 중·임시 저장·제출 완료)도 평가에 같이 들어 있다.
//
// 읽기와 쓰기는 모두 try/catch 로 감싼다. 저장소 읽기 결과는 둘로 나눈다.
// - 읽음: 값이 없거나 JSON 이 아니거나 모양이 틀리면 "저장한 평가 없음"(lib/evaluate/evaluation.ts 의 확인). 저장소의 값은 지우지 않는다.
// - 읽지 못함: getItem 이나 localStorage 접근 자체가 예외를 던짐. 저장소에 무엇이 있는지 모르므로 쓰지 않는다(덮어써서 다른 평가를 잃지 않게).
//   화면에는 이 페이지를 연 뒤 마지막으로 읽는 데 성공한 값을 보여 준다. 한 번도 읽지 못했으면 저장한 평가가 없는 모습(처음 상태)이다.
//
// 쓰지 않았거나 쓰기가 실패한 평가는 이 페이지의 메모리에만 둔다(지원자마다. 새로고침하면 사라진다).
// - 화면에는 메모리에 둔 평가가 저장소의 평가보다 먼저 보인다.
// - 메모리에 둔 평가가 있는 동안 화면은 "저장하지 못함" 안내를 보여 준다(hasUnsavedEvaluations). 다음 쓰기가 성공하면
//   메모리에 둔 평가도 같이 저장하고 안내가 사라진다.
// 쓸 때는 저장소를 그 순간 다시 읽고 그 지원자의 평가만 바꿔 쓴다(다른 탭이 저장한 다른 지원자의 평가를 지우지 않게).
// 다른 탭의 변경은 구독하지 않는다(storage 이벤트 없음). 화면이 다시 그려질 때 저장소를 다시 읽으면서 반영된다.
// 화면은 useSyncExternalStore 로 읽는다. 내용이 같으면 같은 객체를 돌려준다.

const listeners = new Set<() => void>();

/** 마지막으로 읽는 데 성공한(또는 쓴) 저장 문자열(undefined: 이 페이지에서 아직 한 번도 읽지 못함)과 그 평가 */
let lastRaw: string | null | undefined;
let lastEvaluations: Evaluations = NO_EVALUATIONS;
/** 저장소에 쓰지 못해 메모리에만 둔 평가 (지원자 코드 → 평가) */
let memoryEvaluations: Evaluations = NO_EVALUATIONS;
/** 마지막으로 만든 화면 평가와 그것을 만든 재료 */
let composed: { stored: Evaluations; memory: Evaluations; value: Evaluations } | null = null;

/** 평가가 바뀔 때 알림을 받는다. 구독을 끝내는 함수를 돌려준다. */
export function subscribeEvaluations(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * 화면에 보이는 평가: 마지막으로 읽은 저장소의 평가 위에 메모리에만 둔 평가를 지원자마다 덮어쓴 것. 저장소를 다시 읽는다.
 * 읽지 못하면 이 페이지에서 마지막으로 읽은 값을 쓰고, 한 번도 읽지 못했으면 메모리에만 둔 평가뿐이다(없으면 빈 값).
 */
export function loadEvaluations(): Evaluations {
  readEvaluations();
  return composeEvaluations();
}

/** 저장소에 쓰지 못해 메모리에만 둔 평가가 있는지 */
export function hasUnsavedEvaluations(): boolean {
  return Object.keys(memoryEvaluations).length > 0;
}

/**
 * 지원자 한 명의 평가를 쓴다. 저장소를 이 순간 다시 읽고, 읽은 값에 그 지원자의 평가(와 메모리에만 두었던 평가)를 바꿔 넣어 쓴다.
 * 읽지 못하면 쓰지 않는다. 쓰지 않았거나 쓰지 못한 평가는 메모리에만 둔다. 저장소에 저장했으면 true.
 */
export function updateEvaluation(code: string, record: EvaluationRecord): boolean {
  const read = readEvaluations();
  const pending: Evaluations = { ...memoryEvaluations, [code]: record };
  const saved = read.ok && writeEvaluations({ ...read.evaluations, ...pending });
  memoryEvaluations = saved ? NO_EVALUATIONS : pending;
  notify();
  return saved;
}

/** 저장소를 읽는다. 읽으면 "마지막으로 읽은 값"을 바꾸고 그 값을, 읽지 못하면 그 값을 그대로 두고 ok: false 를 돌려준다. */
function readEvaluations(): { ok: true; evaluations: Evaluations } | { ok: false; evaluations?: undefined } {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(EVALUATIONS_STORAGE_KEY);
  } catch {
    return { ok: false };
  }
  if (raw !== lastRaw) {
    lastRaw = raw;
    lastEvaluations = raw === null ? NO_EVALUATIONS : parseEvaluations(parseJson(raw));
  }
  return { ok: true, evaluations: lastEvaluations };
}

/** 평가를 쓴다. 쓰면 그 값을 "마지막으로 읽은 값"으로 삼고 true, 예외가 나면(저장 공간 부족 등) false. */
function writeEvaluations(evaluations: Evaluations): boolean {
  const raw = serializeEvaluations(evaluations);
  try {
    window.localStorage.setItem(EVALUATIONS_STORAGE_KEY, raw);
  } catch {
    return false;
  }
  lastRaw = raw;
  lastEvaluations = parseEvaluations(JSON.parse(raw));
  return true;
}

/** 화면 평가 = 마지막으로 읽은 평가 + 메모리에만 둔 평가. 재료가 같으면 같은 객체를 돌려준다. */
function composeEvaluations(): Evaluations {
  if (composed !== null && composed.stored === lastEvaluations && composed.memory === memoryEvaluations) return composed.value;
  const value = hasUnsavedEvaluations() ? { ...lastEvaluations, ...memoryEvaluations } : lastEvaluations;
  composed = { stored: lastEvaluations, memory: memoryEvaluations, value };
  return value;
}

/** JSON 이 아니면 undefined (확인 함수가 "저장한 평가 없음"으로 본다) */
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
