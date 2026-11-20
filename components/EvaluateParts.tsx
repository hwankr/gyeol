import Link from "next/link";
import type { Ref } from "react";
import {
  BUTTON_OUTLINE_CLASS,
  BUTTON_PRESSED_CLASS,
  BUTTON_SECONDARY_CLASS,
  ConsoleCrumbs,
  ConsoleTitle,
  PANEL_CLASS,
  PANEL_HEAD_CLASS,
  PANEL_TITLE_CLASS,
  StatusChip,
  segmentClass,
  type ChipTone,
  type ConsoleCrumb,
} from "@/components/consoleUi";
import { toneSwatchClass, toneTextClass } from "@/components/evidenceTone";
import { PdfZoomButtons, RecordModeButtons, RecordPdf, type PdfPickable, type RecordViewMode } from "@/components/RecordPdf";
import type { PdfPan, PdfZoom } from "@/hooks/usePdfViewport";
import { EVALUATE_PATH } from "@/lib/consoleMenu";
import type { EvaluationStatus } from "@/lib/evaluate/evaluation";
import type { DocumentArea } from "@/lib/evaluate/sampleEvaluations";
import { SWAP_TRANSITION } from "@/lib/motion";
import type { PdfPageView } from "@/lib/recordPdfMarks";

// 평가하기 세 화면(평가 대기 목록, 총평, 세부 항목 평가)이 같이 쓰는 조각. 치수·색·글자는 디자인 값 그대로다.

const STATUS_TONE: Record<EvaluationStatus, ChipTone> = {
  "평가 중": "blue",
  "임시 저장": "amber",
  대기: "gray",
  "제출 완료": "green",
};

/** 평가 상태 표시 (평가 중: 파랑, 임시 저장: 주황, 대기: 회색, 제출 완료: 초록) */
export function EvaluationStatusChip({ status }: { status: EvaluationStatus }) {
  return <StatusChip tone={STATUS_TONE[status]}>{status}</StatusChip>;
}

/** 평가하기 화면의 머리: 현재 위치 줄과 제목 줄 */
export function EvaluateHead({ crumbs, note }: { crumbs: readonly ConsoleCrumb[]; note: string }) {
  return (
    <>
      <ConsoleCrumbs items={crumbs} />
      <ConsoleTitle title="평가하기" note={note} />
    </>
  );
}

/** 왼쪽을 가리키는 꺾쇠 (돌아가기 링크) */
function BackArrow() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="#505050"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[16px] w-[16px]"
    >
      <path d="M10 3.5 5.5 8l4.5 4.5" />
    </svg>
  );
}

type ApplicantBarProps = {
  /** 돌아가기 링크 (총평에서는 "목록", 세부 항목 평가에서는 "총평") */
  backHref: string;
  backLabel: string;
  backLinkRef: Ref<HTMLAnchorElement>;
  code: string;
  summary: string;
  status: EvaluationStatus;
  /** 보류·재검토 요청 표시 (없으면 null) */
  markLabel: string | null;
  /** 방금 한 일의 안내 또는 저장하지 못했다는 안내 (없으면 빈 글) */
  note: string;
  noteIsWarning: boolean;
  /** 평가 순서에서의 자리: "23 / 24" */
  positionText: string;
  /** 앞뒤 지원자의 주소 (없으면 null: 첫·마지막 지원자) */
  previousHref: string | null;
  nextHref: string | null;
  nextLinkRef: Ref<HTMLAnchorElement>;
  /** 제출한 평가인지 (임시저장이 꺼진다) */
  locked: boolean;
  onSaveDraft: () => void;
};

const STEP_LINK_CLASS = `${BUTTON_SECONDARY_CLASS} h-[32px] scroll-m-[8px] px-[12px] leading-[normal]`;

/**
 * 지원자 줄: 돌아가기, 지원자 코드, AI 한 줄 요약, 상태, 안내 글, 평가 순서의 앞뒤 지원자, 임시저장.
 * 앞뒤 지원자는 보통 링크다. 첫·마지막 지원자에서는 갈 곳이 없는 쪽을 href 없는 <a> 로 그린다(초점을 받지 않고 흐리게 보인다).
 * 안내 글은 바뀔 때 화면 낭독기가 읽도록 role="status" 다.
 * 이전·다음은 같은 화면에서 지원자만 바꾸는 이동이라 화면 전환 없이 바로 바뀐다(잇달아 눌러도 누름이 빠지지 않는다. lib/motion.ts).
 */
