import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type PointerEvent } from "react";
import { useRecordPages } from "@/hooks/useRecordPages";
import type { PageRect } from "@/lib/recordLocate";
import { buildResultView } from "@/lib/resultView";
import type { AnalysisResult } from "@/types/analysis";

/** 원문 스크롤 영역의 위쪽 가장자리와 스크롤 대상 사이 여백(px) */
const SCROLL_MARGIN = 12;

/** PDF 보기에서 스크롤 대상(강조한 자리)을 스크롤 영역 높이의 이 비율만큼 아래에 둔다(위쪽 문맥이 보이게) */
const PDF_TARGET_OFFSET = 0.2;

/**
 * PDF 보기의 배율 단계. 1 은 단의 폭에 맞춘 크기다(쪽 폭 880px 까지. components/OriginalScreen.tsx).
 * 남겨 둔 쪽 그림(긴 변 1500px, lib/recordPages.ts)을 늘려 보는 것이라 2배까지만 둔다(그보다 키우면 글자가 뭉개진다).
 */
const PDF_ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

/** 처음 배율(1)의 자리 */
const PDF_ZOOM_DEFAULT_INDEX = PDF_ZOOM_STEPS.indexOf(1);

function clampPdfZoomIndex(index: number): number {
  return Math.min(PDF_ZOOM_STEPS.length - 1, Math.max(0, index));
}

/** 휠 이벤트 하나가 이만큼(px) 이상이면 마우스 휠을 굴린 것으로 본다(보통 한 칸이 100px 쯤이다). */
const PDF_WHEEL_NOTCH_PX = 50;

/** 휠 한 칸의 크기(px): 이만큼에 배율이 한 단계 바뀐다. 조금씩 오는 휠(터치패드)은 이만큼 모일 때마다 한 단계다. */
const PDF_WHEEL_STEP_PX = 100;

/** 휠 이벤트의 단위(deltaMode: 0 px, 1 줄, 2 쪽)를 px 로 바꾸는 값 */
const WHEEL_UNIT_PX: Record<number, number> = { 0: 1, 1: 40, 2: 800 };

/**
 * PDF 스크롤 영역 안의 한 자리: 쪽 번호와 그 쪽의 폭·높이에 대한 비율(쪽 밖이면 0~1 을 벗어난다),
 * 그리고 그 자리가 화면에서 있던 곳(스크롤 영역의 왼쪽 위에서 잰 px).
 */
