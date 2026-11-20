import type {
  AnalysisResult,
  Assessment,
  Criterion,
  DepartmentCriteria,
  ElementAssessment,
  Evidence,
  GradeGrowth,
  Linkage,
  LinkageCard,
  LinkageLink,
  Section,
} from "@/types/analysis";
import { ASSESSMENT_LIMITS, GROWTH_GRADES } from "./evaluate/assessment.ts";
import { countByCriterion } from "./resultView.ts";

/**
 * 값이 AnalysisResult 모양(필드 이름과 타입)을 갖췄는지 확인한다.
 * localStorage 나 API 응답처럼 밖에서 들어온 값을 화면에 넘기기 전에 쓴다.
 * masks 가 없는 값은 블라인드 처리를 거치지 않은 예전 결과이므로 받아들이지 않는다
 * ("블라인드 처리됨" 화면에 가리지 않은 원문을 그리지 않게).
 * assessment(AI 제안)는 없어도 되고(전형 준비 기준이 아닌 분석, 예전 결과), 있으면 모양이 맞아야 한다.
 * linkage(학년별 연계)도 없어도 되고(연계가 아직 없는 분석), 있으면 모양이 맞아야 한다(isLinkage).
 */
export function isAnalysisResult(value: unknown): value is AnalysisResult {
  if (!isRecord(value)) return false;
  const { criteria, sections, evidences, masks, assessment, linkage } = value;
  return (
    isDepartmentCriteria(criteria) &&
    Array.isArray(sections) &&
    sections.every(isSection) &&
    Array.isArray(evidences) &&
    evidences.every(isEvidence) &&
    Array.isArray(masks) &&
    masks.every(isMask) &&
    (assessment === undefined || isAssessment(assessment)) &&
    (linkage === undefined || isLinkage(linkage))
  );
}

/**
 * 값이 학년별 연계 모양(필드 이름과 타입)을 갖췄는지 확인한다. /api/linkage 의 응답과 저장소에서 읽은 결과에 쓴다.
 * 내용이 분석 결과와 맞는지(카드의 근거가 실제로 있는지 등)는 linkageProblems 가 본다.
 */
export function isLinkage(value: unknown): value is Linkage {
  if (!isRecord(value)) return false;
  return Array.isArray(value.cards) && value.cards.every(isLinkageCard) && Array.isArray(value.links) && value.links.every(isLinkageLink);
}

function isLinkageCard(value: unknown): value is LinkageCard {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.criterionId === "string" &&
    typeof value.sectionId === "string" &&
    Array.isArray(value.evidenceIds) &&
    value.evidenceIds.every((id) => typeof id === "string") &&
    typeof value.title === "string" &&
    typeof value.theme === "string" &&
    (value.depth === null || value.depth === 1 || value.depth === 2 || value.depth === 3)
  );
}

function isLinkageLink(value: unknown): value is LinkageLink {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.criterionId === "string" &&
    typeof value.fromCardId === "string" &&
    typeof value.toCardId === "string" &&
    (value.kind === "stated" || value.kind === "suggested") &&
    (value.statedQuote === undefined || typeof value.statedQuote === "string") &&
    (value.statedSectionId === undefined || typeof value.statedSectionId === "string") &&
    typeof value.reason === "string"
  );
}

/** 학년별 연계의 카드를 놓는 학년 */
const LINKAGE_GRADES: readonly number[] = [1, 2, 3];

/**
 * 학년별 연계의 내용이 분석 결과와 맞는지 검사하고, 어긋난 점을 문장 목록으로 돌려준다(빈 배열이면 문제가 없다).
 * validateResult 와 같이 문장에는 id 만 넣는다(제목·태그·구절·이유의 글은 넣지 않는다). 문장은 "연계 카드 <id>" 나 "연계 연결 <id>" 로 시작한다.
 * - 카드: id 가 겹치지 않고, 기준과 항목이 실제로 있고, 항목의 학년이 1~3 이고, 제목이 있고, 근거가 1개 이상이며 모두 그 기준·그 항목의 것이고
 *   다른 카드에 들어 있지 않고, 깊이가 null 이거나 1~3 의 정수다.
 * - 연결: id 가 겹치지 않고, 두 카드가 실제로 있고 서로 다르며 연결의 기준과 같은 기준이고, 앞 카드의 학년이 뒤 카드보다 낮고, 이유가 있다.
 *   기록에 적힌 연속(stated)이면 구절과 그 항목이 있고 그 항목이 두 카드의 항목 가운데 하나이며 구절이 그 원문에 글자 그대로 있다.
 *   AI 가 제안한 연관(suggested)이면 구절과 그 항목이 없다.
 */
