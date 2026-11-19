import { CONNECTION_ERROR, RequestCanceledError, readErrorMessage } from "./apiClient.ts";
import { normalizeWarnings } from "./criteria/normalize.ts";
import { normalizeConsensusPoints, type ConsensusOpinion, type ConsensusPoint } from "./prep/consensusDraft.ts";
import { parsePrepCriteria, type PrepCriteria } from "./prep/criteria.ts";

// 화면에서 POST /api/consensus 를 부른다(위원 의견으로 공통 기준 초안 만들기). 브라우저에서만 쓴다.
// 서버 전용 모듈(lib/pipeline/**)은 가져오지 않는다. 받은 값은 서버와 같은 순수 함수(lib/prep/)로 한 번 더 확인한다.

const FALLBACK_ERROR = "공통 기준 초안을 만들지 못했습니다. 다시 시도해 주세요.";

export type ConsensusDraftRequest = {
  /** 바탕이 되는 지금 평가 기준 (저장한 평가 기준) */
  criteria: PrepCriteria;
  /** 위원 의견 (의견을 적은 위원만, 1~6건) */
  opinions: readonly ConsensusOpinion[];
};

export type ConsensusDraftResponse = {
  /** 공통 기준 초안 (요소의 id·이름·순서는 보낸 평가 기준과 같다) */
  criteria: PrepCriteria;
  /** 의견 정리 (0~6건) */
  points: ConsensusPoint[];
  /** 경고 (서버가 준 문장 그대로, 0~10건) */
  warnings: string[];
};

/**
 * 지금 평가 기준과 위원 의견을 POST /api/consensus 로 보내 공통 기준 초안을 받는다. 서버는 아무것도 저장하지 않는다.
 * - 실패하면 화면에 보여 줄 문구를 담은 Error 를 던진다. 서버가 준 { error } 문구가 있으면(공백만 있는 문자열 제외) 그대로 쓴다.
 * - 서버에 닿지 못하면 CONNECTION_ERROR, 응답 모양이 다르면(평가 기준이 저장 값 확인을 통과하지 못하거나 요소가 보낸 것과
 *   다른 경우 포함) 일반 문구로 실패한다.
 * - signal 로 취소되면(응답을 기다리는 중이든 받은 뒤든) RequestCanceledError 를 던진다.
 */
export async function requestConsensusDraft(
  { criteria, opinions }: ConsensusDraftRequest,
  signal?: AbortSignal,
): Promise<ConsensusDraftResponse> {
  let response: Response;
  try {
    response = await fetch("/api/consensus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ criteria, opinions }),
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
  const parsed = parseResponse(data, criteria);
  if (parsed === null) throw new Error(FALLBACK_ERROR);
  return parsed;
}

function parseResponse(data: unknown, sent: PrepCriteria): ConsensusDraftResponse | null {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
  const record = data as Record<string, unknown>;
  if (!Array.isArray(record.points) || !Array.isArray(record.warnings)) return null;
  const criteria = parsePrepCriteria(record.criteria);
  if (criteria === null) return null;
  // 공통 기준은 요소를 바꾸지 않는다. 받은 요소의 id·이름·순서가 보낸 것과 다르면 쓰지 않는다.
  const sameElements =
    criteria.elements.length === sent.elements.length &&
    criteria.elements.every((element, index) => {
      const original = sent.elements[index];
      return element.id === original.id && element.name === original.name;
    });
  if (!sameElements) return null;
  return {
    criteria,
    points: normalizeConsensusPoints(record.points),
    warnings: normalizeWarnings(record.warnings),
  };
}
