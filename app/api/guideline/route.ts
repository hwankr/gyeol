import { PREP_LIMITS } from "@/lib/prep/criteria";
import {
  PDF_DAMAGED_ERROR,
  PDF_PARSE_ERROR,
  PDF_PASSWORD_ERROR,
  PDF_TOO_LARGE_ERROR,
  isPdfFile,
  isPdfTooLarge,
} from "@/lib/pdf";
import { AiCallError } from "@/lib/pipeline/claude";
import { generateGuidelineDraft } from "@/lib/pipeline/generateGuidelineDraft";
import { GUIDELINE_NO_TEXT_ERROR, GuidelineNoTextError, readGuidelinePages } from "@/lib/pipeline/guidelineText";

/** 로그 줄 앞에 붙는 이름 */
const LOG_TAG = "api/guideline";

/** 초안 생성에서 예상하지 못한 오류가 났을 때 보여 주는 문구 */
const UNEXPECTED_ERROR = "기준 초안을 만드는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";

/** AI 를 부르기 전에 요청이 이미 취소됐을 때(브라우저가 떠남)의 상태 코드와 문구. 받는 쪽이 없으므로 기록용이다. */
const CANCELED_STATUS = 499;
const CANCELED_ERROR = "요청이 취소되었습니다.";

/**
 * PDF 를 읽지 못한 이유를 넷으로 나눠 정해진 문구만 돌려준다: 글자 없음 / 암호(PasswordException) / 손상(InvalidPDFException) /
 * 그 밖(일반 문구). 오류 객체의 문구는 응답에 싣지 않는다(라이브러리나 예상하지 못한 오류의 문구에 무엇이 들어 있을지 모른다).
 */
function pdfReadErrorMessage(error: unknown): string {
  if (error instanceof GuidelineNoTextError) return GUIDELINE_NO_TEXT_ERROR;
  if (error instanceof Error && error.name === "PasswordException") return PDF_PASSWORD_ERROR;
  if (error instanceof Error && error.name === "InvalidPDFException") return PDF_DAMAGED_ERROR;
  return PDF_PARSE_ERROR;
}

/**
 * POST /api/guideline — multipart/form-data 로 모집요강 PDF(file)와 모집 단위 이름(department)을 받아 평가 기준 초안을 만든다.
 * 아무것도 저장하지 않는다. 요청을 보낸 사람을 확인하지 않는다(인증 없음. 다른 두 API 와 같다).
 * 성공하면 200 { criteria: PrepCriteria | null, changes: [{ title, body }], warnings: string[], pages: { read, total } }.
 * 오류 응답은 모두 { error: "<문구>" } 이다.
 *
 * 확인 순서와 상태 코드
 * 1. 폼을 읽지 못함 → 400
 * 2. 파일: 없음·PDF 아님 → 400, 10MB 초과(정확히 10MB 는 허용) → 413
 * 3. 모집 단위 이름: 없음·문자열 아님·앞뒤 공백을 뺀 길이가 1~50 이 아님 → 400
 * 4. PDF 읽기 실패 → 400 (글자 없음, 손상·암호(lib/pdf.ts 의 문구), 그 밖은 "PDF 를 읽지 못했습니다." — 오류 객체의 문구는 싣지 않는다)
 * 5. AI 를 부르기 직전에 요청이 이미 취소됐으면(브라우저가 떠남) AI 를 부르지 않고 끝낸다(499, 받는 쪽 없음).
 *    이미 AI 호출이 시작된 뒤의 취소는 공용 모듈(lib/pipeline/claude.ts)이 신호를 받지 않아 끝까지(최대 60초) 진행된다.
 * 6. 초안 생성 실패(키 없음, 호출 실패, 60초 초과, 거절, 잘린 응답, 해석 실패) → 502, 그 밖의 예상하지 못한 오류 → 502(일반 문구)
 * 7. 성공 → 200. 정리한 뒤 요소가 0개여도 오류로 만들지 않고 criteria: null 을 돌려준다.
 * 파일 이름은 AI 에 보내지 않고 로그에도 남기지 않는다. 모집요강의 글과 초안 내용도 로그에 남기지 않는다.
 */
export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse(400, "multipart/form-data 형식으로 file 필드에 PDF 파일을 보내 주세요.");
  }

  const file = formData.get("file");
  if (file === null || typeof file === "string") {
    return errorResponse(400, "file 필드에 PDF 파일이 없습니다.");
  }
  if (!isPdfFile(file)) {
    return errorResponse(400, "PDF 파일만 올릴 수 있습니다.");
  }
  if (isPdfTooLarge(file)) {
    return errorResponse(413, PDF_TOO_LARGE_ERROR);
  }

  const rawDepartment = formData.get("department");
  const department = typeof rawDepartment === "string" ? rawDepartment.trim() : "";
  if (department.length < 1 || department.length > PREP_LIMITS.departmentLength) {
    return errorResponse(400, "모집 단위 이름이 올바르지 않습니다.");
  }

  let pages: string[];
  try {
    pages = await readGuidelinePages(await file.arrayBuffer());
  } catch (error) {
    // 원래 원인은 오류 종류만 서버 로그에 남긴다(라이브러리의 문구에 PDF 의 내용이 섞일 수 있어 남기지 않는다).
    if (!(error instanceof GuidelineNoTextError)) {
      console.error(`[${LOG_TAG}] PDF 읽기 실패 (종류 ${error instanceof Error ? error.name : typeof error})`);
    }
    return errorResponse(400, pdfReadErrorMessage(error));
  }

  // 화면을 떠나 브라우저가 요청을 취소했으면(응답을 받을 쪽이 없다) AI 를 부르지 않는다. PDF 읽기 동안 떠난 경우가 여기에 걸린다.
  // PDF 읽기는 Promise 만으로 이어져 그동안 이벤트 루프가 소켓의 끊김(close)을 처리하지 못한다. 확인하기 전에 이벤트 루프를 한 바퀴
  // 돌려 이미 끊긴 연결이 request.signal 에 반영되게 한다.
  await yieldToEventLoop();
  if (request.signal.aborted) {
    console.error(`[${LOG_TAG}] AI 를 부르기 전에 요청이 취소됨`);
    return errorResponse(CANCELED_STATUS, CANCELED_ERROR);
  }

  try {
    const result = await generateGuidelineDraft(department, pages);
    return Response.json(result);
  } catch (error) {
    if (error instanceof AiCallError) {
      return errorResponse(502, error.message);
    }
    // 원인은 서버 로그에 오류 종류와 스택의 위치 줄만 남긴다(오류 문구에 모집요강·초안의 내용이 섞일 수 있어 남기지 않는다).
    console.error(`[${LOG_TAG}] 기준 초안 생성 중 예상하지 못한 오류 (${describeUnexpected(error)})`);
    return errorResponse(502, UNEXPECTED_ERROR);
  }
}

/** 이벤트 루프를 두 바퀴 돌린다(소켓 읽기 → 닫힘 알림까지 처리되게). 기다리는 시간은 거의 없다. */
async function yieldToEventLoop() {
  for (let i = 0; i < 2; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}

/** 로그용 설명: 오류 종류와 스택의 "at …" 줄(문구 줄은 뺀다). */
function describeUnexpected(error: unknown): string {
  if (!(error instanceof Error)) return `종류 ${typeof error}`;
  const frames = (error.stack ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("at "));
  return [`종류 ${error.name}`, ...frames].join("\n  ");
}

function errorResponse(status: number, message: string) {
  return Response.json({ error: message }, { status });
}
