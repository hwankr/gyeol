import type { AnalysisResult, DepartmentCriteria } from "@/types/analysis";
import { CONNECTION_ERROR, RequestCanceledError, readErrorMessage } from "./apiClient.ts";
import { isAnalysisResult } from "./validateResult.ts";

const FALLBACK_ERROR = "분석에 실패했습니다. 다시 시도해 주세요.";

/**
 * 413 인데 서버가 준 문구가 없을 때(배포 플랫폼이 요청을 앱보다 먼저 막은 경우) 보여 주는 문구.
 * 플랫폼 한도(예: Vercel 4.5MB)는 앱의 10MB 제한보다 작을 수 있어서 "10MB 이하"라고 말하지 않는다.
 */
const PLATFORM_TOO_LARGE_ERROR = "파일이 너무 커서 서버가 받지 못했습니다. 더 작은 PDF 로 다시 시도해 주세요.";

/** 분석에 쓸 학과 기준: 코드에 적힌 학과의 id 또는 저장한 학과의 기준 묶음 중 하나 */
export type AnalysisCriteria =
  | { criteriaId: string; criteria?: undefined }
  | { criteria: DepartmentCriteria; criteriaId?: undefined };

export type AnalysisRequest = AnalysisCriteria & {
  /** 학생부 PDF */
  file: File;
  /** 접속 코드. 입력한 그대로 보낸다(앞뒤 공백은 서버가 뺀다). */
  accessCode: string;
};

/**
 * 학생부 PDF 를 학과 기준, 접속 코드와 함께 POST /api/analyze 로 보내 분석 결과를 받는다.
 * - 학과 기준은 criteriaId(코드에 적힌 학과) 또는 criteria(저장한 학과. JSON 문자열로 만들어 criteria 필드에 넣는다) 중 하나를 보낸다.
 * - 실패하면 화면에 보여 줄 문구를 담은 Error 를 던진다. 서버가 준 { error } 문구가 있으면(공백만 있는 문자열 제외) 그대로 쓴다.
 * - 응답이 413 인데 문구가 없으면(배포 플랫폼이 큰 요청을 먼저 막은 경우) PLATFORM_TOO_LARGE_ERROR 를 쓴다.
 *   앱 서버가 직접 돌려주는 413(10MB 초과)에는 문구가 있으므로 그 문구가 그대로 나온다.
 * - signal 로 취소되면(응답을 기다리는 중이든 받은 뒤든) RequestCanceledError 를 던진다.
 */
export async function requestAnalysis(
  request: AnalysisRequest,
  signal?: AbortSignal,
): Promise<AnalysisResult> {
  const body = new FormData();
  body.append("file", request.file);
  if (request.criteria !== undefined) {
    const { id, department, sourceText, criteria } = request.criteria;
    body.append("criteria", JSON.stringify({ id, department, sourceText, criteria }));
  } else {
    body.append("criteriaId", request.criteriaId);
  }
  body.append("accessCode", request.accessCode);

  let response: Response;
  try {
    response = await fetch("/api/analyze", { method: "POST", body, signal });
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
  if (!isAnalysisResult(data)) {
    throw new Error(FALLBACK_ERROR);
  }
  return data;
}
