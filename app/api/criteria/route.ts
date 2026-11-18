import { MAX_DEPARTMENT_NAME_LENGTH, MAX_SOURCE_TEXT_LENGTH } from "@/lib/criteria/limits";
import { AiCallError } from "@/lib/pipeline/claude";
import { generateCriteria } from "@/lib/pipeline/generateCriteria";

/** 로그 줄 앞에 붙는 이름 */
const LOG_TAG = "api/criteria";

/** 본문을 JSON 객체로 읽지 못했을 때 보여 주는 문구 */
const INVALID_BODY_ERROR = "JSON 형식으로 department, sourceText 를 보내 주세요.";

/** 기준 생성에서 예상하지 못한 오류가 났을 때 보여 주는 문구 */
const UNEXPECTED_ERROR = "기준을 만드는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";

/**
 * POST /api/criteria — 학과 이름과 학과가 보고 싶은 점을 적은 문장으로 평가 기준 초안을 만든다. 아무것도 저장하지 않는다.
 * 본문: JSON { department, sourceText }. 성공하면 { criteria: [{ id, name, description }], warnings: string[] }.
 * 오류 응답은 모두 { error: "<문구>" } 이다. 요청을 보낸 사람을 확인하지 않는다(인증 없음. 주소를 아는 누구나 부를 수 있다).
 *
 * 확인 순서와 상태 코드
 * 1. 본문을 JSON 객체로 읽지 못함 → 400
 * 2. 입력: 학과 이름이 없음·50자 초과, 문장이 없음·2,000자 초과(앞뒤 공백을 뺀 길이) → 400. 조용히 잘라서 보내지 않는다.
 * 3. 기준 생성 실패(키 없음, 호출 실패, 60초 초과, 거절, 잘린 응답, 해석 실패) → 502
 * 4. 성공 → 200. 검증 뒤 기준이 0개여도(문장 전체가 제외 대상인 경우 등) 오류로 만들지 않고 criteria: [] 와 warnings 를 돌려준다.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, INVALID_BODY_ERROR);
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return errorResponse(400, INVALID_BODY_ERROR);
  }
  const { department, sourceText } = body as Record<string, unknown>;

  const trimmedDepartment = typeof department === "string" ? department.trim() : "";
  if (trimmedDepartment === "") {
    return errorResponse(400, "학과 이름을 입력해 주세요.");
  }
  if (trimmedDepartment.length > MAX_DEPARTMENT_NAME_LENGTH) {
    return errorResponse(400, "학과 이름은 50자 이하로 입력해 주세요.");
  }
  const trimmedSourceText = typeof sourceText === "string" ? sourceText.trim() : "";
  if (trimmedSourceText === "") {
    return errorResponse(400, "학과가 보고 싶은 점을 문장으로 입력해 주세요.");
  }
  if (trimmedSourceText.length > MAX_SOURCE_TEXT_LENGTH) {
    return errorResponse(400, "문장은 2,000자 이하로 입력해 주세요.");
  }

  try {
    const result = await generateCriteria(trimmedDepartment, trimmedSourceText);
    return Response.json(result);
  } catch (error) {
    if (error instanceof AiCallError) {
      return errorResponse(502, error.message);
    }
    // 원인은 서버 로그에만 남기고 화면에는 일반 문구를 보여 준다.
    console.error(`[${LOG_TAG}] 기준 생성 중 예상하지 못한 오류`, error);
    return errorResponse(502, UNEXPECTED_ERROR);
  }
}

function errorResponse(status: number, message: string) {
  return Response.json({ error: message }, { status });
}