export function ApplicantBar({
  backHref,
  backLabel,
  backLinkRef,
  code,
  summary,
  status,
  markLabel,
  note,
  noteIsWarning,
  positionText,
  previousHref,
  nextHref,
  nextLinkRef,
  locked,
  onSaveDraft,
}: ApplicantBarProps) {
  return (
    <div className={`${PANEL_CLASS} mt-[16px] flex flex-wrap items-center gap-x-[12px] gap-y-[8px] px-[12px] py-[10px]`}>
      <Link
        ref={backLinkRef}
        href={backHref}
        className={`${BUTTON_SECONDARY_CLASS} h-[32px] scroll-m-[8px] gap-[4px] pr-[10px] pl-[6px]`}
      >
        <BackArrow />
        {backLabel}
      </Link>
      <h2 className="ml-[4px] text-[22px] leading-[30px] font-bold tracking-[-0.01em] tabular-nums">{code}</h2>
      <p className="text-[14px] leading-[20px] text-[#505050]">{summary}</p>
      <EvaluationStatusChip status={status} />
      {markLabel !== null && <StatusChip tone="gray">{markLabel}</StatusChip>}
      <span role="status" className={`text-[13px] leading-[18px] ${noteIsWarning ? "text-[#BA1A1A]" : "text-[#505050]"}`}>
        {note}
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-[8px]">
        <StepLink href={previousHref} label="이전" />
        <span className="text-[13px] text-[#505050] tabular-nums">{positionText}</span>
        <StepLink href={nextHref} label="다음" linkRef={nextLinkRef} />
        <button
          type="button"
          disabled={locked}
          onClick={onSaveDraft}
          className={`${BUTTON_OUTLINE_CLASS} ml-[8px] h-[32px] scroll-m-[8px] px-[12px] leading-[normal]`}
        >
          임시저장
        </button>
      </div>
    </div>
  );
}

function StepLink({ href, label, linkRef }: { href: string | null; label: string; linkRef?: Ref<HTMLAnchorElement> }) {
  if (href === null) {
    return (
      <a aria-disabled="true" className={`${STEP_LINK_CLASS} opacity-[0.45] aria-disabled:cursor-default`}>
        {label}
      </a>
    );
  }
  return (
    <Link ref={linkRef} href={href} transitionTypes={SWAP_TRANSITION} className={STEP_LINK_CLASS}>
      {label}
    </Link>
  );
}

/**
 * 넓은 배치(올린 지원자)에서 단의 높이: 화면 높이에서 위의 것(상단 바, 현재 위치·제목·지원자 줄, 여백)을 뺀 만큼이고 480px 보다 작아지지 않는다.
 * 단이 각자 안에서 스크롤하므로 평가를 입력하는 동안 원본이 화면에 그대로 남는다(원문보기 화면의 두 단과 같은 높이다).
 * 좁은 화면에서 단이 위아래로 쌓여도 같은 높이다.
 */
export const WORKBENCH_HEIGHT_CLASS = "h-[max(480px,calc(100vh-280px))]";

/**
 * 크게 보기(서류 원문 머리 줄의 버튼)를 켰을 때 작업 단의 바깥 상자에 테두리 상자 대신 주는 클래스: 화면 전체를 덮는다(상단 바·사이드바 위).
 * 원본을 읽는 자리가 화면 높이·폭을 다 쓰도록 한 것이다. 폭이 모자라 단이 아래로 쌓이면 이 상자가 세로로 스크롤한다.
 * 그 안의 단은 WORKBENCH_HEIGHT_CLASS 대신 WORKBENCH_EXPANDED_HEIGHT_CLASS(상자 높이 그대로)를 받는다.
 * 바깥 상자에는 data-workbench 를 단다: 덮는 동안 그 밖의 화면을 쓰지 못하게 하는 데 쓴다(hooks/useEvaluationDocument.ts).
 */
