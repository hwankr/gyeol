import type { PrepElement } from "../prep/criteria.ts";
import { decisionSlotOf, tenthsText, weightedTenths, type RankedApplicant } from "./decision.ts";
import { WIDE_ELEMENT_SPREAD } from "./opinions.ts";
import type { DecisionApplicant } from "./sampleDecision.ts";

// 선발 결정 · 위원 의견 모아보기의 조정: 위원 점수가 크게 갈린 요소의 점수를 고쳐 차이를 줄이고 확정한다.
// 확정한 조정(지원자의 조정한 위원 점수)의 형식과 저장 값 확인, 지원자 자료에 덮어쓰기, 고치는 중인 입력의 계산.
// 브라우저와 Node 어디서나 돈다(순수 함수). 저장·불러오기는 lib/decision/adjustStorage.ts 가 한다.

/** 위원 세 명의 자리별 점수 (지원자 자료의 members 와 같은 모양) */
export type MemberScores = DecisionApplicant["members"];

/** 조정을 확정한 지원자 한 명: 조정한 뒤의 위원 점수 (고치지 않은 점수도 같이 들어 있다) */
export type DecisionAdjustment = {
  code: string;
  members: MemberScores;
};

/** 확정한 조정 (확정한 순서) */
export type DecisionAdjustments = readonly DecisionAdjustment[];

export const NO_ADJUSTMENTS: DecisionAdjustments = Object.freeze([]);

/** 지금 저장 형식의 버전 */
export const DECISION_ADJUSTMENTS_VERSION = 1;

/** 위원 점수의 범위 (예시 자료의 점수와 같다) */
const MIN_SCORE = 0;
const MAX_SCORE = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isScore(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= MIN_SCORE && value <= MAX_SCORE;
}

/** 값이 like 와 같은 모양(위원 수, 자리 수)의 0~100 정수 표이면 위원 점수로, 아니면 null */
function memberScoresOf(value: unknown, like: MemberScores): MemberScores | null {
  if (!Array.isArray(value) || value.length !== like.length) return null;
  const rows: number[][] = [];
  for (const [index, row] of value.entries()) {
    if (!Array.isArray(row) || row.length !== like[index].length || !row.every(isScore)) return null;
    rows.push([...row]);
  }
  // 위원 수와 자리 수를 위에서 확인했다(배열의 길이는 타입으로 좁혀지지 않는다).
  return rows as unknown as MemberScores;
}

/**
 * 저장소에서 읽은 값(JSON 해석 결과)을 확인한다. 모양이 틀리면(객체가 아님, version 이 1 이 아님, items 가 배열이 아님) 확정한 조정이
 * 없는 것으로 본다. 항목마다 지원자 목록에 있는 코드이고 위원 점수가 그 지원자와 같은 모양의 0~100 정수 표여야 하며, 그렇지 않은
 * 항목과 되풀이된 코드는 뺀다(나머지는 살린다).
 */
export function parseDecisionAdjustments(value: unknown, applicants: readonly DecisionApplicant[]): DecisionAdjustments {
  if (!isRecord(value) || value.version !== DECISION_ADJUSTMENTS_VERSION || !Array.isArray(value.items)) return NO_ADJUSTMENTS;
  const adjustments: DecisionAdjustment[] = [];
  for (const item of value.items) {
    if (!isRecord(item) || typeof item.code !== "string") continue;
    const { code } = item;
    const applicant = applicants.find((candidate) => candidate.code === code);
    if (applicant === undefined || adjustments.some((adjustment) => adjustment.code === code)) continue;
    const members = memberScoresOf(item.members, applicant.members);
    if (members !== null) adjustments.push({ code, members });
  }
  return adjustments.length === 0 ? NO_ADJUSTMENTS : adjustments;
}

/** 저장할 값 */
export function serializeDecisionAdjustments(adjustments: DecisionAdjustments): string {
  return JSON.stringify({ version: DECISION_ADJUSTMENTS_VERSION, items: adjustments });
}

/** 그 지원자의 확정한 조정 (없으면 undefined) */
export function adjustmentOf(adjustments: DecisionAdjustments, code: string): DecisionAdjustment | undefined {
  return adjustments.find((adjustment) => adjustment.code === code);
}

/** 그 지원자의 조정을 더한다. 이미 있으면 그 자리에서 바꾼다. */
export function withAdjustment(adjustments: DecisionAdjustments, next: DecisionAdjustment): DecisionAdjustments {
  return adjustmentOf(adjustments, next.code) === undefined
    ? [...adjustments, next]
    : adjustments.map((adjustment) => (adjustment.code === next.code ? next : adjustment));
}

/** 그 지원자의 조정을 뺀다 (원래 점수로 돌아간다). 없으면 받은 값을 그대로 돌려준다. */
export function withoutAdjustment(adjustments: DecisionAdjustments, code: string): DecisionAdjustments {
  if (adjustmentOf(adjustments, code) === undefined) return adjustments;
  const rest = adjustments.filter((adjustment) => adjustment.code !== code);
  return rest.length === 0 ? NO_ADJUSTMENTS : rest;
}

