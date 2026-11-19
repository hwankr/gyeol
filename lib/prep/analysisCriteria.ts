import type { DepartmentCriteria } from "@/types/analysis";
import type { PrepCriteria, PrepElement } from "./criteria.ts";
import { MAX_CRITERION_DESCRIPTION_LENGTH } from "../criteria/limits.ts";

// 전형 준비에서 저장한 평가 기준을 학생부 분석(POST /api/analyze)의 근거 추출에 쓰는 분석 기준으로 바꾼다. 순수 함수.
// 학생부 올리기 화면은 평가 기준을 통째로 보내고(prepCriteria 필드) 서버(app/api/analyze/route.ts)가 이 함수로 분석 기준을 만든다.
// 요소 이름은 기준 이름, 묶음 이름과 질문은 기준 설명이 된다. 배점은 넣지 않는다(AI 에 보내지 않는다. 종합 점수는 화면이 배점으로 계산한다).
// 세부 평가 항목의 지문(rubricFingerprint)은 서버와 평가하기 화면이 같이 쓴다.

/**
 * 전형 준비의 평가 기준으로 만든 분석 기준의 id. 분석 결과(AnalysisResult.criteria.id)에 남고, 평가하기 화면이 이 값으로
 * 전형 준비 기준으로 분석한 결과인지 본다(샘플 결과는 코드에 적어 둔 학과 기준 id 다).
 */
export const PREP_CRITERIA_ID = "prep";

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

/** FNV-1a 32비트 해시(UTF-16 단위)를 16진수 여덟 자리로. 브라우저와 Node 에서 같은 값이 나온다. */
function hashText(text: string, seed: number): string {
  let hash = seed >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/**
 * 세부 평가 항목의 지문: 요소의 이름과 묶음(태그·이름·질문)을 순서대로 적은 글의 해시("r1-" + 16진수 열여섯 자리).
 * AI 제안(점수·태그)은 이 질문들에 비추어 만든 것이라, 분석할 때의 지문을 결과에 같이 두고(Assessment.rubric) 평가하기 화면이
 * 지금 평가 기준의 지문과 견준다. 다르면 그 분석은 지금 기준의 것이 아니다. 배점과 요소 id 는 넣지 않는다(배점만 바꾸면 지문은 같다).
 */
export function rubricFingerprint(elements: readonly PrepElement[]): string {
  const text = JSON.stringify(
    elements.map((element) => [element.name, element.groups.map((group) => [group.tag, group.name, group.questions])]),
  );
  return `r1-${hashText(text, 0x811c9dc5)}${hashText(text, 0x01234567)}`;
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
