import { CONNECTION_ERROR, RequestCanceledError, readErrorMessage } from "./apiClient.ts";
import { normalizeWarnings } from "./criteria/normalize.ts";
import { parsePrepCriteria, type PrepCriteria } from "./prep/criteria.ts";
import { normalizeGuidelineChanges } from "./prep/guidelineDraft.ts";
import type { GuidelineChange } from "./prep/guidelineChanges.ts";

// 화면에서 POST /api/guideline 을 부른다(모집요강 PDF 로 평가 기준 초안 만들기). 브라우저에서만 쓴다.
// 서버 전용 모듈(lib/pipeline/**)은 가져오지 않는다. 받은 값은 서버와 같은 순수 함수(lib/prep/)로 한 번 더 확인한다.

const FALLBACK_ERROR = "기준 초안을 만들지 못했습니다. 다시 시도해 주세요.";

/**
 * 413 인데 서버가 준 문구가 없을 때(배포 플랫폼이 요청을 앱보다 먼저 막은 경우) 보여 주는 문구.
 * 학생부 올리기(lib/analyzeClient.ts)와 글자 그대로 같다.
 */
const PLATFORM_TOO_LARGE_ERROR = "파일이 너무 커서 서버가 받지 못했습니다. 더 작은 PDF 로 다시 시도해 주세요.";

export type GuidelineDraftRequest = {
  /** 모집요강 PDF */
  file: File;
  /** 모집 단위 이름 */
  department: string;
};

export type GuidelineDraftResponse = {
  /** 평가 기준 초안. 모집요강에서 평가 요소를 찾지 못했으면 null. */
  criteria: PrepCriteria | null;
  /** 전년 대비 변경 사항 (0~6건) */
  changes: GuidelineChange[];
  /** 경고 (서버가 준 문장 그대로, 0~10건) */
  warnings: string[];
  /** 읽은 쪽 수와 전체 쪽 수 */
  pages: { read: number; total: number };
};

/**
 * 모집요강 PDF 와 모집 단위 이름을 POST /api/guideline 으로 보내 평가 기준 초안을 받는다. 서버는 아무것도 저장하지 않는다.
 * - 실패하면 화면에 보여 줄 문구를 담은 Error 를 던진다. 서버가 준 { error } 문구가 있으면(공백만 있는 문자열 제외) 그대로 쓴다.
 * - 응답이 413 인데 문구가 없으면(배포 플랫폼이 큰 요청을 먼저 막은 경우) PLATFORM_TOO_LARGE_ERROR, 서버에 닿지 못하면 CONNECTION_ERROR.
 * - 응답 모양이 다르면(평가 기준이 저장 값 확인을 통과하지 못하는 경우 포함) 일반 문구로 실패한다.
 * - signal 로 취소되면(응답을 기다리는 중이든 받은 뒤든) RequestCanceledError 를 던진다.
 */
export async function requestGuidelineDraft(
  { file, department }: GuidelineDraftRequest,
  signal?: AbortSignal,
): Promise<GuidelineDraftResponse> {
  const body = new FormData();
  body.append("file", file);
  body.append("department", department);

  let response: Response;
  try {
    response = await fetch("/api/guideline", { method: "POST", body, signal });
  } catch {
    if (signal?.aborted) throw new RequestCanceledError();
    throw new Error(CONNECTION_ERROR);
  }

  const data: unknown = await response.json().catch(() => null);
  if (signal?.aborted) throw new RequestCanceledError();
  if (!response.ok) {
    const fallback = response.status === 413 ? PLATFORM_TOO_LARGE_ERROR : FALLBACK_ERROR;
    throw new Error(readErrorMessage(data) ?? fallback);
  }
  const parsed = parseResponse(data);
  if (parsed === null) throw new Error(FALLBACK_ERROR);
  return parsed;
}

function parseResponse(data: unknown): GuidelineDraftResponse | null {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
  const record = data as Record<string, unknown>;
  if (!Array.isArray(record.changes) || !Array.isArray(record.warnings)) return null;
  const pages = record.pages;
  if (typeof pages !== "object" || pages === null) return null;
  const { read, total } = pages as Record<string, unknown>;
  if (typeof read !== "number" || typeof total !== "number") return null;

  let criteria: PrepCriteria | null = null;
  if (record.criteria !== null) {
    criteria = parsePrepCriteria(record.criteria);
    if (criteria === null) return null;
  }
  return {
    criteria,
    changes: normalizeGuidelineChanges(record.changes),
    warnings: normalizeWarnings(record.warnings),
    pages: { read, total },
  };
}
