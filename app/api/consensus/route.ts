import { MAX_PREP_CRITERIA_FIELD_LENGTH } from "@/lib/criteria/limits";
import { AiCallError } from "@/lib/pipeline/claude";
import { generateConsensusDraft } from "@/lib/pipeline/generateConsensusDraft";
import { CONSENSUS_LIMITS, parseConsensusOpinions } from "@/lib/prep/consensusDraft";
import { parsePrepCriteria } from "@/lib/prep/criteria";

/** 로그 줄 앞에 붙는 이름 */
const LOG_TAG = "api/consensus";

/** 초안 생성에서 예상하지 못한 오류가 났을 때 보여 주는 문구 */
const UNEXPECTED_ERROR = "공통 기준 초안을 만드는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";

/** AI 를 부르기 전에 요청이 이미 취소됐을 때(브라우저가 떠남)의 상태 코드와 문구. 받는 쪽이 없으므로 기록용이다. */
const CANCELED_STATUS = 499;
const CANCELED_ERROR = "요청이 취소되었습니다.";

/**
 * 요청 본문(JSON 문자열)의 최대 길이: 평가 기준 한도(/api/analyze 의 prepCriteria 와 같은 150,000자)에
 * 의견(6건 × 1,000자)과 JSON 의 따옴표·이스케이프를 넉넉하게 더한 값.
 */
const MAX_BODY_LENGTH = MAX_PREP_CRITERIA_FIELD_LENGTH + 20_000;

const BODY_ERROR = "JSON 형식으로 criteria(평가 기준)와 opinions(위원 의견)를 보내 주세요.";
const CRITERIA_ERROR = "평가 기준 형식이 올바르지 않습니다.";
const OPINIONS_ERROR = `위원 의견 형식이 올바르지 않습니다. 의견은 1~${CONSENSUS_LIMITS.members}건, 한 건 ${CONSENSUS_LIMITS.opinionLength.toLocaleString("ko-KR")}자 이하로 보내 주세요.`;
const TOO_LARGE_ERROR = "요청이 너무 큽니다.";

/**
 * POST /api/consensus — JSON 으로 지금 평가 기준(criteria: PrepCriteria)과 위원 의견(opinions: [{ member, role, text }])을 받아
 * 위원 의견을 모은 공통 기준 초안을 만든다. 아무것도 저장하지 않는다. 요청을 보낸 사람을 확인하지 않는다(인증 없음. 다른 API 와 같다).
 * 성공하면 200 { criteria: PrepCriteria, points: [{ kind, title, body }], warnings: string[] }.
 * 오류 응답은 모두 { error: "<문구>" } 이다.
 *
 * 확인 순서와 상태 코드
 * 1. 본문: 읽지 못함·JSON 아님·객체 아님 → 400, 170,000자 초과 → 413
 * 2. 평가 기준: 저장 값 확인(parsePrepCriteria)을 통과하지 못함 → 400
 * 3. 위원 의견: 1~6건의 배열이 아님, 위원 번호(1~6 정수, 서로 다름)·역할(1~20자)·의견(1~1,000자)에서 벗어남 → 400
 * 4. AI 를 부르기 직전에 요청이 이미 취소됐으면 AI 를 부르지 않고 끝낸다(499, 받는 쪽 없음).
 * 5. 초안 생성 실패(키 없음, 호출 실패, 60초 초과, 거절, 잘린 응답, 해석 실패) → 502, 그 밖의 예상하지 못한 오류 → 502(일반 문구)
 * 6. 성공 → 200. 공통 기준의 요소(id·이름·순서)는 받은 평가 기준과 같고 세부 평가 항목과 배점만 다를 수 있다.
 * 위원의 이름은 받지도 AI 에 보내지도 않는다(위원 번호만 쓴다). 의견의 글과 초안 내용은 로그에 남기지 않는다.
 */
export async function POST(request: Request) {
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return errorResponse(400, BODY_ERROR);
  }
  if (raw.length > MAX_BODY_LENGTH) {
    return errorResponse(413, TOO_LARGE_ERROR);
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return errorResponse(400, BODY_ERROR);
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return errorResponse(400, BODY_ERROR);
  }
  const record = body as Record<string, unknown>;

  const criteria = parsePrepCriteria(record.criteria);
  if (criteria === null) {
    return errorResponse(400, CRITERIA_ERROR);
  }
  const opinions = parseConsensusOpinions(record.opinions);
  if (opinions === null) {
    return errorResponse(400, OPINIONS_ERROR);
  }

  // 화면을 떠나 브라우저가 요청을 취소했으면(응답을 받을 쪽이 없다) AI 를 부르지 않는다.
  if (request.signal.aborted) {
    console.error(`[${LOG_TAG}] AI 를 부르기 전에 요청이 취소됨`);
    return errorResponse(CANCELED_STATUS, CANCELED_ERROR);
  }

  try {
    const result = await generateConsensusDraft(criteria, opinions);
    return Response.json(result);
  } catch (error) {
    if (error instanceof AiCallError) {
      return errorResponse(502, error.message);
    }
    // 원인은 서버 로그에 오류 종류만 남긴다(오류 문구에 의견·초안의 내용이 섞일 수 있어 남기지 않는다).
    console.error(
      `[${LOG_TAG}] 공통 기준 초안 생성 중 예상하지 못한 오류 (종류 ${error instanceof Error ? error.name : typeof error})`,
    );
    return errorResponse(502, UNEXPECTED_ERROR);
  }
}

function errorResponse(status: number, message: string) {
  return Response.json({ error: message }, { status });
}
