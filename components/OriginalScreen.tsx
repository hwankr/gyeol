import Link from "next/link";
import type { Ref } from "react";
import {
  AccentTag,
  BUTTON_SECONDARY_CLASS,
  ConsoleCrumbs,
  ConsoleTitle,
  PANEL_CLASS,
  PANEL_HEAD_CLASS,
  PANEL_TITLE_CLASS,
  StatusChip,
  segmentClass,
  type ConsoleCrumb,
} from "@/components/consoleUi";
import type { OriginalMode, PdfPageView } from "@/hooks/useOriginalView";
import type { CriterionTab, EvidenceCardView, SourceSectionView, TextSegment } from "@/lib/resultView";

type OriginalScreenProps = {
  crumbs: readonly ConsoleCrumb[];
  /** 화면 제목: 들어온 곳의 이름 ("지원자 관리", "평가하기") */
  title: string;
  /** 제목 옆의 글: 전형 · 모집 단위 */
  headNote: string;
  /** 돌아가기 링크 (지원자 관리에서는 "목록", 평가하기에서는 "총평") */
  back: { href: string; label: string };
  /** 지원자 코드 ("A-0315") */
  code: string;
  /** 분석에 쓴 기준의 학과·모집 단위 이름 */
  department: string;
  /** 예시 지원자일 때의 안내 (가상 학생부를 보여 준다). 올린 지원자면 null. */
  sampleNote: string | null;
  /** 블라인드 처리 내역 (예: "인적·학적사항 5곳, 학교명 12곳" 또는 "가린 정보 없음") */
  maskSummary: string;
  tabs: CriterionTab[];
  /** 지금 고른 기준의 설명. 없으면 null(아무것도 보여 주지 않는다) */
  activeDescription: string | null;
  sections: SourceSectionView[];
  cards: EvidenceCardView[];
  /** 원문 스크롤 영역 */
  sourceScrollRef: Ref<HTMLDivElement>;
  /** 고른 근거가 들어 있는 항목 */
  selectedSectionRef: Ref<HTMLElement>;
  /** 강조한 인용 구절 */
  highlightRef: Ref<HTMLElement>;
  /** PDF 쪽 스크롤 영역 */
  pdfScrollRef: Ref<HTMLDivElement>;
  /** PDF 쪽 위의 표시 가운데 스크롤 대상 */
  pdfTargetRef: Ref<HTMLSpanElement>;
  /** 실제 PDF 보기: 가린 쪽 그림과 그 위의 표시. 쪽 그림이 없는 지원자는 available 이 false 다(보기 고르기와 쪽 번호 버튼이 없다) */
  pdf: {
    available: boolean;
    /** 왼쪽 단의 지금 보기 */
    mode: OriginalMode;
    pages: readonly PdfPageView[];
    onSelectMode: (mode: OriginalMode) => void;
    /** 항목의 쪽 번호를 누름: 그 항목을 PDF 에서 본다 */
    onShowSection: (sectionId: string) => void;
  };
  onSelectTab: (criterionId: string) => void;
  onSelectEvidence: (evidenceId: string) => void;
};

/** 왼쪽 단의 보기 고르기 */
const MODES: readonly { mode: OriginalMode; label: string }[] = [
  { mode: "text", label: "글" },
  { mode: "pdf", label: "PDF" },
];

/**
 * 두 단의 높이: 화면 높이에서 위의 것(상단 바, 현재 위치·제목·지원자 줄, 여백)을 뺀 만큼이고 480px 보다 작아지지 않는다.
 * 두 단이 각자 안에서 스크롤하므로 근거를 고르며 원문을 따라 읽을 때 문서가 움직이지 않는다. 좁은 화면에서 단이 위아래로 쌓여도 같은 높이다.
 */
const COLUMN_HEIGHT_CLASS = "h-[max(480px,calc(100vh-280px))]";

/** 스크롤 영역의 가는 스크롤바 (지원자 관리의 상세 영역과 같은 모양) */
const SCROLL_CLASS = "min-h-0 flex-[1_1_auto] scroll-m-[8px] overflow-y-auto [scrollbar-color:#CFCFCF_transparent] [scrollbar-width:thin]";

