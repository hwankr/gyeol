import { PANEL_CLASS, PANEL_HEAD_CLASS, PANEL_TITLE_CLASS, StatusChip, segmentClass } from "@/components/consoleUi";
import type { DecisionOpinionsDetail, DecisionOpinionsView, ScoreMark } from "@/hooks/useDecisionOpinions";

/** 단의 머리 줄 (지원자 목록의 제목 줄, 고른 지원자의 코드 줄). 지원자 비교 탭의 머리 줄과 같은 높이다. */
const HEAD_CLASS = `${PANEL_HEAD_CLASS} box-border flex min-h-[48px] flex-none flex-wrap items-center gap-x-[8px] gap-y-[2px] px-[16px] py-[8px]`;

/**
 * 이 탭의 글자색. 읽을 글(위원의 종합 의견)과 눈이 먼저 가야 하는 수(종합 점수, 가장 높게·낮게 준 위원의 점수)만 검은색(#111111)이고
 * 나머지 글은 한 가지 회색(#505050)이다. 색 표시는 `조정 필요`(빨강. 머리의 `조정 N` 과 같은 색) 하나뿐이다.
 */
const INK_CLASS = "text-[#111111]";
const GRAY_CLASS = "text-[#505050]";

/** 단 안의 작은 제목 (12px) */
const LABEL_CLASS = "text-[12px] leading-[16px] font-medium";

/** 고른 지원자 단의 구획 제목 ("위원별 의견", "평가 요소별 점수") */
const SECTION_TITLE_CLASS = `text-[14px] leading-[20px] font-semibold ${INK_CLASS}`;

/** 작은 꼬리표 ("가장 높음", "가장 낮음", "가장 큰 차이"): 옅은 회색 바탕, 회색 글자 (지원자 비교 탭의 꼬리표와 같다) */
const TAG_CLASS = `rounded-[4px] bg-[#F0F0F2] px-[6px] py-px text-[12px] leading-[16px] font-medium whitespace-nowrap ${GRAY_CLASS}`;

const MARK_LABEL: Record<Exclude<ScoreMark, null>, string> = {
  high: "가장 높음",
  low: "가장 낮음",
};

/**
 * 선발 결정 · 위원 의견 모아보기 탭(/decision/opinions). 한 지원자를 평가한 위원들의 종합 점수·종합 의견과 평가 요소별 점수를 한곳에
 * 모아, 위원들의 평가가 어디서 갈렸는지 보고 조정할 지원자를 가린다. 시안에는 탭 이름과 `조정 N` 표시만 있어 다른 선발 결정 탭의
 * 조각(이어 붙인 버튼, 테두리 상자, 머리 줄, 꼬리표, 표)으로 만들었다. 읽기만 하는 화면이다.
 * - 위 줄: 걸러 보기(`조정 필요`·`전체`, 옆에 지원자 수)와 조정이 필요하다고 보는 기준.
 * - 왼쪽 단: 지원자 목록(순위 순서). 줄이 고르는 버튼이고 고른 줄은 옅은 파란 바탕이다(aria-current).
 * - 오른쪽 단: 고른 지원자의 코드·순위, AI 한 줄 요약, 최종 평가·위원 간 차이·인재상 적합도, 위원별 의견(종합 점수와 종합 의견),
 *   평가 요소별 점수의 표(위원별 점수, 평균, 차이, AI 점수. 줄마다 가장 높게·낮게 준 위원을 세모로 표시한다).
 *
 * 두 단은 상자 하나 안에 있고 사이의 선은 상자 바탕(선 색)이 1px 틈으로 비치는 것이다(지원자 비교 탭과 같다). 상자는 본문의 남는 높이를
 * 채운다. 상자 폭이 760px 보다 좁으면 목록이 위로 올라가고(네 줄 높이까지만 보이고 그 안에서 스크롤된다) 상세가 그 아래에 온다.
 */
