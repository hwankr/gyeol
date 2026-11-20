import type { CSSProperties } from "react";
import { PANEL_CLASS, segmentClass } from "@/components/consoleUi";
import type { DecisionOpinionsCard, DecisionOpinionsView } from "@/hooks/useDecisionOpinions";

/**
 * 이 탭의 글자색. 읽을 글(위원 이름)과 눈이 먼저 가야 하는 수(크게 갈린 요소의 점수, 종합 점수)만 검은색(#111111)이고
 * 나머지 글(종합 의견, 갈리지 않은 요소의 점수, 표의 머리)은 한 가지 회색(#505050)이다.
 * 색은 붉은색 하나다: 크게 갈린 요소의 칸 바탕(옅은 붉은색)과 그 차이를 적은 글자(머리의 `조정 N` 과 같은 #BA1A1A).
 */
const INK_CLASS = "text-[#111111]";
const GRAY_CLASS = "text-[#505050]";
const ALERT_CLASS = "text-[#BA1A1A]";

/** 크게 갈린 요소의 칸 바탕 (위 줄의 풀이 글 앞의 색 네모도 같은 색이다) */
const WIDE_FILL_CLASS = "bg-[#F8DCDC]";

/** 표의 치수(px): 점수 칸 하나의 폭, 위원 칸(이름·종합 의견)의 가장 좁은 폭, 상자의 좌우 안쪽 여백(px-[16px]), 카드 사이의 가로 간격(gap-x-[20px]) */
const SCORE_WIDTH = 68;
const MEMBER_MIN_WIDTH = 200;
const PANEL_PAD = 16;
const CARD_GAP = 20;

/** 점수 칸 (위원 줄) */
const SCORE_CELL_CLASS = "px-[4px] py-[12px] text-center text-[14px] leading-[20px] tabular-nums";

/** 마지막 줄(위원 간 차이)의 칸 */
const SPREAD_CELL_CLASS = "px-[4px] pt-[10px] pb-[4px] text-center text-[13px] leading-[18px] tabular-nums";

/** 줄 사이의 선 */
const ROW_LINE_CLASS = "border-b border-b-[#E4E4E4]";

/**
 * 선발 결정 · 위원 의견 모아보기 탭(/decision/opinions). 지원자마다 카드 하나에 위원 × 평가 요소의 점수 표를 두어, 위원들의 평가가
 * 어디서 갈렸는지 한눈에 본다(시안의 배치). 시안의 색·글자·간격은 다른 콘솔 화면에 맞췄다. 읽기만 하는 화면이다.
 * - 위 줄: 걸러 보기(`조정 필요`·`전체`, 옆에 지원자 수)와 붉은 칸의 뜻.
 * - 카드(순위 순서): 제목 줄에 지원자 코드, "28위 · 합격권", 크게 갈린 요소와 그 차이(붉은 글자). 그 아래 상자에 표가 있다.
 *   표의 줄은 위원(이름과 종합 의견), 칸은 평가 요소와 종합이고 마지막 줄은 위원 간 차이다. 위원 점수가 크게 갈린 요소의 칸은
 *   옅은 붉은 바탕에 굵은 글자다(붉은 띠가 위원 줄을 세로로 잇는다).
 * 시안에 없는 것: 걸러 보기, 붉은 칸의 풀이, 순위 옆의 구분(합격권·예비), 마지막 줄(위원 간 차이). 시안의 `저장하기` 는 저장할 값이 없어 두지 않았다.
 *
 * 카드는 한 줄에 둘까지 놓인다. 카드 하나가 표의 가장 좁은 폭(위원 칸 200px + 점수 칸 68px × (요소 수 + 1) + 안쪽 여백)보다 좁아지면
 * 한 줄에 하나가 되고, 그보다도 좁으면 표가 상자 안에서 가로로 스크롤된다.
 */