export const WORKBENCH_EXPANDED_CLASS = "fixed inset-0 z-[50] overflow-y-auto bg-white";

export const WORKBENCH_EXPANDED_HEIGHT_CLASS = "h-full";

/** 단 안에서 스크롤하는 영역의 가는 스크롤바 (원문보기 화면과 같은 모양) */
export const WORKBENCH_SCROLL_CLASS =
  "min-h-0 flex-[1_1_auto] scroll-m-[8px] overflow-y-auto [scrollbar-color:#CFCFCF_transparent] [scrollbar-width:thin]";

/** 평가 요소의 형광펜 색 점 (평가 요소 목록의 이름 앞, 색 풀이). 장식이라 보조 기술에는 숨긴다(이름이 옆에 있다). */
export function ToneSwatch({ tone }: { tone: number }) {
  return <span aria-hidden="true" className={`inline-block h-[10px] w-[10px] flex-none rounded-[3px] ${toneSwatchClass(tone)}`} />;
}

type DocumentPanelProps = {
  /** 바깥 <section> 에 줄 클래스 (단의 너비·높이·왼쪽 선은 화면마다 다르다) */
  className: string;
  /** 머리 줄의 모서리 (상자 안에서의 자리에 따라 다르다) */
  headClassName: string;
  /** 머리 줄 제목의 id (한 화면에 하나) */
  titleId: string;
  /** 아래에 평가 요소별 형광펜 색 풀이를 둘지 (평가 요소 목록이 이 단과 떨어져 있는 화면만) */
  showLegend: boolean;
  /**
   * 고른 근거의 출처와 AI 가 적은 이유를 아래에 적을지. "always": 늘(근거 문장 목록이 따로 없는 화면).
   * "stacked": 근거 문장 목록이 이 단 옆에 있지 못하고 아래로 내려갔을 때만(바깥 상자 @container/bench 의 폭이 700px 미만일 때).
   * "never": 적지 않는다(근거 문장 목록이 늘 가까이 있는 화면).
   */
  showEvidenceNote: "always" | "stacked" | "never";
  /** 넓은 배치인지 (올린 지원자): 단이 주어진 높이를 채우고 원문이 그 안에서 스크롤한다 */
  wide: boolean;
  /** 크게 보기를 켰는지와 켜고 끄기 (넓은 배치에서만 머리 줄에 버튼이 있다. 켜면 화면이 작업 단을 화면 전체로 편다) */
  expanded: boolean;
  onToggleExpanded: () => void;
  /** 이 단의 <section>. 크게 볼 때 이 단이 든 작업 단(data-workbench 를 단 바깥 상자)을 찾는 데 쓴다(hooks/useEvaluationDocument.ts) */
  panelRef: Ref<HTMLElement>;
  areas: { area: DocumentArea; on: boolean; onPick: () => void }[];
  passages: {
    id: string;
    source: string;
    /** 그 원문의 PDF 쪽 번호와 학생부 항목의 id (올린 지원자만. 없으면 null) */
    page: { label: string; sectionId: string } | null;
    /** 조각마다: 형광펜 색의 순번과 세기(근거가 아니면 level 이 null), 스크롤 대상인지 */
    segments: { key: string; text: string; tone: number; level: "focus" | "strong" | "soft" | null; isTarget: boolean }[];
  }[];
  /** 평가 요소와 그 형광펜 색 */
  legend: { id: string; name: string; tone: number }[];
  /** 가림 누락을 신고했는지 */
  maskReported: boolean;
  onToggleMaskReport: () => void;
  /** 원문보기 화면의 주소 (그 지원자의 학생부 원문과 기준별 근거) */
  originalHref: string;
  /** 글 보기의 스크롤 영역과 그 안의 스크롤 대상(고른 근거의 첫 조각) */
  textScrollRef: Ref<HTMLDivElement>;
  textTargetRef: Ref<HTMLElement>;
  /** 글 보기의 쪽 번호를 누름: 이 단에서 실제 PDF 의 그 항목 자리를 보여 준다. null 이면 쪽 번호가 눌리지 않는다(쪽 그림이 없다) */
  onShowSection: ((sectionId: string) => void) | null;
  /** 실제 PDF 보기 (올린 지원자의 가린 쪽 그림) */
  pdf: {
    available: boolean;
    loading: boolean;
    mode: RecordViewMode;
    pages: readonly PdfPageView[];
    currentPage: number;
    zoom: PdfZoom;
    pan: PdfPan;
    scrollRef: Ref<HTMLDivElement>;
    targetRef: Ref<HTMLSpanElement>;
    /** 누를 수 있는 형광펜: 모든 요소의 근거("all") 또는 지금 요소의 근거만("current") */
    pickable: PdfPickable;
    onSelectMode: (mode: RecordViewMode) => void;
  };
  /** 지금 평가 요소의 근거를 원본에서 차례로 보는 줄 */
  evidenceNav: {
    /** "근거 2 / 7" (아직 고르지 않았으면 "근거 7건") */
    text: string;
    /** 지금 평가 요소의 형광펜 색 순번 */
    tone: number;
    /** 근거가 없어 움직일 수 없는지 */
    disabled: boolean;
    onPrevious: () => void;
    onNext: () => void;
    /** 고른 근거의 출처와 AI 가 적은 이유 (고르지 않았으면 null) */
    current: { source: string; reason: string | null } | null;
  };
};

