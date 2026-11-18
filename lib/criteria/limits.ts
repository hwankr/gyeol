// 학과 평가 기준의 개수·길이 제한. 업로드 화면(브라우저)과 /api/criteria·/api/analyze(서버)가 같은 값을 쓴다.
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

/** /api/analyze 의 criteria 필드(DepartmentCriteria JSON 문자열) 최대 길이 */
export const MAX_CRITERIA_FIELD_LENGTH = 20_000;
