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
  sections: SourceSectionView[];
  cards: EvidenceCardView[];
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
  sections,
  cards,
  sourceScrollRef,
  selectedSectionRef,
  highlightRef,
  onSelectTab,
  onSelectEvidence,
}: ResultScreenProps) {
  return (
    <main className="flex h-full flex-col gap-3 p-3">
      <Area name="상단">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-bold">{SERVICE_NAME}</h1>
            <p>학과: {department}</p>
          </div>
          <Link href="/" className="underline">
            다른 학생부 업로드
          </Link>
        </div>
      </Area>

      <div className="grid min-h-0 flex-1 grid-cols-[3fr_2fr] gap-3">
        <Area name="학생부 원문" className="flex min-h-0 flex-col">
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

        <Area name="기준별 근거" className="flex min-h-0 flex-col">
          <div role="tablist" className="mb-3 flex gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.criterionId}
                type="button"
                role="tab"
                aria-selected={tab.isActive}
                className={
                  tab.isActive
                    ? "border-2 border-black px-3 py-1 font-bold"
                    : "border-2 border-neutral-300 px-3 py-1"
                }
                onClick={() => onSelectTab(tab.criterionId)}
              >
                {tab.name} ({tab.count})
              </button>
            ))}
          </div>

          <ul role="tabpanel" className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-2">
            {cards.length === 0 && <li className="text-neutral-500">이 기준의 근거가 없습니다.</li>}
            {cards.map((card) => (
              <li key={card.id}>
                <button
                  type="button"
                  aria-pressed={card.isSelected}
                  className={`flex w-full flex-col gap-1 text-left ${
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
