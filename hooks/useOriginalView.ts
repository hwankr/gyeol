import { useEffect, useMemo, useRef, useState } from "react";
import type { RecordViewMode } from "@/components/RecordPdf";
import { usePdfViewport } from "@/hooks/usePdfViewport";
import { useRecordPages } from "@/hooks/useRecordPages";
import { buildPdfPages, type PdfMarkGroup, type PdfPageView } from "@/lib/recordPdfMarks";
import { buildResultView } from "@/lib/resultView";
import type { AnalysisResult } from "@/types/analysis";

/** 원문 스크롤 영역의 위쪽 가장자리와 스크롤 대상 사이 여백(px) */
const SCROLL_MARGIN = 12;

/** 왼쪽 단의 보기: 가려진 글 / 실제 PDF 의 가린 쪽 그림 */
export type OriginalMode = RecordViewMode;

/** 고른 것: 근거(인용 구절) 또는 항목. 누를 때마다 새 번호라 같은 것을 다시 눌러도 다시 스크롤한다. */
type Focus = { kind: "evidence"; evidenceId: string; request: number } | { kind: "section"; sectionId: string; request: number };

/**
 * 원문보기 화면 상태: 지금 고른 기준(기준 id), 고른 근거 또는 항목, 원문 스크롤, 왼쪽 단의 보기(글 / PDF).
 * - pagesKey 는 올린 학생부의 가린 쪽 그림 열쇠다(lib/recordPagesStorage.ts). 그림이 있으면 "PDF" 보기를 고를 수 있고, 근거를 고르거나
 *   항목의 쪽 번호를 누르면 실제 PDF 의 그 쪽에서 그 자리를 강조해 보여 준다. 예시 지원자와 그림을 남기지 못한 학생부는 null(글만 보여 준다).
 * - initialSectionId 는 처음부터 고른 채로 여는 항목이다. 그림이 있으면 PDF 보기로 연다.
 * - 근거 구절은 기준(평가 요소)마다 다른 형광펜 색으로 칠한다(components/evidenceTone.ts. 색의 순번은 기준의 순번이다).
 *   PDF 보기에서는 지금 기준의 근거가 모두 칠해져 있고, 표시를 누르면 그 근거를 고른다.
 * 지원자나 그 분석이 바뀌면 이 훅을 쓰는 컴포넌트가 새로 그려지므로(연결부의 key) 처음 상태로 시작한다.
 */
