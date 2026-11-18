import type { AnalysisResult, Section } from "@/types/analysis";
import { isPdfFile } from "@/lib/pdf";
import { blind } from "@/lib/pipeline/blind";
import { extractEvidence } from "@/lib/pipeline/extractEvidence";
import { parsePdf } from "@/lib/pipeline/parsePdf";

/** 파서가 던진 오류에 쓸 만한 문구가 없을 때 보여 주는 문구 */
const PARSE_ERROR = "PDF 를 읽지 못했습니다.";

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

  // 파싱 오류(예: 글자가 없는 이미지 PDF)는 파서의 문구를 그대로 업로드 화면에 보여 준다.
  let sections: Section[];
  try {
    sections = await parsePdf(await file.arrayBuffer());
  } catch (error) {
    return errorResponse(error instanceof Error && error.message !== "" ? error.message : PARSE_ERROR);
  }

  const blindedSections = await blind(sections);
  const evidences = await extractEvidence(blindedSections);

  const result: AnalysisResult = { sections: blindedSections, evidences };
  return Response.json(result);
}

function errorResponse(message: string) {
  return Response.json({ error: message }, { status: 400 });
}
