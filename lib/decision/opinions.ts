import type { PrepElement } from "../prep/criteria.ts";
import { WIDE_SPREAD10, decisionMemberName, decisionSlotOf, tenthsText, type RankedApplicant } from "./decision.ts";

// 선발 결정 · 위원 의견 모아보기의 계산: 조정이 필요한 지원자인지, 위원들의 점수가 어디서 갈렸는지(가장 높게·낮게 준 위원,
// 요소별 차이, 가장 크게 갈린 요소), 위원 한 명의 종합 점수가 평균에서 얼마나 떨어져 있는지.
// 브라우저와 Node 어디서나 돈다(순수 함수). 점수 계산과 순위는 lib/decision/decision.ts 의 것을 그대로 쓴다.

/**
 * 조정이 필요한 지원자인지: 위원별 종합 점수의 차이가 기준(5.0점) 이상이다.
 * 인재상 적합 추천의 "위원 간 차이 큼" 과 같은 기준이고, 탭 옆의 `조정 N` 과 이 탭의 `조정 필요` 가 같이 쓴다.
 */
export function needsAdjustment(row: Pick<RankedApplicant, "spread10">): boolean {
  return row.spread10 >= WIDE_SPREAD10;
}

/** 값이 가장 큰 자리와 가장 작은 자리 (같은 값이 여럿이면 모두. 순번은 0 부터) */
export type Extremes = {
  high: readonly number[];
  low: readonly number[];
};

const NO_EXTREMES: Extremes = Object.freeze({ high: Object.freeze([]), low: Object.freeze([]) });

/**
 * 값 가운데 가장 큰 것과 가장 작은 것의 자리. 값이 모두 같거나(갈리지 않음) 값이 없으면 둘 다 비어 있다.
 * 위원별 종합 점수와 요소 하나의 위원별 점수에 같이 쓴다.
 */
export function extremesOf(values: readonly number[]): Extremes {
  if (values.length === 0) return NO_EXTREMES;
  const max = Math.max(...values);
  const min = Math.min(...values);
  if (max === min) return NO_EXTREMES;
  const indexesOf = (target: number) => values.flatMap((value, index) => (value === target ? [index] : []));
  return { high: indexesOf(max), low: indexesOf(min) };
}

/** 위원 여럿을 한 번에 적는 이름: "위원 1", "위원 1·3" (없으면 빈 글) */
export function memberNamesText(indexes: readonly number[]): string {
  if (indexes.length === 0) return "";
  return `${decisionMemberName(indexes[0])}${indexes
    .slice(1)
    .map((index) => `·${index + 1}`)
    .join("")}`;
}

/** 평가 요소 하나에서 위원들의 점수 */
export type ElementSpread = {
  id: string;
  name: string;
  weight: number;
  /** 위원별 점수 (위원 1·2·3 순서. 0~100 정수) */
  scores: readonly number[];
  /** 위원 평균의 10배 */
  mean10: number;
  /** 가장 높은 점수 − 가장 낮은 점수 (정수) */
  spread: number;
  /** 가장 높게·낮게 준 위원 (모두 같으면 비어 있다) */
  extremes: Extremes;
  /** AI 점수 */
  ai: number;
};

/** 요소별 위원 점수와 차이 (지금 평가 기준의 요소 순서. 자리는 순위 계산과 같은 규칙으로 맞춘다) */
export function elementSpreadsOf(row: RankedApplicant, elements: readonly PrepElement[]): ElementSpread[] {
  const { applicant } = row;
  return elements.map((element, index) => {
    const slot = decisionSlotOf(applicant, index);
    const scores = applicant.members.map((member) => member[slot] ?? 0);
    return {
      id: element.id,
      name: element.name,
      weight: element.weight,
      scores,
      mean10: row.element10[index] ?? 0,
      spread: scores.length === 0 ? 0 : Math.max(...scores) - Math.min(...scores),
      extremes: extremesOf(scores),
      ai: applicant.ai[slot] ?? 0,
    };
  });
}

/** 위원들이 가장 크게 갈린 요소 (차이가 같으면 앞의 요소. 모든 요소에서 점수가 같으면 null) */
export function widestSpreadOf(spreads: readonly ElementSpread[]): ElementSpread | null {
  let widest: ElementSpread | null = null;
  for (const item of spreads) {
    if (item.spread > 0 && (widest === null || item.spread > widest.spread)) widest = item;
  }
  return widest;
}

/** 위원 한 명의 종합 점수가 최종 평가(위원 평균)에서 떨어진 정도: "평균 대비 +4.7", "평균 대비 −1.2", "평균과 같음" */
export function deviationText(memberTotal10: number, final10: number): string {
  const diff10 = memberTotal10 - final10;
  if (diff10 === 0) return "평균과 같음";
  return `평균 대비 ${diff10 > 0 ? "+" : "−"}${tenthsText(Math.abs(diff10))}`;
}