/**
 * 서류 원문: 평가하면서 근거를 원본에서 바로 확인하는 단.
 * - AI 가 근거로 쓴 구절은 평가 요소마다 다른 형광펜 색으로 칠해져 있다(components/evidenceTone.ts). 지금 고른 평가 요소의 근거는
 *   제 색과 실선 밑줄, 다른 요소의 근거는 옅은 색과 점선 밑줄, 지금 고른 근거는 더 짙은 색과 굵은 밑줄이다.
 * - 올린 지원자는 실제 학생부 PDF 의 가린 쪽 그림을 본다(머리 줄의 "글 / PDF" 로 바꾼다. PDF 보기의 모습·배율·움직이기는
 *   원문보기 화면과 같다: components/RecordPdf.tsx). 형광펜을 누르면 그 근거를 고른다. 글 보기의 쪽 번호를 누르면 PDF 의 그 자리를 보여 준다.
 * - 아래의 근거 줄(이전 · "근거 2 / 7" · 다음)로 지금 평가 요소의 근거를 원본에서 차례로 본다. 고르면 원본이 그 자리로 스크롤된다.
 * - 글 보기는 서류 구분(교과·세특·창체·행특)과 그 구분의 가려진 학생부 문장이다.
 * 가림 누락 신고는 누르면 신고한 것으로 표시되고 다시 누르면 거둔다.
 * 넓은 배치에서는 단이 주어진 높이를 채우고(className 이 높이를 준다) 원문만 그 안에서 스크롤한다.
 * 넓은 배치의 머리 줄 끝에는 "크게 보기" 가 있다: 누르면 작업 단이 화면 전체를 덮어 원본을 크게 읽고("원래 크기" 나 Esc 로 돌아온다),
 * 보던 자리·보기·배율은 그대로다. 덮는 것은 화면(바깥 상자)이 하고 이 단은 버튼만 그린다.
 */
