import type { CSSProperties } from "react";
import { BUTTON_PRIMARY_CLASS, BUTTON_SECONDARY_CLASS, PANEL_CLASS, StatusChip, segmentClass } from "@/components/consoleUi";
import type { DecisionOpinionsCard, DecisionOpinionsView } from "@/hooks/useDecisionOpinions";

/**
 * 이 탭의 글자색. 읽을 글(위원 이름)과 눈이 먼저 가야 하는 수(크게 갈린 요소의 점수, 고친 점수, 종합 점수)만 검은색(#111111)이고
 * 나머지 글(종합 의견, 갈리지 않은 요소의 점수, 표의 머리, 원래 점수)은 한 가지 회색(#505050)이다.
 * 색은 둘이다: 크게 갈린 요소의 붉은색(칸 바탕은 옅은 붉은색, 그 차이를 적은 글자는 머리의 `조정 N` 과 같은 #BA1A1A)과
 * 조정을 확정한 지원자의 `조정 완료` 표시(초록. 다른 화면의 완료 표시와 같다).
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

/** 점수 칸 (위원 줄). 위아래 여백은 칸의 종류가 정한다: 글은 12px, 입력란(높이 32px)은 6px 이라 줄 높이가 같다. */
const SCORE_CELL_CLASS = "px-[4px] text-center text-[14px] leading-[20px] tabular-nums";

/** 붉은 칸: 옆 칸과는 흰 틈(2px), 위아래 위원 사이는 흰 선으로 나뉜다. 마지막 위원의 아래는 다른 칸처럼 회색 선이다. */
const WIDE_CELL_CLASS = `border-x-2 border-x-white border-b border-b-white group-last/member:border-b-[#E4E4E4] ${WIDE_FILL_CLASS}`;

/** 마지막 줄(위원 간 차이)의 칸 */
const SPREAD_CELL_CLASS = "px-[4px] pt-[10px] pb-[4px] text-center text-[13px] leading-[18px] tabular-nums";

/** 줄 사이의 선 */
const ROW_LINE_CLASS = "border-b border-b-[#E4E4E4]";

/** 점수 아래에 적는 원래 점수 ("원래 74") */
const ORIGINAL_NOTE_CLASS = `mt-[2px] block text-[11px] leading-[14px] font-normal whitespace-nowrap ${GRAY_CLASS}`;

/** 점수 입력란: 흰 바탕의 작은 상자(46×32px), 굵은 숫자. 틀린 값이면 테두리가 붉다. */
const SCORE_INPUT_CLASS =
  "motion-colors box-border h-[32px] w-[46px] scroll-m-[8px] rounded-[6px] border border-[#CFCFCF] bg-white p-0 text-center text-[14px] leading-[20px] font-bold text-[#111111] tabular-nums hover:border-[#AEAEAE] aria-invalid:border-[#BA1A1A]";

/**
 * 선발 결정 · 위원 의견 모아보기 탭(/decision/opinions). 지원자마다 카드 하나에 위원 × 평가 요소의 점수 표를 두어, 위원들의 평가가
 * 어디서 갈렸는지 한눈에 보고(시안의 배치) 크게 갈린 요소의 점수를 고쳐 조정을 확정한다. 시안의 색·글자·간격은 다른 콘솔 화면에 맞췄다.
 * - 위 줄: 걸러 보기(`조정 필요`·`조정 완료`·`전체`, 옆에 지원자 수)와 붉은 칸의 뜻. 저장소에 쓰지 못했으면 그 아래에 안내가 나온다.
 * - 카드(순위 순서): 제목 줄에 지원자 코드, "28위 · 합격권", 크게 갈린 요소와 그 차이(붉은 글자) 또는 `조정 완료` 와 고친 요소.
 *   그 아래 상자에 표가 있다. 표의 줄은 위원(이름과 종합 의견), 칸은 평가 요소와 종합이고 마지막 줄은 위원 간 차이다. 위원 점수가
 *   크게 갈린 요소의 칸은 옅은 붉은 바탕에 굵은 글자다(붉은 띠가 위원 줄을 세로로 잇는다).
 * - 조정: 조정이 필요한 지원자는 크게 갈린 요소의 점수 칸이 입력란이고, 상자 아래 줄에 안내 글과 `되돌리기`·`조정 확정` 이 있다
 *   (시안의 `저장하기` 자리). 조정을 확정한 지원자는 고친 점수 아래에 원래 점수가 적히고 `조정 취소` 가 있다.
 * 시안에 없는 것: 걸러 보기, 붉은 칸의 풀이, 순위 옆의 구분(합격권·예비), 마지막 줄(위원 간 차이), 안내 글, `되돌리기`·`조정 취소`.
 *
 * 카드는 한 줄에 둘까지 놓인다. 카드 하나가 표의 가장 좁은 폭(위원 칸 200px + 점수 칸 68px × (요소 수 + 1) + 안쪽 여백)보다 좁아지면
 * 한 줄에 하나가 되고, 그보다도 좁으면 표가 상자 안에서 가로로 스크롤된다(아래 줄의 버튼은 스크롤되지 않는다).
 */
