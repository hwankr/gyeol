import type { Criterion } from "@/types/analysis";
import { CONNECTION_ERROR, RequestCanceledError, readErrorMessage } from "./apiClient.ts";
import { normalizeCriteria, normalizeWarnings } from "./criteria/normalize.ts";

const FALLBACK_ERROR = "기준을 만들지 못했습니다. 다시 시도해 주세요.";

export type CriteriaRequest = {
  /** 학과 이름 */
  department: string;
  /** 학과가 보고 싶은 점을 적은 문장 */
  sourceText: string;
  /** 접속 코드. 입력한 그대로 보낸다(앞뒤 공백은 서버가 뺀다). */
  accessCode: string;
};

export type CriteriaDraftResponse = {
  /** 서버가 정리한 기준 초안 (0~6개, id c1…) */
  criteria: Criterion[];
  /** 기준에서 제외한 내용과 이유 (서버가 준 문장 그대로) */
  warnings: string[];
};

/**
 * 학과 이름과 문장을 POST /api/criteria 로 보내 평가 기준 초안을 받는다. 서버는 아무것도 저장하지 않는다.
 * - 실패하면 화면에 보여 줄 문구를 담은 Error 를 던진다. 서버가 준 { error } 문구가 있으면(공백만 있는 문자열 제외) 그대로 쓴다.
 * - 응답 모양이 다르면 일반 문구로 실패한다. 받은 기준·경고는 서버와 같은 함수로 한 번 더 정리한다.
 * - signal 로 취소되면(응답을 기다리는 중이든 받은 뒤든) RequestCanceledError 를 던진다.
 */
export async function requestCriteria(
  { department, sourceText, accessCode }: CriteriaRequest,
  signal?: AbortSignal,
): Promise<CriteriaDraftResponse> {
  let response: Response;
  try {
    response = await fetch("/api/criteria", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ department, sourceText, accessCode }),
      signal,
    });
  } catch {
    if (signal?.aborted) throw new RequestCanceledError();
    throw new Error(CONNECTION_ERROR);
  }

  const data: unknown = await response.json().catch(() => null);
  if (signal?.aborted) throw new RequestCanceledError();
  if (!response.ok) {
    throw new Error(readErrorMessage(data) ?? FALLBACK_ERROR);
  }
  if (
    typeof data !== "object" ||
    data === null ||
    !("criteria" in data) ||
    !("warnings" in data) ||
    !Array.isArray(data.criteria) ||
    !Array.isArray(data.warnings)
  ) {
    throw new Error(FALLBACK_ERROR);
  }
  return { criteria: normalizeCriteria(data.criteria), warnings: normalizeWarnings(data.warnings) };
}