/** 확정한 조정을 지원자 자료에 덮어쓴다: 조정한 지원자는 위원 점수만 조정한 값으로 바뀐다. 조정이 없으면 받은 목록 그대로다. */
export function applyAdjustments(applicants: readonly DecisionApplicant[], adjustments: DecisionAdjustments): readonly DecisionApplicant[] {
  if (adjustments.length === 0) return applicants;
  return applicants.map((applicant) => {
    const adjustment = adjustmentOf(adjustments, applicant.code);
    return adjustment === undefined ? applicant : { ...applicant, members: adjustment.members };
  });
}

/** 점수 입력란의 글 → 0~100 정수. 숫자 1~3자리이고 100 이하일 때만 값이 있다(빈 글, 소수, 음수, 101 이상, 숫자가 아닌 글은 null). */
export function parseScoreText(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d{1,3}$/.test(trimmed)) return null;
  const score = Number(trimmed);
  return score <= MAX_SCORE ? score : null;
}

/** 고치는 중인 점수: 위원 × 자리의 입력 글 (위원 점수와 같은 모양) */
export type AdjustDraft = readonly (readonly string[])[];

/** 위원 점수 그대로의 입력 글 (고치기 전의 모습) */
export function draftOf(members: MemberScores): AdjustDraft {
  return members.map((scores) => scores.map(String));
}

/** 입력란 하나의 글을 바꾼 새 값 */
export function editDraft(draft: AdjustDraft, memberIndex: number, slot: number, text: string): AdjustDraft {
  return draft.map((texts, index) => (index === memberIndex ? texts.map((value, at) => (at === slot ? text : value)) : texts));
}

/** 고치는 중인 점수로 다시 계산한 값 */
export type AdjustPreview = {
  /**
   * 요소별(지금 평가 기준의 요소 순서): 위원 점수(읽지 못한 입력은 null), 차이(하나라도 읽지 못하면 null), 크게 갈렸는지.
   * 차이를 모르는 요소는 아직 크게 갈린 것으로 둔다(확정할 수 없다).
   */
  columns: { scores: (number | null)[]; spread: number | null; wide: boolean }[];
  /** 위원별 종합 점수의 10배 (그 위원의 입력 중 읽지 못한 것이 있으면 null) */
  memberTotal10: (number | null)[];
  /** 위원별 종합 점수의 차이 (10배. 종합 점수를 하나라도 모르면 null) */
  spread10: number | null;
  /** 확정할 위원 점수: 입력이 모두 0~100 정수이고 크게 갈린 요소가 남지 않았을 때만 값이 있다 */
  members: MemberScores | null;
};

/**
 * 고치는 중인 입력으로 요소별 위원 점수·차이와 위원별 종합 점수를 다시 계산한다(지원자의 저장된 점수는 보지 않는다).
 * 자리는 순위 계산과 같은 규칙으로 요소에 맞춘다. 입력의 모양(위원 수, 자리 수)이 지원자와 다르면 확정할 수 없다.
 */
export function adjustPreviewOf(
  applicant: Pick<DecisionApplicant, "ai" | "members">,
  draft: AdjustDraft,
  elements: readonly PrepElement[],
): AdjustPreview {
  const parsed = applicant.members.map((scores, memberIndex) => scores.map((_, slot) => parseScoreText(draft[memberIndex]?.[slot] ?? "")));
  const slots = elements.map((_, index) => decisionSlotOf(applicant, index));
  const columns = slots.map((slot) => {
    const scores = parsed.map((row) => row[slot] ?? null);
    const known = scores.filter(isScore);
    // 읽지 못한 입력이 있으면 차이를 모른다: 아직 크게 갈린 것으로 둔다.
    if (known.length !== scores.length) return { scores, spread: null, wide: true };
    const spread = known.length === 0 ? 0 : Math.max(...known) - Math.min(...known);
    return { scores, spread, wide: spread >= WIDE_ELEMENT_SPREAD };
  });
  const memberTotal10 = parsed.map((row) => {
    const used = slots.map((slot) => row[slot] ?? null);
    const known = used.filter(isScore);
    return known.length === used.length ? weightedTenths(known, elements) : null;
  });
  const totals = memberTotal10.filter((total): total is number => total !== null);
  const complete = parsed.every((row) => row.every((score) => score !== null));
  return {
    columns,
    memberTotal10,
    spread10: totals.length === memberTotal10.length && totals.length > 0 ? Math.max(...totals) - Math.min(...totals) : null,
    members: complete && columns.every((column) => !column.wide) ? memberScoresOf(parsed, applicant.members) : null,
  };
}

/** 조정으로 달라진 최종 평가와 순위: "최종 평가 82.4 → 83.9점 · 28위 → 25위", 달라지지 않은 것은 "최종 평가 82.4점 그대로 · 28위 그대로" */
export function adjustEffectText(before: Pick<RankedApplicant, "final10" | "rank">, after: Pick<RankedApplicant, "final10" | "rank">): string {
  const final =
    before.final10 === after.final10
      ? `최종 평가 ${tenthsText(after.final10)}점 그대로`
      : `최종 평가 ${tenthsText(before.final10)} → ${tenthsText(after.final10)}점`;
  const rank = before.rank === after.rank ? `${after.rank}위 그대로` : `${before.rank}위 → ${after.rank}위`;
  return `${final} · ${rank}`;
}
