import { useEffect, useMemo, useRef, useState } from "react";
import { useRecordPages } from "@/hooks/useRecordPages";
import type { PageRect } from "@/lib/recordLocate";
import { buildResultView } from "@/lib/resultView";
import type { AnalysisResult } from "@/types/analysis";

/** 원문 스크롤 영역의 위쪽 가장자리와 스크롤 대상 사이 여백(px) */
const SCROLL_MARGIN = 12;

/** PDF 보기에서 스크롤 대상(강조한 자리)을 스크롤 영역 높이의 이 비율만큼 아래에 둔다(위쪽 문맥이 보이게) */
const PDF_TARGET_OFFSET = 0.2;

/** 왼쪽 단의 보기: 가려진 글 / 실제 PDF 의 가린 쪽 그림 */
export type OriginalMode = "text" | "pdf";

/** 고른 것: 근거(인용 구절) 또는 항목. 누를 때마다 새 번호라 같은 것을 다시 눌러도 다시 스크롤한다. */
type Focus = { kind: "evidence"; evidenceId: string; request: number } | { kind: "section"; sectionId: string; request: number };

/** PDF 쪽 위에 그리는 표시 하나 (자리는 쪽 크기에 대한 비율) */
export type PdfMark = {
  key: string;
  /** quote: 고른 근거의 인용 구절. section: 고른 항목(또는 고른 근거가 든 항목)의 원문 */
  kind: "quote" | "section";
  x: number;
  y: number;
  w: number;
  h: number;
  /** 스크롤 대상인지 (표시 가운데 맨 앞의 것 하나) */
  isTarget: boolean;
};

export type PdfPageView = {
  page: number;
  /** 쪽의 가로세로 크기(pt). 그림을 받기 전에도 자리를 잡는다 */
  width: number;
  height: number;
  /** 가린 그림의 주소. 그림이 없는 쪽은 null */
  url: string | null;
  /** 그림이 없는 쪽의 상태 글. 그림이 있으면 빈 글 */
  stateText: string;
  marks: PdfMark[];
};

function marksOf(rects: readonly PageRect[] | undefined, page: number, kind: PdfMark["kind"]): Omit<PdfMark, "isTarget">[] {
  return (rects ?? [])
    .filter((rect) => rect[0] === page)
    .map((rect, index) => ({ key: `${kind}-${index}`, kind, x: rect[1], y: rect[2], w: rect[3], h: rect[4] }));
}

/**
 * 원문보기 화면 상태: 지금 고른 기준(기준 id), 고른 근거 또는 항목, 원문 스크롤, 왼쪽 단의 보기(글 / PDF).
 * - pagesKey 는 올린 학생부의 가린 쪽 그림 열쇠다(lib/recordPagesStorage.ts). 그림이 있으면 "PDF" 보기를 고를 수 있고, 근거를 고르거나
 *   항목의 쪽 번호를 누르면 실제 PDF 의 그 쪽에서 그 자리를 강조해 보여 준다. 예시 지원자와 그림을 남기지 못한 학생부는 null(글만 보여 준다).
 * - initialSectionId 는 처음부터 고른 채로 여는 항목이다(평가하기의 서류 원문에서 넘어온 경우). 그림이 있으면 PDF 보기로 연다.
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
  const pdfScrollRef = useRef<HTMLDivElement>(null);
  const pdfTargetRef = useRef<HTMLSpanElement>(null);
  /** 마지막으로 발급한 선택 요청 번호 (기준을 바꿔도 줄지 않는다) */
  const lastRequestRef = useRef(startSection === null ? 0 : 1);
  /** 보기마다 마지막으로 스크롤까지 처리한 선택 요청 번호 */
  const handledRef = useRef<Record<OriginalMode, number>>({ text: 0, pdf: 0 });

  const selectedEvidenceId = focus?.kind === "evidence" ? focus.evidenceId : null;
  const focusSectionId = focus?.kind === "section" ? focus.sectionId : null;
  const view = useMemo(
    () => buildResultView(result, activeCriterionId, selectedEvidenceId, focusSectionId),
    [result, activeCriterionId, selectedEvidenceId, focusSectionId],
  );

  /** PDF 보기의 쪽과 그 위의 표시: 고른 근거의 인용 구절(짙게)과 그 항목의 원문(옅게), 또는 고른 항목의 원문(옅게) */
  const pdfPages = useMemo((): PdfPageView[] => {
    if (recordPages === null) return [];
    const evidence = result.evidences.find((item) => item.id === selectedEvidenceId);
    const sectionId = evidence?.sectionId ?? focusSectionId;
    const quoteRects = evidence === undefined ? undefined : recordPages.evidences[evidence.id];
    const sectionRects = sectionId === null ? undefined : recordPages.sections[sectionId];
    let targeted = false;
    return recordPages.pages.map((page) => {
      const quotes = marksOf(quoteRects, page.page, "quote");
      const sections = marksOf(sectionRects, page.page, "section");
      // 스크롤 대상: 인용 구절이 있으면 그 첫 표시, 없으면 항목의 첫 표시.
      const marks = [...sections, ...quotes].map((mark) => ({ ...mark, isTarget: false }));
      if (!targeted) {
        const target =
          marks.find((mark) => mark.kind === "quote") ?? (quoteRects?.length ? undefined : marks.find((mark) => mark.kind === "section"));
        if (target !== undefined) {
          target.isTarget = true;
          targeted = true;
        }
      }
      return {
        page: page.page,
        width: page.width,
        height: page.height,
        url: page.url,
        stateText: page.state === "shown" ? "" : page.state === "scan" ? "스캔본 · 가린 그림 없음" : "가림 확인 안 됨 · 그림 없음",
        marks,
      };
    });
  }, [recordPages, result.evidences, selectedEvidenceId, focusSectionId]);

  // 근거나 항목을 고를 때마다(같은 것을 다시 골라도), 그리고 보기를 바꿨을 때, 지금 보기의 스크롤 영역만 해당 위치로 스크롤한다.
  // 다른 화면에 갔다가 돌아와 이 화면이 다시 보일 때도(Activity) effect 가 다시 실행되는데,
  // 그 보기에서 이미 처리한 요청이면 스크롤하지 않아 원하지 않는 스크롤이 생기지 않게 한다.
  useEffect(() => {
    if (focus === null || focus.request === handledRef.current[mode]) return;
    if (mode === "pdf") {
      const container = pdfScrollRef.current;
      const target = pdfTargetRef.current;
      // 자리를 찾지 못한 항목·근거는 표시가 없다. 그때는 스크롤하지 않는다(처리한 것으로 둔다).
      handledRef.current.pdf = focus.request;
      if (container === null || target === null) return;
      const top =
        target.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - container.clientHeight * PDF_TARGET_OFFSET;
      container.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      return;
    }
    const container = sourceScrollRef.current;
    if (container === null) return;
    handledRef.current.text = focus.request;
    scrollSourceTo(container, selectedSectionRef.current, highlightRef.current);
  }, [focus, mode, pdfPages]);

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
    sourceScrollRef,
    selectedSectionRef,
    highlightRef,
    pdfScrollRef,
    pdfTargetRef,
    pdf: {
      /** 가린 쪽 그림이 있는지 (없으면 보기 고르기와 쪽 번호 버튼을 보여 주지 않는다) */
      available: recordPages !== null,
      mode,
      pages: pdfPages,
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
