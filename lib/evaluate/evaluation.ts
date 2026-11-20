import { normalizeSearchText } from "../applicants/applicants.ts";
import { isUploadedCode, uploadedCodeNumber } from "../applicants/uploaded.ts";
import type { PrepElement } from "../prep/criteria.ts";
import {
  DOCUMENT_AREAS,
  EVALUATION_APPLICANTS,
  EXTRA_DOCUMENT_AREAS,
  SLOT_COUNT,
  type ApplicantEvidence,
  type DocumentArea,
  type EvaluationApplicant,
  type EvaluationSeed,
  type Passage,
  type PassageSegment,
  type Slot,
  type SlotAssessment,
} from "./sampleEvaluations.ts";

// 평가하기 화면의 평가 형식, 저장 값 확인, 화면용 계산. 브라우저와 Node 어디서나 돈다(순수 함수).
// 평가 요소·배점·세부 평가 항목은 전형 준비에서 저장한 평가 기준(lib/prep/criteria.ts 의 PrepElement)을 그대로 쓴다.
// 지원자는 예시 지원자(./sampleEvaluations.ts)와 올린 지원자(./uploadedEvaluation.ts)이고, 지원자 목록은 인자로 받는다.
// 예시 자료는 평가 요소를 자리(0~2)로 적어 두었으므로 요소 순번으로 자리를 맞춘다. 올린 지원자는 요소 순번이 그대로 자리다.

/** 저장한 평가의 상태: 고치는 중(평가 중) / 임시 저장 / 제출 완료 */
export type EvaluationRecordStatus = "editing" | "draft" | "submitted";

/** 지원자에게 붙이는 표시: 보류 / 재검토 요청 (둘 중 하나만) */
export type EvaluationMark = "hold" | "recheck";

/**
 * 지원자 한 명에 대한 내 평가. localStorage 에 이 모양 그대로 저장한다(lib/evaluate/evaluationStorage.ts).
 * - scores: 평가 요소 id → 내 점수(0~100 정수). 키가 없는 요소는 AI 점수와 같다.
 * - reasons: 평가 요소 id → 수정 사유 (내 점수가 AI 점수와 다를 때 필요하다)
 * - answers: 평가 요소 id → 세부 평가 항목 응답 (질문 키 "q1", "q2" … → 1~5)
 * - basis: 이 평가를 적은 때의 평가 요소 구성(criteriaBasis). 지금 구성과 다르면 이 평가는 쓰지 않는다(effectiveRecord).
 */
export type EvaluationRecord = {
  status: EvaluationRecordStatus;
  basis: string;
  scores: Readonly<Record<string, number>>;
  reasons: Readonly<Record<string, string>>;
  opinion: string;
  answers: Readonly<Record<string, Readonly<Record<string, number>>>>;
  mark: EvaluationMark | null;
  maskReported: boolean;
};

/** 지원자 코드 → 저장한 평가 */
export type Evaluations = Readonly<Record<string, EvaluationRecord>>;

export const NO_EVALUATIONS: Evaluations = Object.freeze({});

/** 지금 저장 형식의 버전 */
export const EVALUATIONS_VERSION = 1;

/** 값의 범위와 길이 한도 */
export const EVALUATION_LIMITS = {
  minScore: 0,
  maxScore: 100,
  minAnswer: 1,
  maxAnswer: 5,
  reasonLength: 200,
  opinionLength: 1000,
  /** 평가 요소 id 의 길이와 한 평가에 둘 수 있는 요소 수 (lib/prep/criteria.ts 의 한도보다 넉넉하게) */
  idLength: 64,
  elements: 12,
  /** 한 요소의 응답 수 (묶음 6개 × 질문 8개) */
  answers: 48,
  /** 평가 요소 구성 글의 길이 (요소 6개 × (id 64자 + 이름 30자) 보다 넉넉하게) */
  basisLength: 1000,
} as const;

/** 세부 평가 항목의 척도 (높은 점수부터 그린다) */
export const ANSWER_SCALE = [5, 4, 3, 2, 1] as const;

/** 아직 아무것도 정하지 않은 평가 (처음 고칠 때의 바탕) */
export const EMPTY_EVALUATION: EvaluationRecord = Object.freeze({
  status: "editing",
  basis: "",
  scores: Object.freeze({}),
  reasons: Object.freeze({}),
  opinion: "",
  answers: Object.freeze({}),
  mark: null,
  maskReported: false,
});