export function DecisionOpinionsTab({ filters, note, columnCount, cards, empty }: DecisionOpinionsView) {
  const tableMinWidth = MEMBER_MIN_WIDTH + SCORE_WIDTH * (columnCount + 1);
  const cardMinWidth = tableMinWidth + PANEL_PAD * 2;
  const grid: CSSProperties = {
    gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, max(${cardMinWidth}px, calc(50% - ${CARD_GAP / 2}px))), 1fr))`,
  };
  return (
    <>
      <div className="mt-[16px] flex flex-wrap items-center justify-between gap-x-[16px] gap-y-[8px]">
        <div role="group" aria-label="지원자 걸러 보기" className="flex">
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
        <p className={`flex items-center gap-[8px] text-[13px] leading-[18px] tabular-nums ${GRAY_CLASS}`}>
          <span aria-hidden="true" className={`h-[14px] w-[14px] flex-none rounded-[3px] ${WIDE_FILL_CLASS}`} />
          <span>
            <span className="sr-only">붉은 칸: </span>
            {note}
          </span>
        </p>
      </div>
      {cards.length === 0 ? (
        <div className={`${PANEL_CLASS} mt-[12px] flex min-h-[240px] flex-col items-center justify-center gap-[6px] px-[20px] py-[32px] text-center`}>
          <h2 className="text-[15px] leading-[22px] font-semibold">{empty.title}</h2>
          <p className={`text-[14px] leading-[20px] [overflow-wrap:anywhere] break-keep ${GRAY_CLASS}`}>{empty.text}</p>
        </div>
      ) : (
        <ul aria-label="지원자별 위원 의견" className="mt-[20px] grid gap-x-[20px] gap-y-[28px]" style={grid}>
          {cards.map((card) => (
            // 걸러 보기를 바꿔 새로 놓이는 카드는 제자리에서 옅게 나타난다.
            <li key={card.code} className="min-w-0 animate-fade-in">
              <OpinionCard card={card} tableMinWidth={tableMinWidth} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** 지원자 한 명의 카드: 제목 줄(코드, "28위 · 합격권", 크게 갈린 요소와 그 차이)과 위원 × 평가 요소의 점수 표 */
function OpinionCard({ card, tableMinWidth }: { card: DecisionOpinionsCard; tableMinWidth: number }) {
  const titleId = `opinions-card-${card.code}`;
  return (
    // 한 줄에 놓인 두 카드는 상자의 아래 끝이 맞는다(종합 의견이 짧은 쪽은 표 아래가 빈다).
    <article aria-labelledby={titleId} className="flex h-full flex-col">
      <div className="flex flex-none flex-wrap items-baseline gap-x-[8px] gap-y-[2px] px-[2px]">
        <h2 id={titleId} className="text-[18px] leading-[26px] font-bold tracking-[-0.01em] tabular-nums">
          {card.code}
        </h2>
        <span className={`text-[13px] leading-[18px] tabular-nums ${GRAY_CLASS}`}>
          {card.rankText} · {card.standingText}
        </span>
        {card.wideText !== "" && (
          <span className={`text-[13px] leading-[18px] font-medium tabular-nums [overflow-wrap:anywhere] break-keep ${ALERT_CLASS}`}>
            {card.wideText}
          </span>
        )}
      </div>
      {/* relative: 칸 안의 화면 낭독기용 글(sr-only, absolute)이 이 상자에 갇혀, 표가 가로로 스크롤될 때 화면 전체의 폭을 넓히지 않는다. */}
      <div className={`${PANEL_CLASS} relative mt-[8px] flex-[1_1_auto] overflow-x-auto bg-white px-[16px] pt-[2px] pb-[8px]`}>
        <table className="w-full table-fixed border-collapse" style={{ minWidth: tableMinWidth }}>
          <caption className="sr-only">{card.code} 위원별 평가 요소 점수와 종합 의견</caption>
          <colgroup>
            <col />
            {card.columns.map((column) => (
              <col key={column.id} style={{ width: SCORE_WIDTH }} />
            ))}
            <col style={{ width: SCORE_WIDTH }} />
          </colgroup>
          <thead>
            <tr className={`text-[12px] leading-[16px] ${GRAY_CLASS}`}>
              <th scope="col" className="border-b border-b-[#767676] py-[10px] pr-[12px] text-left align-bottom font-medium">
                위원
              </th>
              {card.columns.map((column) => (
                <th
                  key={column.id}
                  scope="col"
                  className="border-b border-b-[#767676] px-[4px] py-[10px] text-center align-bottom font-medium [overflow-wrap:anywhere] break-keep"
                >
                  {column.name}
                  {column.wide && <span className="sr-only"> (위원 점수가 크게 갈림)</span>}
                </th>
              ))}
              <th scope="col" className="border-b border-b-[#767676] px-[4px] py-[10px] text-center align-bottom font-medium">
                종합
              </th>
            </tr>
          </thead>
          <tbody>
            {card.members.map((member) => (
              <tr key={member.name} className="group/member">
                <th scope="row" className={`${ROW_LINE_CLASS} py-[12px] pr-[12px] text-left align-middle font-normal`}>
                  <span className={`block text-[13px] leading-[18px] font-semibold ${INK_CLASS}`}>{member.name}</span>
                  <span className={`mt-[2px] block text-[12px] leading-[17px] [overflow-wrap:anywhere] break-keep ${GRAY_CLASS}`}>
                    {member.opinion}
                  </span>
                </th>
                {member.scores.map((score, index) => {
                  const column = card.columns[index];
                  return column.wide ? (
                    // 붉은 칸: 옆 칸과는 흰 틈(2px), 위아래 위원 사이는 흰 선으로 나뉜다. 마지막 위원의 아래는 다른 칸처럼 회색 선이다.
                    <td
                      key={column.id}
                      className={`${SCORE_CELL_CLASS} border-x-2 border-x-white border-b border-b-white font-bold group-last/member:border-b-[#E4E4E4] ${WIDE_FILL_CLASS} ${INK_CLASS}`}
                    >
                      {score}
                    </td>
                  ) : (
                    <td key={column.id} className={`${SCORE_CELL_CLASS} ${ROW_LINE_CLASS} ${GRAY_CLASS}`}>
                      {score}
                    </td>
                  );
                })}
                <td className={`${SCORE_CELL_CLASS} ${ROW_LINE_CLASS} font-medium ${INK_CLASS}`}>{member.totalText}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className={GRAY_CLASS}>
              <th scope="row" className="pt-[10px] pr-[12px] pb-[4px] text-left text-[12px] leading-[18px] font-medium">
                위원 간 차이
              </th>
              {card.columns.map((column) => (
                <td key={column.id} className={`${SPREAD_CELL_CLASS} ${column.wide ? `font-semibold ${ALERT_CLASS}` : ""}`}>
                  {column.spreadText}
                </td>
              ))}
              <td className={SPREAD_CELL_CLASS}>{card.totalSpreadText}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </article>
  );
}
