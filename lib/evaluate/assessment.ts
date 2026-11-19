import type { Assessment, Criterion, ElementAssessment, Evidence, GradeGrowth } from "@/types/analysis";
import { truncateText } from "../criteria/normalize.ts";
import { rubricFingerprint } from "../prep/analysisCriteria.ts";
import { numberedGroups, type PrepElement } from "../prep/criteria.ts";

// AI 제안(평가 요소별 점수·신뢰도·태그, 한 줄 요약, 학년별 성장)의 계산과 정리. 순수 함수라 브라우저와 Node 어디서나 돈다.
// AI 는 세부 평가 항목의 질문마다 1~5 를 고르고(lib/pipeline/assessRecord.ts), 점수는 여기서 계산한다(사람의 세부 항목 평가와 같은 식:
// 응답 평균 × 20). AI 가 점수를 직접 적지 않으므로 같은 응답이면 늘 같은 점수가 나오고, 사람의 점수와 같은 척도로 견줄 수 있다.
// 어떤 입력에도 예외를 던지지 않는다.

/** 값의 범위와 길이 한도 */
export const ASSESSMENT_LIMITS = {
  minRating: 1,
  maxRating: 5,
  minConfidence: 1,
  maxConfidence: 4,
  minScore: 0,
  maxScore: 100,
  /** 한 줄 요약의 길이 */
  summaryLength: 60,
  /** 학년별 성장 이름표의 길이 */
  labelLength: 16,
  /** 요소 하나에 붙이는 태그 수 */
  tags: 2,
} as const;

/** 묶음의 응답 평균이 이 값 이상이면 그 묶음의 태그를 붙인다 */
export const TAG_AVERAGE = 4;

/** 질문 일부에 응답이 없을 때 신뢰도의 위쪽 끝 */
const PARTIAL_CONFIDENCE = 2;

/** 요약이 비어 있을 때 쓰는 글 */
export const NO_SUMMARY = "요약 없음";

/** 그 학년의 성장 이름표가 비어 있을 때 쓰는 글 */
export const NO_GROWTH_LABEL = "기록 없음";

/** 성장 요약을 적는 학년 */
export const GROWTH_GRADES = [1, 2, 3] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** min~max 의 정수면 그 값, 아니면 undefined */
function integerIn(value: unknown, min: number, max: number): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : undefined;
}

/** 여러 줄·연속 공백을 공백 하나로 줄이고 길이를 자른다. 문자열이 아니면 빈 글. */
function oneLine(value: unknown, maxLength: number): string {
  return typeof value === "string" ? truncateText(value.replace(/\s+/g, " ").trim(), maxLength) : "";
}

