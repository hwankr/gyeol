import type { AnalysisResult, Evidence, Section } from "@/types/analysis";
import { COMPETENCIES, SECTION_CATEGORIES } from "./constants.ts";
import { countByCompetency } from "./resultView.ts";

/**
 * 값이 AnalysisResult 모양(필드 이름과 타입)을 갖췄는지 확인한다.
 * sessionStorage 나 API 응답처럼 밖에서 들어온 값을 화면에 넘기기 전에 쓴다.
 */
export function isAnalysisResult(value: unknown): value is AnalysisResult {
  if (!isRecord(value)) return false;
  const { sections, evidences } = value;
  return (
    Array.isArray(sections) &&
    sections.every(isSection) &&
    Array.isArray(evidences) &&
    evidences.every(isEvidence)
  );
}

/**
 * AnalysisResult 의 내용이 서로 맞는지 검사하고, 어긋난 점을 문장 목록으로 돌려준다.
 * 빈 배열이면 문제가 없다는 뜻이다.
 */
export function validateResult(result: AnalysisResult): string[] {
  const problems: string[] = [];
  const categories: readonly string[] = SECTION_CATEGORIES;
  const competencies: readonly string[] = COMPETENCIES;

  const sectionById = new Map<string, Section>();
  for (const section of result.sections) {
    if (sectionById.has(section.id)) {
      problems.push(`항목 id 중복: ${section.id}`);
    }
    sectionById.set(section.id, section);
    if (!categories.includes(section.category)) {
      problems.push(`항목 ${section.id}: 목록에 없는 항목명 "${section.category}"`);
    }
  }

  const evidenceIds = new Set<string>();
  // 항목별로 이미 확인한 인용 문장 구간 (서로 겹치는지 보기 위해)
  const rangesBySection = new Map<string, { id: string; start: number; end: number }[]>();

  for (const evidence of result.evidences) {
    if (evidenceIds.has(evidence.id)) {
      problems.push(`근거 id 중복: ${evidence.id}`);
    }
    evidenceIds.add(evidence.id);

    if (!competencies.includes(evidence.competency)) {
      problems.push(`근거 ${evidence.id}: 목록에 없는 역량 "${evidence.competency}"`);
    }

    const section = sectionById.get(evidence.sectionId);
    if (!section) {
      problems.push(`근거 ${evidence.id}: 없는 항목 id "${evidence.sectionId}"`);
      continue;
    }

    if (evidence.quote.length === 0) {
      problems.push(`근거 ${evidence.id}: 인용 문장이 비어 있음`);
      continue;
    }

    const start = section.text.indexOf(evidence.quote);
    if (start === -1) {
      problems.push(
        `근거 ${evidence.id}: 인용 문장이 항목 ${section.id} 원문에 글자 그대로 없음 — "${evidence.quote}"`,
      );
      continue;
    }
    if (section.text.indexOf(evidence.quote, start + 1) !== -1) {
      problems.push(`근거 ${evidence.id}: 인용 문장이 항목 ${section.id} 원문에 두 번 이상 나옴`);
    }

    const end = start + evidence.quote.length;
    const ranges = rangesBySection.get(section.id) ?? [];
    for (const other of ranges) {
      if (start < other.end && other.start < end) {
        problems.push(
          `근거 ${evidence.id}: 인용 문장이 근거 ${other.id} 의 인용 문장과 항목 ${section.id} 원문에서 겹침`,
        );
      }
    }
    ranges.push({ id: evidence.id, start, end });
    rangesBySection.set(section.id, ranges);
  }

  return problems;
}

/** 검사 통과 시 출력하는 한 줄 요약: 항목 수, 근거 수, 역량별 근거 수 (COMPETENCIES 순서) */
export function summarizeResult(result: AnalysisResult): string {
  const counts = countByCompetency(result.evidences)
    .map(({ competency, count }) => `${competency} ${count}`)
    .join(", ");
  return `항목 ${result.sections.length}개, 근거 ${result.evidences.length}개 (${counts})`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSection(value: unknown): value is Section {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.category === "string" &&
    (value.grade === null || typeof value.grade === "number") &&
    (value.subject === undefined || typeof value.subject === "string") &&
    typeof value.page === "number" &&
    typeof value.text === "string"
  );
}

function isEvidence(value: unknown): value is Evidence {
  if (!isRecord(value)) return false;
  const competencies: readonly unknown[] = COMPETENCIES;
  return (
    typeof value.id === "string" &&
    competencies.includes(value.competency) &&
    typeof value.sectionId === "string" &&
    typeof value.quote === "string" &&
    typeof value.reason === "string"
  );
}
