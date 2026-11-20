import type { CSSProperties, Ref } from "react";
import { segmentClass } from "@/components/consoleUi";
import { tonePdfClass } from "@/components/evidenceTone";
import type { PdfPan, PdfZoom } from "@/hooks/usePdfViewport";
import type { PdfPageView } from "@/lib/recordPdfMarks";

// 실제 학생부 PDF 의 가린 쪽 그림을 늘어놓은 보기와 그 머리 줄의 배율 버튼. 원문보기 화면(components/OriginalScreen.tsx)과
// 평가하기의 서류 원문(components/EvaluateParts.tsx 의 DocumentPanel)이 같이 쓴다. 동작은 hooks/usePdfViewport.ts 에 있다.

/**
 * PDF 쪽 스크롤 영역: 옅은 회색 바탕 위라 스크롤바 손잡이가 글 보기보다 조금 짙다. 확대하면 가로로도 스크롤된다.
 * 마우스로 끌어 움직일 수 있어 손 모양 커서이고(누르는 동안은 쥔 손), 끄는 동안 글자가 선택되지 않게 한다.
 */
const PDF_SCROLL_CLASS =
  "min-h-0 flex-[1_1_auto] scroll-m-[8px] cursor-grab overflow-auto select-none active:cursor-grabbing [scrollbar-color:#B9BDCB_transparent] [scrollbar-width:thin] flex flex-col bg-[#EEF0F6]";

/**
 * PDF 의 한 쪽: 옅은 회색 바탕 위에 떠 있는 흰 종이. 테두리 대신 가는 선과 옅은 그림자(남색)로 가장자리를 낸다.
 * 배율 1 에서 폭은 880px 까지만 넓어지고(쪽 그림의 원래 폭 1061px 보다 좁아 흐려지지 않는다) 그보다 넓은 단에서는 가운데에 놓인다.
 * 폭은 그 값에 배율(--pdf-zoom, 스크롤 영역이 준다)을 곱한 것이다. 좌우 바깥 여백이 auto 라 스크롤 영역보다 좁으면 가운데에 놓이고,
 * 넓으면 왼쪽 끝부터 놓여 가로 스크롤로 끝까지 볼 수 있다(가운데 맞춤으로 두면 넘친 왼쪽이 스크롤되지 않는다).
 */
const PDF_PAGE_CLASS =
  "relative mx-auto my-0 w-[calc(min(100%,880px)*var(--pdf-zoom))] flex-none overflow-hidden rounded-[4px] bg-white shadow-[0_0_0_1px_rgba(0,9,71,0.07),0_1px_2px_rgba(0,9,71,0.04),0_8px_24px_-8px_rgba(0,9,71,0.14)]";

/**
 * 지금 보는 쪽 번호(<쪽> / <전체>): PDF 보기의 아래 끝 가운데에 떠 있는 알약 모양(남색 바탕, 흰 글자). 스크롤해도 제자리에 있다.
 * 눌리지 않아(pointer-events-none) 그 아래의 쪽을 그대로 스크롤할 수 있다.
 */
const PDF_PAGE_NUMBER_CLASS =
  "pointer-events-none absolute bottom-[12px] left-1/2 m-0 -translate-x-1/2 rounded-full bg-[#000947]/[0.72] px-[10px] text-[11px] leading-[22px] font-medium text-white tabular-nums backdrop-blur-[4px]";

type RecordPdfProps = {
  /** PDF 쪽 스크롤 영역 */
  scrollRef: Ref<HTMLDivElement>;
  /** 쪽 위의 표시 가운데 스크롤 대상 */
  targetRef: Ref<HTMLSpanElement>;
  pages: readonly PdfPageView[];
  /** 지금 보는 쪽 (아래 끝에 "<쪽> / <전체>" 로 보여 준다) */
  currentPage: number;
  /** 배율: 1 은 단의 폭에 맞춘 크기 */
  scale: number;
  pan: PdfPan;
  /** 좁은 단에 넣을 때: 쪽 둘레·사이 여백을 줄인다 */
  compact?: boolean;
  /**
   * 누를 수 있는 표시 (누르면 그 근거를 고른다. hooks/usePdfViewport.ts). 누를 수 있는 표시 위에서는 손가락 커서다.
   * "all": 근거의 표시 모두. "current": 지금 고른 평가 요소의 근거만(다른 요소로 바꿀 수 없는 화면). "none": 없음.
   */
  pickable?: PdfPickable;
};

export type PdfPickable = "all" | "current" | "none";

/**
 * 실제 PDF 보기: 옅은 회색 바탕 위에 흰 종이(쪽)를 가운데에 늘어놓고, 지금 보는 쪽의 번호를 아래 끝 가운데에 띄운다.
 * 쪽의 폭은 --pdf-zoom(배율)을 곱한 값이다. 확대해서 넘치면 가로로도 스크롤되고, 마우스로 끌어 움직일 수 있다.
 * 이 안에서 휠을 굴리면 스크롤하지 않고 배율이 바뀐다(hooks/usePdfViewport.ts 가 요소에 직접 건다).
 * 바깥 상자가 남는 높이를 채운다(부모가 세로로 쌓는 flex 상자여야 한다).
 */
