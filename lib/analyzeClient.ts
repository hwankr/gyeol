import type { AnalysisResult } from "@/types/analysis";
import { isAnalysisResult } from "./validateResult.ts";

const FALLBACK_ERROR = "분석에 실패했습니다. 다시 시도해 주세요.";

/**
 * 413 인데 서버가 준 문구가 없을 때(배포 플랫폼이 요청을 앱보다 먼저 막은 경우) 보여 주는 문구.
 * 플랫폼 한도(예: Vercel 4.5MB)는 앱의 10MB 제한보다 작을 수 있어서 "10MB 이하"라고 말하지 않는다.
 */
const PLATFORM_TOO_LARGE_ERROR = "파일이 너무 커서 서버가 받지 못했습니다. 더 작은 PDF 로 다시 시도해 주세요.";

/**
 * 분석 요청이 취소(AbortSignal)되었을 때 던지는 오류.
 * 서버 연결 실패 같은 일반 오류와 구분하려고 따로 둔다. 화면에 보여 줄 문구가 아니다.
 */
export class AnalysisCanceledError extends Error {
  constructor() {
    super("분석 요청이 취소되었습니다.");
    this.name = "AnalysisCanceledError";
  }
}

export type AnalysisRequest = {
  /** 학생부 PDF */
  file: File;
  /** 학과 기준 id (lib/criteria) */
  criteriaId: string;
  /** 접속 코드. 입력한 그대로 보낸다(앞뒤 공백은 서버가 뺀다). */
  accessCode: string;
};

/**
 * 학생부 PDF 를 학과 기준 id, 접속 코드와 함께 POST /api/analyze 로 보내 분석 결과를 받는다.
 * - 실패하면 화면에 보여 줄 문구를 담은 Error 를 던진다. 서버가 준 { error } 문구가 있으면(공백만 있는 문자열 제외) 그대로 쓴다.
 * - 응답이 413 인데 문구가 없으면(배포 플랫폼이 큰 요청을 먼저 막은 경우) PLATFORM_TOO_LARGE_ERROR 를 쓴다.
 *   앱 서버가 직접 돌려주는 413(10MB 초과)에는 문구가 있으므로 그 문구가 그대로 나온다.
 * - signal 로 취소되면(응답을 기다리는 중이든 받은 뒤든) AnalysisCanceledError 를 던진다.
 */
export async function requestAnalysis(
  { file, criteriaId, accessCode }: AnalysisRequest,
  signal?: AbortSignal,
): Promise<AnalysisResult> {
  const body = new FormData();
  body.append("file", file);
  body.append("criteriaId", criteriaId);
  body.append("accessCode", accessCode);

  let response: Response;
  try {
    response = await fetch("/api/analyze", { method: "POST", body, signal });
  } catch {
    if (signal?.aborted) throw new AnalysisCanceledError();
    throw new Error("서버에 연결하지 못했습니다. 다시 시도해 주세요.");
  }

  const data: unknown = await response.json().catch(() => null);
  if (signal?.aborted) throw new AnalysisCanceledError();
  if (!response.ok) {
    const fallback = response.status === 413 ? PLATFORM_TOO_LARGE_ERROR : FALLBACK_ERROR;
    throw new Error(readErrorMessage(data) ?? fallback);
  }
  if (!isAnalysisResult(data)) {
    throw new Error(FALLBACK_ERROR);
  }
  return data;
}

/** 응답 본문의 error 문구. 문자열이고 공백을 뺀 길이가 0 보다 클 때만 원형 그대로 돌려준다. 그 밖에는 null. */
function readErrorMessage(data: unknown): string | null {
  if (
    typeof data === "object" &&
    data !== null &&
    "error" in data &&
    typeof data.error === "string" &&
    data.error.trim().length > 0
  ) {
    return data.error;
  }
  return null;
}
