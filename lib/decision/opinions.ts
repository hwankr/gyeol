import type { PrepElement } from "../prep/criteria.ts";
import { decisionSlotOf, type RankedApplicant } from "./decision.ts";

// 선발 결정 · 위원 의견 모아보기의 계산: 평가 요소마다 위원들의 점수가 얼마나 갈렸는지, 크게 갈린 요소가 있어 조정이 필요한 지원자인지.
// 브라우저와 Node 어디서나 돈다(순수 함수). 점수 계산과 순위는 lib/decision/decision.ts 의 것을 그대로 쓴다.

/**
 * 평가 요소 하나에서 위원 점수의 차이(가장 높은 점수 − 가장 낮은 점수)가 이 값 이상이면 "크게 갈린 요소" 다.
 * 시안의 기준이다: 시안은 위원 점수가 10점 이상 벌어진 요소의 칸을 붉게 칠하고 지원자 코드 옆에 `전공 13점 차이` 처럼 적는다(8점은 칠하지 않는다).
 */
export const WIDE_ELEMENT_SPREAD = 10;

/** 평가 요소 하나에서 위원들의 점수 */
export type ElementSpread = {
  id: string;
  name: string;
  /** 위원별 점수 (위원 1·2·3 순서. 0~100 정수) */
  scores: readonly number[];
  /** 가장 높은 점수 − 가장 낮은 점수 (정수) */
  spread: number;
  /** 크게 갈린 요소인지 (차이가 WIDE_ELEMENT_SPREAD 이상) */
  wide: boolean;
};

/** 요소별 위원 점수와 차이 (지금 평가 기준의 요소 순서. 자리는 순위 계산과 같은 규칙으로 맞춘다) */
export function elementSpreadsOf(row: RankedApplicant, elements: readonly PrepElement[]): ElementSpread[] {
  const { applicant } = row;
  return elements.map((element, index) => {
    const slot = decisionSlotOf(applicant, index);
    const scores = applicant.members.map((member) => member[slot] ?? 0);
    const spread = scores.length === 0 ? 0 : Math.max(...scores) - Math.min(...scores);
    return { id: element.id, name: element.name, scores, spread, wide: spread >= WIDE_ELEMENT_SPREAD };
  });
}

/**
 * 조정이 필요한 지원자인지: 위원 점수가 크게 갈린 평가 요소가 하나라도 있다. 탭 옆의 `조정 N` 과 이 탭의 `조정 필요` 가 같이 쓴다.
 * 요소별로 보므로, 위원들이 서로 다른 요소에서 엇갈려 종합 점수는 비슷해진 지원자도 걸린다(시안의 A-0132 가 그렇다). 그래서 종합 점수의
 * 차이로 보는 인재상 적합 추천의 "위원 간 차이 큼"(lib/decision/decision.ts 의 WIDE_SPREAD10)과는 다른 기준이다.
 */
export function needsAdjustment(spreads: readonly Pick<ElementSpread, "wide">[]): boolean {
  return spreads.some((item) => item.wide);
}