function averageOf(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** 응답 평균(1~5)을 점수(20~100)로: 평균 × 20 을 반올림 (lib/evaluate/evaluation.ts 의 rubricScore 와 같은 식) */
export function ratingScore(average: number): number {
  return Math.min(ASSESSMENT_LIMITS.maxScore, Math.max(ASSESSMENT_LIMITS.minScore, Math.round(average * 20)));
}

/** AI 가 준 질문별 응답 목록([{ key, rating }])에서 1~5 정수인 것만 꺼낸다. 같은 key 가 또 나오면 앞의 것을 쓴다. */
function readRatings(value: unknown): Map<string, number> {
  const ratings = new Map<string, number>();
  if (!Array.isArray(value)) return ratings;
  for (const item of value) {
    if (!isRecord(item) || typeof item.key !== "string" || ratings.has(item.key)) continue;
    const rating = integerIn(item.rating, ASSESSMENT_LIMITS.minRating, ASSESSMENT_LIMITS.maxRating);
    if (rating !== undefined) ratings.set(item.key, rating);
  }
  return ratings;
}

/**
 * 묶음의 태그 가운데 붙일 것: 응답 평균이 4 이상인 묶음을 평균이 높은 순서로(같으면 묶음 순서) 두 개까지. 겹치는 태그는 한 번만.
 */
function pickTags(element: PrepElement, averages: readonly (number | null)[]): string[] {
  const strong = element.groups
    .map((group, index) => ({ tag: group.tag, average: averages[index] ?? null, index }))
    .filter((item): item is { tag: string; average: number; index: number } => item.average !== null && item.average >= TAG_AVERAGE)
    .sort((a, b) => b.average - a.average || a.index - b.index);
  const tags: string[] = [];
  for (const item of strong) {
    if (tags.length >= ASSESSMENT_LIMITS.tags) break;
    if (!tags.includes(item.tag)) tags.push(item.tag);
  }
  return tags;
}

/** 학년별 성장 세 건(1·2·3학년). AI 가 주지 않은 학년은 "기록 없음"·0 이다. 지수는 0~100 으로 맞춘다. */
function readGrowth(value: unknown): GradeGrowth[] {
  const items = Array.isArray(value) ? value.filter(isRecord) : [];
  return GROWTH_GRADES.map((grade) => {
    const source = items.find((item) => item.grade === grade);
    const label = oneLine(source?.label, ASSESSMENT_LIMITS.labelLength);
    const index = source?.index;
    return {
      grade,
      label: label === "" ? NO_GROWTH_LABEL : label,
      index:
        typeof index === "number" && Number.isFinite(index)
          ? Math.min(ASSESSMENT_LIMITS.maxScore, Math.max(ASSESSMENT_LIMITS.minScore, Math.round(index)))
          : 0,
    };
  });
}

/**
 * AI 가 준 값(JSON 해석 결과)을 AI 제안으로 정리한다. 쓸 수 없으면 null(호출한 쪽이 응답 해석 실패로 다룬다).
 * - 모양: { summary, elements: [{ id, ratings: [{ key, rating }], confidence }], growth: [{ grade, label, index }] }.
 * - 요소는 받은 평가 요소(elements)의 순서대로 본다. 요소 i 는 기준 i(criteria[i], id c1 …)이고 AI 응답에서는 그 id 로 찾는다.
 *   응답에 그 요소가 없거나, 그 요소의 질문(q1 … 요소 안에서 묶음을 넘어 이어지는 번호) 가운데 1~5 정수로 응답한 것이 하나도 없으면 null.
 * - 점수: 응답한 질문의 평균 × 20 을 반올림(20~100). 지금 질문에 없는 key 와 범위 밖 값은 쓰지 않는다.
 * - 신뢰도: 1~4 정수가 아니면 1. 응답이 빠진 질문이 있으면 2 를 넘지 않는다.
 * - 태그: pickTags.
 * - 요약: 한 줄로 줄여 60자까지, 비면 "요약 없음". 성장: readGrowth.
 * elements 와 criteria 의 개수가 다르면 null(둘은 같은 평가 기준에서 만든 것이어야 한다).
 */
export function normalizeAssessment(
  raw: unknown,
  elements: readonly PrepElement[],
  criteria: readonly Criterion[],
): Assessment | null {
  if (!isRecord(raw) || !Array.isArray(raw.elements) || elements.length === 0 || elements.length !== criteria.length) {
    return null;
  }
  const sources = raw.elements.filter(isRecord);
  const assessed: ElementAssessment[] = [];
  for (const [index, element] of elements.entries()) {
    const criterion = criteria[index];
    const source = sources.find((item) => item.id === criterion.id);
    if (source === undefined) return null;
    const ratings = readRatings(source.ratings);
    const groups = numberedGroups(element).map((group) =>
      group.questions.flatMap((question) => {
        const rating = ratings.get(`q${question.number}`);
        return rating === undefined ? [] : [rating];
      }),
    );
    const answered = groups.flat();
    const average = averageOf(answered);
    if (average === null) return null;
    const questionTotal = element.groups.reduce((sum, group) => sum + group.questions.length, 0);
    const confidence =
      integerIn(source.confidence, ASSESSMENT_LIMITS.minConfidence, ASSESSMENT_LIMITS.maxConfidence) ??
      ASSESSMENT_LIMITS.minConfidence;
    assessed.push({
      criterionId: criterion.id,
      score: ratingScore(average),
      confidence: answered.length < questionTotal ? Math.min(confidence, PARTIAL_CONFIDENCE) : confidence,
      tags: pickTags(element, groups.map(averageOf)),
    });
  }
  const summary = oneLine(raw.summary, ASSESSMENT_LIMITS.summaryLength);
  return {
    rubric: rubricFingerprint(elements),
    summary: summary === "" ? NO_SUMMARY : summary,
    elements: assessed,
    growth: readGrowth(raw.growth),
  };
}

/**
 * 근거가 하나도 없는 요소의 신뢰도를 1 로 낮춘다. 화면은 신뢰도 1 에 "사람 확인 권장" 을 붙인다.
 * AI 제안과 근거 추출은 따로 부르므로(서로의 결과를 보지 않는다), 사람에게 보여 줄 근거가 없는 점수는 여기서 낮은 신뢰도로 맞춘다.
 */
export function withEvidenceConfidence(assessment: Assessment, evidences: readonly Evidence[]): Assessment {
  const supported = new Set(evidences.map((evidence) => evidence.criterionId));
  return {
    ...assessment,
    elements: assessment.elements.map((element) =>
      supported.has(element.criterionId) ? element : { ...element, confidence: ASSESSMENT_LIMITS.minConfidence },
    ),
  };
}
