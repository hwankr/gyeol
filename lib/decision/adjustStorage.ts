import { DECISION_ADJUSTMENTS_STORAGE_KEY } from "../constants.ts";
import { NO_ADJUSTMENTS, parseDecisionAdjustments, serializeDecisionAdjustments, type DecisionAdjustments } from "./adjustments.ts";
import { DECISION_APPLICANTS } from "./sampleDecision.ts";

// 선발 결정 · 위원 의견 모아보기에서 확정한 조정(지원자의 조정한 위원 점수)을 브라우저 localStorage 에 JSON 으로 저장하고 불러온다.
// 브라우저에서만 호출한다. 조정한 점수로 최종 평가와 순위를 다시 계산하므로 선발 결정의 머리와 세 탭이 같이 읽고, 새로고침해도 남는다.
//
// 읽기와 쓰기는 모두 try/catch 로 감싼다(고른 지원자의 저장 lib/decision/pickStorage.ts 와 같은 규칙).
// - 읽음: 값이 없거나 JSON 이 아니거나 모양이 틀리면 "확정한 조정 없음"(lib/decision/adjustments.ts 의 확인). 저장소의 값은 지우지 않는다.
// - 읽지 못함(getItem 이 예외를 던짐): 이 페이지에서 마지막으로 읽은 값을 그대로 쓴다. 한 번도 읽지 못했으면 조정이 없는 모습이다.
// - 쓰지 못함: 조정을 이 페이지의 메모리에만 둔다(새로고침하면 사라진다). 화면에는 메모리의 값이 먼저 보이고, 다음 쓰기가 성공하면
//   저장소의 값이 된다. 메모리에만 둔 동안 화면은 "저장하지 못함" 안내를 보여 준다(hasUnsavedDecisionAdjustments).
// 다른 탭의 변경은 구독하지 않는다(storage 이벤트 없음). 화면이 다시 그려질 때 저장소를 다시 읽으면서 반영된다.
// 화면은 useSyncExternalStore 로 읽는다. 내용이 같으면 같은 객체를 돌려준다.

const listeners = new Set<() => void>();

/** 마지막으로 읽는 데 성공한(또는 쓴) 저장 문자열(undefined: 이 페이지에서 아직 한 번도 읽지 못함)과 그 값 */
let lastRaw: string | null | undefined;
let lastAdjustments: DecisionAdjustments = NO_ADJUSTMENTS;
/** 저장소에 쓰지 못해 메모리에만 둔 값 (없으면 null) */
let memoryAdjustments: DecisionAdjustments | null = null;

/** 확정한 조정이 바뀔 때 알림을 받는다. 구독을 끝내는 함수를 돌려준다. */
export function subscribeDecisionAdjustments(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 화면에 보이는 값: 메모리에만 둔 값이 있으면 그것, 없으면 저장소의 값(저장소를 다시 읽는다) */
export function loadDecisionAdjustments(): DecisionAdjustments {
  if (memoryAdjustments !== null) return memoryAdjustments;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(DECISION_ADJUSTMENTS_STORAGE_KEY);
  } catch {
    return lastAdjustments;
  }
  if (raw !== lastRaw) {
    lastRaw = raw;
    lastAdjustments = raw === null ? NO_ADJUSTMENTS : parseDecisionAdjustments(parseJson(raw), DECISION_APPLICANTS);
  }
  return lastAdjustments;
}

/** 저장소에 쓰지 못해 메모리에만 둔 조정이 있는지 */
export function hasUnsavedDecisionAdjustments(): boolean {
  return memoryAdjustments !== null;
}

/** 확정한 조정을 저장한다. 쓰지 못하면 메모리에만 둔다. 저장소에 저장했으면 true. */
export function saveDecisionAdjustments(adjustments: DecisionAdjustments): boolean {
  const raw = serializeDecisionAdjustments(adjustments);
  let saved = true;
  try {
    window.localStorage.setItem(DECISION_ADJUSTMENTS_STORAGE_KEY, raw);
    lastRaw = raw;
    lastAdjustments = adjustments;
    memoryAdjustments = null;
  } catch {
    memoryAdjustments = adjustments;
    saved = false;
  }
  listeners.forEach((listener) => listener());
  return saved;
}

/** JSON 이 아니면 undefined (확인 함수가 "확정한 조정 없음"으로 본다) */
function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}
