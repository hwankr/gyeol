import type { AnalysisResult, DepartmentCriteria } from "@/types/analysis";
import { MAX_PREP_CRITERIA_FIELD_LENGTH } from "@/lib/criteria/limits";
import { checkDepartmentCriteria } from "@/lib/criteria/normalize";
import { describeErrorForLog } from "@/lib/errorKind";
import { withEvidenceConfidence } from "@/lib/evaluate/assessment";
import { assessRecord } from "@/lib/pipeline/assessRecord";
import { blind } from "@/lib/pipeline/blind";
import { AiCallError } from "@/lib/pipeline/claude";
import { extractEvidence } from "@/lib/pipeline/extractEvidence";
import { prepAnalysisCriteria } from "@/lib/prep/analysisCriteria";
import { parsePrepCriteria, type PrepCriteria } from "@/lib/prep/criteria";
import { MAX_ANALYZE_BODY_LENGTH, readRecordSections } from "@/lib/recordSections";

/** 로그 줄 앞에 붙는 이름 */
const LOG_TAG = "api/analyze";

/** 블라인드 처리·근거 추출·AI 제안에서 예상하지 못한 오류가 났을 때 보여 주는 문구 */
const UNEXPECTED_ERROR = "분석 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";

/** 본문을 읽지 못했을 때의 문구 */
const BODY_ERROR = "JSON 형식으로 sections(학생부 항목)와 prepCriteria(평가 기준)를 보내 주세요.";

/** 본문이 한도를 넘을 때의 문구 */
const TOO_LARGE_ERROR = "학생부 내용이 너무 길어 분석할 수 없습니다.";

/** 학생부 항목 확인 실패 문구 */
const SECTIONS_ERROR = "학생부 항목이 없거나 형식이 올바르지 않습니다.";

/** 평가 기준 확인 실패 문구 */
const CRITERIA_ERRORS = {
  missing: "평가 기준이 없습니다. prepCriteria 필드에 전형 준비의 평가 기준을 보내 주세요.",
  invalid: "평가 기준 형식이 올바르지 않습니다.",
} as const;