export function linkageProblems(result: Pick<AnalysisResult, "criteria" | "sections" | "evidences">, linkage: Linkage): string[] {
  const problems: string[] = [];
  const criterionIds = new Set(result.criteria.criteria.map((criterion) => criterion.id));
  const sectionById = new Map(result.sections.map((section) => [section.id, section]));
  const evidenceById = new Map(result.evidences.map((evidence) => [evidence.id, evidence]));

  const cardById = new Map<string, LinkageCard>();
  const usedEvidenceIds = new Set<string>();
  for (const card of linkage.cards) {
    if (cardById.has(card.id)) problems.push(`연계 카드 id 중복: ${card.id}`);
    cardById.set(card.id, card);
    const label = `연계 카드 ${card.id}`;
    if (!criterionIds.has(card.criterionId)) problems.push(`${label}: 기준 목록에 없는 기준 id "${card.criterionId}"`);
    const section = sectionById.get(card.sectionId);
    if (section === undefined) {
      problems.push(`${label}: 없는 항목 id "${card.sectionId}"`);
    } else if (section.grade === null || !LINKAGE_GRADES.includes(section.grade)) {
      problems.push(`${label}: 항목 ${card.sectionId} 의 학년이 1~3 이 아님`);
    }
    if (card.title.trim().length === 0) problems.push(`${label}: 제목이 비어 있음`);
    if (card.depth !== null && !isIntegerIn(card.depth, 1, 3)) problems.push(`${label}: 깊이가 1~3 의 정수가 아님`);
    if (card.evidenceIds.length === 0) problems.push(`${label}: 근거가 없음`);
    for (const evidenceId of card.evidenceIds) {
      const evidence = evidenceById.get(evidenceId);
      if (evidence === undefined) {
        problems.push(`${label}: 없는 근거 id "${evidenceId}"`);
        continue;
      }
      if (evidence.criterionId !== card.criterionId || evidence.sectionId !== card.sectionId) {
        problems.push(`${label}: 근거 ${evidenceId} 가 이 카드의 기준·항목의 것이 아님`);
      }
      if (usedEvidenceIds.has(evidenceId)) problems.push(`${label}: 근거 ${evidenceId} 가 다른 카드에도 있음`);
      usedEvidenceIds.add(evidenceId);
    }
  }

  const linkIds = new Set<string>();
  for (const link of linkage.links) {
    if (linkIds.has(link.id)) problems.push(`연계 연결 id 중복: ${link.id}`);
    linkIds.add(link.id);
    const label = `연계 연결 ${link.id}`;
    const from = cardById.get(link.fromCardId);
    const to = cardById.get(link.toCardId);
    if (from === undefined || to === undefined) {
      problems.push(`${label}: 없는 카드 id "${from === undefined ? link.fromCardId : link.toCardId}"`);
      continue;
    }
    if (from === to) problems.push(`${label}: 앞뒤 카드가 같음`);
    if (from.criterionId !== link.criterionId || to.criterionId !== link.criterionId) {
      problems.push(`${label}: 두 카드의 기준이 연결의 기준과 다름`);
    }
    const fromGrade = sectionById.get(from.sectionId)?.grade ?? null;
    const toGrade = sectionById.get(to.sectionId)?.grade ?? null;
    if (fromGrade === null || toGrade === null || fromGrade >= toGrade) {
      problems.push(`${label}: 앞 카드의 학년이 뒤 카드보다 낮지 않음`);
    }
    if (link.reason.trim().length === 0) problems.push(`${label}: 이유가 비어 있음`);
    if (link.kind === "suggested") {
      if (link.statedQuote !== undefined || link.statedSectionId !== undefined) {
        problems.push(`${label}: AI 가 제안한 연관인데 구절이 있음`);
      }
      continue;
    }
    if (link.statedQuote === undefined || link.statedQuote.trim().length === 0 || link.statedSectionId === undefined) {
      problems.push(`${label}: 기록에 적힌 연속인데 구절이나 그 항목이 없음`);
      continue;
    }
    if (link.statedSectionId !== from.sectionId && link.statedSectionId !== to.sectionId) {
      problems.push(`${label}: 구절의 항목이 두 카드의 항목이 아님`);
      continue;
    }
    if (!(sectionById.get(link.statedSectionId)?.text.includes(link.statedQuote) ?? false)) {
      problems.push(`${label}: 구절이 항목 ${link.statedSectionId} 원문에 글자 그대로 없음`);
    }
  }
  return problems;
}

