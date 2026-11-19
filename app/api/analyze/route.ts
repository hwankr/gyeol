import type { AnalysisResult, DepartmentCriteria, Section } from "@/types/analysis";
import { findDepartmentCriteria } from "@/lib/criteria";
import { MAX_CRITERIA_FIELD_LENGTH } from "@/lib/criteria/limits";
import { checkDepartmentCriteria } from "@/lib/criteria/normalize";
import { PDF_TOO_LARGE_ERROR, describePdfParseError, isPdfFile, isPdfTooLarge } from "@/lib/pdf";
import { blind } from "@/lib/pipeline/blind";
import { AiCallError } from "@/lib/pipeline/claude";
import { extractEvidence } from "@/lib/pipeline/extractEvidence";
import { parsePdf } from "@/lib/pipeline/parsePdf";

/** 로그 줄 앞에 붙는 이름 */
const LOG_TAG = "api/analyze";

/** 블라인드 처리·근거 추출에서 예상하지 못한 오류가 났을 때 보여 주는 문구 */
const UNEXPECTED_ERROR = "분석 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";

/** 학과 기준 확인 실패 문구 */
const CRITERIA_ERRORS = {
  missing: "학과를 선택해 주세요.",
  both: "criteriaId 와 criteria 중 하나만 보내 주세요.",
  invalid: "학과 기준 형식이 올바르지 않습니다.",
  noCriteria: "평가 기준이 없습니다. 기준을 1개 이상 넣어 주세요.",
} as const;

/**
 * POST /api/analyze — multipart/form-data 로 학생부 PDF 를 받아 분석 결과(AnalysisResult)를 돌려준다.
 * 필드: file(PDF), criteriaId(코드에 적힌 학과 기준 id) 또는 criteria(저장한 학과의 DepartmentCriteria JSON 문자열) 중 하나.
 * 오류 응답은 모두 { error: "<문구>" } 이다. 요청을 보낸 사람을 확인하지 않는다(인증 없음. 주소를 아는 누구나 부를 수 있다).
 *
 * 확인 순서와 상태 코드
 * 1. 폼을 읽지 못함 → 400
 * 2. 파일: 없음·PDF 아님 → 400, 10MB 초과 → 413
 * 3. 학과 기준 → 400: 둘 다 없음, 둘 다 있음, criteriaId 가 목록에 없음,
 *    criteria 가 문자열이 아님·20,000자 초과·JSON 아님·형식이 틀림·기준 0개
 *    criteria 는 기준 생성과 같은 검증(normalizeCriteria: 1~6개, 이름 30자·설명 300자, id c1…)으로 정리해 쓴다.
 * 4. PDF 파싱 실패 → 400 (한국어 문구. 파서의 안내 문구(글자가 없는 PDF)만 그대로, 손상된 PDF·암호가 걸린 PDF 는 고정 문구,
 *    그 밖에는 일반 문구. 서버 로그에는 항상 한 줄, 오류 종류만(목록에 있는 이름 또는 "알 수 없음") 남긴다)
 * 5. 블라인드 처리(blind: 이름·학교명 등 식별 정보 가리기) → 근거 추출. 근거 추출 실패 → 502,
 *    블라인드 처리·근거 추출 중 예상하지 못한 오류 → 502(일반 문구. 서버 로그에는 단계와 오류 종류만)
 * 근거 추출과 응답에는 가려진 항목만 쓴다. 가리기 전 항목은 응답·로그·오류 문구·AI 요청에 넣지 않는다.
 * 응답은 { criteria, sections(가려진 항목), evidences, masks(블라인드 처리 내역) } 이다.
 * 근거 추출은 받은 기준을 그대로 쓴다. 기준을 다시 만들지 않고(generateCriteria 를 부르지 않는다) sourceText 를 AI 에 보내지 않는다.
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
    return errorResponse(400, "PDF 파일만 분석할 수 있습니다.");
  }
  if (isPdfTooLarge(file)) {
    return errorResponse(413, PDF_TOO_LARGE_ERROR);
  }

  const criteriaResult = readCriteria(formData.get("criteriaId"), formData.get("criteria"));
  if (!criteriaResult.ok) {
    return errorResponse(400, criteriaResult.message);
  }
  const criteria = criteriaResult.value;

  // 파싱 오류는 한국어 문구로 업로드 화면에 보여 준다(describePdfParseError). 파서의 안내 문구(글자가 없는 이미지 PDF)만 그대로,
  // PDF 라이브러리의 오류(손상된 PDF, 암호가 걸린 PDF)는 종류에 따른 한국어 고정 문구, 그 밖에는 일반 문구로 바꾼다.
  // 가리기 전 항목은 blind 에 넘기는 데만 쓴다. 이름·학교명이 응답·로그·AI 요청에 실리지 않게 이 변수는 아래 blind 호출 말고는 쓰지 않는다.
  let unmaskedSections: Section[];
  try {
    unmaskedSections = await parsePdf(await file.arrayBuffer());
  } catch (error) {
    // 파싱이 실패하면 항상 한 줄 남긴다. 오류 종류만 남기고 오류 문구·스택은 읽지도 남기지도 않는다(describeErrorForLog).
    // describePdfParseError 와 describeErrorForLog 는 어떤 값에도 예외를 던지지 않는다.
    console.error(`[${LOG_TAG}] PDF 파싱 실패 (${describeErrorForLog(error)})`);
    return errorResponse(400, describePdfParseError(error));
  }

  // 예상하지 못한 오류가 났을 때 어느 단계였는지 로그에 남기려고 지금 하는 호출을 기억한다(오류 내용에서 읽지 않는다).
  let stage: "블라인드 처리" | "근거 추출" = "블라인드 처리";
  try {
    // 이 아래(근거 추출·응답)에서는 blind 가 돌려준 가려진 항목만 쓴다.
    const { sections, masks } = blind(unmaskedSections);
    stage = "근거 추출";
    const evidences = await extractEvidence(sections, criteria);
    const result: AnalysisResult = { criteria, sections, evidences, masks };
    return Response.json(result);
  } catch (error) {
    // AI 호출 실패(AiCallError)면 그 화면 문구로 502. 판별하다 예외가 나면(이상한 오류 객체) 예상하지 못한 오류로 다룬다.
    const aiMessage = aiCallErrorMessage(error);
    if (aiMessage !== null) {
      return errorResponse(502, aiMessage);
    }
    // 화면에는 일반 문구를 보여 주고, 서버 로그에는 단계와 오류 종류만 남긴다(오류 문구·스택·오류 객체는 남기지 않는다. describeErrorForLog).
    console.error(`[${LOG_TAG}] 블라인드 처리·근거 추출 중 예상하지 못한 오류 (단계 ${stage}, ${describeErrorForLog(error)})`);
    return errorResponse(502, UNEXPECTED_ERROR);
  }
}

/**
 * 서버 로그에 남길 오류 설명: "종류 <이름>" 하나만 돌려준다. 이름은 오류 객체의 name 을 한 번만 읽어, 문자열이고 아래 목록에 있을 때만
 * 그 값을 쓴다. 그 밖(목록에 없는 이름, Error 가 아닌 값, 읽다가 예외가 나는 getter·Proxy)은 "알 수 없음". 어떤 값에도 예외를 던지지 않는다.
 * 목록(코드에 적어 둔 이름만): 자바스크립트 기본 오류, 이 앱이 쓰는 PDF 라이브러리(pdf.js)의 오류, 요청 취소·시간 초과 오류.
 * 목록에 없는 이름은 식별자 모양이어도(지어낸 영문 성명일 수도 있다) 남기지 않는다.
 * 오류의 message, 스택, 오류 객체 전체(cause 등)는 읽지도 남기지도 않는다. 파싱·블라인드 처리 중에 난 오류의 문구와 스택 머리말에는
 * 가리기 전 학생부 내용(이름·학교명 등)이 섞일 수 있어서다. 값을 문자열로 바꾸지도 않는다.
 * "Error 인가"는 instanceof Error 로 본다(pdf.js 예외는 BaseException.prototype = Error() 인 옛 방식 상속이라 Error.isError 는 false 다. 실측).
 * 함수 하나만 떼어 시험할 수 있도록 목록을 함수 안에 둔다.
 */
