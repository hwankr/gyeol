import type { PrepElement } from "../prep/criteria.ts";
import { adjustmentOf, type DecisionAdjustments } from "./adjustments.ts";
import { standingText, tenthsText, type Cutline, type RankedApplicant } from "./decision.ts";
import { elementSpreadsOf, needsAdjustment } from "./opinions.ts";

// 선발 결정 · 기록 확정의 계산: 확정하기 전에 확인할 것(위원 간 점수 조정이 얼마나 끝났는지, 합격선)의 값과 글,
// 확정한 기록(확정한 때의 순위와 최종 평가)의 형식과 저장 값 확인.
// 브라우저와 Node 어디서나 돈다(순수 함수). 저장·불러오기는 lib/decision/confirmStorage.ts 가 한다.

/** 위원 간 점수 조정이 얼마나 끝났는지 (지원자 수) */
export type AdjustProgress = {
  /** 조정이 필요했던 지원자: 아직 필요한 지원자 + 조정을 확정한 지원자 */
  total: number;
  /** 조정을 확정해 크게 갈린 요소가 남지 않은 지원자 (위원 의견 모아보기의 `조정 완료`) */
  done: number;
  /** 아직 조정이 필요한 지원자 (위원 의견 모아보기의 `조정 필요`, 머리의 `조정 N`) */
  left: number;
};

/**
 * 위원 간 점수 조정의 진행. ranked 는 확정한 조정을 덮어쓴 순위다(hooks/useDecisionData.ts).
 * 조정을 확정했는데도 크게 갈린 요소가 남은 지원자(조정한 뒤 평가 요소의 수가 바뀐 경우)는 아직 조정이 필요한 쪽에 센다.
 */
export function adjustProgressOf(
  ranked: readonly RankedApplicant[],
  elements: readonly PrepElement[],
  adjustments: DecisionAdjustments,
): AdjustProgress {
  let done = 0;
  let left = 0;
  for (const row of ranked) {
    if (needsAdjustment(elementSpreadsOf(row, elements))) left += 1;
    else if (adjustmentOf(adjustments, row.applicant.code) !== undefined) done += 1;
  }
  return { total: done + left, done, left };
}

/** 확인 항목의 설명 한 조각. strong 이면 굵게 적는다. 조각 사이는 " · " 로 잇는다. */
export type CheckPart = { text: string; strong: boolean };

/** 서류평가: "총 312명" · "위원 3인 제출 완료" */
export function evaluationCheckParts(evaluatedCount: number, memberCount: number): CheckPart[] {
  return [
    { text: `총 ${evaluatedCount}명`, strong: false },
    { text: `위원 ${memberCount}인 제출 완료`, strong: true },
  ];
}

/**
 * 위원 간 점수 조정: "4건 조정 필요" · "4건 모두 완료", 남았으면 "4건 조정 필요" · "1건 완료, 3건 남음".
 * 조정이 필요했던 지원자가 없으면 "조정이 필요한 지원자 없음" 한 조각이다.
 */
export function adjustCheckParts(progress: AdjustProgress): CheckPart[] {
  if (progress.total === 0) return [{ text: "조정이 필요한 지원자 없음", strong: true }];
  return [
    { text: `${progress.total}건 조정 필요`, strong: false },
    {
      text: progress.left === 0 ? `${progress.total}건 모두 완료` : `${progress.done}건 완료, ${progress.left}건 남음`,
      strong: true,
    },
  ];
}

/** 합격선 확인: "30위 82.0점" · "예비 1번과 0.2점 차이" (점수가 같으면 "예비 1번과 동점"). 합격선의 두 사람이 없으면 안내 한 조각이다. */
export function cutlineCheckParts(cutline: Cutline | null): CheckPart[] {
  if (cutline === null) return [{ text: "합격선 주변의 지원자가 없음", strong: true }];
  return [
    { text: `${cutline.last.rank}위 ${tenthsText(cutline.last.final10)}점`, strong: true },
    { text: cutline.gap10 === 0 ? "예비 1번과 동점" : `예비 1번과 ${tenthsText(cutline.gap10)}점 차이`, strong: false },
  ];
}

/** 확정한 기록의 한 줄: 지원자의 순위와 최종 평가(10배 한 정수) */
export type ConfirmRow = {
  code: string;
  rank: number;
  final10: number;
};

