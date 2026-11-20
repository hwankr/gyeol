import type { AnalysisResult, Linkage } from "@/types/analysis";
import { CONNECTION_ERROR, RequestCanceledError, readErrorMessage } from "./apiClient.ts";
import { buildLinkageRequest } from "./evaluate/linkage.ts";
import { isLinkage, linkageProblems } from "./validateResult.ts";

// 화면에서 학년별 연계를 만든다(POST /api/linkage). 브라우저에서만 쓴다.
// 학생부 올리기는 분석이 끝난 뒤 이어서 부르고(lib/analyzeClient.ts), 평가하기 총평은 연계가 없는 올린 지원자의 "연계 만들기" 버튼으로 부른다
// (hooks/useEvaluateLinkage.ts). 보내는 것은 분석 결과에 있는 가려진 항목과 근거뿐이다(가리기 전 원문은 브라우저에 없다).

/** 서버가 준 문구가 없거나 받은 값을 쓸 수 없을 때 보여 주는 문구 */
export const LINKAGE_ERROR = "학년별 연계를 만들지 못했습니다. 다시 시도해 주세요.";

/**
 * 분석 결과의 근거 사이에서 학년별 연계를 받아 온다. AI 를 한 번 부른다(근거가 없으면 서버가 부르지 않는다).
 * - 본문은 기준의 id·이름, 근거, 근거가 든 항목이다(lib/evaluate/linkage.ts 의 buildLinkageRequest).
 * - 받은 값은 모양(isLinkage)과 그 분석 결과와의 맞음(linkageProblems: 카드의 근거·항목이 실제로 있는지, 기록에 적힌 표현이 원문에 있는지)을
 *   확인한다. 통과하지 못하면 실패다.
 * - 실패하면 화면에 보여 줄 문구를 담은 Error 를 던진다. 서버가 준 { error } 문구가 있으면 그대로 쓴다.
 * - signal 로 취소되면 RequestCanceledError 를 던진다.
 */
export async function requestLinkage(
  result: Pick<AnalysisResult, "criteria" | "sections" | "evidences">,
  signal?: AbortSignal,
): Promise<Linkage> {
  let response: Response;
  try {
    response = await fetch("/api/linkage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildLinkageRequest(result)),
      signal,
    });
  } catch {
    if (signal?.aborted) throw new RequestCanceledError();
    throw new Error(CONNECTION_ERROR);
  }

  const data: unknown = await response.json().catch(() => null);
  if (signal?.aborted) throw new RequestCanceledError();
  if (!response.ok) throw new Error(readErrorMessage(data) ?? LINKAGE_ERROR);

  const linkage = typeof data === "object" && data !== null && "linkage" in data ? data.linkage : undefined;
  if (!isLinkage(linkage) || linkageProblems(result, linkage).length > 0) throw new Error(LINKAGE_ERROR);
  return linkage;
}