function describeErrorForLog(error: unknown): string {
  const loggable = [
    "Error", "TypeError", "RangeError", "SyntaxError", "ReferenceError", "EvalError", "URIError", "AggregateError",
    "InvalidPDFException", "PasswordException", "FormatError", "MissingPDFException", "UnexpectedResponseException",
    "UnknownErrorException", "AbortException",
    "AbortError", "TimeoutError",
  ];
  try {
    if (!(error instanceof Error)) return "종류 알 수 없음";
    const name: unknown = error.name;
    return typeof name === "string" && loggable.includes(name) ? `종류 ${name}` : "종류 알 수 없음";
  } catch {
    return "종류 알 수 없음";
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
 * 분석에 쓸 학과 기준을 고른다. criteriaId 와 criteria 중 하나만 받는다(필드가 있는지는 null 인지로 본다).
 * - criteriaId: 코드에 적힌 학과(lib/criteria)에서 찾는다.
 * - criteria: DepartmentCriteria JSON 문자열. 확인·정리한 값(checkDepartmentCriteria)을 쓴다.
 */
function readCriteria(
  criteriaId: FormDataEntryValue | null,
  criteriaJson: FormDataEntryValue | null,
): { ok: true; value: DepartmentCriteria } | { ok: false; message: string } {
  if (criteriaId === null && criteriaJson === null) return { ok: false, message: CRITERIA_ERRORS.missing };
  if (criteriaId !== null && criteriaJson !== null) return { ok: false, message: CRITERIA_ERRORS.both };

  if (criteriaId !== null) {
    const found = typeof criteriaId === "string" ? findDepartmentCriteria(criteriaId) : undefined;
    return found === undefined ? { ok: false, message: CRITERIA_ERRORS.missing } : { ok: true, value: found };
  }

  if (typeof criteriaJson !== "string" || criteriaJson.length > MAX_CRITERIA_FIELD_LENGTH) {
    return { ok: false, message: CRITERIA_ERRORS.invalid };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(criteriaJson);
  } catch {
    return { ok: false, message: CRITERIA_ERRORS.invalid };
  }
  const check = checkDepartmentCriteria(parsed);
  if (!check.ok) {
    return { ok: false, message: CRITERIA_ERRORS[check.reason] };
  }
  return { ok: true, value: check.value };
}

function errorResponse(status: number, message: string) {
  return Response.json({ error: message }, { status });
}