export function RecordPdf({ scrollRef, targetRef, pages, currentPage, scale, pan, compact = false, pickable = "none" }: RecordPdfProps) {
  return (
    <div className="relative flex min-h-0 flex-[1_1_auto] animate-fade-in flex-col">
      <div
        ref={scrollRef}
        tabIndex={0}
        role="group"
        aria-label="학생부 PDF 쪽"
        style={{ "--pdf-zoom": scale } as CSSProperties}
        className={`${PDF_SCROLL_CLASS} ${compact ? "gap-[12px] px-[12px] py-[12px]" : "gap-[16px] px-[24px] py-[20px]"}`}
        {...pan}
      >
        {pages.map((page) => (
          <PdfPage key={page.page} page={page} targetRef={targetRef} pickable={pickable} />
        ))}
      </div>
      {/* 지금 보는 쪽 / 전체 쪽. 쪽 그림의 이름(alt)에 쪽 번호가 있어 보조 기술에는 읽히지 않게 둔다. */}
      <p aria-hidden="true" className={PDF_PAGE_NUMBER_CLASS}>
        {currentPage} / {pages.length}
      </p>
    </div>
  );
}

/**
 * PDF 의 한 쪽: 가린 쪽 그림(그림이 없는 쪽은 그 까닭을 적은 글)과 그 위의 표시(형광펜). 쪽의 가로세로 비율로 자리를 먼저 잡아 그림을 받기 전에도
 * 높이가 같다. data-page 는 지금 보는 쪽을 알아내는 데, 표시의 data-mark 는 누른 표시의 근거를 알아내는 데 쓴다(hooks/usePdfViewport.ts).
 */
function PdfPage({ page, targetRef, pickable }: { page: PdfPageView; targetRef: Ref<HTMLSpanElement>; pickable: PdfPickable }) {
  return (
    <figure data-page={page.page} className={PDF_PAGE_CLASS} style={{ aspectRatio: `${page.width} / ${page.height}` }}>
      {page.url !== null ? (
        // 그림은 이 브라우저에 남긴 가린 쪽 그림(blob 주소)이라 next/image 를 쓰지 않는다.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={page.url}
          alt={`학생부 ${page.page}쪽`}
          loading="lazy"
          draggable={false}
          className="absolute inset-0 h-full w-full"
        />
      ) : (
        <p className="absolute inset-0 m-0 flex items-center justify-center text-[13px] leading-[18px] text-[#767676]">{page.stateText}</p>
      )}
      {page.marks.map((mark) => {
        // 근거의 표시만 누를 수 있다(항목의 원문 표시는 근거가 아니다). "current" 면 다른 요소의 근거(옅은 표시)는 눌리지 않는다.
        const canPick = pickable === "all" ? mark.level !== "section" : pickable === "current" && (mark.level === "focus" || mark.level === "strong");
        return (
          <span
            key={mark.key}
            ref={mark.isTarget ? targetRef : undefined}
            aria-hidden="true"
            data-mark={canPick ? mark.groupId : undefined}
            className={`absolute ${canPick ? "cursor-pointer" : "pointer-events-none"} ${tonePdfClass(mark.tone, mark.level)}`}
            style={{
              left: `${mark.x * 100}%`,
              top: `${mark.y * 100}%`,
              width: `${mark.w * 100}%`,
              height: `${mark.h * 100}%`,
            }}
          />
        );
      })}
    </figure>
  );
}

/** 머리 줄의 배율 버튼(축소·배율·확대): 보기 고르기와 같은 높이의 이어 붙인 버튼. 더 줄이거나 키울 수 없으면 옅은 회색이고 눌리지 않는다. */
const ZOOM_BUTTON_CLASS = "h-[26px] scroll-m-[8px] justify-center p-0 disabled:cursor-default disabled:text-[#AEAEAE]";

/** PDF 보기의 배율 버튼: 축소 · 배율(누르면 처음 크기로) · 확대 */
export function PdfZoomButtons({ zoom }: { zoom: PdfZoom }) {
  return (
    <div role="group" aria-label="PDF 배율" className="flex animate-fade-in">
      <button
        type="button"
        aria-label="축소"
        disabled={!zoom.canZoomOut}
        onClick={zoom.onZoomOut}
        className={`${segmentClass(0, 3, false)} ${ZOOM_BUTTON_CLASS} w-[28px]`}
      >
        <ZoomIcon plus={false} />
      </button>
      <button
        type="button"
        aria-label={`배율 ${zoom.percent}%, 처음 크기로`}
        onClick={zoom.onReset}
        className={`${segmentClass(1, 3, false)} ${ZOOM_BUTTON_CLASS} w-[52px] tabular-nums`}
      >
        {zoom.percent}%
      </button>
      <button
        type="button"
        aria-label="확대"
        disabled={!zoom.canZoomIn}
        onClick={zoom.onZoomIn}
        className={`${segmentClass(2, 3, false)} ${ZOOM_BUTTON_CLASS} w-[28px]`}
      >
        <ZoomIcon plus />
      </button>
    </div>
  );
}

/** 배율 버튼의 빼기·더하기 그림 (선은 글자색을 따른다) */
function ZoomIcon({ plus }: { plus: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      className="h-[14px] w-[14px]"
    >
      <path d={plus ? "M8 3.5v9M3.5 8h9" : "M3.5 8h9"} />
    </svg>
  );
}

/** 왼쪽 단의 보기: 가려진 글 / 실제 PDF 의 가린 쪽 그림 */
export type RecordViewMode = "text" | "pdf";

const MODES: readonly { mode: RecordViewMode; label: string }[] = [
  { mode: "text", label: "글" },
  { mode: "pdf", label: "PDF" },
];

/** 보기 고르기: 글 / PDF (이어 붙인 버튼) */
export function RecordModeButtons({ mode, onSelect }: { mode: RecordViewMode; onSelect: (mode: RecordViewMode) => void }) {
  return (
    <div role="group" aria-label="원문 보기" className="flex">
      {MODES.map((item, index) => (
        <button
          key={item.mode}
          type="button"
          aria-pressed={mode === item.mode}
          onClick={() => onSelect(item.mode)}
          className={`${segmentClass(index, MODES.length, mode === item.mode)} h-[26px] scroll-m-[8px] px-[12px]`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