/**
 * AnalysisResult 의 내용이 서로 맞는지 검사하고, 어긋난 점을 문장 목록으로 돌려준다.
 * 빈 배열이면 문제가 없다는 뜻이다.
 * 문장에는 id(기준·항목·근거), 블라인드 처리 내역의 종류 이름·순번·개수만 넣고 항목 원문·인용 구절·이유는 넣지 않는다.
 * 스크립트가 이 문장을 출력하므로, 가리기 전 원문(이름·학교명 등)이 터미널·로그에 남지 않게 하기 위해서다.
 * 위치는 근거 id 와 항목 id 로 찾는다.
 * 같은 구절이 원문에 여러 번 나오거나 인용 구절끼리 겹치는 것은 문제로 보지 않는다.
 * (실제 AI 결과에서는 같은 구절이 두 기준의 근거가 될 수 있고, 화면의 segmentText 는 이 경우에도 예외 없이 동작한다.)
 */
export function validateResult(result: AnalysisResult): string[] {
  const problems: string[] = [];

  const criterionIds = new Set<string>();
  for (const criterion of result.criteria.criteria) {
    if (criterionIds.has(criterion.id)) {
      problems.push(`기준 id 중복: ${criterion.id}`);
    }
    criterionIds.add(criterion.id);
  }

  const sectionById = new Map<string, Section>();
  for (const section of result.sections) {
    if (sectionById.has(section.id)) {
      problems.push(`항목 id 중복: ${section.id}`);
    }
    sectionById.set(section.id, section);
  }

  const evidenceIds = new Set<string>();
  for (const evidence of result.evidences) {
    if (evidenceIds.has(evidence.id)) {
      problems.push(`근거 id 중복: ${evidence.id}`);
    }
    evidenceIds.add(evidence.id);

    if (!criterionIds.has(evidence.criterionId)) {
      problems.push(`근거 ${evidence.id}: 기준 목록에 없는 기준 id "${evidence.criterionId}"`);
    }

    const section = sectionById.get(evidence.sectionId);
    if (!section) {
      problems.push(`근거 ${evidence.id}: 없는 항목 id "${evidence.sectionId}"`);
      continue;
    }

    // 공백만 있는 인용도 빈 것으로 본다(공백 한 글자는 어느 원문에나 들어 있어 아래 검사를 그냥 통과한다).
    if (evidence.quote.trim().length === 0) {
      problems.push(`근거 ${evidence.id}: 인용 구절이 비어 있음`);
      continue;
    }

    if (!section.text.includes(evidence.quote)) {
      problems.push(`근거 ${evidence.id}: 인용 구절이 항목 ${section.id} 원문에 글자 그대로 없음`);
    }
  }

  // 블라인드 처리 내역: 종류 이름이 있고, 가린 곳 수가 1 이상의 정수이고, 종류가 겹치지 않아야 한다.
  const maskTypes = new Set<string>();
  for (const [index, mask] of result.masks.entries()) {
    const label = `블라인드 처리 내역 ${index + 1}번째`;
    if (mask.type.trim().length === 0) {
      problems.push(`${label}: 종류 이름이 비어 있음`);
    } else if (maskTypes.has(mask.type)) {
      problems.push(`블라인드 처리 내역 종류 중복: ${mask.type}`);
    }
    maskTypes.add(mask.type);
    if (!Number.isInteger(mask.count) || mask.count < 1) {
      problems.push(`${label}: 가린 곳 수가 1 이상의 정수가 아님 — ${mask.count}`);
    }
  }

  // AI 제안(있을 때): 요소가 기준과 같은 순서·개수이고, 점수 0~100·신뢰도 1~4 의 정수, 성장은 1·2·3학년 세 건에 지수 0~100 의 정수.
  // 문장에는 기준 id 와 숫자만 넣는다(요약·이름표의 글은 넣지 않는다).
  const assessment = result.assessment;
  if (assessment !== undefined) {
    const criteria = result.criteria.criteria;
    if (assessment.elements.length !== criteria.length) {
      problems.push(`AI 제안: 요소 수(${assessment.elements.length})가 기준 수(${criteria.length})와 다름`);
    }
    for (const [index, element] of assessment.elements.entries()) {
      const expected = criteria[index]?.id;
      if (expected !== undefined && element.criterionId !== expected) {
        problems.push(`AI 제안 ${index + 1}번째 요소: 기준 id 가 "${expected}" 가 아님 — "${element.criterionId}"`);
      }
      if (!isIntegerIn(element.score, ASSESSMENT_LIMITS.minScore, ASSESSMENT_LIMITS.maxScore)) {
        problems.push(`AI 제안 ${index + 1}번째 요소: 점수가 0~100 의 정수가 아님 — ${element.score}`);
      }
      if (!isIntegerIn(element.confidence, ASSESSMENT_LIMITS.minConfidence, ASSESSMENT_LIMITS.maxConfidence)) {
        problems.push(`AI 제안 ${index + 1}번째 요소: 신뢰도가 1~4 의 정수가 아님 — ${element.confidence}`);
      }
    }
    if (assessment.growth.length !== GROWTH_GRADES.length) {
      problems.push(`AI 제안: 학년별 성장이 ${GROWTH_GRADES.length}건이 아님 — ${assessment.growth.length}건`);
    }
    for (const [index, point] of assessment.growth.entries()) {
      if (point.grade !== GROWTH_GRADES[index]) {
        problems.push(`AI 제안 학년별 성장 ${index + 1}번째: 학년이 ${GROWTH_GRADES[index] ?? "없음"} 이 아님 — ${point.grade}`);
      }
      if (!isIntegerIn(point.index, ASSESSMENT_LIMITS.minScore, ASSESSMENT_LIMITS.maxScore)) {
        problems.push(`AI 제안 학년별 성장 ${index + 1}번째: 지수가 0~100 의 정수가 아님 — ${point.index}`);
      }
    }
  }

  // 학년별 연계(있을 때): 카드·연결이 기준·항목·근거와 맞는지 (linkageProblems)
  if (result.linkage !== undefined) problems.push(...linkageProblems(result, result.linkage));

  return problems;
}