export function DocumentPanel({
  className,
  headClassName,
  titleId,
  showLegend,
  showEvidenceNote,
  wide,
  expanded,
  onToggleExpanded,
  panelRef,
  areas,
  passages,
  legend,
  maskReported,
  onToggleMaskReport,
  originalHref,
  textScrollRef,
  textTargetRef,
  onShowSection,
  pdf,
  evidenceNav,
}: DocumentPanelProps) {
  const areaButtons = (
    <div role="group" aria-label="서류 구분" className="flex flex-none">
      {areas.map((item, index) => (
        <button
          key={item.area}
          type="button"
          aria-pressed={item.on}
          onClick={item.onPick}
          className={`${segmentClass(index, areas.length, item.on)} h-[28px] scroll-m-[8px] px-[12px]`}
        >
          {item.area}
        </button>
      ))}
    </div>
  );
  /*
    원문이 길면(올린 학생부의 세특은 과목 수십 건이다) 이 상자 안에서 세로로 스크롤한다. 넓은 배치에서는 단의 남는 높이를 채우고,
    그 밖에는 화면 높이의 60%(360px 보다 작아지지 않음)까지다. 예시 지원자의 원문은 짧아 스크롤이 생기지 않는다. 키보드로도 스크롤할 수 있게 초점을 받는다.
  */
  const passageList = (
    <div
      ref={textScrollRef}
      role="group"
      aria-label="서류 원문 내용"
      tabIndex={0}
      className={wide ? `${WORKBENCH_SCROLL_CLASS} mt-[12px]` : "mt-[12px] max-h-[max(360px,60vh)] scroll-m-[8px] overflow-y-auto"}
    >
      {/* 서류 구분을 바꾸면 그 구분의 문장들이 옅게 나타난다(문장마다 새로 그려지는 것에 건다. 자리는 바로 잡힌다). */}
      {passages.map((passage, index) => (
        <div key={passage.id} className={`animate-fade-in border-t border-t-[#E4E4E4] pt-[12px] ${index === 0 ? "" : "mt-[12px]"}`}>
          <p className="flex flex-wrap items-baseline gap-x-[8px] text-[12px] leading-[16px] font-semibold text-[#505050]">
            {passage.source}
            {/* 올린 지원자: 쪽 그림이 있으면 쪽 번호가 버튼이다. 누르면 이 단이 PDF 보기로 바뀌어 실제 PDF 의 그 자리를 보여 준다. */}
            {passage.page !== null &&
              (onShowSection !== null ? (
                <button
                  type="button"
                  aria-label={`${passage.source} PDF ${passage.page.label} 보기`}
                  onClick={onShowSection.bind(null, passage.page.sectionId)}
                  className="motion-colors cursor-pointer scroll-m-[8px] rounded-[4px] border-0 bg-transparent p-0 text-[12px] leading-[16px] font-medium text-[#001AD0] tabular-nums hover-on:underline"
                >
                  PDF {passage.page.label}
                </button>
              ) : (
                <span className="font-medium tabular-nums">{passage.page.label}</span>
              ))}
          </p>
          <p className="mt-[6px] text-[14px] leading-[24px] [overflow-wrap:anywhere] break-keep whitespace-pre-line">
            {passage.segments.map((segment) =>
              segment.level === null ? (
                <span key={segment.key}>{segment.text}</span>
              ) : (
                <mark
                  key={segment.key}
                  ref={segment.isTarget ? textTargetRef : undefined}
                  className={toneTextClass(segment.tone, segment.level)}
                >
                  {segment.text}
                </mark>
              ),
            )}
          </p>
        </div>
      ))}
      {passages.length === 0 && (
        <p className="border-t border-t-[#E4E4E4] pt-[12px] text-[13px] leading-[18px] text-[#505050]">이 구분의 원문이 없습니다.</p>
      )}
    </div>
  );
  return (
    <section ref={panelRef} aria-labelledby={titleId} className={`${className} ${wide ? "flex flex-col" : ""}`}>
      <div
        className={`${PANEL_HEAD_CLASS} ${headClassName} box-border flex min-h-[40px] flex-none flex-wrap items-center justify-between gap-x-[8px] gap-y-[4px] px-[16px] py-[4px]`}
      >
        <h3 id={titleId} className={PANEL_TITLE_CLASS}>
          서류 원문
        </h3>
        <div className="flex flex-wrap items-center gap-x-[10px] gap-y-[4px]">
          {/* 쪽 그림이 있을 때: PDF 보기의 배율(축소 · 배율 · 확대)과 보기 고르기(글 / PDF) */}
          {pdf.mode === "pdf" && <PdfZoomButtons zoom={pdf.zoom} />}
          {pdf.available && <RecordModeButtons mode={pdf.mode} onSelect={pdf.onSelectMode} />}
          <button
            type="button"
            aria-pressed={maskReported}
            onClick={onToggleMaskReport}
            className="inline-flex cursor-pointer scroll-m-[8px] items-center gap-[4px] rounded-[4px] border-0 bg-transparent p-0 text-[12px] font-medium text-[#BA1A1A] hover-on:underline"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              fill="none"
              stroke="#BA1A1A"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-[14px] w-[14px]"
            >
              <path d="M8 2.5 14 13H2z" />
              <path d="M8 6.8v2.8M8 11.3v.1" />
            </svg>
            {maskReported ? "가림 누락 신고함" : "가림 누락 신고"}
          </button>
          {/* 크게 보기: 작업 단을 화면 전체로 편다. 켜져 있으면 글자가 "원래 크기" 로 바뀐다(같은 버튼이라 초점이 그대로 남는다). */}
          {wide && (
            <button
              type="button"
              onClick={onToggleExpanded}
              className={`${BUTTON_SECONDARY_CLASS} h-[26px] scroll-m-[8px] gap-[4px] pr-[8px] pl-[6px] leading-[normal]`}
            >
              <ExpandIcon collapse={expanded} />
              {expanded ? "원래 크기" : "크게 보기"}
            </button>
          )}
        </div>
      </div>
      {pdf.mode === "pdf" ? (
        <RecordPdf
          scrollRef={pdf.scrollRef}
          targetRef={pdf.targetRef}
          pages={pdf.pages}
          currentPage={pdf.currentPage}
          scale={pdf.zoom.scale}
          pan={pdf.pan}
          compact
          pickable={pdf.pickable}
        />
      ) : pdf.loading ? (
        // 쪽 그림을 불러오는 동안: 자리만 잡아 둔다(글이 잠깐 보였다가 PDF 로 바뀌지 않게).
        <div aria-hidden="true" className="min-h-0 flex-[1_1_auto] bg-[#EEF0F6]" />
      ) : (
        <div className={`px-[16px] pt-[12px] ${wide ? "flex min-h-0 flex-[1_1_auto] flex-col" : ""}`}>
          {areaButtons}
          {passageList}
        </div>
      )}
      <div
        className={`flex flex-none flex-wrap items-center gap-x-[12px] gap-y-[8px] border-t border-t-[#E4E4E4] ${
          wide ? "px-[16px] py-[10px]" : "mx-[16px] mt-[12px] pt-[12px] pb-[16px]"
        }`}
      >
        {/* 근거 줄: 지금 평가 요소의 근거를 원본에서 차례로 본다(끝에서는 반대쪽 끝으로 돈다). 색 점은 지금 요소의 형광펜 색이다. */}
        <div role="group" aria-label="근거 이동" className="flex flex-none">
          <button
            type="button"
            aria-label="이전 근거"
            disabled={evidenceNav.disabled}
            onClick={evidenceNav.onPrevious}
            className={`${segmentClass(0, 3, false)} ${STEP_BUTTON_CLASS}`}
          >
            <StepIcon next={false} />
          </button>
          <span
            role="status"
            className="relative -ml-px box-border inline-flex h-[28px] items-center gap-[6px] border border-[#CFCFCF] bg-white px-[10px] text-[13px] font-medium text-[#111111] tabular-nums"
          >
            <ToneSwatch tone={evidenceNav.tone} />
            {evidenceNav.text}
          </span>
          <button
            type="button"
            aria-label="다음 근거"
            disabled={evidenceNav.disabled}
            onClick={evidenceNav.onNext}
            className={`${segmentClass(2, 3, false)} ${STEP_BUTTON_CLASS}`}
          >
            <StepIcon next />
          </button>
        </div>
        {showLegend && (
          <ul
            aria-label="평가 요소별 형광펜 색"
            className="flex flex-wrap items-center gap-x-[10px] gap-y-[4px] text-[12px] leading-[16px] text-[#505050]"
          >
            {legend.map((item) => (
              <li key={item.id} className="inline-flex items-center gap-[5px]">
                <ToneSwatch tone={item.tone} />
                {item.name}
              </li>
            ))}
          </ul>
        )}
        {/* 원문보기 화면으로 가는 링크다(디자인의 버튼 모양 그대로). */}
        <Link href={originalHref} className={`${BUTTON_SECONDARY_CLASS} ml-auto h-[28px] scroll-m-[8px] px-[10px] leading-[normal]`}>
          원문보기
        </Link>
        {/* 고른 근거의 출처와 AI 가 적은 이유 (근거 문장 목록이 곁에 없을 때, 원본 아래에서 바로 읽는다) */}
        {showEvidenceNote !== "never" && evidenceNav.current !== null && (
          <p
            className={`m-0 animate-fade-in basis-full text-[13px] leading-[19px] text-[#111111] [overflow-wrap:anywhere] break-keep ${
              showEvidenceNote === "stacked" ? "hidden @max-[700px]/bench:block" : ""
            }`}
          >
            <span className="mr-[8px] text-[12px] text-[#505050]">{evidenceNav.current.source}</span>
            {evidenceNav.current.reason}
          </p>
        )}
      </div>
    </section>
  );
}

