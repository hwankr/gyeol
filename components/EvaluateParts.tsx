import Link from "next/link";
import type { Ref } from "react";
import {
  BUTTON_OUTLINE_CLASS,
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
import { EVALUATE_PATH } from "@/lib/consoleMenu";
import type { EvaluationStatus } from "@/lib/evaluate/evaluation";
import type { DocumentArea } from "@/lib/evaluate/sampleEvaluations";

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
      <a aria-disabled="true" className={`${STEP_LINK_CLASS} cursor-default opacity-[0.45]`}>
        {label}
      </a>
    );
  }
  return (
    <Link ref={linkRef} href={href} className={STEP_LINK_CLASS}>
      {label}
    </Link>
  );
}

/** 원문 조각의 강조: 지금 고른 평가 요소의 근거는 색 면과 실선 밑줄, 다른 요소의 근거는 점선 밑줄 */
const SEGMENT_CLASS = {
  selected: "bg-[#DCE0FF] underline decoration-[#001AD0] decoration-solid underline-offset-[4px]",
  other: "underline decoration-[#505050] decoration-dotted underline-offset-[4px]",
  none: "",
} as const;

type DocumentPanelProps = {
  /** 바깥 <section> 에 줄 클래스 (단의 너비·왼쪽 선은 화면마다 다르다) */
  className: string;
  /** 머리 줄의 모서리 (상자 안에서의 자리에 따라 다르다) */
  headClassName: string;
  /** 머리 줄 제목의 id (한 화면에 하나) */
  titleId: string;
  /** 아래에 밑줄·색 면 풀이를 적을지 (총평 화면만) */
  showLegend: boolean;
  areas: { area: DocumentArea; on: boolean; onPick: () => void }[];
  passages: {
    id: string;
    source: string;
    segments: { key: string; text: string; emphasis: keyof typeof SEGMENT_CLASS }[];
  }[];
  /** 가림 누락을 신고했는지 */
  maskReported: boolean;
  onToggleMaskReport: () => void;
  /** 원문보기 화면의 주소 (그 지원자의 학생부 원문과 기준별 근거) */
  originalHref: string;
};

/**
 * 서류 원문: 서류 구분(교과·세특·창체·행특)과 그 구분의 가려진 학생부 문장. AI 가 근거로 쓴 문장에 밑줄이 있고,
 * 지금 고른 평가 요소의 근거는 색 면으로 강조한다. 가림 누락 신고는 누르면 신고한 것으로 표시되고 다시 누르면 거둔다.
 */
export function DocumentPanel({
  className,
  headClassName,
  titleId,
  showLegend,
  areas,
  passages,
  maskReported,
  onToggleMaskReport,
  originalHref,
}: DocumentPanelProps) {
  return (
    <section aria-labelledby={titleId} className={className}>
      <div className={`${PANEL_HEAD_CLASS} ${headClassName} flex h-[40px] items-center justify-between gap-[8px] px-[16px]`}>
        <h3 id={titleId} className={PANEL_TITLE_CLASS}>
          서류 원문
        </h3>
        <button
          type="button"
          aria-pressed={maskReported}
          onClick={onToggleMaskReport}
          className="inline-flex scroll-m-[8px] items-center gap-[4px] rounded-[4px] border-0 bg-transparent p-0 text-[12px] font-medium text-[#BA1A1A]"
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
      </div>
      <div className="px-[16px] pt-[12px] pb-[16px]">
        <div role="group" aria-label="서류 구분" className="flex">
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
        {/*
          원문이 길면(올린 학생부의 세특은 과목 수십 건이다) 이 상자 안에서 세로로 스크롤한다. 높이는 화면 높이의 60%(360px 보다 작아지지 않음)까지다.
          예시 지원자의 원문은 짧아 스크롤이 생기지 않는다. 키보드로도 스크롤할 수 있게 초점을 받는다.
        */}
        <div
          role="group"
          aria-label="서류 원문 내용"
          tabIndex={0}
          className="mt-[12px] max-h-[max(360px,60vh)] scroll-m-[8px] overflow-y-auto"
        >
          {passages.map((passage, index) => (
            <div key={passage.id} className={`border-t border-t-[#E4E4E4] pt-[12px] ${index === 0 ? "" : "mt-[12px]"}`}>
              <p className="text-[12px] leading-[16px] font-semibold text-[#505050]">{passage.source}</p>
              <p className="mt-[6px] text-[14px] leading-[24px] [overflow-wrap:anywhere] break-keep whitespace-pre-line">
                {passage.segments.map((segment) => (
                  <span key={segment.key} className={SEGMENT_CLASS[segment.emphasis]}>
                    {segment.text}
                  </span>
                ))}
              </p>
            </div>
          ))}
          {passages.length === 0 && (
            <p className="border-t border-t-[#E4E4E4] pt-[12px] text-[13px] leading-[18px] text-[#505050]">
              이 구분의 원문이 없습니다.
            </p>
          )}
        </div>
        <div
          className={`mt-[12px] flex flex-wrap items-center gap-[8px] border-t border-t-[#E4E4E4] pt-[12px] ${
            showLegend ? "justify-between" : "justify-end"
          }`}
        >
          {showLegend && (
            <span className="text-[12px] leading-[16px] text-[#505050]">
              밑줄은 AI가 근거로 쓴 문장, 색 면은 지금 고른 항목의 근거입니다.
            </span>
          )}
          {/* 원문보기 화면으로 가는 링크다(디자인의 버튼 모양 그대로). */}
          <Link href={originalHref} className={`${BUTTON_SECONDARY_CLASS} h-[28px] scroll-m-[8px] px-[10px] leading-[normal]`}>
            원문보기
          </Link>
        </div>
      </div>
    </section>
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
          className={`${BUTTON_SECONDARY_CLASS} h-[34px] scroll-m-[8px] px-[10px] leading-[normal] ${
            mark.on ? "border-[#001AD0] bg-[#EEF0FF] font-semibold text-[#001AD0]" : ""
          }`}
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
