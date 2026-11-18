import { createHash, timingSafeEqual } from "node:crypto";
import type { AnalysisResult, Section } from "@/types/analysis";
import { findDepartmentCriteria } from "@/lib/criteria";
import { PDF_TOO_LARGE_ERROR, describePdfParseError, isPdfFile, isPdfTooLarge } from "@/lib/pdf";
import { blind } from "@/lib/pipeline/blind";
import { EvidenceExtractionError, extractEvidence } from "@/lib/pipeline/extractEvidence";
import { parsePdf } from "@/lib/pipeline/parsePdf";

/** 근거 추출에서 예상하지 못한 오류가 났을 때 보여 주는 문구 */
const UNEXPECTED_ERROR = "분석 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";

/**
 * POST /api/analyze — multipart/form-data 로 학생부 PDF 를 받아 분석 결과(AnalysisResult)를 돌려준다.
 * 필드: file(PDF), criteriaId(학과 기준 id), accessCode(접속 코드). 오류 응답은 모두 { error: "<문구>" } 이다.
 *
 * 확인 순서와 상태 코드
 * 1. 폼을 읽지 못함 → 400
 * 2. 접속 코드: 서버에 ACCESS_CODE 가 없음 → 500, 보낸 코드가 없거나 다름 → 401 (파일 처리·AI 호출보다 먼저)
 * 3. 파일: 없음·PDF 아님 → 400, 10MB 초과 → 413
 * 4. 학과 기준(criteriaId)이 없거나 목록에 없음 → 400
 * 5. PDF 파싱 실패 → 400 (한국어 문구. 파서의 한국어 안내는 그대로, PDF 라이브러리의 영어 오류는 한국어로 바꿈)
 * 6. blind → 근거 추출. 근거 추출 실패 → 502
 */
export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse(400, "multipart/form-data 형식으로 file 필드에 PDF 파일을 보내 주세요.");
  }

  // 공개 주소에서 아무나 AI 호출 비용을 쓰지 못하게, 파일을 읽거나 AI 를 부르기 전에 접속 코드부터 확인한다.
  const expectedCode = (process.env.ACCESS_CODE ?? "").trim();
  if (expectedCode === "") {
    console.error("[api/analyze] ACCESS_CODE 가 설정되지 않아 요청을 거부함");
    return errorResponse(500, "서버에 접속 코드(ACCESS_CODE)가 설정되지 않았습니다.");
  }
  const sentCode = formData.get("accessCode");
  if (typeof sentCode !== "string" || !isSameCode(sentCode.trim(), expectedCode)) {
    return errorResponse(401, "접속 코드가 올바르지 않습니다.");
  }

  const file = formData.get("file");
  if (file === null || typeof file === "string") {
    return errorResponse(400, "file 필드에 PDF 파일이 없습니다.");
  }
  if (!isPdfFile(file)) {
    return errorResponse(400, "PDF 파일만 분석할 수 있습니다.");
  }
  if (isPdfTooLarge(file)) {
    return errorResponse(413, PDF_TOO_LARGE_ERROR);
  }

  const criteriaId = formData.get("criteriaId");
  const criteria = typeof criteriaId === "string" ? findDepartmentCriteria(criteriaId) : undefined;
  if (criteria === undefined) {
    return errorResponse(400, "학과를 선택해 주세요.");
  }

  // 파싱 오류는 한국어 문구로 업로드 화면에 보여 준다. 파서의 한국어 안내(예: 글자가 없는 이미지 PDF)는 그대로,
  // PDF 라이브러리의 영어 오류(손상된 PDF, 암호가 걸린 PDF 등)는 한국어 문구로 바꾼다.
  let sections: Section[];
  try {
    sections = await parsePdf(await file.arrayBuffer());
  } catch (error) {
    const message = describePdfParseError(error);
    // 문구를 바꿨다면 원래 원인(오류 종류와 라이브러리의 문구)은 서버 로그에 남긴다.
    if (!(error instanceof Error) || error.message !== message) {
      console.error(
        `[api/analyze] PDF 파싱 실패 (${error instanceof Error ? `${error.name}: ${error.message}` : typeof error})`,
      );
    }
    return errorResponse(400, message);
  }

  try {
    const blindedSections = await blind(sections);
    const evidences = await extractEvidence(blindedSections, criteria);
    const result: AnalysisResult = { criteria, sections: blindedSections, evidences };
    return Response.json(result);
  } catch (error) {
    if (error instanceof EvidenceExtractionError) {
      return errorResponse(502, error.message);
    }
    // 원인은 서버 로그에만 남기고 화면에는 일반 문구를 보여 준다.
    console.error("[api/analyze] 근거 추출 중 예상하지 못한 오류", error);
    return errorResponse(502, UNEXPECTED_ERROR);
  }
}

/**
 * 접속 코드 비교. 걸리는 시간으로 코드를 짐작하지 못하게 timingSafeEqual 로 비교한다.
 * 길이가 달라도 예외 없이 false 가 되도록 양쪽을 SHA-256 으로 같은 길이로 만든 뒤 비교한다.
 */
function isSameCode(sent: string, expected: string): boolean {
  const sentHash = createHash("sha256").update(sent, "utf8").digest();
  const expectedHash = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(sentHash, expectedHash);
}

function errorResponse(status: number, message: string) {
  return Response.json({ error: message }, { status });
}