/** 화면에 보이는 상태. "대기" 는 평가가 아직 없는 지원자다. */
export const EVALUATION_STATUSES = ["평가 중", "임시 저장", "대기", "제출 완료"] as const;
export type EvaluationStatus = (typeof EVALUATION_STATUSES)[number];

export function evaluationStatus(record: EvaluationRecord | null): EvaluationStatus {
  if (record === null) return "대기";
  return record.status === "submitted" ? "제출 완료" : record.status === "draft" ? "임시 저장" : "평가 중";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIntegerIn(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function isElementId(key: string): boolean {
  return key.length >= 1 && key.length <= EVALUATION_LIMITS.idLength;
}

/** 요소 id → 값 꼴의 객체에서 조건에 맞는 것만 남긴다(요소 수 한도까지). */
function pickByElement<T>(value: unknown, parse: (item: unknown) => T | undefined): Record<string, T> {
  const result: Record<string, T> = {};
  if (!isRecord(value)) return result;
  for (const [key, item] of Object.entries(value)) {
    if (Object.keys(result).length >= EVALUATION_LIMITS.elements) break;
    if (!isElementId(key)) continue;
    const parsed = parse(item);
    if (parsed !== undefined) result[key] = parsed;
  }
  return result;
}

const ANSWER_KEY = /^q([1-9]\d?)$/;

function parseAnswers(value: unknown): Record<string, number> | undefined {
  if (!isRecord(value)) return undefined;
  const result: Record<string, number> = {};
  for (const [key, item] of Object.entries(value)) {
    const match = ANSWER_KEY.exec(key);
    if (match === null || Number(match[1]) > EVALUATION_LIMITS.answers) continue;
    if (isIntegerIn(item, EVALUATION_LIMITS.minAnswer, EVALUATION_LIMITS.maxAnswer)) result[key] = item;
  }
  return Object.keys(result).length === 0 ? undefined : result;
}

/** 평가 하나를 확인한다. 상태가 틀리면 버리고(null), 나머지 필드는 틀린 값만 빼고 쓴다(긴 글은 한도까지 자른다). */
function parseRecord(value: unknown): EvaluationRecord | null {
  if (!isRecord(value)) return null;
  const { status, opinion, mark, maskReported } = value;
  if (status !== "editing" && status !== "draft" && status !== "submitted") return null;
  return {
    status,
    basis: typeof value.basis === "string" ? value.basis.slice(0, EVALUATION_LIMITS.basisLength) : "",
    scores: pickByElement(value.scores, (item) =>
      isIntegerIn(item, EVALUATION_LIMITS.minScore, EVALUATION_LIMITS.maxScore) ? item : undefined,
    ),
    reasons: pickByElement(value.reasons, (item) =>
      typeof item === "string" && item !== "" ? item.slice(0, EVALUATION_LIMITS.reasonLength) : undefined,
    ),
    opinion: typeof opinion === "string" ? opinion.slice(0, EVALUATION_LIMITS.opinionLength) : "",
    answers: pickByElement(value.answers, parseAnswers),
    mark: mark === "hold" || mark === "recheck" ? mark : null,
    maskReported: maskReported === true,
  };
}

/**
 * 올린 지원자의 평가를 남기는 최대 수. 넘으면 번호가 작은 것부터 버린다(올린 지원자는 최근 30건만 남으므로 넉넉한 값이다.
 * 목록에서 밀려난 올린 지원자의 평가가 저장소에 끝없이 쌓이지 않게 한다).
 */
export const MAX_UPLOADED_EVALUATIONS = 50;

/**
 * 저장소에서 읽은 값(JSON 해석 결과)을 확인한다. 모양이 틀리면(객체가 아님, version 이 1 이 아님, records 가 객체가 아님)
 * 저장한 평가가 없는 것으로 본다. 쓰는 코드는 예시 지원자 24명의 코드와 올린 지원자의 코드 꼴("A-" + 네 자리, 번호 315 이상. 번호가 큰
 * 50건까지)이다. 그 밖의 코드와 모양이 틀린 평가는 버리고 나머지만 쓴다. 올린 지원자의 평가가 지금 목록의 지원자 것인지는 여기서 보지
 * 않는다(effectiveRecord 가 평가의 basis 로 본다).
 */
export function parseEvaluations(value: unknown): Evaluations {
  if (!isRecord(value) || value.version !== EVALUATIONS_VERSION || !isRecord(value.records)) return NO_EVALUATIONS;
  const stored = value.records;
  const result: Record<string, EvaluationRecord> = {};
  for (const applicant of EVALUATION_APPLICANTS) {
    if (!Object.hasOwn(stored, applicant.code)) continue;
    const record = parseRecord(stored[applicant.code]);
    if (record !== null) result[applicant.code] = record;
  }
  const uploadedCodes = Object.keys(stored)
    .filter(isUploadedCode)
    .sort((a, b) => uploadedCodeNumber(a) - uploadedCodeNumber(b))
    .slice(-MAX_UPLOADED_EVALUATIONS);
  for (const code of uploadedCodes) {
    const record = parseRecord(stored[code]);
    if (record !== null) result[code] = record;
  }
  return Object.keys(result).length === 0 ? NO_EVALUATIONS : result;
}

/** 저장할 값 */
export function serializeEvaluations(evaluations: Evaluations): string {
  return JSON.stringify({ version: EVALUATIONS_VERSION, records: evaluations });
}

/** AI 제안이 없는 자리에 쓰는 값 (지원자에게는 늘 제안이 하나 이상 있어 정상이라면 쓰이지 않는다) */
const NO_ASSESSMENT: SlotAssessment = Object.freeze({ score: 0, confidence: 1, tagPicks: Object.freeze([]) });

/**
 * 요소 순번 → 그 지원자 자료의 자리. 요소가 자리보다 많으면 자리를 돌려 쓴다(예시 지원자는 자리가 셋이다).
 * 올린 지원자는 자리 수가 평가 요소 수와 같아 요소 순번이 그대로 자리다.
 */
export function slotOf(applicant: Pick<EvaluationApplicant, "ai">, elementIndex: number): number {
  return applicant.ai.length === 0 ? 0 : elementIndex % applicant.ai.length;
}

/** 그 요소에 대한 AI 제안 */
export function assessmentOf(applicant: EvaluationApplicant, elementIndex: number): SlotAssessment {
  return applicant.ai[slotOf(applicant, elementIndex)] ?? NO_ASSESSMENT;
}

/**
 * 평가 요소 구성을 나타내는 글: 요소의 id 와 이름을 순서대로 이은 것 ("e1:잠재역량|e2:학업역량|…").
 * 내 점수·사유·응답은 요소 id 로 저장하는데, 전형 준비에서 모집요강 초안을 저장해 요소가 바뀌어도 id 는 e1, e2 … 로 같다.
 * 그래서 평가마다 적은 때의 구성을 같이 저장해 두고, 지금 구성과 다르면 그 평가를 쓰지 않는다(예전 요소에 준 값이 새 요소에 붙지 않게).
 * 배점만 바꾼 것은 구성이 같으므로 평가가 그대로 남고 종합 점수만 새 배점으로 다시 계산된다.
 */
export function criteriaBasis(elements: readonly PrepElement[]): string {
  return elements.map((element) => `${element.id}:${element.name}`).join("|");
}

/**
 * 그 지원자의 평가에 적는 basis: 평가 요소 구성(criteriaBasis)에, 올린 지원자면 "#" 과 그 분석의 표시(stamp: 분석을 남긴 때)를 붙인 글.
 * 올린 지원자의 코드는 목록에서 가장 큰 번호 + 1 로 정하므로, 저장하지 못해 메모리에만 있던 지원자가 새로고침으로 사라지면 같은 코드가
 * 다른 학생부에 다시 붙을 수 있다. 표시를 같이 적어 두면 그때 예전 학생부에 준 점수가 새 학생부에 붙지 않는다.
 */
export function evaluationBasis(applicant: Pick<EvaluationApplicant, "stamp">, elements: readonly PrepElement[]): string {
  const basis = criteriaBasis(elements);
  return applicant.stamp === undefined ? basis : `${basis}#${applicant.stamp}`;
}

/**
 * 처음 평가 상태(자리별)를 지금 평가 기준의 요소 id 로 옮긴 평가. 처음 상태가 없으면("대기") null.
 * 앞의 세 요소에만 처음 점수·사유가 붙고, 넷째부터는 AI 점수 그대로다.
 */
export function seedRecord(seed: EvaluationSeed | null, elements: readonly PrepElement[]): EvaluationRecord | null {
  if (seed === null) return null;
  const scores: Record<string, number> = {};
  const reasons: Record<string, string> = {};
  elements.slice(0, SLOT_COUNT).forEach((element, index) => {
    const slot = index as Slot;
    scores[element.id] = seed.scores[slot];
    const reason = seed.reasons[slot];
    if (reason !== undefined) reasons[element.id] = reason;
  });
  return { ...EMPTY_EVALUATION, status: seed.status, basis: criteriaBasis(elements), scores, reasons, opinion: seed.opinion };
}

/**
 * 지금 평가: 지금 평가 요소 구성으로(올린 지원자면 그 분석에 대해) 저장한 평가가 있으면 그것, 없으면 처음 상태 (둘 다 없으면 null = "대기").
 * basis 가 다른 평가는 쓰지 않는다(저장소에는 그대로 있고, 이 지원자를 다시 고치면 그때 지금 basis 의 평가로 바뀌어 저장된다).
 */
export function effectiveRecord(
  applicant: EvaluationApplicant,
  stored: Evaluations,
  elements: readonly PrepElement[],
): EvaluationRecord | null {
  const record = stored[applicant.code];
  if (record !== undefined && record.basis === evaluationBasis(applicant, elements)) return record;
  return seedRecord(applicant.seed, elements);
}

/** 그 요소의 내 점수: 정한 값이 없으면 AI 점수 */
export function myScoreOf(record: EvaluationRecord | null, elementId: string, aiScore: number): number {
  return record?.scores[elementId] ?? aiScore;
}

export function clampScore(score: number): number {
  return Math.min(EVALUATION_LIMITS.maxScore, Math.max(EVALUATION_LIMITS.minScore, Math.round(score)));
}

/** 종합 점수: 요소 점수를 배점으로 가중 평균해 반올림한다 (배점 합은 100 이다. 합이 0 이면 0). */
export function weightedTotal(scores: readonly number[], elements: readonly PrepElement[]): number {
  let sum = 0;
  let weights = 0;
  elements.forEach((element, index) => {
    sum += (scores[index] ?? 0) * element.weight;
    weights += element.weight;
  });
  return weights === 0 ? 0 : Math.round(sum / weights);
}

/** AI 종합 점수 (디자인의 "인재상 적합도") */
export function aiTotalOf(applicant: EvaluationApplicant, elements: readonly PrepElement[]): number {
  return weightedTotal(
    elements.map((_, index) => assessmentOf(applicant, index).score),
    elements,
  );
}

/** 내 종합 점수 */
export function myTotalOf(
  applicant: EvaluationApplicant,
  record: EvaluationRecord | null,
  elements: readonly PrepElement[],
): number {
  return weightedTotal(
    elements.map((element, index) => myScoreOf(record, element.id, assessmentOf(applicant, index).score)),
    elements,
  );
}

/** 배점 줄: "50·30·20" */
export function weightsLine(elements: readonly PrepElement[]): string {
  return elements.map((element) => element.weight).join("·");
}

/**
 * 그 요소의 AI 태그 줄: "# 전공활동탐색 # 자기주도성" (겹치는 태그는 한 번만).
 * 올린 지원자는 분석할 때 정한 태그(tags)를 그대로, 예시 자료는 고른 묶음(tagPicks)의 태그를 잇는다.
 */
export function assessmentTags(assessment: SlotAssessment, element: PrepElement): string {
  const tags: string[] = [];
  if (assessment.tags !== undefined) {
    for (const tag of assessment.tags) if (!tags.includes(tag)) tags.push(tag);
  } else {
    for (const pick of assessment.tagPicks) {
      const tag = element.groups[pick % element.groups.length]?.tag;
      if (tag !== undefined && !tags.includes(tag)) tags.push(tag);
    }
  }
  return tags.map((tag) => `# ${tag}`).join(" ");
}

/** 신뢰도가 이 값 이하이면 "사람 확인 권장" 을 붙인다 */
export const LOW_CONFIDENCE = 1;

export const MAX_CONFIDENCE = 4;

/**
 * 근거로 쓰이는 자리의 수: 지금 평가 기준에 그 자리를 쓰는 요소가 있어야 한다(요소가 자리보다 적으면 뒤 자리는 근거가 아니다).
 * 예시 지원자는 자리가 셋이라 요소가 둘이면 앞의 두 자리만 근거다.
 */
export function evidenceSlotCount(applicant: Pick<EvaluationApplicant, "ai">, elementCount: number): number {
  return Math.min(elementCount, applicant.ai.length);
}

/** 조각의 자리 가운데 근거로 쓰이는 것 (limit 은 evidenceSlotCount) */
export function evidenceSlotsOf(segment: PassageSegment, limit: number): number[] {
  return segment.slots.filter((slot) => slot < limit);
}

/** 원문 출처의 학년 머리: "2학년 · " (학년이 없는 항목은 빈 글) */
function gradePrefix(passage: Passage): string {
  return passage.grade === null ? "" : `${passage.grade}학년 · `;
}

/** 원문 위에 적는 출처: "2학년 · 경제" */
export function passageSource(passage: Passage): string {
  return `${gradePrefix(passage)}${passage.subject}`;
}

/** 근거에 적는 출처: "2학년 · 세특 · 경제" */
export function evidenceSource(passage: Passage): string {
  return `${gradePrefix(passage)}${passage.area} · ${passage.subject}`;
}

/** 근거 문장 하나 */
export type EvidenceItem = ApplicantEvidence;

/**
 * 그 요소의 근거 문장 (모든 서류 구분에서, 원문 순서대로).
 * 올린 지원자는 분석이 준 근거 구절(evidences)을, 예시 지원자는 원문 조각을 쓴다(조각 하나가 근거 문장 하나다).
 */
export function evidencesOf(
  applicant: EvaluationApplicant,
  elementIndex: number,
  elementCount: number,
): readonly EvidenceItem[] {
  const slot = slotOf(applicant, elementIndex);
  if (slot >= evidenceSlotCount(applicant, elementCount)) return [];
  if (applicant.evidences !== undefined) return applicant.evidences[slot] ?? [];
  const items: EvidenceItem[] = [];
  for (const passage of applicant.passages) {
    let start = 0;
    passage.segments.forEach((segment, index) => {
      const end = start + segment.text.length;
      if (segment.slots.includes(slot)) {
        items.push({
          id: `${passage.id}-${index}`,
          source: evidenceSource(passage),
          text: segment.text,
          place: { passageId: passage.id, start, end },
        });
      }
      start = end;
    });
  }
  return items;
}

/**
 * 원문 조각의 형광펜 색 순번(평가 요소 순번)과 지금 고른 요소의 근거인지. 근거가 아닌 조각은 null.
 * 조각이 지금 고른 요소의 근거면 그 요소의 색이고, 아니면 그 조각을 근거로 쓴 요소 가운데 맨 앞 요소의 색이다
 * (자리가 요소 순번과 같다: 예시 지원자는 앞의 세 요소, 올린 지원자는 모든 요소).
 */
export function segmentTone(
  segment: PassageSegment,
  selectedSlot: number,
  selectedIndex: number,
  slotLimit: number,
): { tone: number; selected: boolean } | null {
  const slots = evidenceSlotsOf(segment, slotLimit);
  if (slots.length === 0) return null;
  return slots.includes(selectedSlot) ? { tone: selectedIndex, selected: true } : { tone: slots[0], selected: false };
}

/** 그 서류 구분의 원문 */
export function passagesIn(applicant: EvaluationApplicant, area: DocumentArea): readonly Passage[] {
  return applicant.passages.filter((passage) => passage.area === area);
}

/** 그 지원자의 서류 구분 버튼: 네 영역은 늘, "독서" 는 그 영역의 원문이 있을 때만 */
export function documentAreasOf(applicant: EvaluationApplicant): DocumentArea[] {
  return [
    ...DOCUMENT_AREAS,
    ...EXTRA_DOCUMENT_AREAS.filter((area) => applicant.passages.some((passage) => passage.area === area)),
  ];
}

/** 세부 평가 항목의 질문 하나: 응답을 저장하는 키("q1" …)와 요소 안에서 이어지는 번호 */
export type RubricQuestion = {
  key: string;
  number: number;
  text: string;
};

export type RubricGroup = {
  name: string;
  questions: RubricQuestion[];
};

/** 그 요소의 세부 평가 항목: 묶음과 질문. 번호는 묶음을 넘어 이어진다(1~4, 5~6 …). */
export function rubricGroups(element: PrepElement): RubricGroup[] {
  let next = 1;
  return element.groups.map((group) => {
    const questions = group.questions.map((text, offset) => ({ key: `q${next + offset}`, number: next + offset, text }));
    next += group.questions.length;
    return { name: group.name, questions };
  });
}

/** 그 요소의 질문 수 */
export function questionCount(element: PrepElement): number {
  return element.groups.reduce((sum, group) => sum + group.questions.length, 0);
}

/** 그 요소의 응답 가운데 지금 질문에 해당하는 것만 (평가 기준이 바뀌어 남은 응답은 빼고) */
export function validAnswers(record: EvaluationRecord | null, element: PrepElement): Record<string, number> {
  const stored = record?.answers[element.id];
  const result: Record<string, number> = {};
  if (stored === undefined) return result;
  const count = questionCount(element);
  for (let number = 1; number <= count; number += 1) {
    const answer = stored[`q${number}`];
    if (answer !== undefined) result[`q${number}`] = answer;
  }
  return result;
}

/** 응답의 평균 (응답이 없으면 null) */
export function answerAverage(answers: Readonly<Record<string, number>>): number | null {
  const values = Object.values(answers);
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** 척도 평균(1~5)을 요소 점수(20~100)로: 평균 × 20 을 반올림 */
export function rubricScore(average: number): number {
  return clampScore(average * 20);
}

/** 지원자 찾기 (목록에 없는 코드면 undefined). 목록은 평가할 지원자 전체다(./uploadedEvaluation.ts 의 evaluationApplicants). */
export function findEvaluationApplicant(
  applicants: readonly EvaluationApplicant[],
  code: string | null,
): EvaluationApplicant | undefined {
  return code === null ? undefined : applicants.find((applicant) => applicant.code === code);
}

/** 평가 순서(목록 순서)에서의 자리(1부터)와 앞뒤 지원자 코드 */
export function queuePosition(
  applicants: readonly EvaluationApplicant[],
  code: string,
): { position: number; total: number; previous: string | null; next: string | null } {
  const index = applicants.findIndex((applicant) => applicant.code === code);
  return {
    position: index + 1,
    total: applicants.length,
    previous: index > 0 ? applicants[index - 1].code : null,
    next: index >= 0 && index < applicants.length - 1 ? applicants[index + 1].code : null,
  };
}

/**
 * 검색어가 지원자 코드나 한 줄 요약에 들어 있는지. 코드는 공백·"-" 를 빼고 대소문자 없이("a0187" → A-0187), 요약은 공백을 빼고
 * 견준다("소비자료" → "소비 자료…"). 검색어가 비어 있으면 거르지 않는다.
 */
export function matchesEvaluationSearch(applicant: Pick<EvaluationApplicant, "code" | "summary">, query: string): boolean {
  const text = query.replace(/\s/g, "").toUpperCase();
  if (text === "") return true;
  const codeNeedle = normalizeSearchText(query);
  if (codeNeedle !== "" && normalizeSearchText(applicant.code).includes(codeNeedle)) return true;
  return applicant.summary.replace(/\s/g, "").toUpperCase().includes(text);
}

/** 비율(%) 글: 소수 첫째 자리까지, ".0" 은 뗀다 ("87.5", "100"). 나눌 수 없으면 "0". */
export function percentText(done: number, total: number): string {
  if (total <= 0) return "0";
  return ((done / total) * 100).toFixed(1).replace(/\.0$/, "");
}

/** 총평 화면 주소 */
export function summaryPath(code: string): string {
  return `/evaluate/summary?code=${encodeURIComponent(code)}`;
}

/**
 * 평가하기 · 원문보기 화면 주소 (그 지원자의 학생부 원문과 기준별 근거).
 * sectionId 를 주면 그 항목을 고른 채로 연다(쪽 그림이 있으면 실제 PDF 의 그 자리를 보여 준다).
 */
export function evaluateOriginalPath(code: string, sectionId?: string): string {
  const base = `/evaluate/original?code=${encodeURIComponent(code)}`;
  return sectionId === undefined ? base : `${base}&section=${encodeURIComponent(sectionId)}`;
}

/** 세부 항목 평가 화면 주소. elementId 가 비어 있으면 요소를 적지 않는다(그 화면이 첫 요소를 보여 준다). */
export function detailPath(code: string, elementId: string): string {
  const base = `/evaluate/detail?code=${encodeURIComponent(code)}`;
  return elementId === "" ? base : `${base}&item=${encodeURIComponent(elementId)}`;
}
