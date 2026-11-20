import { DECISION_PICKS_STORAGE_KEY } from "../constants.ts";
import { NO_PICKS, parseDecisionPicks, serializeDecisionPicks, type DecisionPicks } from "./decision.ts";
import { DECISION_APPLICANTS } from "./sampleDecision.ts";

// 선발 결정에서 비교하려고 고른 지원자(2명까지)를 브라우저 localStorage 에 JSON 으로 저장하고 불러온다. 브라우저에서만 호출한다.
// 인재상 적합 추천 탭에서 고르고 지원자 비교 탭에서 읽으므로 두 탭(과 머리의 탭 줄)이 같이 쓰고, 새로고침해도 남는다.
//
// 읽기와 쓰기는 모두 try/catch 로 감싼다(다른 저장소와 같은 규칙. lib/applicants/reviewStorage.ts).
// - 읽음: 값이 없거나 JSON 이 아니거나 모양이 틀리면 "고른 사람 없음"(lib/decision/decision.ts 의 확인). 저장소의 값은 지우지 않는다.
// - 읽지 못함(getItem 이 예외를 던짐): 이 페이지에서 마지막으로 읽은 값을 그대로 쓴다. 한 번도 읽지 못했으면 고른 사람이 없는 모습이다.
// - 쓰지 못함: 고른 값을 이 페이지의 메모리에만 둔다(새로고침하면 사라진다). 화면에는 메모리의 값이 먼저 보이고, 다음 쓰기가 성공하면
//   저장소의 값이 된다. 고른 두 사람은 다시 고르면 되는 값이라 "저장하지 못함" 안내는 두지 않는다.
// 다른 탭의 변경은 구독하지 않는다(storage 이벤트 없음). 화면이 다시 그려질 때 저장소를 다시 읽으면서 반영된다.
// 화면은 useSyncExternalStore 로 읽는다. 내용이 같으면 같은 객체를 돌려준다.

const CODES: readonly string[] = DECISION_APPLICANTS.map((applicant) => applicant.code);

const listeners = new Set<() => void>();

/** 마지막으로 읽는 데 성공한(또는 쓴) 저장 문자열(undefined: 이 페이지에서 아직 한 번도 읽지 못함)과 그 값 */
let lastRaw: string | null | undefined;
let lastPicks: DecisionPicks = NO_PICKS;
/** 저장소에 쓰지 못해 메모리에만 둔 값 (없으면 null) */
let memoryPicks: DecisionPicks | null = null;

/** 고른 지원자가 바뀔 때 알림을 받는다. 구독을 끝내는 함수를 돌려준다. */
export function subscribeDecisionPicks(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 화면에 보이는 값: 메모리에만 둔 값이 있으면 그것, 없으면 저장소의 값(저장소를 다시 읽는다) */
export function loadDecisionPicks(): DecisionPicks {
  if (memoryPicks !== null) return memoryPicks;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(DECISION_PICKS_STORAGE_KEY);
  } catch {
    return lastPicks;
  }
  if (raw !== lastRaw) {
    lastRaw = raw;
    lastPicks = raw === null ? NO_PICKS : parseDecisionPicks(parseJson(raw), CODES);
  }
  return lastPicks;
}

/** 고른 지원자를 저장한다. 쓰지 못하면 메모리에만 둔다. */
export function saveDecisionPicks(picks: DecisionPicks): void {
  const raw = serializeDecisionPicks(picks);
  try {
    window.localStorage.setItem(DECISION_PICKS_STORAGE_KEY, raw);
    lastRaw = raw;
    lastPicks = picks;
    memoryPicks = null;
  } catch {
    memoryPicks = picks;
  }
  listeners.forEach((listener) => listener());
}

/** JSON 이 아니면 undefined (확인 함수가 "고른 사람 없음"으로 본다) */
function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}
