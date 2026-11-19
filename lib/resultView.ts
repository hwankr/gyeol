import type { AnalysisResult, Criterion, Evidence } from "@/types/analysis";
import { recordFormGroup } from "./recordForm.ts";

// 원문보기 화면(components/OriginalScreen.tsx)에 그릴 값을 만드는 순수 함수 모음. 화면 컴포넌트는 여기서 만든 값을 그리기만 한다.

/** 원문 구간 종류: 일반 / 밑줄(현재 탭 기준의 인용 구절) / 강조(선택한 근거의 인용 구절) */
export type SegmentKind = "plain" | "underline" | "highlight";

export type TextSegment = {
  kind: SegmentKind;
  text: string;
};

/** 원문에 표시할 인용 구절 하나 */
export type QuoteMark = {
  quote: string;
  kind: Exclude<SegmentKind, "plain">;
};

export type CriterionCount = {
  criterionId: string;
  /** 기준 이름 */
  name: string;
  count: number;
};

export type CriterionTab = CriterionCount & {
  isActive: boolean;
};

export type SourceSectionView = {
  id: string;
  category: string;
  grade: number | null;
  subject?: string;
  /** 서식에서의 묶음 이름(교과학습발달상황의 "진로 선택 과목"·"체육·예술" 등). 없으면 null */
  group: string | null;
  /** 창의적 체험활동 영역의 시간. 없으면 undefined */
  hours?: number;
  /** PDF 쪽 번호 */
  page: number;
  /** 선택한 근거가 들어 있는 항목이거나, 고른 항목인지 */
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
  /** 학과 이름 */
  department: string;
  tabs: CriterionTab[];
  /** 현재 탭 기준의 설명(description). 기준이 하나도 없거나 현재 탭의 기준을 찾지 못하면 null */
  activeDescription: string | null;
  sections: SourceSectionView[];
  cards: EvidenceCardView[];
  /** 블라인드 처리 내역 (예: "인적·학적사항 5곳, 학교명 12곳"). 가린 것이 없으면 "가린 정보 없음" */
  maskSummary: string;
};

/** 블라인드 처리 내역에 보여 줄 것이 없을 때의 문구 */
const NO_MASK_SUMMARY = "가린 정보 없음";

/** 기준별 근거 개수. 기준 목록(criteria) 순서를 따른다. */
export function countByCriterion(
  criteria: readonly Criterion[],
  evidences: readonly Evidence[],
): CriterionCount[] {
  return criteria.map((criterion) => ({
    criterionId: criterion.id,
    name: criterion.name,
    count: evidences.filter((evidence) => evidence.criterionId === criterion.id).length,
  }));
}

/**
 * 블라인드 처리 내역 문자열. 가린 곳 수가 1 이상인 것만 받은 순서대로 "<종류> <수>곳" 으로 만들어 ", " 로 잇는다.
 * 예: "인적·학적사항 5곳, 학교명 12곳". 보여 줄 것이 하나도 없으면 "가린 정보 없음".
 */
export function formatMaskSummary(masks: AnalysisResult["masks"]): string {
  const parts = masks.filter((mask) => mask.count >= 1).map((mask) => `${mask.type} ${mask.count}곳`);
  return parts.length === 0 ? NO_MASK_SUMMARY : parts.join(", ");
}

/**
 * 원문을 일반 / 밑줄 / 강조 구간으로 나눈다.
 * - 인용 구절이 원문에 없거나 비어 있으면 그 구절은 표시하지 않고 넘어간다.
 * - 인용 구절끼리 겹치면(같은 구절이 두 번 오는 경우 포함) 강조를 먼저, 그다음은 먼저 온 것을 남기고 나머지는 넘어간다.
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

/**
 * 지금 고른 기준과 고른 근거(또는 고른 항목)를 반영해 원문보기 화면 전체에 그릴 값을 만든다.
 * 탭은 result.criteria.criteria 순서대로 만든다. 기준이 하나도 없으면(activeCriterionId 가 null) 근거 카드도, 기준 설명도 없다.
 * focusSectionId 는 근거 없이 고른 항목이다(쪽 번호를 눌러 실제 PDF 의 자리를 보는 항목). 고른 근거가 있으면 그 근거의 항목이 먼저다.
 */
export function buildResultView(
  result: AnalysisResult,
  activeCriterionId: string | null,
  selectedEvidenceId: string | null,
  focusSectionId: string | null = null,
): ResultView {
  const activeEvidences = result.evidences.filter(
    (evidence) => evidence.criterionId === activeCriterionId,
  );
  const selectedEvidence =
    activeEvidences.find((evidence) => evidence.id === selectedEvidenceId) ?? null;

  const tabs = countByCriterion(result.criteria.criteria, result.evidences).map((item) => ({
    ...item,
    isActive: item.criterionId === activeCriterionId,
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
      group: recordFormGroup(section.fieldId),
      hours: section.hours,
      page: section.page,
      isSelected: section.id === (selectedEvidence?.sectionId ?? focusSectionId),
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

  const activeCriterion = result.criteria.criteria.find((criterion) => criterion.id === activeCriterionId);

  return {
    department: result.criteria.department,
    tabs,
    activeDescription: activeCriterion?.description ?? null,
    sections,
    cards,
    maskSummary: formatMaskSummary(result.masks),
  };
}
