import { describeErrorForLog } from "@/lib/errorKind";
import { AiCallError } from "@/lib/pipeline/claude";
import { readRecordPage } from "@/lib/pipeline/readRecordPage";
import { MAX_PAGE_IMAGE_BASE64_LENGTH, MAX_PAGE_TEXT_LENGTH, isJpegBase64 } from "@/lib/recordSections";

/** 로그 줄 앞에 붙는 이름 */
const LOG_TAG = "api/record-page";

/** 본문을 읽지 못했거나 image 가 없을 때의 문구 */
const BODY_ERROR = "JSON 형식으로 image 필드에 쪽 그림(JPEG, base64)을 보내 주세요.";

/** 그림이 한도를 넘을 때의 문구 */
const TOO_LARGE_ERROR = "쪽 그림이 너무 큽니다.";

/** text 가 문자열이 아니거나 한도를 넘을 때의 문구 */
const TEXT_ERROR = "text 필드(쪽에서 뽑은 글자)의 형식이 올바르지 않습니다.";

/** 예상하지 못한 오류가 났을 때 보여 주는 문구 */
const UNEXPECTED_ERROR = "이미지로 된 쪽을 읽는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";

/**
 * POST /api/record-page — 학생부에서 글자가 없는 쪽(스캔본, 쪽 전체가 그림인 PDF)의 그림 한 장을 받아, AI 가 그 쪽의 기록을
 * 항목별로 옮겨 적은 결과를 돌려준다. 학생부 올리기 화면이 이미지 쪽마다 한 번씩 부른다(lib/analyzeClient.ts).
 * 글자는 있는데 파서가 양식을 알아보지 못한 학생부도 쪽마다 이 API 로 읽는다(그 쪽에서 뽑은 글자를 text 로 함께 보낸다).
 * 본문은 JSON { image: "<JPEG 를 base64 로 적은 문자열>", text?: "<그 쪽의 PDF 에서 뽑은 글자>" } 이다.
 * 쪽 하나씩 보내므로 배포 환경의 본문 한도(4.5MB)에 걸리지 않는다.
 * 오류 응답은 모두 { error: "<문구>" } 이다. 요청을 보낸 사람을 확인하지 않는다(인증 없음. 주소를 아는 누구나 부를 수 있다).
 *
 * 확인 순서와 상태 코드
 * 1. 본문이 JSON 객체가 아니거나 image 가 문자열이 아님 → 400
 * 2. image 가 MAX_PAGE_IMAGE_BASE64_LENGTH(4,000,000자)를 넘음 → 413
 * 3. image 가 base64 로 적은 JPEG 가 아님 → 400
 * 4. text 가 있는데 문자열이 아니거나 MAX_PAGE_TEXT_LENGTH(20,000자)를 넘음 → 400 (공백만 있으면 없는 것으로 본다)
 * 5. AI 호출 실패(키 없음, 시간 초과, 거절 등) → 502 (lib/pipeline/claude.ts 의 화면 문구), 그 밖의 예상하지 못한 오류 → 502(일반 문구)
 * 응답은 { sections: [{ fieldId, category, grade, subject, hours, text, continued }] } 이다(lib/recordSections.ts 의 PageSection.
 * fieldId 는 학생부 서식(lib/recordForm.ts)의 칸이고 category 는 그 칸의 항목명이다). 옮길 기록이 없는 쪽은 빈 배열.
 * 응답의 글은 가리기 전 원문이다(보낸 브라우저가 이미 가진 내용). 블라인드 처리는 항목을 모아 보내는 /api/analyze 에서 한다.
 * 아무것도 저장하지 않고, 로그에는 개수·시간·토큰 수·오류 종류만 남긴다(그림과 옮겨 적은 글은 남기지 않는다).
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, BODY_ERROR);
  }
  if (typeof body !== "object" || body === null || !("image" in body) || typeof body.image !== "string") {
    return errorResponse(400, BODY_ERROR);
  }
  const { image } = body;
  if (image.length > MAX_PAGE_IMAGE_BASE64_LENGTH) {
    return errorResponse(413, TOO_LARGE_ERROR);
  }
  if (!isJpegBase64(image)) {
    return errorResponse(400, BODY_ERROR);
  }
  const pageText = "text" in body ? body.text : undefined;
  if (pageText !== undefined && (typeof pageText !== "string" || pageText.length > MAX_PAGE_TEXT_LENGTH)) {
    return errorResponse(400, TEXT_ERROR);
  }

  try {
    const sections = await readRecordPage(image, pageText === undefined || pageText.trim() === "" ? null : pageText);
    return Response.json({ sections });
  } catch (error) {
    if (error instanceof AiCallError) {
      return errorResponse(502, error.message);
    }
    // 화면에는 일반 문구를 보여 주고, 서버 로그에는 오류 종류만 남긴다(오류 문구·스택·오류 객체는 남기지 않는다).
    console.error(`[${LOG_TAG}] 이미지 쪽을 읽는 중 예상하지 못한 오류 (${describeErrorForLog(error)})`);
    return errorResponse(502, UNEXPECTED_ERROR);
  }
}

function errorResponse(status: number, message: string) {
  return Response.json({ error: message }, { status });
}