/** 크게 보기 버튼의 그림: 바깥으로 벌어지는 두 화살표(펴기), 켜져 있으면 안으로 모이는 두 화살표(접기). 선은 글자색을 따른다. */
function ExpandIcon({ collapse }: { collapse: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[14px] w-[14px]"
    >
      <path d={collapse ? "M13 6.5H9.5V3M9.5 6.5l4-4M3 9.5h3.5V13M6.5 9.5l-4 4" : "M9.5 3H13v3.5M13 3 9 7M6.5 13H3V9.5M3 13l4-4"} />
    </svg>
  );
}

/** 근거 줄의 이전·다음 버튼: 28px 정사각형. 근거가 없으면 옅은 회색이고 눌리지 않는다. */
const STEP_BUTTON_CLASS = "h-[28px] w-[28px] scroll-m-[8px] justify-center p-0 disabled:cursor-default disabled:text-[#AEAEAE]";

/** 근거 줄의 꺾쇠 (선은 글자색을 따른다) */
function StepIcon({ next }: { next: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[14px] w-[14px]"
    >
      <path d={next ? "M6 3.5 10.5 8 6 12.5" : "M10 3.5 5.5 8l4.5 4.5"} />
    </svg>
  );
}

type MarkButtonsProps = {
  marks: { key: string; label: string; on: boolean; onToggle: () => void }[];
  /** 제출한 평가인지 (버튼이 꺼진다) */
  locked: boolean;
};

