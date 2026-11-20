// lib/ 안의 모듈끼리 값을 가져올 때는 상대 경로에 .ts 확장자를 붙인다.
// `npm run check:mock` 이 이 파일들을 Node 로 직접(타입 제거 방식) 실행하기 때문이다.
// 타입만 가져올 때(import type)는 실행 시 지워지므로 @/ 경로를 써도 된다.

/** 서비스 이름 */
export const SERVICE_NAME = "GYEOL";

/**
 * 전형 준비 · 평가·배점 설정의 평가 기준(PrepCriteria)을 저장하는 localStorage 키.
 * 끝의 ".v2" 는 모집 단위를 컴퓨터공학과에서 경영학과로 바꾸면서 붙였다. 예전 키("gyeol.prepCriteria", "gyeol.prepHistory")에 저장한
 * 컴퓨터공학과의 평가 기준과 그 변경 기록이 경영학과의 것으로 읽히지 않게 한다(예전 값은 지우지 않고 읽지 않는다).
 */
export const PREP_CRITERIA_STORAGE_KEY = "gyeol.prepCriteria.v2";

/** 전형 준비 · 기준 변경 기록(PrepHistoryEntry[])을 저장하는 localStorage 키 (평가 기준의 키와 같이 바꿨다) */
export const PREP_HISTORY_STORAGE_KEY = "gyeol.prepHistory.v2";

/**
 * 전형 준비 · 공통 기준 협의의 위원 의견({ version: 1, opinions: { "<위원 번호>": "<의견>" } })을 저장하는 localStorage 키.
 * 위원이 적은 글 그대로 저장한다(위원 이름은 저장하지 않는다. 번호만).
 */
export const PREP_OPINIONS_STORAGE_KEY = "gyeol.prepOpinions";

/** 지원자 관리 · 가릴지 확인이 필요한 표현의 결정({ version: 1, reviews })을 저장하는 localStorage 키 */
export const APPLICANT_REVIEWS_STORAGE_KEY = "gyeol.applicantReviews";

/**
 * 지원자 관리 · 학생부 올리기에서 분석한 학생부(올린 지원자, { version: 1, items: [{ code, at, result }] }, 최근 30건)를 저장하는 localStorage 키.
 * result 는 서버가 돌려준 분석 결과(가려진 원문)이고, 파일 이름은 저장하지 않는다.
 */
export const UPLOADED_APPLICANTS_STORAGE_KEY = "gyeol.uploadedApplicants";

/** 평가하기 · 내 평가({ version: 1, records: { "<코드>": 평가 } })를 저장하는 localStorage 키 */
export const EVALUATIONS_STORAGE_KEY = "gyeol.evaluations";

/** 선발 결정 · 비교하려고 고른 지원자({ version: 1, codes: ["<코드>", …] }, 2명까지)를 저장하는 localStorage 키 */
export const DECISION_PICKS_STORAGE_KEY = "gyeol.decisionPicks";
