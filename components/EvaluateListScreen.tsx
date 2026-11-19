import Link from "next/link";
import {
  PANEL_CLASS,
  PANEL_HEAD_CLASS,
  PANEL_TITLE_CLASS,
  segmentClass,
  type ConsoleCrumb,
} from "@/components/consoleUi";
import { EvaluateHead, EvaluationStatusChip } from "@/components/EvaluateParts";
import type { EvaluationStatus } from "@/lib/evaluate/evaluation";

type EvaluateListScreenProps = {
  crumbs: readonly ConsoleCrumb[];
  /** 제목 옆의 글: 전형 · 모집 단위 · 접수 건수 */
  note: string;
  /** 목록에 넣지 못한 올린 지원자가 있을 때의 안내 (없으면 빈 글) */
  skippedNote: string;
  /** 목록 구분. count 가 null 이면 수를 적지 않는다(평가 대기 목록). */
  tabs: { key: string; label: string; count: number | null; on: boolean; onPick: () => void }[];
  /** 내 점수 정렬 버튼 */
  sort: { mark: string; active: boolean; label: string; onToggle: () => void };
  rows: { code: string; href: string; summary: string; scoreText: string; status: EvaluationStatus }[];
  progress: {
    ringLabel: string;
    ringPercentText: string;
    ringAriaLabel: string;
    /** 고리의 채움 비율 (0~1) */
    ringFraction: number;
    people: { key: string; name: string; countText: string; percent: number; on: boolean; onPick: () => void }[];
    deadlineText: string;
  };
};

/** 목록의 칸 너비: 지원자 코드, AI 한 줄 요약, 내 점수, 상태 */
const ROW_GRID_CLASS = "grid grid-cols-[92px_minmax(0,1fr)_76px_100px] items-center gap-x-[12px]";

/** 고리 그림의 반지름과 둘레 (viewBox 128, 선 굵기 10) */
const RING_RADIUS = 54;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/**
 * 평가하기 · 평가 대기 목록 화면(/evaluate). 왼쪽은 배정된 지원자 목록(줄 전체가 총평 화면으로 가는 링크),
 * 오른쪽은 평가 진행 현황(고리 그림과 위원별 막대. 사람을 누르면 고리가 그 사람의 비율을 보여 준다).
 * 좁은 화면에서는 진행 현황이 목록 아래로 내려가고, 목록은 상자 안에서 가로로 스크롤된다.
 * 움직임(디자인 시안에 없어 정한 것): 고리와 막대는 화면에 나타날 때 채워지고, 사람을 고르면 고리의 채움이 그 비율로 움직인다.
 * 줄과 고르지 않은 사람은 마우스를 올리면 옅은 회색 바탕이 된다.
 */
