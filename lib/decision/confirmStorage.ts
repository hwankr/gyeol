import { DECISION_CONFIRM_STORAGE_KEY } from "../constants.ts";
import { parseDecisionConfirmation, serializeDecisionConfirmation, type DecisionConfirmation } from "./confirm.ts";
import { DECISION_APPLICANTS } from "./sampleDecision.ts";

// 선발 결정 · 기록 확정에서 확정한 기록(확정한 시각·사람과 그때의 순위·최종 평가)을 브라우저 localStorage 에 JSON 으로 저장하고
// 불러온다. 브라우저에서만 호출한다. 기록 확정 탭과 머리의 탭 줄(`기록 확정` 옆의 `완료`)이 같이 읽고, 새로고침해도 남는다.
// 확정을 취소하면 키를 지운다.
//
// 읽기와 쓰기는 모두 try/catch 로 감싼다(확정한 조정의 저장 lib/decision/adjustStorage.ts 와 같은 규칙).
// - 읽음: 값이 없거나 JSON 이 아니거나 모양이 틀리면 "확정한 기록 없음"(lib/decision/confirm.ts 의 확인). 저장소의 값은 지우지 않는다.
// - 읽지 못함(getItem 이 예외를 던짐): 이 페이지에서 마지막으로 읽은 값을 그대로 쓴다. 한 번도 읽지 못했으면 확정한 기록이 없는 모습이다.
// - 쓰지 못함: 확정(또는 취소)을 이 페이지의 메모리에만 둔다(새로고침하면 사라진다). 화면에는 메모리의 값이 먼저 보이고, 다음 쓰기가
//   성공하면 저장소의 값이 된다. 메모리에만 둔 동안 화면은 "저장하지 못함" 안내를 보여 준다(hasUnsavedDecisionConfirmation).
// 다른 탭의 변경은 구독하지 않는다(storage 이벤트 없음). 화면이 다시 그려질 때 저장소를 다시 읽으면서 반영된다.
// 화면은 useSyncExternalStore 로 읽는다. 내용이 같으면 같은 객체를 돌려준다.

const CODES: readonly string[] = DECISION_APPLICANTS.map((applicant) => applicant.code);

const listeners = new Set<() => void>();

/** 마지막으로 읽는 데 성공한(또는 쓴) 저장 문자열(undefined: 이 페이지에서 아직 한 번도 읽지 못함)과 그 값 */
let lastRaw: string | null | undefined;
let lastConfirmation: DecisionConfirmation | null = null;
/** 저장소에 쓰지 못해 메모리에만 둔 값 (없으면 null. 확정을 취소한 것이면 value 가 null 이다) */
let memory: { value: DecisionConfirmation | null } | null = null;

/** 확정한 기록이 바뀔 때 알림을 받는다. 구독을 끝내는 함수를 돌려준다. */
export function subscribeDecisionConfirmation(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 화면에 보이는 값: 메모리에만 둔 값이 있으면 그것, 없으면 저장소의 값(저장소를 다시 읽는다). 확정한 기록이 없으면 null. */
export function loadDecisionConfirmation(): DecisionConfirmation | null {
  if (memory !== null) return memory.value;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(DECISION_CONFIRM_STORAGE_KEY);
  } catch {
    return lastConfirmation;
  }
  if (raw !== lastRaw) {
    lastRaw = raw;
    lastConfirmation = raw === null ? null : parseDecisionConfirmation(parseJson(raw), CODES);
  }
  return lastConfirmation;
}

/** 저장소에 쓰지 못해 메모리에만 둔 확정(또는 취소)이 있는지 */
export function hasUnsavedDecisionConfirmation(): boolean {
  return memory !== null;
}

/** 확정한 기록을 저장한다. null 이면 확정을 취소한다(키를 지운다). 쓰지 못하면 메모리에만 둔다. 저장소에 반영했으면 true. */
export function saveDecisionConfirmation(confirmation: DecisionConfirmation | null): boolean {
  const raw = confirmation === null ? null : serializeDecisionConfirmation(confirmation);
  let saved = true;
  try {
    if (raw === null) window.localStorage.removeItem(DECISION_CONFIRM_STORAGE_KEY);
    else window.localStorage.setItem(DECISION_CONFIRM_STORAGE_KEY, raw);
    lastRaw = raw;
    lastConfirmation = confirmation;
    memory = null;
  } catch {
    memory = { value: confirmation };
    saved = false;
  }
  listeners.forEach((listener) => listener());
  return saved;
}

/** JSON 이 아니면 undefined (확인 함수가 "확정한 기록 없음"으로 본다) */
function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}
