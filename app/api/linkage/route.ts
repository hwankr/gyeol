import { describeErrorForLog } from "@/lib/errorKind";
import { readLinkageRequest } from "@/lib/evaluate/linkage";
import { AiCallError } from "@/lib/pipeline/claude";
import { linkEvidence } from "@/lib/pipeline/linkEvidence";
import { MAX_ANALYZE_BODY_LENGTH } from "@/lib/recordSections";

/** 로그 줄 앞에 붙는 이름 */
const LOG_TAG = "api/linkage";

/** 연결 찾기에서 예상하지 못한 오류가 났을 때 보여 주는 문구 */
const UNEXPECTED_ERROR = "학년별 연계를 만드는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";

/** 본문을 읽지 못했을 때의 문구 */
const BODY_ERROR = "JSON 형식으로 criteria(평가 기준)·sections(학생부 항목)·evidences(근거)를 보내 주세요.";

/** 본문이 한도를 넘을 때의 문구 */
const TOO_LARGE_ERROR = "학생부 내용이 너무 길어 학년별 연계를 만들 수 없습니다.";

/** 요청 확인 실패 문구 */
const REQUEST_ERROR = "평가 기준·학생부 항목·근거가 없거나 형식이 올바르지 않습니다.";

/**
 * POST /api/linkage — 분석이 끝난 학생부의 근거 사이에서 학년별 연계(카드와 연결)를 찾아 돌려준다.
 * 본문은 JSON { criteria: [{ id, name }], sections: [근거가 든 항목(가려진 원문)], evidences: [{ id, criterionId, sectionId, quote }] } 이고
 * 응답은 { linkage: { cards, links } } 다. 브라우저가 분석 결과(/api/analyze 의 응답)에서 본문을 만든다(lib/linkageClient.ts).
 * /api/analyze 는 이 API 를 부르지 않는다(분석의 요청·응답·시간은 그대로다).
 * 오류 응답은 모두 { error: "<문구>" } 이다. 요청을 보낸 사람을 확인하지 않는다(인증 없음. 주소를 아는 누구나 부를 수 있다).
 *
 * 확인 순서와 상태 코드
 * 1. 본문: MAX_ANALYZE_BODY_LENGTH(2,000,000자) 초과 → 413, JSON 객체가 아님 → 400
 * 2. 요청(readLinkageRequest) → 400: 기준 1~6개, 항목·근거의 필드 모양·길이, 근거의 기준·항목이 받은 것 안에 있는지,
 *    인용 구절이 그 항목 원문에 글자 그대로 있는지, 근거가 없는 항목이 섞이지 않았는지.
 * 3. 연결 찾기(linkEvidence: AI 호출 한 번, 60초 제한) 실패 → 502. 근거가 하나도 없으면 AI 를 부르지 않고 빈 연계를 돌려준다
 *    (그때도 키 확인은 먼저 한다).
 * 받은 항목이 가려진 것인지는 서버가 확인하지 못한다. 브라우저에는 /api/analyze 가 돌려준 가려진 항목만 있고 화면은 그것을 보낸다.
 * 학생부 본문·근거·연계의 내용은 로그·오류 문구에 넣지 않는다.
 */
export async function POST(request: Request) {
  let text: string;
  try {
    text = await request.text();
  } catch {
    return errorResponse(400, BODY_ERROR);
  }
  if (text.length > MAX_ANALYZE_BODY_LENGTH) {
    return errorResponse(413, TOO_LARGE_ERROR);
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return errorResponse(400, BODY_ERROR);
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return errorResponse(400, BODY_ERROR);
  }

  const linkageRequest = readLinkageRequest(body);
  if (linkageRequest === null) {
    return errorResponse(400, REQUEST_ERROR);
  }

  try {
    const linkage = await linkEvidence(linkageRequest);
    return Response.json({ linkage });
  } catch (error) {
    // AI 호출 실패(AiCallError)면 그 화면 문구로 502. 판별하다 예외가 나면(이상한 오류 객체) 예상하지 못한 오류로 다룬다.
    const aiMessage = aiCallErrorMessage(error);
    if (aiMessage !== null) {
      return errorResponse(502, aiMessage);
    }
    // 화면에는 일반 문구를 보여 주고, 서버 로그에는 오류 종류만 남긴다(오류 문구·스택·오류 객체는 남기지 않는다. describeErrorForLog).
    console.error(`[${LOG_TAG}] 연결 찾기 중 예상하지 못한 오류 (${describeErrorForLog(error)})`);
    return errorResponse(502, UNEXPECTED_ERROR);
  }
}

/** AiCallError 면 그 화면 문구(문자열일 때)를, 아니면 null 을 돌려준다. 판별하거나 읽다가 예외가 나도 null(예외를 던지지 않는다) */
function aiCallErrorMessage(error: unknown): string | null {
  try {
    if (!(error instanceof AiCallError)) return null;
    const message: unknown = error.message;
    return typeof message === "string" ? message : null;
  } catch {
    return null;
  }
}

function errorResponse(status: number, message: string) {
  return Response.json({ error: message }, { status });
}
