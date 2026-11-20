import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type PointerEvent } from "react";

// 실제 PDF 의 쪽 그림을 늘어놓은 스크롤 영역(components/RecordPdf.tsx)의 동작: 배율, 휠로 배율 바꾸기, 마우스로 끌어 움직이기,
// 지금 보는 쪽, 표시한 자리로 스크롤하기. 원문보기 화면(hooks/useOriginalView.ts)과 평가하기의 서류 원문(hooks/useEvaluationDocument.ts)이 같이 쓴다.

/** 스크롤 영역의 가장자리와 스크롤 대상 사이 여백(px) */
const SCROLL_MARGIN = 12;

/** 스크롤 대상(강조한 자리)을 스크롤 영역 높이의 이 비율만큼 아래에 둔다(위쪽 문맥이 보이게) */
const PDF_TARGET_OFFSET = 0.2;

/**
 * PDF 보기의 배율 단계. 1 은 단의 폭에 맞춘 크기다(쪽 폭 880px 까지. components/RecordPdf.tsx).
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

/** 끌기 시작한 자리에서 이만큼(px) 넘게 움직이면 끈 것으로 본다(그보다 적으면 누른 것) */
const PAN_CLICK_SLOP = 4;

/**
 * PDF 스크롤 영역 안의 한 자리: 쪽 번호와 그 쪽의 폭·높이에 대한 비율(쪽 밖이면 0~1 을 벗어난다),
 * 그리고 그 자리가 화면에서 있던 곳(스크롤 영역의 왼쪽 위에서 잰 px).
 */
type PdfAnchor = { page: number; fx: number; fy: number; x: number; y: number };

/** 머리 줄의 배율 버튼이 쓰는 값 */
export type PdfZoom = {
  /** 지금 배율 (1 = 단의 폭에 맞춘 크기) */
  scale: number;
  percent: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
};

/** PDF 스크롤 영역에 거는 것: 마우스로 끌어 움직이기 */
export type PdfPan = {
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLDivElement>) => void;
};

/**
 * PDF 스크롤 영역의 동작. shown 은 그 스크롤 영역이 지금 그려져 있는지다(보기를 글로 바꾸면 영역이 사라진다. 다시 생기면 휠을 다시 건다).
 * onPickMark 는 끌지 않고 표시를 눌렀을 때 그 표시의 묶음 이름(data-mark)을 받는다(없으면 표시는 눌리지 않는다).
 */
