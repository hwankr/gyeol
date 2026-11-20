import type { PrepElement } from "../prep/criteria.ts";
import type { DecisionApplicant } from "./sampleDecision.ts";

// 선발 결정 화면의 계산: 최종 평가·순위·비교 기준·비교할 두 사람·요소별 차이, 그리고 고른 지원자(비교 대상)의 저장 값 확인.
// 브라우저와 Node 어디서나 돈다(순수 함수). 평가 요소와 배점은 전형 준비에서 저장한 평가 기준(lib/prep/criteria.ts 의 PrepElement)이다.
//
// 점수는 소수 첫째 자리까지 보여 준다. 소수 계산의 오차가 없도록 10배 한 정수("82.0점" → 820)로 다루고 글로 바꿀 때만 나눈다.
// 화면에 보이는 수끼리 맞아떨어지게, 차이는 반올림한 값끼리 뺀다(82.7 − 80.8 = 1.9).

/** 위원 한 사람을 가리키는 이름: "위원 1" (예시 지원자의 위원은 사람 이름을 적지 않는다) */
export function decisionMemberName(index: number): string {
  return `위원 ${index + 1}`;
}

/** 요소 순번 → 그 지원자 자료의 자리. 요소가 자리(셋)보다 많으면 자리를 돌려 쓴다(평가하기의 예시 지원자와 같은 규칙) */
export function decisionSlotOf(applicant: Pick<DecisionApplicant, "ai">, elementIndex: number): number {
  return elementIndex % applicant.ai.length;
}

/**
 * 요소 점수를 배점으로 가중 평균한 값의 10배 (반올림. 배점 합이 0 이면 0).
 * divisor 를 주면 그 수로 한 번 더 나눈다(위원 점수의 합을 넣고 위원 수로 나눠 평균을 낼 때. 반올림은 마지막에 한 번만 한다).
 */
export function weightedTenths(scores: readonly number[], elements: readonly PrepElement[], divisor = 1): number {
  let sum = 0;
  let weights = 0;
  elements.forEach((element, index) => {
    sum += (scores[index] ?? 0) * element.weight;
    weights += element.weight;
  });
  return weights === 0 || divisor === 0 ? 0 : Math.round((sum * 10) / (weights * divisor));
}

/** 10배 한 점수 → "82.0" */
export function tenthsText(tenths: number): string {
  return (tenths / 10).toFixed(1);
}

/** 10배 한 점수 → "82" 또는 "82.3" (".0" 은 뗀다. 요소 점수에 쓴다) */
export function trimmedTenthsText(tenths: number): string {
  return tenthsText(tenths).replace(/\.0$/, "");
}

/** 순위를 매긴 지원자 한 명 */
export type RankedApplicant = {
  applicant: DecisionApplicant;
  rank: number;
  /** 합격권인지 (순위가 모집 인원 안) */
  admitted: boolean;
  /** 예비 순번 (합격권이면 null. 합격선 바로 아래가 1) */
  waitNumber: number | null;
  /** 최종 평가: 위원 평균을 배점으로 가중 평균한 값의 10배 */
  final10: number;
  /** 요소별 위원 평균의 10배 (지금 평가 기준의 요소 순서) */
  element10: readonly number[];
  /** 위원별 종합 점수의 10배 */
  memberTotal10: readonly number[];
  /** 위원 간 차이: 위원별 종합 점수의 가장 큰 값 − 가장 작은 값 (10배) */
  spread10: number;
  /** 인재상 적합도: AI 점수를 배점으로 가중 평균해 반올림한 정수 (평가하기의 AI 종합 점수와 같은 계산) */
  aiTotal: number;
};

/**
 * 지원자의 최종 평가를 계산해 높은 순으로 줄 세우고 순위를 매긴다. 점수가 같으면 코드 순서다.
 * 순위는 firstRank 부터 차례로 붙인다(예시 자료는 모집 단위 전체에서 합격선 근처만 떼어 온 것이라, 그 구간 안에서만 다시 줄 세운다).
 */
