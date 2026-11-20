import Link from "next/link";
import {
  BUTTON_PRIMARY_CLASS,
  BUTTON_SECONDARY_CLASS,
  PANEL_CLASS,
  PANEL_HEAD_CLASS,
  StatusChip,
  segmentClass,
} from "@/components/consoleUi";
import type { RecommendRow } from "@/hooks/useDecisionRecommend";
import type { DecisionFlag } from "@/lib/decision/decision";

type DecisionRecommendTabProps = {
  /** 걸러 보기: 전체와 비교 기준 셋. count 는 그 기준에 해당하는 지원자 수 */
  filters: { key: string; label: string; count: number; on: boolean; onPick: () => void }[];
  selection: {
    text: string;
    canClear: boolean;
    onClear: () => void;
    canCompare: boolean;
    compareHref: string;
  };
  rows: RecommendRow[];
};

/** 목록의 칸 너비: 고름 표시, 순위·구분, 지원자 코드, AI 한 줄 요약, 인재상 적합도, 최종 평가, 위원 간 차이, 비교 기준 */
const ROW_GRID_CLASS =
  "grid grid-cols-[18px_116px_68px_minmax(0,1fr)_84px_64px_80px_minmax(0,216px)] items-center gap-x-[12px]";

/** 비교 기준 표시의 색: 합격선 접전은 파랑, 위원 간 차이 큼은 주황, 요약 유사는 회색 (글자를 늘 같이 적어 색만으로 구분하지 않는다) */
const FLAG_CLASS: Record<DecisionFlag, string> = {
  close: "bg-[#EEF0FF] text-[#001AD0]",
  spread: "bg-[#FFF1DC] text-[#8A4B00]",
  similar: "bg-[#F0F0F2] text-[#505050]",
};

const COMPARE_BUTTON_CLASS = `${BUTTON_PRIMARY_CLASS} h-[32px] scroll-m-[8px] px-[12px] leading-[normal]`;

/**
 * 선발 결정 · 인재상 적합 추천 탭(/decision). 합격선 주변(접전 구간)의 지원자를 순위 순서로 보여 주고, 비교할 두 사람을 고른다.
 * 시안에는 이 탭의 그림이 없어 평가 대기 목록(components/EvaluateListScreen.tsx)과 같은 모양새로 정했다.
 * - 위 줄: 비교 기준으로 걸러 보기(이어 붙인 버튼), 고른 상태의 안내, `선택 해제`, `선택한 2명 비교`(두 명을 골라야 켜진다).
 * - 목록: 줄 전체가 고르는 버튼이다(aria-pressed). 고른 줄은 옅은 파란 바탕에 체크 표시가 있고, 두 명을 고른 뒤의 나머지 줄은
 *   눌리지 않는다(aria-disabled. 글은 그대로 읽힌다).
 * - 합격권과 예비 사이에는 합격선 줄이 있다(두 사람의 점수와 차이를 적는다).
 * 좁은 화면에서는 목록이 상자 안에서 가로로 스크롤된다. 상자는 본문의 남는 높이를 채운다.
 */