type PdfAnchor = { page: number; fx: number; fy: number; x: number; y: number };

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
      const containerRect = container.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const top = targetRect.top - containerRect.top + container.scrollTop - container.clientHeight * PDF_TARGET_OFFSET;
      // 확대해서 가로로 넘칠 때: 대상을 가로 가운데에 둔다. 대상이 스크롤 영역보다 넓으면 왼쪽 끝부터 보이게 한다.
      const targetLeft = targetRect.left - containerRect.left + container.scrollLeft;
      const left = Math.min(targetLeft - SCROLL_MARGIN, targetLeft - (container.clientWidth - targetRect.width) / 2);
      container.scrollTo({ top: Math.max(0, top), left: Math.max(0, left), behavior: "smooth" });
      return;
    }
    const container = sourceScrollRef.current;
    if (container === null) return;
    handledRef.current.text = focus.request;
    scrollSourceTo(container, selectedSectionRef.current, highlightRef.current);
  }, [focus, mode, pdfPages]);

  // PDF 보기에서 지금 보는 쪽. 상태로 두지 않고 스크롤 영역에서 바로 읽는다(스크롤할 때마다, 그리고 보기를 바꾸거나 이 화면이 다시 보일 때
  // 다시 읽는다). 그래서 스크롤 영역이 새로 생겨 맨 위에서 시작해도 번호가 어긋나지 않는다. 매 렌더링마다 새 함수라 그때마다 다시 구독한다.
  const pdfCurrentPage = useSyncExternalStore(
    (onChange) => {
      const container = pdfScrollRef.current;
      if (container === null) return () => {};
      container.addEventListener("scroll", onChange, { passive: true });
      return () => container.removeEventListener("scroll", onChange);
    },
    () => currentPdfPage(pdfScrollRef.current),
    () => 1,
  );

  /** PDF 보기의 배율 (PDF_ZOOM_STEPS 의 자리). 보기를 글로 바꿨다가 돌아와도 그대로다. */
  const [pdfZoomIndex, setPdfZoomIndex] = useState(PDF_ZOOM_DEFAULT_INDEX);
  /**
   * 배율을 바꾸기 직전에 붙잡아 둔 자리(버튼이면 스크롤 영역의 한가운데, 휠이면 마우스가 가리키는 곳).
   * 바꾼 뒤 같은 자리가 화면의 같은 곳에 오게 스크롤을 맞춘다. 배율을 바꿀 때마다 새로 적는다.
   */
  const pdfZoomAnchorRef = useRef<PdfAnchor | null>(null);
  /** 휠을 굴린 양을 모아 둔 것(px). 한 단계만큼 모이면 배율을 한 단계 바꾼다. */
  const pdfWheelRef = useRef(0);
  /** 마우스로 끌어 움직이는 중일 때: 누른 포인터와 마지막으로 본 자리 */
  const pdfPanRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);

  // 배율이 바뀌어 쪽의 크기가 달라진 직후(그리기 전에), 바꾸기 전에 붙잡아 둔 자리로 스크롤을 맞춘다.
  useLayoutEffect(() => {
    const anchor = pdfZoomAnchorRef.current;
    const container = pdfScrollRef.current;
    pdfZoomAnchorRef.current = null;
    if (anchor === null || container === null) return;
    scrollPdfToAnchor(container, anchor);
  }, [pdfZoomIndex]);

  /** 버튼으로 배율을 바꾼다: 스크롤 영역의 한가운데에 있던 자리가 그대로 한가운데에 남는다. */
  function zoomPdf(next: (index: number) => number) {
    const container = pdfScrollRef.current;
    pdfZoomAnchorRef.current =
      container === null ? null : pdfAnchorAt(container, container.clientWidth / 2, container.clientHeight / 2);
    setPdfZoomIndex((index) => clampPdfZoomIndex(next(index)));
  }

  // PDF 스크롤 영역 안에서 휠을 굴리면 스크롤하지 않고 배율을 바꾼다(위로 굴리면 확대). 마우스가 가리키는 자리가 그 자리에 남는다.
  // 스크롤을 막아야 해서(preventDefault) React 의 onWheel(passive) 대신 요소에 직접 건다. 스크롤 영역은 PDF 보기일 때만 있어 보기가 바뀔 때 다시 건다.
  // 가로로만 굴린 것(Shift+휠, 기울이는 휠)은 그대로 두어 가로로 스크롤된다. 한 번에 조금씩 오는 휠(터치패드)은 한 단계만큼 모일 때까지 모은다.
  useEffect(() => {
    const container = pdfScrollRef.current;
    if (container === null) return;
    const onWheel = (event: WheelEvent) => {
      if (event.deltaY === 0) return;
      event.preventDefault();
      const delta = event.deltaY * (WHEEL_UNIT_PX[event.deltaMode] ?? 1);
      let steps: number;
      if (Math.abs(delta) >= PDF_WHEEL_NOTCH_PX) {
        // 마우스 휠: 한 칸에 한 단계 (칸의 크기가 기기·화면 배율마다 조금 달라도 한 단계다). 빨리 굴려 여러 칸이 한 번에 오면 그만큼이다.
        steps = Math.sign(delta) * Math.max(1, Math.round(Math.abs(delta) / PDF_WHEEL_STEP_PX));
        pdfWheelRef.current = 0;
      } else {
        // 조금씩 오는 휠: 방향이 바뀌면 처음부터 다시 모으고, 한 단계만큼 모이면 한 단계
        const total = (Math.sign(delta) === Math.sign(pdfWheelRef.current) ? pdfWheelRef.current : 0) + delta;
        steps = Math.trunc(total / PDF_WHEEL_STEP_PX);
        pdfWheelRef.current = total - steps * PDF_WHEEL_STEP_PX;
      }
      if (steps === 0) return;
      const rect = container.getBoundingClientRect();
      pdfZoomAnchorRef.current = pdfAnchorAt(container, event.clientX - rect.left, event.clientY - rect.top);
      setPdfZoomIndex((index) => clampPdfZoomIndex(index - steps));
    };
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, [mode]);

  /** 마우스 왼쪽 버튼으로 끌기 시작: 끄는 만큼 스크롤한다(확대해서 가로로 넘칠 때 움직이기 쉽게). 터치·펜은 브라우저가 스크롤한다. */
  function startPdfPan(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    const container = event.currentTarget;
    const rect = container.getBoundingClientRect();
    // 스크롤바를 누른 것이면 끌기로 받지 않는다(스크롤바의 끌기와 부딪힌다).
    if (event.clientX - rect.left >= container.clientWidth || event.clientY - rect.top >= container.clientHeight) return;
    pdfPanRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    container.setPointerCapture(event.pointerId);
  }

  function movePdfPan(event: PointerEvent<HTMLDivElement>) {
    const pan = pdfPanRef.current;
    if (pan === null || pan.pointerId !== event.pointerId) return;
    const container = event.currentTarget;
    container.scrollLeft -= event.clientX - pan.x;
    container.scrollTop -= event.clientY - pan.y;
    pan.x = event.clientX;
    pan.y = event.clientY;
  }

  function endPdfPan(event: PointerEvent<HTMLDivElement>) {
    if (pdfPanRef.current?.pointerId === event.pointerId) pdfPanRef.current = null;
  }

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
      /** 지금 보는 쪽 (스크롤 영역의 가운데 높이에 걸친 쪽) */
      currentPage: pdfCurrentPage,
      /** 배율: 지금 배율(1 = 단의 폭에 맞춘 크기)과 그 백분율, 더 키우거나 줄일 수 있는지, 확대·축소·처음 크기로 */
      zoom: {
        scale: PDF_ZOOM_STEPS[pdfZoomIndex],
        percent: Math.round(PDF_ZOOM_STEPS[pdfZoomIndex] * 100),
        canZoomIn: pdfZoomIndex < PDF_ZOOM_STEPS.length - 1,
        canZoomOut: pdfZoomIndex > 0,
        onZoomIn: () => zoomPdf((index) => index + 1),
        onZoomOut: () => zoomPdf((index) => index - 1),
        onReset: () => zoomPdf(() => PDF_ZOOM_DEFAULT_INDEX),
      },
      /** PDF 스크롤 영역에 거는 것: 마우스로 끌어 움직이기 (휠로 배율 바꾸기는 훅이 요소에 직접 건다) */
      pan: {
        onPointerDown: startPdfPan,
        onPointerMove: movePdfPan,
        onPointerUp: endPdfPan,
        onPointerCancel: endPdfPan,
      },
      onSelectMode: setWantedMode,
      onShowSection: showSectionInPdf,
    },
    onSelectTab: selectTab,
    onSelectEvidence: selectEvidence,
  };
}

