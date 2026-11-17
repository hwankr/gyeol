import type { AnalysisResult } from "@/types/analysis";
import { isPdfFile } from "@/lib/pdf";
import { blind } from "@/lib/pipeline/blind";
import { extractEvidence } from "@/lib/pipeline/extractEvidence";
import { parsePdf } from "@/lib/pipeline/parsePdf";

/** 가짜 처리 시간(ms). 실제 분석이 오래 걸리는 상황을 흉내 낼 뿐, 실제로 하는 일은 없다. */
const FAKE_DELAY_MS = 1500;

/** POST /api/analyze — multipart/form-data 의 file 필드로 학생부 PDF 를 받아 분석 결과를 돌려준다. */
export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse("multipart/form-data 형식으로 file 필드에 PDF 파일을 보내 주세요.");
  }

  const file = formData.get("file");
  if (file === null || typeof file === "string") {
    return errorResponse("file 필드에 PDF 파일이 없습니다.");
  }
  if (!isPdfFile(file)) {
    return errorResponse("PDF 파일만 분석할 수 있습니다.");
  }

  // 가짜 지연: 지금은 파일 내용을 읽지 않으며, 1.5초 기다리는 것은 화면의 "분석 중…" 상태를 확인하기 위한 것이다.
  await new Promise((resolve) => setTimeout(resolve, FAKE_DELAY_MS));

  const sections = await parsePdf(file);
  const blindedSections = await blind(sections);
  const evidences = await extractEvidence(blindedSections);

  const result: AnalysisResult = { sections: blindedSections, evidences };
  return Response.json(result);
}

function errorResponse(message: string) {
  return Response.json({ error: message }, { status: 400 });
}
