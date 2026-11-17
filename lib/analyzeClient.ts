import type { AnalysisResult } from "@/types/analysis";
import { isAnalysisResult } from "./validateResult.ts";

const FALLBACK_ERROR = "분석에 실패했습니다. 다시 시도해 주세요.";

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

/**
 * 학생부 PDF 를 POST /api/analyze 로 보내 분석 결과를 받는다.
 * - 실패하면 화면에 보여 줄 문구를 담은 Error 를 던진다.
 * - signal 로 취소되면(응답을 기다리는 중이든 받은 뒤든) AnalysisCanceledError 를 던진다.
 */
export async function requestAnalysis(file: File, signal?: AbortSignal): Promise<AnalysisResult> {
  const body = new FormData();
  body.append("file", file);

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
    throw new Error(readErrorMessage(data) ?? FALLBACK_ERROR);
  }
  if (!isAnalysisResult(data)) {
    throw new Error(FALLBACK_ERROR);
  }
  return data;
}

function readErrorMessage(data: unknown): string | null {
  if (typeof data === "object" && data !== null && "error" in data && typeof data.error === "string") {
    return data.error;
  }
  return null;
}
