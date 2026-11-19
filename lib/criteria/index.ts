import type { DepartmentCriteria } from "@/types/analysis";
import { businessCriteria } from "./business.ts";

// 코드에 적어 둔 학과 기준. 샘플 결과(lib/mock/sample-result.json)를 만드는 스크립트(scripts/make-sample.ts)만 쓴다.
// 화면의 분석은 전형 준비에서 저장한 평가 기준(lib/prep/)을 쓴다.

/** 코드에 적어 둔 학과 기준 목록 (지금은 경영학과 하나) */
export const DEPARTMENT_CRITERIA_LIST: readonly DepartmentCriteria[] = [businessCriteria];

/** id 로 학과 기준을 찾는다. 없으면 undefined. */
export function findDepartmentCriteria(id: string): DepartmentCriteria | undefined {
  return DEPARTMENT_CRITERIA_LIST.find((criteria) => criteria.id === id);
}