/** 보류·재검토 요청 버튼. 눌린 것은 파란 테두리·바탕으로 보인다(다시 누르면 풀린다). */
export function MarkButtons({ marks, locked }: MarkButtonsProps) {
  return (
    <>
      {marks.map((mark) => (
        <button
          key={mark.key}
          type="button"
          aria-pressed={mark.on}
          disabled={locked}
          onClick={mark.onToggle}
          className={`${mark.on ? BUTTON_PRESSED_CLASS : BUTTON_SECONDARY_CLASS} h-[34px] scroll-m-[8px] px-[10px] leading-[normal]`}
        >
          {mark.label}
        </button>
      ))}
    </>
  );
}

/** 주소의 지원자 코드가 배정된 지원자가 아닐 때 (코드 없이 들어온 경우 포함) */
export function EvaluateMissing({ note }: { note: string }) {
  return (
    <>
      <EvaluateHead crumbs={[{ label: "홈" }, { label: "평가하기", href: EVALUATE_PATH }, { label: "지원자 없음" }]} note={note} />
      <div className={`${PANEL_CLASS} mt-[20px] flex flex-col items-center gap-[6px] px-[20px] py-[32px] text-center`}>
        <p className="text-[15px] leading-[22px] font-semibold">평가할 지원자를 찾지 못했습니다.</p>
        <p className="text-[14px] leading-[20px] text-[#505050]">
          주소의 지원자 코드가 없거나 배정된 지원자가 아닙니다. 평가 대기 목록에서 지원자를 골라 주세요.
        </p>
        <Link href={EVALUATE_PATH} className={`${BUTTON_SECONDARY_CLASS} mt-[10px] h-[36px] px-[14px]`}>
          평가 대기 목록으로 가기
        </Link>
      </div>
    </>
  );
}