/**
 * POST /api/analyze — 학생부 항목 목록을 받아 분석 결과(AnalysisResult)를 돌려준다.
 * 학생부 PDF 는 받지 않는다. PDF 는 학생부 올리기 화면이 브라우저에서 읽고(lib/recordPdf.ts. 글자가 없는 쪽은 /api/record-page 가 읽는다)
 * 읽은 항목만 보낸다. 그래서 큰 PDF 도 배포 환경의 요청 본문 한도(4.5MB)에 걸리지 않는다.
 * 본문은 JSON { sections: 학생부 항목 목록(가리기 전), prepCriteria: 전형 준비의 평가 기준(PrepCriteria) } 이다.
 * 오류 응답은 모두 { error: "<문구>" } 이다. 요청을 보낸 사람을 확인하지 않는다(인증 없음. 주소를 아는 누구나 부를 수 있다).
 *
 * 확인 순서와 상태 코드
 * 1. 본문: MAX_ANALYZE_BODY_LENGTH(2,000,000자) 초과 → 413, JSON 객체가 아님 → 400
 * 2. 학생부 항목(readRecordSections) → 400: 배열이 아님, 0개·400개 초과, 항목의 필드 모양·길이가 맞지 않음, 원문 합 400,000자 초과.
 *    받은 id 는 쓰지 않고 순서대로 s1… 을 새로 준다.
 * 3. 평가 기준 → 400: prepCriteria 가 없음, JSON 으로 적어 150,000자 초과, 평가 기준 형식(parsePrepCriteria)이 아님.
 *    받은 평가 기준으로 분석 기준(prepAnalysisCriteria: id "prep", 요소마다 c1… 이름·설명)을 만들어
 *    기준 검증(checkDepartmentCriteria: 1~6개, 이름 30자·설명 300자)을 거친다.
 * 4. 블라인드 처리(blind: 이름·학교명 등 식별 정보 가리기) → 근거 추출과 AI 제안(assessRecord)을 같이 부른다
 *    (서로를 기다리지 않고 동시에 나간다). 둘 중 하나라도 실패 → 502,
 *    블라인드 처리·근거 추출·AI 제안 중 예상하지 못한 오류 → 502(일반 문구. 서버 로그에는 단계와 오류 종류만)
 * 근거 추출·AI 제안과 응답에는 가려진 항목만 쓴다. 가리기 전 항목은 응답·로그·오류 문구·근거 추출과 AI 제안의 요청에 넣지 않는다.
 * 응답은 { criteria, sections(가려진 항목), evidences, masks(블라인드 처리 내역), assessment(AI 제안: 요소별 점수·신뢰도·태그,
 * 한 줄 요약, 학년별 성장) } 이다. AI 에 보낼 항목(서술형 항목, 교과 성적)이 하나도 없으면 assessment 가 없다.
 * 근거 추출에는 분석 기준(요소 이름과 설명)을, AI 제안에는 평가 요소의 이름·묶음 이름·질문을 보낸다. 배점은 AI 에 보내지 않는다.
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

  // 가리기 전 항목은 blind 에 넘기는 데만 쓴다. 이름·학교명이 응답·로그·AI 요청에 실리지 않게 이 변수는 아래 blind 호출 말고는 쓰지 않는다.
  const unmaskedSections = readRecordSections("sections" in body ? body.sections : undefined);
  if (unmaskedSections === null) {
    return errorResponse(400, SECTIONS_ERROR);
  }

  const criteriaResult = readCriteria("prepCriteria" in body ? body.prepCriteria : undefined);
  if (!criteriaResult.ok) {
    return errorResponse(400, criteriaResult.message);
  }
  const { criteria, prep } = criteriaResult;

  // 예상하지 못한 오류가 났을 때 어느 단계였는지 로그에 남기려고 지금 하는 호출을 기억한다(오류 내용에서 읽지 않는다).
  let stage: "블라인드 처리" | "근거 추출·AI 제안" = "블라인드 처리";
  try {
    // 이 아래(근거 추출·AI 제안·응답)에서는 blind 가 돌려준 가려진 항목만 쓴다.
    const { sections, masks } = blind(unmaskedSections);
    // 근거 추출과 AI 제안을 동시에 부른다(각각 60초 제한이라 기다리는 시간은 둘 중 긴 쪽이다).
    // 하나라도 실패하면 분석 전체가 실패한다(근거만 있는 결과는 평가하기 화면에서 쓰지 못한다).
    stage = "근거 추출·AI 제안";
    const [evidences, assessment] = await Promise.all([
      extractEvidence(sections, criteria),
      assessRecord(sections, prep, criteria.criteria),
    ]);
    const result: AnalysisResult =
      assessment === null
        ? { criteria, sections, evidences, masks }
        : { criteria, sections, evidences, masks, assessment: withEvidenceConfidence(assessment, evidences) };
    return Response.json(result);
  } catch (error) {
    // AI 호출 실패(AiCallError)면 그 화면 문구로 502. 판별하다 예외가 나면(이상한 오류 객체) 예상하지 못한 오류로 다룬다.
    const aiMessage = aiCallErrorMessage(error);
    if (aiMessage !== null) {
      return errorResponse(502, aiMessage);
    }
    // 화면에는 일반 문구를 보여 주고, 서버 로그에는 단계와 오류 종류만 남긴다(오류 문구·스택·오류 객체는 남기지 않는다. describeErrorForLog).
    console.error(`[${LOG_TAG}] 블라인드 처리·근거 추출·AI 제안 중 예상하지 못한 오류 (단계 ${stage}, ${describeErrorForLog(error)})`);
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

/**
 * 분석에 쓸 평가 기준을 읽는다. 받은 값은 전형 준비의 평가 기준(PrepCriteria) 객체다.
 * JSON 으로 적은 길이가 MAX_PREP_CRITERIA_FIELD_LENGTH 를 넘으면 형식 오류로 본다.
 * 저장 값과 같은 확인(parsePrepCriteria)을 통과해야 하고, 그 값으로 분석 기준을 만든다(prepAnalysisCriteria → checkDepartmentCriteria).
 * 만든 분석 기준의 기준 수가 요소 수와 다르면(정리에서 빠진 기준이 있으면) 형식 오류로 본다(요소와 기준은 순서로 짝을 짓는다).
 * 돌려주는 것: criteria(근거 추출에 쓰는 분석 기준. 응답에도 싣는다)와 prep(AI 제안에 쓰는 평가 기준).
 */
function readCriteria(
  value: unknown,
): { ok: true; criteria: DepartmentCriteria; prep: PrepCriteria } | { ok: false; message: string } {
  if (value === undefined || value === null) return { ok: false, message: CRITERIA_ERRORS.missing };
  if (JSON.stringify(value).length > MAX_PREP_CRITERIA_FIELD_LENGTH) {
    return { ok: false, message: CRITERIA_ERRORS.invalid };
  }
  const prep = parsePrepCriteria(value);
  if (prep === null) return { ok: false, message: CRITERIA_ERRORS.invalid };
  const check = checkDepartmentCriteria(prepAnalysisCriteria(prep));
  if (!check.ok || check.value.criteria.length !== prep.elements.length) {
    return { ok: false, message: CRITERIA_ERRORS.invalid };
  }
  return { ok: true, criteria: check.value, prep };
}

function errorResponse(status: number, message: string) {
  return Response.json({ error: message }, { status });
}