export function DecisionOpinionsTab({ filters, note, announcement, alert, columnCount, cards, empty }: DecisionOpinionsView) {
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
      {/* 확정·취소한 결과는 그 카드에 적혀 있다. 여기는 화면 낭독기에 알리는 자리다. */}
      <p role="status" className="sr-only">
        {announcement}
      </p>
      {alert !== "" && (
        <p role="alert" className={`mt-[8px] text-[13px] leading-[18px] ${ALERT_CLASS}`}>
          {alert}
        </p>
      )}
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

/** 지원자 한 명의 카드: 제목 줄(코드, "28위 · 합격권", 크게 갈린 요소 또는 조정 완료)과 위원 × 평가 요소의 점수 표, 조정하는 줄 */
function OpinionCard({ card, tableMinWidth }: { card: DecisionOpinionsCard; tableMinWidth: number }) {
  const hintId = `${card.titleId}-hint`;
  return (
    // 한 줄에 놓인 두 카드는 상자의 아래 끝이 맞는다(종합 의견이 짧은 쪽은 표 아래가 빈다).
    <article aria-labelledby={card.titleId} className="flex h-full flex-col">
      <div className="flex flex-none flex-wrap items-baseline gap-x-[8px] gap-y-[2px] px-[2px]">
        {/* tabIndex -1: 조정을 확정하거나 취소하면 누른 버튼이 사라지므로 초점을 이 제목으로 옮긴다(hooks/useDecisionOpinions.ts). */}
        <h2 id={card.titleId} tabIndex={-1} className="scroll-m-[8px] text-[18px] leading-[26px] font-bold tracking-[-0.01em] tabular-nums">
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
        {card.state === "done" && (
          <>
            <StatusChip tone="green">조정 완료</StatusChip>
            {card.adjustedText !== "" && (
              <span className={`text-[13px] leading-[18px] [overflow-wrap:anywhere] break-keep ${GRAY_CLASS}`}>{card.adjustedText}</span>
            )}
          </>
        )}
      </div>
      <div className={`${PANEL_CLASS} mt-[8px] flex flex-[1_1_auto] flex-col bg-white`}>
        {/* relative: 칸 안의 화면 낭독기용 글(sr-only, absolute)이 이 상자에 갇혀, 표가 가로로 스크롤될 때 화면 전체의 폭을 넓히지 않는다. */}
        <div className="relative overflow-x-auto px-[16px] pt-[2px] pb-[8px]">
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
                  {member.cells.map((cell, index) => {
                    const column = card.columns[index];
                    const frame = column.wide ? WIDE_CELL_CLASS : ROW_LINE_CLASS;
                    if (cell.kind === "input") {
                      return (
                        <td key={column.id} className={`${SCORE_CELL_CLASS} ${frame} py-[6px]`}>
                          <input
                            type="text"
                            inputMode="numeric"
                            autoComplete="off"
                            maxLength={3}
                            aria-label={cell.label}
                            aria-invalid={cell.invalid || undefined}
                            value={cell.value}
                            onChange={(event) => cell.onChange(event.currentTarget.value)}
                            onFocus={(event) => event.currentTarget.select()}
                            className={SCORE_INPUT_CLASS}
                          />
                          {cell.note !== null && <span className={ORIGINAL_NOTE_CLASS}>{cell.note}</span>}
                        </td>
                      );
                    }
                    // 붉은 칸의 점수와 조정으로 고친 점수는 굵은 검은 글자, 나머지는 회색이다.
                    const strong = column.wide || cell.changed;
                    return (
                      <td key={column.id} className={`${SCORE_CELL_CLASS} ${frame} py-[12px] ${strong ? `font-bold ${INK_CLASS}` : GRAY_CLASS}`}>
                        {cell.text}
                        {cell.note !== null && <span className={ORIGINAL_NOTE_CLASS}>{cell.note}</span>}
                      </td>
                    );
                  })}
                  <td className={`${SCORE_CELL_CLASS} ${ROW_LINE_CLASS} py-[12px] font-medium ${INK_CLASS}`}>{member.totalText}</td>
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
        {card.action !== null && (
          // mt-auto: 한 줄의 두 카드에서 이 줄이 상자의 아래 끝에 맞는다.
          <div className="mt-auto flex flex-wrap items-center justify-end gap-x-[12px] gap-y-[8px] border-t border-t-[#E4E4E4] px-[16px] py-[12px]">
            <p id={hintId} className={`min-w-[160px] flex-[1_1_0%] text-[12px] leading-[17px] tabular-nums [overflow-wrap:anywhere] break-keep ${GRAY_CLASS}`}>
              {card.action.hint}
            </p>
            <div className="flex flex-none flex-wrap justify-end gap-[8px]">
              {card.action.cancel !== null && (
                <button type="button" onClick={card.action.cancel.onCancel} className={`${BUTTON_SECONDARY_CLASS} h-[36px] scroll-m-[8px] px-[14px]`}>
                  조정 취소
                </button>
              )}
              {card.action.reset !== null && (
                <button type="button" onClick={card.action.reset.onReset} className={`${BUTTON_SECONDARY_CLASS} h-[36px] scroll-m-[8px] px-[14px]`}>
                  되돌리기
                </button>
              )}
              {card.action.confirm !== null && (
                <button
                  type="button"
                  disabled={!card.action.confirm.enabled}
                  aria-describedby={hintId}
                  onClick={card.action.confirm.onConfirm}
                  className={`${BUTTON_PRIMARY_CLASS} h-[36px] scroll-m-[8px] px-[16px]`}
                >
                  조정 확정
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
