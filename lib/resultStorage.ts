import type { AnalysisResult } from "@/types/analysis";
import { RESULT_STORAGE_KEY } from "./constants.ts";
import { isAnalysisResult } from "./validateResult.ts";

// 분석 결과를 브라우저 sessionStorage 에 저장하고 불러온다. 브라우저에서만 호출한다.
//
// 저장 값은 { saveId, result } 모양이다. saveId 는 저장할 때마다 새로 만드는 값이라서,
// 내용이 이전과 글자 그대로 같은 결과라도 "새로 저장한 결과"인지 구분할 수 있다.
// cacheComponents 에서는 이동해도 결과 화면의 상태가 보존되므로(Activity), 결과 화면은 saveId 가 바뀌면 처음 상태로 다시 그린다.

export type StoredResult = {
  /** 저장할 때마다 새로 만드는 값 */
  saveId: string;
  result: AnalysisResult;
};

const listeners = new Set<() => void>();

/** 분석 결과를 저장하고, 같은 탭에서 구독 중인 화면에 알린다. 저장할 수 없으면 예외를 던진다. */
export function saveResult(result: AnalysisResult): void {
  const stored: StoredResult = { saveId: createSaveId(), result };
  window.sessionStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(stored));
  listeners.forEach((listener) => listener());
}

/**
 * saveResult 로 결과가 바뀔 때 알림을 받는다. 구독을 끝내는 함수를 돌려준다.
 * sessionStorage 는 같은 탭 안의 변경을 알려 주지 않으므로 여기서 직접 알린다.
 */
export function subscribeResult(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

let cachedRaw: string | null = null;
let cachedStored: StoredResult | null = null;

/**
 * 저장된 분석 결과를 불러온다. 값이 없거나 형식이 깨졌으면 null.
 * 저장된 문자열이 그대로면 같은 객체를 돌려준다(useSyncExternalStore 가 같은 값으로 알아보도록).
 */
export function loadResult(): StoredResult | null {
  let raw: string | null;
  try {
    raw = window.sessionStorage.getItem(RESULT_STORAGE_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;
  if (raw === cachedRaw) return cachedStored;

  cachedRaw = raw;
  cachedStored = parseStored(raw);
  return cachedStored;
}

function parseStored(raw: string): StoredResult | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const { saveId, result } = value as Record<string, unknown>;
    return typeof saveId === "string" && saveId !== "" && isAnalysisResult(result)
      ? { saveId, result }
      : null;
  } catch {
    return null;
  }
}

let saveCount = 0;

/** 저장마다 다른 값. (crypto.randomUUID 는 보안 컨텍스트에서만 있어서 쓰지 않는다.) */
function createSaveId(): string {
  saveCount += 1;
  return `${Date.now().toString(36)}-${saveCount}-${Math.random().toString(36).slice(2, 8)}`;
}
