import type { DepartmentCriteria } from "@/types/analysis";
import type { PrepCriteria, PrepElement } from "./criteria.ts";
import { MAX_CRITERION_DESCRIPTION_LENGTH } from "../criteria/limits.ts";

// 전형 준비에서 저장한 평가 기준을 학생부 분석(POST /api/analyze 의 criteria 필드)에 쓰는 학과 기준으로 바꾼다. 순수 함수.
// 업로드 화면의 "학과 선택" 목록 맨 앞 항목(<모집 단위> (전형 준비))이 이 값을 쓴다.
// 배점은 넣지 않는다(AI 는 점수를 매기지 않는다). 요소 이름은 기준 이름, 묶음 이름과 질문은 기준 설명이 된다.

/**
 * 업로드 화면의 학과 선택에서 전형 준비 항목의 값이자 분석 요청의 학과 기준 id.
 * 코드에 적힌 학과(business 등)와 저장한 학과(custom- 로 시작)의 id 와 겹치지 않는다.
 * 저장소에 id 가 이 값인 저장한 학과가 들어 있으면 읽을 때 버린다(lib/criteriaStorage.ts).
 */
export const PREP_CRITERIA_ID = "prep";

/** 학과 선택 목록에 보이는 전형 준비 항목의 이름: "컴퓨터공학과 (전형 준비)" */
export function prepDepartmentLabel(criteria: PrepCriteria): string {
  return `${criteria.department} (전형 준비)`;
}

/**
 * 평가 요소 하나의 기준 설명. "<묶음 이름들을 ", " 로 이은 것>에 관한 기록." 으로 시작하고, 그 뒤에 그 요소의 질문을
 * 묶음 순서·질문 순서대로 공백 하나씩 두고 이어 붙이되 전체가 300자(분석의 기준 설명 한도, JS 문자열 length)를 넘지 않는 데까지만 붙인다.
 * 들어가지 않는 질문을 만나면 거기서 멈춘다(뒤의 짧은 질문을 골라 넣지 않는다). 질문은 통째로만 들어간다.
 * 머리말은 저장 한도(묶음 6개 × 이름 20자)에서도 138자라 늘 들어간다. 분석 서버가 설명을 300자로 자르는 일은 없다.
 */
export function prepElementDescription(element: PrepElement): string {
  let description = `${element.groups.map((group) => group.name).join(", ")}에 관한 기록.`;
  for (const group of element.groups) {
    for (const question of group.questions) {
      const next = `${description} ${question}`;
      if (next.length > MAX_CRITERION_DESCRIPTION_LENGTH) return description;
      description = next;
    }
  }
  return description;
}

/**
 * 분석에 보낼 학과 기준: id "prep", 학과 이름은 모집 단위, sourceText 는 빈 문자열(분석은 sourceText 를 AI 에 보내지 않는다),
 * 기준은 요소 순서대로 id c1, c2 …, 이름은 요소 이름, 설명은 prepElementDescription. 배점은 넣지 않는다.
 * 저장한 평가 기준의 한도(요소 1~6개, 이름 30자, 모집 단위 50자)는 분석의 학과 기준 한도와 같거나 안쪽이라 서버 정리에서 바뀌지 않는다.
 */
export function prepAnalysisCriteria(criteria: PrepCriteria): DepartmentCriteria {
  return {
    id: PREP_CRITERIA_ID,
    department: criteria.department,
    sourceText: "",
    criteria: criteria.elements.map((element, index) => ({
      id: `c${index + 1}`,
      name: element.name,
      description: prepElementDescription(element),
    })),
  };
}
