import type { Competency } from "@/types/analysis";

// lib/ 안의 모듈끼리 값을 가져올 때는 상대 경로에 .ts 확장자를 붙인다.
// `npm run check:mock` 이 이 파일들을 Node 로 직접(타입 제거 방식) 실행하기 때문이다.
// 타입만 가져올 때(import type)는 실행 시 지워지므로 @/ 경로를 써도 된다.

/** 서비스 이름. 아직 정해지지 않았다. */
export const SERVICE_NAME = "서비스명(미정)";

/** 모든 화면 맨 위에 고정하는 띠 문구 */
export const WIREFRAME_BANNER = "와이어프레임 (기능 확인용) · 디자인 미적용";

/** 분석 결과를 저장하는 sessionStorage 키 */
export const RESULT_STORAGE_KEY = "gyeol.analysisResult";

/** 평가 역량 목록. 역량 문자열은 이 목록 한 곳에서만 정의하고, 다른 코드는 이 목록을 순회한다. */
export const COMPETENCIES = [
  "학업역량",
  "진로역량",
  "공동체역량",
] as const satisfies readonly Competency[];

/**
 * COMPETENCIES 가 Competency 의 모든 값을 담고 있는지 컴파일 시점에 확인한다.
 * 빠진 역량이 있으면 이 타입에서 컴파일 오류가 난다. (없는 값을 넣으면 위의 satisfies 에서 오류가 난다.)
 */
export type CompetencyListCoversAll = AssertNever<
  Exclude<Competency, (typeof COMPETENCIES)[number]>
>;
type AssertNever<T extends never> = T;

/** 학생부 항목명 목록 (학생부에 실리는 순서) */
export const SECTION_CATEGORIES = [
  "인적·학적사항",
  "출결사항",
  "자율활동",
  "동아리활동",
  "진로활동",
  "봉사활동실적",
  "세부능력 및 특기사항",
  "행동특성 및 종합의견",
] as const;