function isIntegerIn(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}

/** 검사 통과 시 출력하는 한 줄 요약: 항목 수, 근거 수, 기준별 근거 수 (기준 목록 순서, 기준 이름 사용) */
export function summarizeResult(result: AnalysisResult): string {
  const counts = countByCriterion(result.criteria.criteria, result.evidences)
    .map(({ name, count }) => `${name} ${count}`)
    .join(", ");
  return `항목 ${result.sections.length}개, 근거 ${result.evidences.length}개 (${counts})`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDepartmentCriteria(value: unknown): value is DepartmentCriteria {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.department === "string" &&
    typeof value.sourceText === "string" &&
    Array.isArray(value.criteria) &&
    value.criteria.every(isCriterion)
  );
}

function isCriterion(value: unknown): value is Criterion {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.description === "string"
  );
}

function isSection(value: unknown): value is Section {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.category === "string" &&
    (value.grade === null || typeof value.grade === "number") &&
    (value.subject === undefined || typeof value.subject === "string") &&
    typeof value.page === "number" &&
    typeof value.text === "string" &&
    (value.fieldId === undefined || typeof value.fieldId === "string") &&
    (value.hours === undefined || typeof value.hours === "number")
  );
}

function isMask(value: unknown): value is AnalysisResult["masks"][number] {
  if (!isRecord(value)) return false;
  return typeof value.type === "string" && typeof value.count === "number";
}

/** AI 제안의 모양(필드 이름과 타입). 값의 범위는 validateResult 가 보고, 화면은 범위 밖 값을 범위 안으로 맞춰 그린다. */
function isAssessment(value: unknown): value is Assessment {
  if (!isRecord(value)) return false;
  return (
    typeof value.rubric === "string" &&
    typeof value.summary === "string" &&
    Array.isArray(value.elements) &&
    value.elements.every(isElementAssessment) &&
    Array.isArray(value.growth) &&
    value.growth.every(isGradeGrowth)
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isElementAssessment(value: unknown): value is ElementAssessment {
  if (!isRecord(value)) return false;
  return (
    typeof value.criterionId === "string" &&
    isFiniteNumber(value.score) &&
    isFiniteNumber(value.confidence) &&
    Array.isArray(value.tags) &&
    value.tags.every((tag) => typeof tag === "string")
  );
}

function isGradeGrowth(value: unknown): value is GradeGrowth {
  if (!isRecord(value)) return false;
  return isFiniteNumber(value.grade) && typeof value.label === "string" && isFiniteNumber(value.index);
}

function isEvidence(value: unknown): value is Evidence {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.criterionId === "string" &&
    typeof value.sectionId === "string" &&
    typeof value.quote === "string" &&
    typeof value.reason === "string"
  );
}