/** 확정한 기록: 확정한 시각(ISO 문자열), 확정한 사람("홍길동 사정관"), 그때의 모집 인원, 합격선 주변 명단(순위 순서) */
export type DecisionConfirmation = {
  at: string;
  actor: string;
  quota: number;
  rows: readonly ConfirmRow[];
};

/** 지금 저장 형식의 버전 */
export const DECISION_CONFIRM_VERSION = 1;

/** 확정한 사람 이름의 최대 길이 */
const MAX_ACTOR_LENGTH = 100;

/** 최종 평가(10배)의 범위: 0.0 ~ 100.0점 */
const MAX_FINAL10 = 1000;

/** 순위·모집 인원으로 받아들이는 가장 큰 값 */
const MAX_RANK = 1_000_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= MAX_RANK;
}

/** 순위를 매긴 지원자 → 기록에 남길 줄 (순위 순서 그대로) */
export function confirmRowsOf(ranked: readonly RankedApplicant[]): ConfirmRow[] {
  return ranked.map((row) => ({ code: row.applicant.code, rank: row.rank, final10: row.final10 }));
}

/** 두 명단이 같은지: 줄 수, 줄마다 지원자·순위·최종 평가 */
export function sameConfirmRows(a: readonly ConfirmRow[], b: readonly ConfirmRow[]): boolean {
  return a.length === b.length && a.every((row, index) => row.code === b[index].code && row.rank === b[index].rank && row.final10 === b[index].final10);
}

/** 명단을 한 줄의 글로 (명단이 달라졌는지 견줄 때 쓴다): "A-0012:25:837|A-0029:26:832|…" */
export function confirmRowsKey(rows: readonly ConfirmRow[]): string {
  return rows.map((row) => `${row.code}:${row.rank}:${row.final10}`).join("|");
}

/** 기록의 줄에 적는 구분: "합격권" 또는 "예비 1" (그 기록의 모집 인원으로 정한다) */
export function confirmStandingOf(row: Pick<ConfirmRow, "rank">, quota: number): { text: string; admitted: boolean } {
  const admitted = row.rank <= quota;
  return { text: standingText({ admitted, waitNumber: admitted ? null : row.rank - quota }), admitted };
}

/**
 * 저장소에서 읽은 값(JSON 해석 결과)을 확인한다. 하나라도 틀리면 확정한 기록이 없는 것으로 본다(null). 일부만 살리지 않는다:
 * 줄이 빠진 명단을 확정한 기록이라고 보여 주지 않으려는 것이다.
 * - 객체이고 version 이 1, at 이 날짜로 읽히는 글, actor 가 1~100자, quota 가 1 이상의 정수
 * - rows 가 한 줄 이상: 줄마다 지원자 목록에 있는 코드(되풀이 없음), 1 이상의 정수 순위(앞 줄보다 큼), 0~1000 의 정수 최종 평가
 */
export function parseDecisionConfirmation(value: unknown, codes: readonly string[]): DecisionConfirmation | null {
  if (!isRecord(value) || value.version !== DECISION_CONFIRM_VERSION) return null;
  const { at, actor, quota } = value;
  if (typeof at !== "string" || Number.isNaN(Date.parse(at))) return null;
  if (typeof actor !== "string" || actor.trim().length === 0 || actor.length > MAX_ACTOR_LENGTH) return null;
  if (!isCount(quota)) return null;
  if (!Array.isArray(value.rows) || value.rows.length === 0) return null;
  const rows: ConfirmRow[] = [];
  for (const item of value.rows) {
    if (!isRecord(item)) return null;
    const { code, rank, final10 } = item;
    if (typeof code !== "string" || !codes.includes(code) || rows.some((row) => row.code === code)) return null;
    if (!isCount(rank) || (rows.length > 0 && rank <= rows[rows.length - 1].rank)) return null;
    if (typeof final10 !== "number" || !Number.isInteger(final10) || final10 < 0 || final10 > MAX_FINAL10) return null;
    rows.push({ code, rank, final10 });
  }
  return { at, actor, quota, rows };
}

/** 저장할 값 */
export function serializeDecisionConfirmation(confirmation: DecisionConfirmation): string {
  return JSON.stringify({ version: DECISION_CONFIRM_VERSION, ...confirmation });
}
