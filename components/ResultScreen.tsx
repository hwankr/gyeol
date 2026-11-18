import Link from "next/link";
import type { Ref } from "react";
import { Area } from "@/components/Area";
import { SERVICE_NAME } from "@/lib/constants";
import type {
  CriterionTab,
  EvidenceCardView,
  SourceSectionView,
  TextSegment,
} from "@/lib/resultView";

type ResultScreenProps = {
  /** 학과 이름 */
  department: string;
  tabs: CriterionTab[];
  /** 현재 탭 기준의 설명. 없으면 null(아무것도 보여 주지 않는다) */
  activeDescription: string | null;
  sections: SourceSectionView[];
  cards: EvidenceCardView[];
  /** 블라인드 처리 내역 (예: "인적·학적사항 5곳, 학교명 12곳" 또는 "가린 정보 없음") */
  maskSummary: string;
  /** 원문 단(스크롤 영역) */
  sourceScrollRef: Ref<HTMLDivElement>;
  /** 선택한 근거가 들어 있는 항목 */
  selectedSectionRef: Ref<HTMLElement>;
  /** 강조한 인용 구절 */
  highlightRef: Ref<HTMLElement>;
  onSelectTab: (criterionId: string) => void;
  onSelectEvidence: (evidenceId: string) => void;
};

/** 분석 결과 화면 (/result). 왼쪽 원문과 오른쪽 근거가 각자 스크롤된다. */
export function ResultScreen({
  department,
  tabs,
  activeDescription,
  sections,
  cards,
  maskSummary,
  sourceScrollRef,
  selectedSectionRef,
  highlightRef,
  onSelectTab,
  onSelectEvidence,
}: ResultScreenProps) {
  return (
    <main className="flex h-full flex-col gap-3 p-3">
      <Area name="상단">
        <div className="flex items-center justify-between gap-6">
          <div className="flex min-w-0 items-center gap-6">
            <h1 className="text-lg font-bold">{SERVICE_NAME}</h1>
            <p className="min-w-0 [overflow-wrap:anywhere]">학과: {department}</p>
          </div>
          <Link href="/" className="shrink-0 underline">
            다른 학생부 업로드
          </Link>
        </div>
      </Area>

      {/* 두 단 폭 3:2 를 내용 길이와 상관없이 지킨다(minmax(0, …): 긴 기준 이름·글자가 단 폭을 넓히지 못하게). */}
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-3">
        <Area name="학생부 원문 (블라인드 처리됨)" className="flex min-h-0 flex-col">
          {/* 원문 스크롤 상자 밖에 둔다: 원문을 스크롤해도 제자리에 있고, 원문 위치로 이동하는 스크롤 계산에 끼지 않는다. */}
          <p className="[overflow-wrap:anywhere]">블라인드 처리 내역: {maskSummary}</p>
          <div ref={sourceScrollRef} className="min-h-0 flex-1 overflow-y-auto pr-2">
            {sections.map((section) => (
              <article
                key={section.id}
                ref={section.isSelected ? selectedSectionRef : undefined}
                className="border-b border-neutral-300 py-3 last:border-b-0"
              >
                <h2 className="mb-1 font-bold">{sectionTitle(section)}</h2>
                <p className="whitespace-pre-wrap leading-7">
                  {section.segments.map((segment, index) => (
                    <SegmentText key={index} segment={segment} highlightRef={highlightRef} />
                  ))}
                </p>
              </article>
            ))}
          </div>
        </Area>

        {/* 탭 줄·기준 설명이 길어 카드 목록의 최소 높이까지 담을 수 없으면 이 단 전체가 세로로 스크롤된다. */}
        <Area name="기준별 근거" className="flex min-h-0 flex-col overflow-y-auto">
          {/* 탭은 자리가 모자라면 다음 줄로 넘기고, 공백 없는 긴 이름은 탭 안에서 줄을 바꾼다. */}
          <div role="tablist" className="mb-3 flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.criterionId}
                type="button"
                role="tab"
                aria-selected={tab.isActive}
                className={
                  tab.isActive
                    ? "max-w-full border-2 border-black px-3 py-1 font-bold [overflow-wrap:anywhere]"
                    : "max-w-full border-2 border-neutral-300 px-3 py-1 [overflow-wrap:anywhere]"
                }
                onClick={() => onSelectTab(tab.criterionId)}
              >
                {tab.name} ({tab.count})
              </button>
            ))}
          </div>

          {activeDescription !== null && (
            <p className="mb-3 [overflow-wrap:anywhere]">기준 설명: {activeDescription}</p>
          )}

          {/* 카드 목록은 남은 높이를 다 쓰고 그 안에서 스크롤된다. 남은 높이가 모자라도 최소 8rem 은 보이게 한다. */}
          <ul role="tabpanel" className="flex min-h-[8rem] flex-1 flex-col gap-2 overflow-y-auto pr-2">
            {cards.length === 0 && <li className="text-neutral-500">이 기준의 근거가 없습니다.</li>}
            {cards.map((card) => (
              <li key={card.id}>
                <button
                  type="button"
                  aria-pressed={card.isSelected}
                  className={`flex w-full flex-col gap-1 text-left [overflow-wrap:anywhere] ${
                    card.isSelected
                      ? "border-[3px] border-black p-[10px]"
                      : "border border-neutral-400 p-3"
                  }`}
                  onClick={() => onSelectEvidence(card.id)}
                >
                  <span>“{card.quote}”</span>
                  <span className="text-sm text-neutral-700">근거인 이유: {card.reason}</span>
                  <span className="text-sm text-neutral-500">
                    출처: {card.source ? sourceLabel(card.source) : "찾을 수 없음"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Area>
      </div>
    </main>
  );
}

/** 결과가 없을 때 (/result 에 바로 들어온 경우 등) */
export function NoResultScreen() {
  return (
    <main className="p-3">
      <Area name="안내">
        <p className="mb-2">분석 결과가 없습니다.</p>
        <Link href="/" className="underline">
          업로드 화면으로 이동
        </Link>
      </Area>
    </main>
  );
}

function SegmentText({
  segment,
  highlightRef,
}: {
  segment: TextSegment;
  highlightRef: Ref<HTMLElement>;
}) {
  if (segment.kind === "highlight") {
    return (
      <mark ref={highlightRef} className="bg-neutral-300 text-black underline underline-offset-4">
        {segment.text}
      </mark>
    );
  }
  if (segment.kind === "underline") {
    return <span className="underline underline-offset-4">{segment.text}</span>;
  }
  return <>{segment.text}</>;
}

/** 항목 제목: 항목명 · 학년 · 과목 · 시간 · 쪽 번호 (학년·과목·시간은 없으면 뺀다. 과목이 빈 문자열이어도 뺀다) */
function sectionTitle(section: SourceSectionView): string {
  return [
    section.category,
    section.grade === null ? null : `${section.grade}학년`,
    section.subject || null,
    section.hours === undefined ? null : `${section.hours}시간`,
    `${section.page}쪽`,
  ]
    .filter((part) => part !== null)
    .join(" · ");
}

function sourceLabel(source: { category: string; grade: number | null }): string {
  return source.grade === null ? source.category : `${source.category} · ${source.grade}학년`;
}