/**
 * 원문보기 화면(/applicants/original?code=…, /evaluate/original?code=…): 지원자 한 명의 가려진 학생부 원문(왼쪽)과 기준별 근거(오른쪽).
 * 기준을 고르면 그 기준의 근거 구절에 원문에서 점선 밑줄이 그어지고, 근거를 누르면 원문이 그 자리로 스크롤되며 그 구절이 색 면으로 강조된다.
 * 디자인 시안에는 없는 화면이라 평가하기의 지원자 줄·서류 원문과 같은 조각과 색으로 만들었다. 폭이 모자라면 오른쪽 단이 아래로 내려간다.
 * 기준을 바꾸면 그 기준의 근거가 옅게 나타나고, 근거를 고르면 원문의 그 구절이 잠깐 짙게 나타났다가 제 색으로 가라앉는다(스크롤이 닿는 곳을 알아보게).
 * 올린 학생부는 왼쪽 단을 "글" 과 "PDF" 로 바꿔 볼 수 있다. PDF 는 실제 학생부의 쪽 그림이고 가린 정보의 자리는 덮여 있다(가리기 전 그림은
 * 어디에도 남지 않는다). 항목 제목의 쪽 번호를 누르거나 PDF 보기에서 근거를 고르면 그 쪽으로 스크롤되고 그 자리가 색 면으로 표시된다.
 */