export function DecisionRecommendTab({ filters, selection, rows }: DecisionRecommendTabProps) {
  return (
    <>
      <div className="mt-[16px] flex flex-wrap items-center justify-between gap-x-[16px] gap-y-[8px]">
        <div role="group" aria-label="비교 기준으로 걸러 보기" className="flex">
          {filters.map((filter, index) => (
            <button
              key={filter.key}
              type="button"
              aria-pressed={filter.on}
              onClick={filter.onPick}
              className={`${segmentClass(index, filters.length, filter.on)} h-[32px] scroll-m-[8px] gap-[6px] px-[12px] leading-[normal]`}
            >
              {filter.label}
              <span className={`tabular-nums ${filter.on ? "text-[#001AD0]" : "text-[#767676]"}`}>{filter.count}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-[8px]">
          <p role="status" className="mr-[4px] text-[13px] leading-[18px] text-[#505050] tabular-nums">
            {selection.text}
          </p>
          <button
            type="button"
            disabled={!selection.canClear}
            onClick={selection.onClear}
            className={`${BUTTON_SECONDARY_CLASS} h-[32px] scroll-m-[8px] px-[12px] leading-[normal]`}
          >
            선택 해제
          </button>
          {/* 두 명을 고르기 전에는 갈 곳이 없는 링크다(href 없는 <a>: 초점을 받지 않고 꺼진 주 버튼 모양이다). */}
          {selection.canCompare ? (
            <Link href={selection.compareHref} className={COMPARE_BUTTON_CLASS}>
              선택한 2명 비교
            </Link>
          ) : (
            <a
              aria-disabled="true"
              className={`${COMPARE_BUTTON_CLASS} aria-disabled:cursor-default aria-disabled:border-[#E4E6EE] aria-disabled:bg-[#E4E6EE] aria-disabled:text-[#505050]`}
            >
              선택한 2명 비교
            </a>
          )}
        </div>
      </div>
      <section aria-label="합격선 주변 지원자" className={`${PANEL_CLASS} mt-[12px] flex-[1_1_auto] overflow-x-auto`}>
        <div className="min-w-[940px]">
          <div
            aria-hidden="true"
            className={`${ROW_GRID_CLASS} ${PANEL_HEAD_CLASS} h-[40px] rounded-t-[7px] px-[20px] text-[12px] leading-[16px] font-semibold text-[#505050]`}
          >
            <span />
            <span>순위</span>
            <span>지원자 코드</span>
            <span>AI 한 줄 요약</span>
            <span>인재상 적합도</span>
            <span>최종 평가</span>
            <span>위원 간 차이</span>
            <span>비교 기준</span>
          </div>
          <ul>
            {rows.map((row) =>
              row.kind === "cutline" ? (
                <li
                  key="cutline"
                  className="flex items-center gap-[12px] border-b border-b-[#E4E4E4] bg-[#F6F7FB] px-[20px] py-[7px] text-[12px] leading-[16px] font-semibold text-[#000947] tabular-nums"
                >
                  <span aria-hidden="true" className="h-px flex-[1_1_0%] bg-[#000947]" />
                  {row.text}
                  <span aria-hidden="true" className="h-px flex-[1_1_0%] bg-[#000947]" />
                </li>
              ) : (
                <li key={row.code} className="border-b border-b-[#E4E4E4]">
                  <button
                    type="button"
                    aria-pressed={row.picked}
                    aria-disabled={row.blocked}
                    onClick={row.onToggle}
                    className={`${ROW_GRID_CLASS} motion-colors box-border min-h-[52px] w-full cursor-pointer scroll-m-[8px] border-0 px-[20px] py-[8px] text-left text-[14px] leading-[20px] text-[#505050] aria-disabled:cursor-default ${
                      row.picked ? "bg-[#EEF0FF]" : "bg-white hover-on:bg-[#F6F7FB]"
                    }`}
                  >
                    <PickMark picked={row.picked} blocked={row.blocked} />
                    <span className="flex items-center gap-[8px]">
                      <strong className="font-semibold text-[#111111] tabular-nums">{row.rankText}</strong>
                      <StatusChip tone={row.standing.admitted ? "green" : "amber"}>{row.standing.text}</StatusChip>
                    </span>
                    <strong className="font-semibold text-[#001AD0] tabular-nums">{row.code}</strong>
                    <span className="text-[#111111] [overflow-wrap:anywhere] break-keep">{row.summary}</span>
                    <span className="tabular-nums">
                      <span className="sr-only">인재상 적합도 </span>
                      {row.aiText}
                    </span>
                    <span className="font-semibold text-[#111111] tabular-nums">
                      <span className="sr-only">최종 평가 </span>
                      {row.finalText}
                    </span>
                    <span className={`tabular-nums ${row.spreadWide ? "font-semibold text-[#8A4B00]" : ""}`}>
                      <span className="sr-only">위원 간 차이 </span>
                      {row.spreadText}
                    </span>
                    <span className="flex flex-wrap gap-[4px]">
                      {row.flags.map((flag) => (
                        <span
                          key={flag.key}
                          className={`rounded-[4px] px-[6px] py-px text-[12px] leading-[16px] font-semibold whitespace-nowrap tabular-nums ${FLAG_CLASS[flag.key]}`}
                        >
                          {flag.label}
                        </span>
                      ))}
                    </span>
                  </button>
                </li>
              ),
            )}
          </ul>
          {rows.length === 0 && (
            <p className="px-[20px] py-[32px] text-center text-[14px] leading-[20px] text-[#505050]">조건에 맞는 지원자가 없습니다.</p>
          )}
        </div>
      </section>
    </>
  );
}

/** 고름 표시: 고른 줄은 파란 바탕의 체크, 더 고를 수 없는 줄은 회색 바탕. 장식이다(고른 상태는 버튼의 aria-pressed 가 알린다). */
function PickMark({ picked, blocked }: { picked: boolean; blocked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`motion-colors box-border flex h-[18px] w-[18px] items-center justify-center rounded-[4px] border ${
        picked ? "border-[#001AD0] bg-[#001AD0]" : blocked ? "border-[#E4E4E4] bg-[#F0F0F2]" : "border-[#AEAEAE] bg-white"
      }`}
    >
      {picked && (
        <svg viewBox="0 0 12 12" fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-[12px] w-[12px]">
          <path d="M2.5 6.3 4.9 8.6 9.5 3.6" />
        </svg>
      )}
    </span>
  );
}
