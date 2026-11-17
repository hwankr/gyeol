import type { AnalysisResult, Competency, Evidence } from "@/types/analysis";
import { COMPETENCIES } from "./constants.ts";

// 결과 화면에 그릴 값을 만드는 순수 함수 모음. 화면 컴포넌트는 여기서 만든 값을 그리기만 한다.

/** 원문 구간 종류: 일반 / 밑줄(현재 탭 역량의 인용 문장) / 강조(선택한 근거의 인용 문장) */
export type SegmentKind = "plain" | "underline" | "highlight";

export type TextSegment = {
  kind: SegmentKind;
  text: string;
};

/** 원문에 표시할 인용 문장 하나 */
export type QuoteMark = {
  quote: string;
  kind: Exclude<SegmentKind, "plain">;
};

export type CompetencyCount = {
  competency: Competency;
  count: number;
};

export type CompetencyTab = CompetencyCount & {
  isActive: boolean;
};

export type SourceSectionView = {
  id: string;
  category: string;
  grade: number | null;
  subject?: string;
  /** 선택한 근거가 들어 있는 항목인지 */
  isSelected: boolean;
  segments: TextSegment[];
};

export type EvidenceCardView = {
  id: string;
  quote: string;
  reason: string;
  /** 출처 항목. 근거의 sectionId 에 맞는 항목이 없으면 null */
  source: { category: string; grade: number | null } | null;
  isSelected: boolean;
};

export type ResultView = {
  tabs: CompetencyTab[];
  sections: SourceSectionView[];
  cards: EvidenceCardView[];
};

/** 역량별 근거 개수. COMPETENCIES 순서를 따른다. */
export function countByCompetency(evidences: readonly Evidence[]): CompetencyCount[] {
  return COMPETENCIES.map((competency) => ({
    competency,
    count: evidences.filter((evidence) => evidence.competency === competency).length,
  }));
}

/**
 * 원문을 일반 / 밑줄 / 강조 구간으로 나눈다.
 * - 인용 문장이 원문에 없거나 비어 있으면 그 문장은 표시하지 않고 넘어간다.
 * - 인용 문장끼리 겹치면 강조를 먼저, 그다음은 먼저 온 것을 남기고 나머지는 넘어간다.
 * 어떤 입력에도 예외를 던지지 않는다.
 */
export function segmentText(text: string, marks: readonly QuoteMark[]): TextSegment[] {
  const ordered = [
    ...marks.filter((mark) => mark.kind === "highlight"),
    ...marks.filter((mark) => mark.kind !== "highlight"),
  ];

  const ranges: { start: number; end: number; kind: QuoteMark["kind"] }[] = [];
  for (const mark of ordered) {
    if (mark.quote.length === 0) continue;
    const start = text.indexOf(mark.quote);
    if (start === -1) continue;
    const end = start + mark.quote.length;
    const overlaps = ranges.some((range) => start < range.end && range.start < end);
    if (overlaps) continue;
    ranges.push({ start, end, kind: mark.kind });
  }
  ranges.sort((a, b) => a.start - b.start);

  const segments: TextSegment[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor) {
      segments.push({ kind: "plain", text: text.slice(cursor, range.start) });
    }
    segments.push({ kind: range.kind, text: text.slice(range.start, range.end) });
    cursor = range.end;
  }
  if (cursor < text.length) {
    segments.push({ kind: "plain", text: text.slice(cursor) });
  }
  return segments;
}

/** 현재 탭과 선택한 근거를 반영해 결과 화면 전체에 그릴 값을 만든다. */
export function buildResultView(
  result: AnalysisResult,
  activeCompetency: Competency,
  selectedEvidenceId: string | null,
): ResultView {
  const activeEvidences = result.evidences.filter(
    (evidence) => evidence.competency === activeCompetency,
  );
  const selectedEvidence =
    activeEvidences.find((evidence) => evidence.id === selectedEvidenceId) ?? null;

  const tabs = countByCompetency(result.evidences).map((item) => ({
    ...item,
    isActive: item.competency === activeCompetency,
  }));

  const sections = result.sections.map((section) => {
    const marks: QuoteMark[] = activeEvidences
      .filter((evidence) => evidence.sectionId === section.id)
      .map((evidence) => ({
        quote: evidence.quote,
        kind: evidence.id === selectedEvidence?.id ? "highlight" : "underline",
      }));
    return {
      id: section.id,
      category: section.category,
      grade: section.grade,
      subject: section.subject,
      isSelected: section.id === selectedEvidence?.sectionId,
      segments: segmentText(section.text, marks),
    };
  });

  const cards = activeEvidences.map((evidence) => {
    const section = result.sections.find((item) => item.id === evidence.sectionId);
    return {
      id: evidence.id,
      quote: evidence.quote,
      reason: evidence.reason,
      source: section ? { category: section.category, grade: section.grade } : null,
      isSelected: evidence.id === selectedEvidence?.id,
    };
  });

  return { tabs, sections, cards };
}
