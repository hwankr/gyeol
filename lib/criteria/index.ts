import type { DepartmentCriteria } from "@/types/analysis";
import { businessCriteria } from "./business.ts";

// 학과별 평가 기준. 업로드 화면(브라우저)과 /api/analyze(서버)가 같이 쓰므로 서버 전용 코드를 가져오지 않는다.

/**
 * 고를 수 있는 학과 기준 전체 목록. 학과를 추가하면 기준 파일을 만들고 여기에 넣는다.
 * 업로드 화면의 학과 선택은 이 순서대로 보여 주고, 첫 번째 학과를 기본으로 고른다.
 */
export const DEPARTMENT_CRITERIA_LIST: readonly DepartmentCriteria[] = [businessCriteria];

/** id 로 학과 기준을 찾는다. 없으면 undefined. */
export function findDepartmentCriteria(id: string): DepartmentCriteria | undefined {
  return DEPARTMENT_CRITERIA_LIST.find((criteria) => criteria.id === id);
}