export function OriginalScreen({
  crumbs,
  title,
  headNote,
  back,
  code,
  department,
  sampleNote,
  maskSummary,
  tabs,
  activeDescription,
  sections,
  cards,
  sourceScrollRef,
  selectedSectionRef,
  highlightRef,
  pdfScrollRef,
  pdfTargetRef,
  pdf,
  onSelectTab,
  onSelectEvidence,
}: OriginalScreenProps) {
  /** 고른 근거. 강조한 구절을 근거가 바뀔 때마다 새로 그려(key) 나타나는 움직임이 다시 걸리게 한다. */
  const selectedCardId = cards.find((card) => card.isSelected)?.id ?? "";
  return (
    <>
      <ConsoleCrumbs items={crumbs} />
      <ConsoleTitle title={title} note={headNote} />
      <div className={`${PANEL_CLASS} mt-[16px] flex flex-wrap items-center gap-x-[12px] gap-y-[8px] px-[12px] py-[10px]`}>
        <Link href={back.href} className={`${BUTTON_SECONDARY_CLASS} h-[32px] scroll-m-[8px] gap-[4px] pr-[10px] pl-[6px]`}>
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
          {back.label}
        </Link>
        <h2 className="ml-[4px] text-[22px] leading-[30px] font-bold tracking-[-0.01em] tabular-nums">{code}</h2>
        <p className="text-[14px] leading-[20px] text-[#505050] [overflow-wrap:anywhere]">원문보기 · {department} 기준</p>
        <StatusChip tone="gray">블라인드 처리됨</StatusChip>
        <p className="text-[13px] leading-[18px] text-[#505050] [overflow-wrap:anywhere]">블라인드 처리 내역: {maskSummary}</p>
      </div>
      {sampleNote !== null && <p className="mt-[8px] text-[13px] leading-[18px] text-[#8A4B00]">{sampleNote}</p>}

      <div className={`${PANEL_CLASS} mt-[16px] flex flex-wrap items-stretch`}>
        <section aria-labelledby="original-title" className={`flex min-w-0 flex-[999_1_460px] flex-col ${COLUMN_HEIGHT_CLASS}`}>
          <div className={`${PANEL_HEAD_CLASS} flex h-[40px] flex-none items-center justify-between gap-[8px] rounded-tl-[7px] px-[20px]`}>
            <h3 id="original-title" className={PANEL_TITLE_CLASS}>
              학생부 원문
            </h3>
            {pdf.available && (
              <div role="group" aria-label="원문 보기" className="flex">
                {MODES.map((item, index) => (
                  <button
                    key={item.mode}
                    type="button"
                    aria-pressed={pdf.mode === item.mode}
                    onClick={() => pdf.onSelectMode(item.mode)}
                    className={`${segmentClass(index, MODES.length, pdf.mode === item.mode)} h-[26px] scroll-m-[8px] px-[12px]`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {pdf.mode === "pdf" && (
            <div
              ref={pdfScrollRef}
              tabIndex={0}
              role="group"
              aria-label="학생부 PDF 쪽"
              className={`${SCROLL_CLASS} flex animate-fade-in flex-col gap-[12px] bg-[#F0F0F2] p-[12px]`}
            >
              {pdf.pages.map((page) => (
                <figure
                  key={page.page}
                  className="relative m-0 w-full flex-none overflow-hidden rounded-[2px] border border-[#CFCFCF] bg-white"
                  style={{ aspectRatio: `${page.width} / ${page.height}` }}
                >
                  {page.url !== null ? (
                    // 그림은 이 브라우저에 남긴 가린 쪽 그림(blob 주소)이라 next/image 를 쓰지 않는다.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={page.url} alt={`학생부 ${page.page}쪽`} loading="lazy" className="absolute inset-0 h-full w-full" />
                  ) : (
                    <p className="absolute inset-0 m-0 flex items-center justify-center text-[13px] leading-[18px] text-[#505050]">
                      {page.stateText}
                    </p>
                  )}
                  {page.marks.map((mark) => (
                    <span
                      key={mark.key}
                      ref={mark.isTarget ? pdfTargetRef : undefined}
                      aria-hidden="true"
                      className={`pointer-events-none absolute ${PDF_MARK_CLASS[mark.kind]}`}
                      style={{
                        left: `${mark.x * 100}%`,
                        top: `${mark.y * 100}%`,
                        width: `${mark.w * 100}%`,
                        height: `${mark.h * 100}%`,
                      }}
                    />
                  ))}
                  <figcaption className="absolute right-[6px] bottom-[4px] rounded-[4px] bg-white/[0.85] px-[6px] text-[11px] leading-[16px] font-medium text-[#505050] tabular-nums">
                    {page.page} / {pdf.pages.length}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
          <div
            ref={sourceScrollRef}
            tabIndex={0}
            role="group"
            aria-label="학생부 원문 내용"
            hidden={pdf.mode === "pdf"}
            className={`${SCROLL_CLASS} px-[20px] ${pdf.mode === "pdf" ? "hidden" : ""}`}
          >
            {sections.map((section, index) => (
              <article
                key={section.id}
                ref={section.isSelected ? selectedSectionRef : undefined}
                className={`py-[12px] ${index === 0 ? "" : "border-t border-t-[#E4E4E4]"}`}
              >
                <h4
                  className={`flex flex-wrap items-baseline gap-x-[6px] text-[12px] leading-[16px] font-semibold ${
                    section.isSelected ? "text-[#001AD0]" : "text-[#505050]"
                  }`}
                >
                  {sectionTitle(section)}
                  {/* 쪽 그림이 있으면 쪽 번호가 버튼이다: 누르면 실제 PDF 의 그 쪽에서 이 항목의 자리를 보여 준다. */}
                  {pdf.available ? (
                    <button
                      type="button"
                      aria-label={`${sectionTitle(section)} PDF ${section.page}쪽 보기`}
                      onClick={() => pdf.onShowSection(section.id)}
                      className="motion-colors cursor-pointer scroll-m-[8px] rounded-[4px] border-0 bg-transparent p-0 text-[12px] leading-[16px] font-medium text-[#001AD0] tabular-nums hover-on:underline"
                    >
                      PDF {section.page}쪽
                    </button>
                  ) : (
                    <span className="font-medium tabular-nums">· {section.page}쪽</span>
                  )}
                </h4>
                <p className="mt-[6px] text-[14px] leading-[24px] [overflow-wrap:anywhere] break-keep whitespace-pre-wrap">
                  {section.segments.map((segment, segmentIndex) => (
                    <SegmentText key={segmentIndex} segment={segment} highlightRef={highlightRef} highlightKey={selectedCardId} />
                  ))}
                </p>
              </article>
            ))}
            {sections.length === 0 && <p className="py-[12px] text-[13px] leading-[18px] text-[#505050]">원문 항목이 없습니다.</p>}
          </div>
        </section>

        <section
          aria-labelledby="evidence-title"
          className={`box-border flex max-w-[432px] min-w-0 flex-[1_1_360px] flex-col border-l border-l-[#E4E4E4] ${COLUMN_HEIGHT_CLASS}`}
        >
          <div className={`${PANEL_HEAD_CLASS} flex h-[40px] flex-none items-center gap-[8px] rounded-tr-[7px] px-[20px]`}>
            <h3 id="evidence-title" className={PANEL_TITLE_CLASS}>
              기준별 근거
            </h3>
            <AccentTag>AI 제안</AccentTag>
          </div>
          <div className="flex min-h-0 flex-[1_1_auto] flex-col px-[20px] pt-[12px] pb-[16px]">
            {/* 기준 버튼은 자리가 모자라면 다음 줄로 넘기고, 공백 없는 긴 이름은 버튼 안에서 줄을 바꾼다. */}
            <div role="tablist" aria-label="평가 기준" className="flex flex-none flex-wrap gap-[6px]">
              {tabs.map((tab) => (
                <button
                  key={tab.criterionId}
                  type="button"
                  role="tab"
                  aria-selected={tab.isActive}
                  onClick={() => onSelectTab(tab.criterionId)}
                  className={`motion-colors box-border inline-flex min-h-[32px] max-w-full scroll-m-[8px] cursor-pointer items-center gap-[6px] rounded-[6px] border px-[12px] py-[4px] text-left text-[13px] leading-[18px] [overflow-wrap:anywhere] ${
                    tab.isActive
                      ? "border-[#001AD0] bg-[#EEF0FF] font-semibold text-[#001AD0]"
                      : "border-[#CFCFCF] bg-white font-medium text-[#505050] hover-on:bg-[#F6F7FB] hover-on:text-[#111111]"
                  }`}
                >
                  {tab.name}
                  <span className={`flex-none tabular-nums ${tab.isActive ? "text-[#001AD0]" : "text-[#767676]"}`}>{tab.count}</span>
                </button>
              ))}
            </div>
            {activeDescription !== null && (
              <p className="mt-[10px] flex-none text-[12px] leading-[18px] text-[#505050] [overflow-wrap:anywhere]">
                {activeDescription}
              </p>
            )}
            <ul
              role="tabpanel"
              tabIndex={0}
              aria-label="고른 기준의 근거"
              className={`${SCROLL_CLASS} mt-[12px] flex flex-col gap-[8px] border-t border-t-[#E4E4E4] pt-[12px]`}
            >
              {cards.length === 0 && <li className="text-[13px] leading-[18px] text-[#505050]">이 기준의 근거가 없습니다.</li>}
              {cards.map((card) => (
                <li key={card.id} className="animate-fade-in">
                  {/* 누르면 원문이 그 구절로 스크롤된다. 고른 근거는 파란 테두리·옅은 파란 바탕이다(aria-pressed). */}
                  <button
                    type="button"
                    aria-pressed={card.isSelected}
                    onClick={() => onSelectEvidence(card.id)}
                    className={`motion-colors box-border flex w-full scroll-m-[8px] cursor-pointer flex-col gap-[4px] rounded-[6px] border px-[12px] py-[8px] text-left [overflow-wrap:anywhere] ${
                      card.isSelected
                        ? "border-[#001AD0] bg-[#EEF0FF]"
                        : "border-[#E4E4E4] bg-[#F6F7FB] hover-on:border-[#CFCFCF] hover-on:bg-[#EEF0F6]"
                    }`}
                  >
                    <span className="text-[12px] leading-[16px] text-[#505050]">
                      {card.source ? sourceLabel(card.source) : "출처를 찾을 수 없음"}
                    </span>
                    <span className="text-[14px] leading-[22px] break-keep text-[#111111]">{card.quote}</span>
                    <span className="text-[12px] leading-[18px] text-[#505050]">{card.reason}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </>
  );
}

type OriginalMissingProps = {
  crumbs: readonly ConsoleCrumb[];
  title: string;
  headNote: string;
  back: { href: string; label: string };
};

/** 주소의 지원자 코드로 원문을 찾지 못했을 때 (코드 없이 들어온 경우, 목록에서 빠진 올린 지원자 포함) */
export function OriginalMissing({ crumbs, title, headNote, back }: OriginalMissingProps) {
  return (
    <>
      <ConsoleCrumbs items={crumbs} />
      <ConsoleTitle title={title} note={headNote} />
      <div className={`${PANEL_CLASS} mt-[20px] flex flex-col items-center gap-[6px] px-[20px] py-[32px] text-center`}>
        <p className="text-[15px] leading-[22px] font-semibold">원문을 찾지 못했습니다.</p>
        <p className="text-[14px] leading-[20px] text-[#505050]">
          주소의 지원자 코드가 없거나, 이 브라우저에 그 지원자의 학생부가 남아 있지 않습니다.
        </p>
        <Link href={back.href} className={`${BUTTON_SECONDARY_CLASS} mt-[10px] h-[36px] px-[14px]`}>
          {back.label}
        </Link>
      </div>
    </>
  );
}

/**
 * 원문의 구간: 고른 근거의 구절은 색 면(#DCE0FF)과 실선 밑줄, 지금 기준의 다른 근거 구절은 점선 밑줄이다
 * (평가하기의 서류 원문과 같은 표시: components/EvaluateParts.tsx 의 SEGMENT_CLASS).
 * 강조한 구절은 고른 근거(highlightKey)가 바뀔 때마다 새로 그려져, 색 면이 잠깐 짙게 나타났다가 제 색으로 가라앉는다(app/globals.css 의 mark-in).
 */
function SegmentText({
  segment,
  highlightRef,
  highlightKey,
}: {
  segment: TextSegment;
  highlightRef: Ref<HTMLElement>;
  highlightKey: string;
}) {
  if (segment.kind === "highlight") {
    return (
      <mark
        key={highlightKey}
        ref={highlightRef}
        className="animate-mark-in bg-[#DCE0FF] text-[#111111] underline decoration-[#001AD0] decoration-solid underline-offset-[4px]"
      >
        {segment.text}
      </mark>
    );
  }
  if (segment.kind === "underline") {
    return <span className="underline decoration-[#505050] decoration-dotted underline-offset-[4px]">{segment.text}</span>;
  }
  return <>{segment.text}</>;
}

/**
 * PDF 쪽 위의 표시: 고른 근거의 인용 구절은 짙은 색 면(글의 강조 색과 같은 파랑), 그 항목의 원문은 옅은 색 면.
 * 색 면은 곱하기로 얹어 아래의 글자가 그대로 보인다.
 */
const PDF_MARK_CLASS = {
  quote: "animate-mark-in bg-[#8C9BFF]/[0.45] mix-blend-multiply",
  section: "bg-[#DCE0FF]/[0.55] mix-blend-multiply",
} as const;

/**
 * 항목 제목: 항목명 · 묶음 · 학년 · 과목 · 시간 (묶음·학년·과목·시간은 없으면 뺀다. 과목이 빈 문자열이어도 뺀다).
 * 묶음은 서식의 "진로 선택 과목"·"체육·예술" 처럼 항목명만으로는 알 수 없는 것이다. 쪽 번호는 제목 옆에 따로 적는다.
 */
function sectionTitle(section: SourceSectionView): string {
  return [
    section.category,
    section.group,
    section.grade === null ? null : `${section.grade}학년`,
    section.subject || null,
    section.hours === undefined ? null : `${section.hours}시간`,
  ]
    .filter((part) => part !== null)
    .join(" · ");
}

function sourceLabel(source: { category: string; grade: number | null }): string {
  return source.grade === null ? source.category : `${source.grade}학년 · ${source.category}`;
}
