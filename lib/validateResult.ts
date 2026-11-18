import type { AnalysisResult, Criterion, DepartmentCriteria, Evidence, Section } from "@/types/analysis";
import { countByCriterion } from "./resultView.ts";

/**
 * 값이 AnalysisResult 모양(필드 이름과 타입)을 갖췄는지 확인한다.
 * sessionStorage 나 API 응답처럼 밖에서 들어온 값을 화면에 넘기기 전에 쓴다.
 */
export function isAnalysisResult(value: unknown): value is AnalysisResult {
  if (!isRecord(value)) return false;
  const { criteria, sections, evidences } = value;
  return (
    isDepartmentCriteria(criteria) &&
    Array.isArray(sections) &&
    sections.every(isSection) &&
    Array.isArray(evidences) &&
    evidences.every(isEvidence)
  );
}

/**
 * AnalysisResult 의 내용이 서로 맞는지 검사하고, 어긋난 점을 문장 목록으로 돌려준다.
 * 빈 배열이면 문제가 없다는 뜻이다.
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

    if (evidence.quote.length === 0) {
      problems.push(`근거 ${evidence.id}: 인용 구절이 비어 있음`);
      continue;
    }

    if (!section.text.includes(evidence.quote)) {
      problems.push(
        `근거 ${evidence.id}: 인용 구절이 항목 ${section.id} 원문에 글자 그대로 없음 — "${evidence.quote}"`,
      );
    }
  }

  return problems;
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