export function rankDecisionApplicants(
  applicants: readonly DecisionApplicant[],
  elements: readonly PrepElement[],
  quota: number,
  firstRank: number,
): RankedApplicant[] {
  const scored = applicants.map((applicant) => {
    const memberCount = Math.max(1, applicant.members.length);
    // 요소별 위원 점수의 합. 요소별 평균과 최종 평가는 이 합에서 바로 구해 반올림을 한 번씩만 한다.
    const sums = elements.map((_, index) => {
      const slot = decisionSlotOf(applicant, index);
      return applicant.members.reduce((sum, member) => sum + (member[slot] ?? 0), 0);
    });
    const memberTotal10 = applicant.members.map((member) =>
      weightedTenths(
        elements.map((_, index) => member[decisionSlotOf(applicant, index)] ?? 0),
        elements,
      ),
    );
    const aiTenths = weightedTenths(
      elements.map((_, index) => applicant.ai[decisionSlotOf(applicant, index)] ?? 0),
      elements,
    );
    return {
      applicant,
      final10: weightedTenths(sums, elements, memberCount),
      element10: sums.map((sum) => Math.round((sum * 10) / memberCount)),
      memberTotal10,
      spread10: memberTotal10.length === 0 ? 0 : Math.max(...memberTotal10) - Math.min(...memberTotal10),
      aiTotal: Math.round(aiTenths / 10),
    };
  });
  scored.sort((a, b) => b.final10 - a.final10 || a.applicant.code.localeCompare(b.applicant.code));
  return scored.map((row, index) => {
    const rank = firstRank + index;
    const admitted = rank <= quota;
    return { ...row, rank, admitted, waitNumber: admitted ? null : rank - quota };
  });
}

/** 순위 옆에 적는 구분: "합격권" 또는 "예비 1" */
export function standingText(row: Pick<RankedApplicant, "admitted" | "waitNumber">): string {
  return row.admitted || row.waitNumber === null ? "합격권" : `예비 ${row.waitNumber}`;
}

/** 합격선: 합격권의 마지막 지원자(순위 = 모집 인원)와 예비 1번. 그 구간에 둘 다 있을 때만 값이 있다. */
export type Cutline = {
  last: RankedApplicant;
  first: RankedApplicant;
  /** 두 사람의 최종 평가 차이 (10배) */
  gap10: number;
};

export function cutlineOf(ranked: readonly RankedApplicant[], quota: number): Cutline | null {
  const last = ranked.find((row) => row.rank === quota);
  const first = ranked.find((row) => row.rank === quota + 1);
  if (last === undefined || first === undefined) return null;
  return { last, first, gap10: last.final10 - first.final10 };
}

/** 비교 기준: 합격선 접전 / 위원 간 차이 큼 / 요약이 비슷함 */
export type DecisionFlag = "close" | "spread" | "similar";

export const DECISION_FLAGS: readonly DecisionFlag[] = ["close", "spread", "similar"];

/** 합격선(합격권 마지막 지원자의 점수)과 이 값 이내이면 "합격선 접전" 이다 (10배: 0.5점) */
export const CLOSE_MARGIN10 = 5;

/** 위원 간 차이가 이 값 이상이면 "위원 간 차이 큼" 이다 (10배: 5.0점) */
export const WIDE_SPREAD10 = 50;

/** 요약이 비슷한 다른 지원자의 코드 (순위 순서. 갈래가 없으면 빈 배열) */
export function similarCodesOf(row: RankedApplicant, ranked: readonly RankedApplicant[]): string[] {
  const { theme, code } = row.applicant;
  if (theme === null) return [];
  return ranked.filter((other) => other.applicant.code !== code && other.applicant.theme === theme).map((other) => other.applicant.code);
}

/** 그 지원자에게 해당하는 비교 기준 */
export function decisionFlagsOf(row: RankedApplicant, ranked: readonly RankedApplicant[], cutline: Cutline | null): DecisionFlag[] {
  const flags: DecisionFlag[] = [];
  if (cutline !== null && Math.abs(row.final10 - cutline.last.final10) <= CLOSE_MARGIN10) flags.push("close");
  if (row.spread10 >= WIDE_SPREAD10) flags.push("spread");
  if (similarCodesOf(row, ranked).length > 0) flags.push("similar");
  return flags;
}

/** 비교하려고 고른 지원자의 코드 (고른 순서, 2명까지) */
export type DecisionPicks = readonly string[];

export const NO_PICKS: DecisionPicks = Object.freeze([]);

