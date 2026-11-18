import type { Competency } from "@/types/analysis";

// lib/ 안의 모듈끼리 값을 가져올 때는 상대 경로에 .ts 확장자를 붙인다.
// `npm run check:mock` 이 이 파일들을 Node 로 직접(타입 제거 방식) 실행하기 때문이다.
// 타입만 가져올 때(import type)는 실행 시 지워지므로 @/ 경로를 써도 된다.

/** 서비스 이름 */
export const SERVICE_NAME = "GYEOL";

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