export function DecisionOpinionsTab({ listRef, filters, note, countText, rows, detail, empty }: DecisionOpinionsView) {
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
        <p className="text-[13px] leading-[18px] text-[#505050] tabular-nums">{note}</p>
      </div>
      <div className={`${PANEL_CLASS} @container/opinions mt-[12px] flex flex-[1_1_auto] flex-col overflow-hidden bg-[#E4E4E4]`}>
        <div className="grid flex-[1_1_auto] grid-cols-1 gap-px @min-[760px]/opinions:grid-cols-[248px_minmax(0,1fr)]">
          <section aria-labelledby="opinions-list-title" className="min-w-0 bg-white">
            <div className={`${HEAD_CLASS} justify-between`}>
              <h2 id="opinions-list-title" className={PANEL_TITLE_CLASS}>
                지원자
              </h2>
              <span className="text-[12px] leading-[16px] text-[#505050] tabular-nums">{countText}</span>
            </div>
            <ul ref={listRef} className="@max-[759px]/opinions:max-h-[236px] @max-[759px]/opinions:overflow-y-auto">
              {rows.map((row) => (
                <li key={row.code} className="border-b border-b-[#E4E4E4]">
                  <button
                    type="button"
                    aria-current={row.selected ? "true" : undefined}
                    onClick={row.onPick}
                    className={`motion-colors box-border flex min-h-[58px] w-full cursor-pointer flex-col justify-center gap-[2px] border-0 px-[16px] py-[9px] text-left -outline-offset-2 ${
                      row.selected ? "bg-[#EEF0FF]" : "bg-white hover-on:bg-[#F6F7FB]"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-[8px]">
                      <strong className="text-[14px] leading-[20px] font-semibold text-[#001AD0] tabular-nums">{row.code}</strong>
                      {row.adjust && <StatusChip tone="red">조정 필요</StatusChip>}
                    </span>
                    <span className="text-[12px] leading-[16px] text-[#505050] tabular-nums">
                      {row.rankText} · {row.standingText} · 위원 간 차이 {row.spreadText}점
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="opinions-detail-title" className="@container/detail flex min-w-0 flex-col bg-white">
            {detail === null ? (
              <div className="flex min-h-[240px] flex-[1_1_auto] flex-col items-center justify-center gap-[6px] px-[20px] py-[32px] text-center">
                <h2 id="opinions-detail-title" className="text-[15px] leading-[22px] font-semibold">
                  {empty.title}
                </h2>
                <p className="text-[14px] leading-[20px] text-[#505050] [overflow-wrap:anywhere] break-keep">{empty.text}</p>
              </div>
            ) : (
              // 지원자를 바꾸면 새로 그려서 상세가 제자리에서 옅게 나타난다(자리·크기는 바로 바뀐다).
              <OpinionDetail key={detail.code} detail={detail} />
            )}
          </section>
        </div>
      </div>
    </>
  );
}

/** 고른 지원자의 단: 머리 줄(코드, "28위 · 합격권", `조정 필요`)과 요약, 세 가지 수, 위원별 의견, 평가 요소별 점수 */
function OpinionDetail({ detail }: { detail: DecisionOpinionsDetail }) {
  return (
    <div className="animate-fade-in">
      <div className={HEAD_CLASS}>
        <h2 id="opinions-detail-title" className="text-[18px] leading-[26px] font-bold tracking-[-0.01em] tabular-nums">
          {detail.code}
        </h2>
        <span className={`text-[13px] leading-[18px] tabular-nums ${GRAY_CLASS}`}>
          {detail.rankText} · {detail.standingText}
        </span>
        {detail.adjust && <StatusChip tone="red">조정 필요</StatusChip>}
      </div>
      <div className={`p-[20px] ${GRAY_CLASS}`}>
        <p className={LABEL_CLASS}>AI 한 줄 요약</p>
        <p className="mt-[4px] text-[14px] leading-[22px] [overflow-wrap:anywhere] break-keep">{detail.summary}</p>
        <dl className="mt-[16px] grid grid-cols-1 gap-x-[20px] gap-y-[12px] border-t border-t-[#E4E4E4] pt-[16px] @min-[480px]/detail:grid-cols-3">
          {detail.stats.map((stat) => (
            <div key={stat.label} className="min-w-0">
              <dt className={LABEL_CLASS}>{stat.label}</dt>
              {/* 크게 적는 수는 글꼴의 기본 숫자 폭 그대로다(지원자 비교 탭의 최종 평가와 같다). */}
              <dd className={`mt-[2px] text-[24px] leading-[32px] font-bold tracking-[-0.01em] ${INK_CLASS}`}>
                {stat.value}
                {stat.unit !== "" && <span className="ml-[2px] text-[14px] font-semibold">{stat.unit}</span>}
              </dd>
              <dd className="text-[12px] leading-[16px] tabular-nums">{stat.note}</dd>
            </div>
          ))}
        </dl>

        <h3 className={`${SECTION_TITLE_CLASS} mt-[20px] border-t border-t-[#E4E4E4] pt-[16px]`}>위원별 의견</h3>
        <ul className="mt-[10px] grid grid-cols-1 gap-[10px] @min-[620px]/detail:grid-cols-3">
          {detail.members.map((member) => (
            <li key={member.name} className="flex min-w-0 flex-col rounded-[8px] border border-[#E4E4E4] p-[14px]">
              <p className="flex min-h-[18px] items-center justify-between gap-[8px]">
                <strong className="text-[13px] leading-[18px] font-semibold">{member.name}</strong>
                {member.mark !== null && <span className={TAG_CLASS}>{MARK_LABEL[member.mark]}</span>}
              </p>
              <p className="mt-[6px] flex flex-wrap items-baseline gap-x-[8px]">
                <span className={`text-[20px] leading-[28px] font-bold tracking-[-0.01em] ${INK_CLASS}`}>
                  <span className="sr-only">종합 점수 </span>
                  {member.totalText}
                  <span className="ml-[2px] text-[13px] font-semibold">점</span>
                </span>
                <span className="text-[12px] leading-[16px] tabular-nums">{member.deviationText}</span>
              </p>
              <p className={`mt-[8px] text-[14px] leading-[22px] [overflow-wrap:anywhere] break-keep ${INK_CLASS}`}>{member.opinion}</p>
            </li>
          ))}
        </ul>

        <h3 className={`${SECTION_TITLE_CLASS} mt-[20px] border-t border-t-[#E4E4E4] pt-[16px]`}>평가 요소별 점수</h3>
        <p className="mt-[6px] text-[13px] leading-[18px] tabular-nums [overflow-wrap:anywhere] break-keep">{detail.headline}</p>
        <ScoreTable table={detail.table} />
        <p className="mt-[10px] flex flex-wrap items-center gap-x-[12px] gap-y-[2px] text-[12px] leading-[16px]">
          <span className="inline-flex items-center gap-[4px]">
            <MarkGlyph mark="high" />
            가장 높게 준 위원
          </span>
          <span className="inline-flex items-center gap-[4px]">
            <MarkGlyph mark="low" />
            가장 낮게 준 위원
          </span>
          <span>종합은 배점으로 가중 평균한 값</span>
        </p>
      </div>
    </div>
  );
}

/** 가장 높게(위로 향한 세모)·낮게(아래로 향한 세모) 준 위원의 표시. 장식이다(표의 칸에는 화면 낭독기가 읽는 글이 따로 있다). */
function MarkGlyph({ mark }: { mark: Exclude<ScoreMark, null> }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 8 8" className="h-[8px] w-[8px] flex-none fill-current">
      <path d={mark === "high" ? "M4 1 7.5 7h-7z" : "M4 7 .5 1h7z"} />
    </svg>
  );
}

const CELL_CLASS = "px-[8px] py-[10px] text-right tabular-nums";

type ScoreCellView = DecisionOpinionsDetail["table"]["rows"][number]["cells"][number];

/** 위원 한 명의 점수 칸. 그 줄에서 가장 높게·낮게 준 위원이면 세모를 붙이고 굵은 검은 글자로 적는다. */
function ScoreCell({ cell }: { cell: ScoreCellView }) {
  if (cell.mark === null) return <td className={CELL_CLASS}>{cell.text}</td>;
  return (
    <td className={`${CELL_CLASS} font-semibold ${INK_CLASS}`}>
      <span className="inline-flex items-center gap-[4px]">
        <MarkGlyph mark={cell.mark} />
        <span className="sr-only">{MARK_LABEL[cell.mark]} </span>
        {cell.text}
      </span>
    </td>
  );
}

/**
 * 평가 요소별 점수의 표: 요소(배점), 위원별 점수, 평균(위원 평균), 차이(가장 높은 점수 − 가장 낮은 점수), AI 점수.
 * 마지막 줄은 종합이다(위원별 종합 점수, 최종 평가, 위원 간 차이, 인재상 적합도). 좁으면 표가 그 안에서 가로로 스크롤된다.
 */
function ScoreTable({ table }: { table: DecisionOpinionsDetail["table"] }) {
  return (
    // relative: 칸 안의 화면 낭독기용 글(sr-only, absolute)이 이 상자에 갇혀, 표가 가로로 스크롤될 때 화면 전체의 폭을 넓히지 않는다.
    <div className="relative mt-[8px] overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-[13px] leading-[18px]">
        <caption className="sr-only">평가 요소별 위원 점수와 위원 간 차이</caption>
        <thead>
          <tr className="text-[12px] leading-[16px]">
            <th scope="col" className="py-[10px] pr-[8px] text-left font-medium">
              평가 요소
            </th>
            <th scope="col" className={`${CELL_CLASS} font-medium`}>
              배점
            </th>
            {table.memberNames.map((name) => (
              <th key={name} scope="col" className={`${CELL_CLASS} font-medium`}>
                {name}
              </th>
            ))}
            <th scope="col" className={`${CELL_CLASS} font-medium`}>
              평균
            </th>
            <th scope="col" className={`${CELL_CLASS} font-medium`}>
              차이
            </th>
            <th scope="col" className="py-[10px] pl-[8px] text-right font-medium">
              AI
            </th>
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.id} className="border-t border-t-[#E4E4E4]">
              <th scope="row" className="py-[10px] pr-[8px] text-left font-medium [overflow-wrap:anywhere] break-keep">
                {row.name}
                {row.widest && <span className={`${TAG_CLASS} ml-[6px]`}>가장 큰 차이</span>}
              </th>
              <td className={CELL_CLASS}>{row.weightText}</td>
              {row.cells.map((cell, index) => (
                <ScoreCell key={table.memberNames[index]} cell={cell} />
              ))}
              <td className={CELL_CLASS}>{row.meanText}</td>
              <td className={`${CELL_CLASS} ${row.widest ? `font-semibold ${INK_CLASS}` : ""}`}>{row.spreadText}</td>
              <td className="py-[10px] pl-[8px] text-right tabular-nums">{row.aiText}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-t-[#CFCFCF] font-semibold">
            <th scope="row" className="py-[10px] pr-[8px] text-left font-semibold">
              종합
            </th>
            <td className={CELL_CLASS}>{table.total.weightText}</td>
            {table.total.cells.map((cell, index) => (
              <ScoreCell key={table.memberNames[index]} cell={cell} />
            ))}
            <td className={CELL_CLASS}>{table.total.meanText}</td>
            <td className={CELL_CLASS}>{table.total.spreadText}</td>
            <td className="py-[10px] pl-[8px] text-right tabular-nums">{table.total.aiText}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