/** 한 번에 비교하는 지원자 수 */
export const MAX_PICKS = 2;

/** 지금 저장 형식의 버전 */
export const DECISION_PICKS_VERSION = 1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 저장소에서 읽은 값(JSON 해석 결과)을 확인한다. 모양이 틀리면(객체가 아님, version 이 1 이 아님, codes 가 배열이 아님) 고른 사람이 없는
 * 것으로 본다. 목록에 없는 코드와 되풀이된 코드는 빼고 앞에서부터 2명까지만 쓴다.
 */
export function parseDecisionPicks(value: unknown, codes: readonly string[]): DecisionPicks {
  if (!isRecord(value) || value.version !== DECISION_PICKS_VERSION || !Array.isArray(value.codes)) return NO_PICKS;
  const picks: string[] = [];
  for (const code of value.codes) {
    if (picks.length >= MAX_PICKS) break;
    if (typeof code === "string" && codes.includes(code) && !picks.includes(code)) picks.push(code);
  }
  return picks.length === 0 ? NO_PICKS : picks;
}

/** 저장할 값 */
export function serializeDecisionPicks(picks: DecisionPicks): string {
  return JSON.stringify({ version: DECISION_PICKS_VERSION, codes: picks });
}

/** 고른 사람이면 빼고, 아니면 더한다. 이미 2명을 골랐으면 더하지 않는다(받은 값을 그대로 돌려준다). */
export function togglePick(picks: DecisionPicks, code: string): DecisionPicks {
  if (picks.includes(code)) {
    const rest = picks.filter((item) => item !== code);
    return rest.length === 0 ? NO_PICKS : rest;
  }
  return picks.length >= MAX_PICKS ? picks : [...picks, code];
}

/** 비교할 두 사람. chosen: 사람이 고른 두 사람인지(false 면 합격선 바로 위·아래 두 사람) */
export type ComparePair = {
  left: RankedApplicant;
  right: RankedApplicant;
  chosen: boolean;
};

/**
 * 지원자 비교 탭에 보여 줄 두 사람: 고른 사람이 둘이면 그 둘, 아니면 합격선 바로 위·아래 두 사람(합격권의 마지막과 예비 1번)이다.
 * 순위가 높은 사람이 왼쪽이다. 합격선의 두 사람이 구간에 없으면 맨 위의 두 사람이고, 지원자가 둘보다 적으면 null 이다.
 */
export function comparePairOf(ranked: readonly RankedApplicant[], picks: DecisionPicks, quota: number): ComparePair | null {
  const picked = ranked.filter((row) => picks.includes(row.applicant.code));
  if (picked.length === MAX_PICKS) return { left: picked[0], right: picked[1], chosen: true };
  const cutline = cutlineOf(ranked, quota);
  if (cutline !== null) return { left: cutline.last, right: cutline.first, chosen: false };
  return ranked.length < 2 ? null : { left: ranked[0], right: ranked[1], chosen: false };
}

/** 평가 요소 하나에서 두 사람의 점수 */
export type ElementGap = {
  id: string;
  name: string;
  weight: number;
  left10: number;
  right10: number;
  /** 왼쪽 − 오른쪽 (10배. 양수면 왼쪽이 높다) */
  diff10: number;
};

/** 요소별 두 사람의 점수와 차이 (지금 평가 기준의 요소 순서) */
export function elementGapsOf(pair: Pick<ComparePair, "left" | "right">, elements: readonly PrepElement[]): ElementGap[] {
  return elements.map((element, index) => {
    const left10 = pair.left.element10[index] ?? 0;
    const right10 = pair.right.element10[index] ?? 0;
    return { id: element.id, name: element.name, weight: element.weight, left10, right10, diff10: left10 - right10 };
  });
}

/** 두 사람이 가장 크게 갈린 요소 (차이가 같으면 앞의 요소. 모든 요소에서 점수가 같으면 null) */
export function widestGapOf(gaps: readonly ElementGap[]): ElementGap | null {
  let widest: ElementGap | null = null;
  for (const gap of gaps) {
    if (gap.diff10 !== 0 && (widest === null || Math.abs(gap.diff10) > Math.abs(widest.diff10))) widest = gap;
  }
  return widest;
}