export function usePdfViewport(shown: boolean, onPickMark?: (groupId: string) => void) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLSpanElement>(null);

  // 지금 보는 쪽. 상태로 두지 않고 스크롤 영역에서 바로 읽는다(스크롤할 때마다, 그리고 보기를 바꾸거나 이 화면이 다시 보일 때
  // 다시 읽는다). 그래서 스크롤 영역이 새로 생겨 맨 위에서 시작해도 번호가 어긋나지 않는다. 매 렌더링마다 새 함수라 그때마다 다시 구독한다.
  const currentPage = useSyncExternalStore(
    (onChange) => {
      const container = scrollRef.current;
      if (container === null) return () => {};
      container.addEventListener("scroll", onChange, { passive: true });
      return () => container.removeEventListener("scroll", onChange);
    },
    () => currentPdfPage(scrollRef.current),
    () => 1,
  );

  /** 배율 (PDF_ZOOM_STEPS 의 자리). 보기를 글로 바꿨다가 돌아와도 그대로다. */
  const [zoomIndex, setZoomIndex] = useState(PDF_ZOOM_DEFAULT_INDEX);
  /**
   * 배율을 바꾸기 직전에 붙잡아 둔 자리(버튼이면 스크롤 영역의 한가운데, 휠이면 마우스가 가리키는 곳).
   * 바꾼 뒤 같은 자리가 화면의 같은 곳에 오게 스크롤을 맞춘다. 배율을 바꿀 때마다 새로 적는다.
   */
  const zoomAnchorRef = useRef<PdfAnchor | null>(null);
  /** 휠을 굴린 양을 모아 둔 것(px). 한 단계만큼 모이면 배율을 한 단계 바꾼다. */
  const wheelRef = useRef(0);
  /** 마우스로 끌어 움직이는 중일 때: 누른 포인터, 마지막으로 본 자리, 누른 자리, 끌었는지 */
  const panRef = useRef<{ pointerId: number; x: number; y: number; startX: number; startY: number; moved: boolean } | null>(null);

  // 배율이 바뀌어 쪽의 크기가 달라진 직후(그리기 전에), 바꾸기 전에 붙잡아 둔 자리로 스크롤을 맞춘다.
  useLayoutEffect(() => {
    const anchor = zoomAnchorRef.current;
    const container = scrollRef.current;
    zoomAnchorRef.current = null;
    if (anchor === null || container === null) return;
    scrollPdfToAnchor(container, anchor);
  }, [zoomIndex]);

  /** 버튼으로 배율을 바꾼다: 스크롤 영역의 한가운데에 있던 자리가 그대로 한가운데에 남는다. */
  function zoomBy(next: (index: number) => number) {
    const container = scrollRef.current;
    zoomAnchorRef.current =
      container === null ? null : pdfAnchorAt(container, container.clientWidth / 2, container.clientHeight / 2);
    setZoomIndex((index) => clampPdfZoomIndex(next(index)));
  }

  // PDF 스크롤 영역 안에서 휠을 굴리면 스크롤하지 않고 배율을 바꾼다(위로 굴리면 확대). 마우스가 가리키는 자리가 그 자리에 남는다.
  // 스크롤을 막아야 해서(preventDefault) React 의 onWheel(passive) 대신 요소에 직접 건다. 스크롤 영역은 PDF 보기일 때만 있어 보기가 바뀔 때 다시 건다.
  // 가로로만 굴린 것(Shift+휠, 기울이는 휠)은 그대로 두어 가로로 스크롤된다. 한 번에 조금씩 오는 휠(터치패드)은 한 단계만큼 모일 때까지 모은다.
  useEffect(() => {
    const container = scrollRef.current;
    if (container === null) return;
    const onWheel = (event: WheelEvent) => {
      if (event.deltaY === 0) return;
      event.preventDefault();
      const delta = event.deltaY * (WHEEL_UNIT_PX[event.deltaMode] ?? 1);
      let steps: number;
      if (Math.abs(delta) >= PDF_WHEEL_NOTCH_PX) {
        // 마우스 휠: 한 칸에 한 단계 (칸의 크기가 기기·화면 배율마다 조금 달라도 한 단계다). 빨리 굴려 여러 칸이 한 번에 오면 그만큼이다.
        steps = Math.sign(delta) * Math.max(1, Math.round(Math.abs(delta) / PDF_WHEEL_STEP_PX));
        wheelRef.current = 0;
      } else {
        // 조금씩 오는 휠: 방향이 바뀌면 처음부터 다시 모으고, 한 단계만큼 모이면 한 단계
        const total = (Math.sign(delta) === Math.sign(wheelRef.current) ? wheelRef.current : 0) + delta;
        steps = Math.trunc(total / PDF_WHEEL_STEP_PX);
        wheelRef.current = total - steps * PDF_WHEEL_STEP_PX;
      }
      if (steps === 0) return;
      const rect = container.getBoundingClientRect();
      zoomAnchorRef.current = pdfAnchorAt(container, event.clientX - rect.left, event.clientY - rect.top);
      setZoomIndex((index) => clampPdfZoomIndex(index - steps));
    };
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, [shown]);

  /** 마우스 왼쪽 버튼으로 끌기 시작: 끄는 만큼 스크롤한다(확대해서 가로로 넘칠 때 움직이기 쉽게). 터치·펜은 브라우저가 스크롤한다. */
  function startPan(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    const container = event.currentTarget;
    const rect = container.getBoundingClientRect();
    // 스크롤바를 누른 것이면 끌기로 받지 않는다(스크롤바의 끌기와 부딪힌다).
    if (event.clientX - rect.left >= container.clientWidth || event.clientY - rect.top >= container.clientHeight) return;
    panRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    container.setPointerCapture(event.pointerId);
  }

  function movePan(event: PointerEvent<HTMLDivElement>) {
    const pan = panRef.current;
    if (pan === null || pan.pointerId !== event.pointerId) return;
    const container = event.currentTarget;
    container.scrollLeft -= event.clientX - pan.x;
    container.scrollTop -= event.clientY - pan.y;
    pan.x = event.clientX;
    pan.y = event.clientY;
    if (Math.abs(event.clientX - pan.startX) > PAN_CLICK_SLOP || Math.abs(event.clientY - pan.startY) > PAN_CLICK_SLOP) {
      pan.moved = true;
    }
  }

  /**
   * 끌기 끝. 끌지 않고 뗐으면 누른 것이다: 그 자리에 표시가 있으면 그 표시의 묶음을 알린다.
   * 끄는 동안 포인터를 스크롤 영역이 붙잡고 있어 표시에는 click 이 가지 않으므로, 뗀 자리의 요소를 직접 찾는다.
   */
  function endPan(event: PointerEvent<HTMLDivElement>) {
    const pan = panRef.current;
    if (pan === null || pan.pointerId !== event.pointerId) return;
    panRef.current = null;
    if (pan.moved || event.type !== "pointerup" || onPickMark === undefined) return;
    const groupId = pdfMarkAt(event.currentTarget, event.clientX, event.clientY);
    if (groupId !== null) onPickMark(groupId);
  }

  /**
   * 스크롤 대상 표시(targetRef)가 보이게 스크롤한다. 대상이 없으면(자리를 찾지 못한 항목·근거) 아무것도 하지 않고 false.
   * 확대해서 가로로 넘칠 때에는 대상을 가로 가운데에 둔다. 대상이 스크롤 영역보다 넓으면 왼쪽 끝부터 보이게 한다.
   * ref 만 읽으므로 늘 같은 함수다(effect 의 의존 값으로 넣어도 다시 실행시키지 않는다).
   */
  const scrollToTarget = useCallback((): boolean => {
    const container = scrollRef.current;
    const target = targetRef.current;
    if (container === null || target === null) return false;
    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const top = targetRect.top - containerRect.top + container.scrollTop - container.clientHeight * PDF_TARGET_OFFSET;
    const targetLeft = targetRect.left - containerRect.left + container.scrollLeft;
    const left = Math.min(targetLeft - SCROLL_MARGIN, targetLeft - (container.clientWidth - targetRect.width) / 2);
    container.scrollTo({ top: Math.max(0, top), left: Math.max(0, left), behavior: "smooth" });
    return true;
  }, []);

  const zoom: PdfZoom = {
    scale: PDF_ZOOM_STEPS[zoomIndex],
    percent: Math.round(PDF_ZOOM_STEPS[zoomIndex] * 100),
    canZoomIn: zoomIndex < PDF_ZOOM_STEPS.length - 1,
    canZoomOut: zoomIndex > 0,
    onZoomIn: () => zoomBy((index) => index + 1),
    onZoomOut: () => zoomBy((index) => index - 1),
    onReset: () => zoomBy(() => PDF_ZOOM_DEFAULT_INDEX),
  };
  const pan: PdfPan = { onPointerDown: startPan, onPointerMove: movePan, onPointerUp: endPan, onPointerCancel: endPan };

  return {
    /** PDF 쪽 스크롤 영역 */
    scrollRef,
    /** PDF 쪽 위의 표시 가운데 스크롤 대상 */
    targetRef,
    /** 지금 보는 쪽 (스크롤 영역의 가운데 높이에 걸친 쪽) */
    currentPage,
    zoom,
    pan,
    scrollToTarget,
  };
}

/**
 * PDF 쪽 스크롤 영역에서 지금 보는 쪽: 스크롤 영역의 가운데 높이에 걸친 쪽(그 높이보다 위에서 시작하는 쪽 가운데 마지막 것).
 * 쪽은 data-page 에 쪽 번호를 적은 요소다(components/RecordPdf.tsx). 스크롤 영역이 없으면(글 보기) 1 이다.
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
 * 화면의 (clientX, clientY) 에 놓인 누를 수 있는 표시의 묶음 이름(data-mark). 표시가 겹치면 위에 그려진 것(더 짙은 것)이다.
 * 누를 수 없는 표시(data-mark 없음)가 위를 덮고 있어도 찾도록, 그 자리의 요소를 묻지 않고 표시들의 네모를 견준다.
 */
function pdfMarkAt(container: HTMLElement, clientX: number, clientY: number): string | null {
  let found: string | null = null;
  for (const mark of container.querySelectorAll<HTMLElement>("[data-mark]")) {
    const rect = mark.getBoundingClientRect();
    if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
      found = mark.dataset.mark ?? null;
    }
  }
  return found;
}