export function EvaluateListScreen({
  crumbs,
  note,
  skippedNote,
  tabs,
  sort,
  rows,
  progress,
}: EvaluateListScreenProps) {
  return (
    <>
      <EvaluateHead crumbs={crumbs} note={note} />
      <div className="mt-[20px] flex flex-wrap items-center justify-between gap-x-[16px] gap-y-[8px]">
        <div role="group" aria-label="평가 목록 구분" className="flex">
          {tabs.map((tab, index) => (
            <button
              key={tab.key}
              type="button"
              aria-pressed={tab.on}
              onClick={tab.onPick}
              className={`${segmentClass(index, tabs.length, tab.on)} h-[32px] scroll-m-[8px] gap-[6px] px-[12px] leading-[normal]`}
            >
              {tab.label}
              {tab.count !== null && (
                <span className={`tabular-nums ${tab.on ? "text-[#001AD0]" : "text-[#767676]"}`}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>
      {/* 디자인에는 없는 줄: 올린 학생부 가운데 지금 평가 기준으로 분석하지 않아 목록에 넣지 못한 것이 있을 때만 나온다. */}
      {skippedNote !== "" && (
        <p role="status" className="mt-[8px] text-[13px] leading-[18px] text-[#8A4B00]">
          {skippedNote}
        </p>
      )}
      <div className={`${PANEL_CLASS} mt-[12px] flex flex-[1_1_auto] flex-wrap items-stretch`}>
        <div className="min-w-0 flex-[999_1_440px] overflow-x-auto">
          <div className="min-w-[600px]">
            <div
              className={`${ROW_GRID_CLASS} ${PANEL_HEAD_CLASS} h-[40px] rounded-tl-[7px] px-[20px] text-[12px] leading-[16px] font-semibold text-[#505050]`}
            >
              <span>지원자 코드</span>
              <span>AI 한 줄 요약</span>
              <button
                type="button"
                aria-label={sort.label}
                onClick={sort.onToggle}
                className={`motion-colors -ml-[6px] inline-flex h-[28px] cursor-pointer scroll-m-[8px] items-center gap-[4px] justify-self-start rounded-[4px] border-0 bg-transparent px-[6px] text-[12px] leading-[normal] font-semibold hover-on:bg-[#E9EBF3] ${
                  sort.active ? "text-[#001AD0]" : "text-[#505050]"
                }`}
              >
                내 점수<span aria-hidden="true">{sort.mark}</span>
              </button>
              <span>상태</span>
            </div>
            <ul>
              {rows.map((row) => (
                <li key={row.code} className="border-b border-b-[#E4E4E4]">
                  <Link
                    href={row.href}
                    className={`${ROW_GRID_CLASS} motion-colors box-border min-h-[52px] scroll-m-[8px] px-[20px] py-[8px] text-[14px] leading-[20px] text-[#505050] no-underline hover-on:bg-[#F6F7FB]`}
                  >
                    <strong className="font-semibold text-[#001AD0] tabular-nums">{row.code}</strong>
                    <span className="text-[#111111] [overflow-wrap:anywhere]">{row.summary}</span>
                    <span className="font-semibold text-[#111111] tabular-nums">{row.scoreText}</span>
                    <span>
                      <EvaluationStatusChip status={row.status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            {rows.length === 0 && (
              <p className="px-[20px] py-[32px] text-center text-[14px] leading-[20px] text-[#505050]">
                조건에 맞는 지원자가 없습니다.
              </p>
            )}
          </div>
        </div>
        <section
          aria-labelledby="progress-title"
          className="box-border max-w-[432px] min-w-0 flex-[1_1_432px] border-l border-l-[#E4E4E4]"
        >
          <div className={`${PANEL_HEAD_CLASS} flex h-[40px] items-center rounded-tr-[7px] px-[20px]`}>
            <h2 id="progress-title" className={PANEL_TITLE_CLASS}>
              평가 진행 현황
            </h2>
          </div>
          <div className="p-[20px]">
            <div className="relative mx-auto w-[200px] max-w-full">
              <svg role="img" aria-label={progress.ringAriaLabel} viewBox="0 0 128 128" className="block h-auto w-full">
                <circle cx="64" cy="64" r={RING_RADIUS} fill="none" stroke="#E4E6EE" strokeWidth="10" />
                {/* 채움 길이는 style 로 준다(값은 속성으로 줄 때와 같다): 사람을 고르면 CSS 전환으로 그 비율까지 움직인다. */}
                <circle
                  cx="64"
                  cy="64"
                  r={RING_RADIUS}
                  fill="none"
                  stroke="#001AD0"
                  strokeWidth="10"
                  transform="rotate(-90 64 64)"
                  className="animate-ring-grow transition-[stroke-dasharray] duration-500 ease-soft"
                  style={{ strokeDasharray: `${(progress.ringFraction * RING_LENGTH).toFixed(1)} ${RING_LENGTH.toFixed(1)}` }}
                />
              </svg>
              <div
                aria-hidden="true"
                className="absolute inset-0 flex flex-col items-center justify-center px-[28px] text-center"
              >
                <p className="text-[12px] leading-[16px] text-[#505050]">{progress.ringLabel}</p>
                <p className="mt-[2px] text-[22px] leading-[30px] font-bold tabular-nums">{progress.ringPercentText}</p>
              </div>
            </div>
            <ul className="mt-[20px] flex flex-col gap-[4px]">
              {progress.people.map((person) => (
                <li key={person.key}>
                  <button
                    type="button"
                    aria-pressed={person.on}
                    onClick={person.onPick}
                    className={`motion-colors box-border block w-full cursor-pointer scroll-m-[8px] rounded-[6px] border px-[12px] py-[10px] text-left ${
                      person.on ? "border-[#001AD0] bg-[#EEF0FF]" : "border-[#E4E4E4] bg-white hover-on:border-[#CFCFCF] hover-on:bg-[#F6F7FB]"
                    }`}
                  >
                    <span className="flex justify-between gap-[12px] text-[13px] leading-[18px] text-[#111111]">
                      <span className={person.on ? "font-semibold" : "font-medium"}>{person.name}</span>
                      <span className="tabular-nums">{person.countText}</span>
                    </span>
                    <span aria-hidden="true" className="mt-[8px] block h-[6px] overflow-hidden rounded-[3px] bg-[#E4E6EE]">
                      <span
                        className="block h-[6px] origin-left animate-bar-grow bg-[#001AD0] transition-[width] duration-500 ease-soft"
                        style={{ width: `${person.percent}%` }}
                      />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-[16px] border-t border-t-[#E4E4E4] pt-[12px] text-[13px] leading-[18px] text-[#505050]">
              1차 평가 마감 <strong className="font-semibold text-[#111111]">{progress.deadlineText}</strong>
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
