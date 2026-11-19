// 분석 기준(요소 이름·설명)의 개수·길이 제한. 화면(lib/prep/analysisCriteria.ts)과 /api/analyze·/api/guideline(서버)이 같은 값을 쓴다.
// 서버 전용 코드를 가져오지 않는 순수 모듈이다.
// 길이는 JS 문자열 length(UTF-16 단위)로 센다. 브라우저 입력란의 maxLength 와 같은 기준이다.

/** 학과 하나의 기준 최대 개수 */
export const MAX_CRITERIA = 6;

/** 기준 이름(name) 최대 길이 */
export const MAX_CRITERION_NAME_LENGTH = 30;

/** 기준 설명(description) 최대 길이 */
export const MAX_CRITERION_DESCRIPTION_LENGTH = 300;

/** 학과가 적은 문장(sourceText) 최대 길이 */
export const MAX_SOURCE_TEXT_LENGTH = 2000;

/** 학과 이름(department) 최대 길이 */
export const MAX_DEPARTMENT_NAME_LENGTH = 50;

/** 학과 기준 id 최대 길이 */
export const MAX_DEPARTMENT_ID_LENGTH = 64;

/** 기준 생성 경고(warnings) 최대 개수 */
export const MAX_WARNINGS = 10;

/** 기준 생성 경고 한 건 최대 길이 */
export const MAX_WARNING_LENGTH = 300;

/**
 * /api/analyze 의 prepCriteria 필드(전형 준비 평가 기준 JSON 문자열) 최대 길이.
 * 저장 한도를 꽉 채운 평가 기준(요소 6개 × 묶음 6개 × 질문 8개 × 200자)은 질문만 약 58,000자이고,
 * JSON 으로 적을 때 따옴표·역슬래시가 두 글자가 되는 경우까지 넉넉하게 잡는다.
 */
export const MAX_PREP_CRITERIA_FIELD_LENGTH = 150_000;