export function useOriginalView(result: AnalysisResult, pagesKey: string | null = null, initialSectionId: string | null = null) {
  const startSection = result.sections.some((section) => section.id === initialSectionId) ? initialSectionId : null;
  /** 지금 고른 기준의 id. 처음에는 첫 번째 기준. 기준이 하나도 없으면 null. */
  const [activeCriterionId, setActiveCriterionId] = useState<string | null>(
    result.criteria.criteria[0]?.id ?? null,
  );
  const [focus, setFocus] = useState<Focus | null>(
    startSection === null ? null : { kind: "section", sectionId: startSection, request: 1 },
  );
  /** 고른 보기. 쪽 그림이 없으면 글만 보여 준다(아래 mode). */
  const [wantedMode, setWantedMode] = useState<OriginalMode>(startSection === null ? "text" : "pdf");
  const recordPages = useRecordPages(pagesKey);
  const mode: OriginalMode = recordPages !== null && wantedMode === "pdf" ? "pdf" : "text";

  const sourceScrollRef = useRef<HTMLDivElement>(null);
  const selectedSectionRef = useRef<HTMLElement>(null);
  const highlightRef = useRef<HTMLElement>(null);
  /** 마지막으로 발급한 선택 요청 번호 (기준을 바꿔도 줄지 않는다) */
  const lastRequestRef = useRef(startSection === null ? 0 : 1);
  /** 보기마다 마지막으로 스크롤까지 처리한 선택 요청 번호 */
  const handledRef = useRef<Record<OriginalMode, number>>({ text: 0, pdf: 0 });
  // PDF 의 표시를 누르면 그 근거를 고른다(표시는 지금 기준의 근거뿐이다).
  const viewport = usePdfViewport(mode === "pdf", selectEvidence);
  const { scrollToTarget } = viewport;

  const selectedEvidenceId = focus?.kind === "evidence" ? focus.evidenceId : null;
  const focusSectionId = focus?.kind === "section" ? focus.sectionId : null;
  const focusRequest = focus?.request ?? 0;
  const view = useMemo(
    () => buildResultView(result, activeCriterionId, selectedEvidenceId, focusSectionId),
    [result, activeCriterionId, selectedEvidenceId, focusSectionId],
  );
  /** 지금 기준의 형광펜 색 순번 (기준의 순번. 기준이 없으면 0) */
  const activeTone = Math.max(
    0,
    result.criteria.criteria.findIndex((criterion) => criterion.id === activeCriterionId),
  );

  /**
   * PDF 보기의 쪽과 그 위의 표시: 지금 기준의 근거 구절(형광펜 색. 고른 근거는 짙게), 고른 항목의 원문(옅은 남색).
   * 고른 근거의 자리를 찾지 못했으면 그 근거가 든 항목의 원문을 대신 표시한다.
   */
  const pdfPages = useMemo((): PdfPageView[] => {
    if (recordPages === null) return [];
    const groups: PdfMarkGroup[] = result.evidences
      .filter((evidence) => evidence.criterionId === activeCriterionId)
      .map((evidence) => {
        const selected = evidence.id === selectedEvidenceId;
        return {
          id: evidence.id,
          rects: recordPages.evidences[evidence.id],
          tone: activeTone,
          level: selected ? "focus" : "strong",
          stamp: selected ? focusRequest : 0,
        };
      });
    const evidence = result.evidences.find((item) => item.id === selectedEvidenceId);
    const located = evidence !== undefined && (recordPages.evidences[evidence.id]?.length ?? 0) > 0;
    const sectionId = located ? null : (evidence?.sectionId ?? focusSectionId);
    if (sectionId !== null) {
      groups.push({ id: `section:${sectionId}`, rects: recordPages.sections[sectionId], tone: null, level: "section" });
    }
    const targetId = located ? (evidence?.id ?? null) : sectionId === null ? null : `section:${sectionId}`;
    return buildPdfPages(recordPages.pages, groups, targetId);
  }, [recordPages, result.evidences, activeCriterionId, activeTone, selectedEvidenceId, focusSectionId, focusRequest]);

  // 근거나 항목을 고를 때마다(같은 것을 다시 골라도), 그리고 보기를 바꿨을 때, 지금 보기의 스크롤 영역만 해당 위치로 스크롤한다.
  // 다른 화면에 갔다가 돌아와 이 화면이 다시 보일 때도(Activity) effect 가 다시 실행되는데,
  // 그 보기에서 이미 처리한 요청이면 스크롤하지 않아 원하지 않는 스크롤이 생기지 않게 한다.
  useEffect(() => {
    if (focus === null || focus.request === handledRef.current[mode]) return;
    if (mode === "pdf") {
      // 자리를 찾지 못한 항목·근거는 표시가 없다. 그때는 스크롤하지 않는다(처리한 것으로 둔다).
      handledRef.current.pdf = focus.request;
      scrollToTarget();
      return;
    }
    const container = sourceScrollRef.current;
    if (container === null) return;
    handledRef.current.text = focus.request;
    scrollSourceTo(container, selectedSectionRef.current, highlightRef.current);
  }, [focus, mode, pdfPages, scrollToTarget]);

  function nextRequest(): number {
    lastRequestRef.current += 1;
    return lastRequestRef.current;
  }

  function selectTab(criterionId: string) {
    setActiveCriterionId(criterionId);
    setFocus(null);
  }

  function selectEvidence(evidenceId: string) {
    setFocus({ kind: "evidence", evidenceId, request: nextRequest() });
  }

  /** 항목의 쪽 번호를 누름: 그 항목을 고르고 PDF 보기로 바꾼다 */
  function showSectionInPdf(sectionId: string) {
    setFocus({ kind: "section", sectionId, request: nextRequest() });
    setWantedMode("pdf");
  }

  return {
    ...view,
    /** 기준 버튼: 기준마다 형광펜 색의 순번을 붙인다 */
    tabs: view.tabs.map((tab, index) => ({ ...tab, tone: index })),
    /** 지금 기준의 형광펜 색 순번 (원문의 근거 구절을 이 색으로 칠한다) */
    activeTone,
    sourceScrollRef,
    selectedSectionRef,
    highlightRef,
    pdfScrollRef: viewport.scrollRef,
    pdfTargetRef: viewport.targetRef,
    pdf: {
      /** 가린 쪽 그림이 있는지 (없으면 보기 고르기와 쪽 번호 버튼을 보여 주지 않는다) */
      available: recordPages !== null,
      mode,
      pages: pdfPages,
      /** 지금 보는 쪽 (스크롤 영역의 가운데 높이에 걸친 쪽) */
      currentPage: viewport.currentPage,
      /** 배율: 지금 배율(1 = 단의 폭에 맞춘 크기)과 그 백분율, 더 키우거나 줄일 수 있는지, 확대·축소·처음 크기로 */
      zoom: viewport.zoom,
      /** PDF 스크롤 영역에 거는 것: 마우스로 끌어 움직이기 (휠로 배율 바꾸기는 훅이 요소에 직접 건다) */
      pan: viewport.pan,
      onSelectMode: setWantedMode,
      onShowSection: showSectionInPdf,
    },
    onSelectTab: selectTab,
    onSelectEvidence: selectEvidence,
  };
}

/**
 * 원문 스크롤 영역(container)만 스크롤한다. scrollIntoView 는 바깥 요소(문서)까지 움직일 수 있어 쓰지 않는다.
 * 항목 제목부터 보이게 하되, 그러면 강조한 인용 문장이 아래로 잘리는 경우에는 인용 문장을 기준으로 맞춘다.
 */
function scrollSourceTo(
  container: HTMLElement,
  section: HTMLElement | null,
  quote: HTMLElement | null,
) {
  const containerTop = container.getBoundingClientRect().top;
  const offsetOf = (element: HTMLElement) =>
    element.getBoundingClientRect().top - containerTop + container.scrollTop;

  let top: number | null = section ? offsetOf(section) - SCROLL_MARGIN : null;
  if (quote) {
    const quoteTop = offsetOf(quote);
    const quoteBottom = quoteTop + quote.getBoundingClientRect().height;
    if (top === null || quoteBottom + SCROLL_MARGIN - top > container.clientHeight) {
      top = quoteTop - SCROLL_MARGIN;
    }
  }
  if (top === null) return;
  container.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}