/**
 * PDF 쪽 스크롤 영역에서 지금 보는 쪽: 스크롤 영역의 가운데 높이에 걸친 쪽(그 높이보다 위에서 시작하는 쪽 가운데 마지막 것).
 * 쪽은 data-page 에 쪽 번호를 적은 요소다(components/OriginalScreen.tsx). 스크롤 영역이 없으면(글 보기) 1 이다.
 */
function currentPdfPage(container: HTMLElement | null): number {
  if (container === null) return 1;
  const page = pdfPageAt(container, container.clientHeight / 2);
  return page === null ? 1 : Number(page.dataset.page);
}

/** 스크롤 영역의 위에서 y(px) 만큼 내려온 높이에 걸친 쪽의 요소(그 높이보다 위에서 시작하는 쪽 가운데 마지막 것). 쪽이 하나도 없으면 null. */
function pdfPageAt(container: HTMLElement, y: number): HTMLElement | null {
  const line = container.getBoundingClientRect().top + y;
  let current: HTMLElement | null = null;
  for (const element of container.querySelectorAll<HTMLElement>("[data-page]")) {
    if (current !== null && element.getBoundingClientRect().top > line) break;
    current = element;
  }
  return current;
}

/** 스크롤 영역의 왼쪽 위에서 (x, y) 만큼 떨어진 곳에 지금 놓여 있는 자리. 쪽이 없으면 null. */
function pdfAnchorAt(container: HTMLElement, x: number, y: number): PdfAnchor | null {
  const page = pdfPageAt(container, y);
  if (page === null) return null;
  const containerRect = container.getBoundingClientRect();
  const rect = page.getBoundingClientRect();
  return {
    page: Number(page.dataset.page),
    fx: (containerRect.left + x - rect.left) / rect.width,
    fy: (containerRect.top + y - rect.top) / rect.height,
    x,
    y,
  };
}

/** 그 자리가 화면에서 있던 곳에 다시 오게 바로 스크롤한다(끝에 닿으면 브라우저가 거기서 멈춘다). */
function scrollPdfToAnchor(container: HTMLElement, anchor: PdfAnchor) {
  const page = container.querySelector<HTMLElement>(`[data-page="${anchor.page}"]`);
  if (page === null) return;
  const containerRect = container.getBoundingClientRect();
  const rect = page.getBoundingClientRect();
  container.scrollLeft += rect.left + rect.width * anchor.fx - (containerRect.left + anchor.x);
  container.scrollTop += rect.top + rect.height * anchor.fy - (containerRect.top + anchor.y);
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
