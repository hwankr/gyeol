import {
  NO_REVIEWS,
  type Applicant,
  type ApplicantDecisions,
  type ApplicantReviews,
  type MaskDecision,
} from "./applicants.ts";

// 저장한 가림 결정의 형식과 확인. 저장 값은 { version: 1, reviews: { "<코드>": { "<표현 id>": "mask" | "keep" } } } 이다.

/** 지금 저장 형식의 버전 */
export const APPLICANT_REVIEWS_VERSION = 1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMaskDecision(value: unknown): value is MaskDecision {
  return value === "mask" || value === "keep";
}

/**
 * 저장소에서 읽은 값(JSON 해석 결과)을 확인한다. 모양이 틀리면(객체가 아님, version 이 1 이 아님, reviews 가 객체가 아님)
 * 저장한 결정이 없는 것으로 본다. 모르는 코드, 그 지원자에게 없는 표현 id, mask·keep 이 아닌 값은 버리고 나머지만 쓴다.
 * 남은 결정이 없는 지원자는 넣지 않는다.
 */
export function parseApplicantReviews(value: unknown, applicants: readonly Applicant[]): ApplicantReviews {
  if (!isRecord(value) || value.version !== APPLICANT_REVIEWS_VERSION || !isRecord(value.reviews)) return NO_REVIEWS;
  const stored = value.reviews;
  const result: Record<string, ApplicantDecisions> = {};
  for (const applicant of applicants) {
    if (!Object.hasOwn(stored, applicant.code)) continue;
    const decisions = stored[applicant.code];
    if (!isRecord(decisions)) continue;
    const kept: Record<string, MaskDecision> = {};
    for (const expression of applicant.expressions) {
      const decision = Object.hasOwn(decisions, expression.id) ? decisions[expression.id] : undefined;
      if (isMaskDecision(decision)) kept[expression.id] = decision;
    }
    if (Object.keys(kept).length > 0) result[applicant.code] = kept;
  }
  return Object.keys(result).length === 0 ? NO_REVIEWS : result;
}

/** 저장할 값 */
export function serializeApplicantReviews(reviews: ApplicantReviews): string {
  return JSON.stringify({ version: APPLICANT_REVIEWS_VERSION, reviews });
}
