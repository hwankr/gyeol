import Link from "next/link";
import type { CSSProperties } from "react";
import { BUTTON_SECONDARY_CLASS, PANEL_CLASS, PANEL_HEAD_CLASS, PANEL_TITLE_CLASS } from "@/components/consoleUi";
import type { DecisionCompareView } from "@/hooks/useDecisionCompare";

/**
 * 두 지원자의 막대 색: 왼쪽은 파랑, 오른쪽은 주황. 시안은 회색 두 단계라 색을 새로 정했다.
 * 흰 바탕에서 색각이 달라도 두 색이 갈리고(파랑·주황), 바탕과의 대비가 3:1 을 넘는 값이다. 색만으로 구분하지 않도록 지원자 코드 앞의
 * 색 점, 범례, 막대 위의 점수, 아래의 표가 같이 있다(막대는 늘 왼쪽 지원자가 왼쪽이다).
 */
const SERIES_CLASS = ["bg-[#2F4BE0]", "bg-[#E8590C]"] as const;

/** 지원자 코드 앞의 색 점 (그래프의 막대 색). 장식이라 보조 기술에는 숨긴다(코드가 옆에 있다). */
function SeriesSwatch({ side }: { side: 0 | 1 }) {
  return <span aria-hidden="true" className={`inline-block h-[10px] w-[10px] flex-none rounded-[3px] ${SERIES_CLASS[side]}`} />;
}

/** 단의 머리 줄 (지원자 코드 줄, 그래프 제목 줄) */
const HEAD_CLASS = `${PANEL_HEAD_CLASS} box-border flex min-h-[48px] flex-none flex-wrap items-center gap-x-[8px] gap-y-[2px] px-[16px] py-[8px]`;

/**
 * 이 탭의 글자색. 볼 것이 많은 화면이라 글자색을 둘로 줄였다: 눈이 먼저 가야 하는 것(지원자 코드, 최종 평가, 단의 제목, 풀이 글의 첫 줄)만
 * 검은색(#111111)이고, 나머지 글(요약, 강점·약점, 위원별 점수, 표, 꼬리표)은 모두 한 가지 회색(#505050)이다. 파랑·주황·초록 글자와
 * 색 바탕의 표시는 쓰지 않는다(색은 그래프의 막대와 지원자 코드 앞의 색 점에만 있다). 강조는 색 대신 굵기로만 한다.
 */
const INK_CLASS = "text-[#111111]";
const GRAY_CLASS = "text-[#505050]";

/** 단 안의 작은 제목 (12px) */
const LABEL_CLASS = "text-[12px] leading-[16px] font-medium";

/** 작은 꼬리표 (두 지원자의 사이, 표의 "가장 큰 차이"): 옅은 회색 바탕, 회색 글자 */
const TAG_CLASS = `rounded-[4px] bg-[#F0F0F2] px-[6px] py-px text-[12px] leading-[16px] font-medium whitespace-nowrap ${GRAY_CLASS}`;

/**
 * 선발 결정 · 지원자 비교 탭(/decision/compare). 합격선 근처에서 두 지원자의 평가가 어디서 갈렸는지 한눈에 보도록, 가운데에 평가 요소별
 * 점수의 막대 그래프를 두고 양옆에 두 지원자의 정보(순위·구분, 최종 평가, AI 한 줄 요약, 강점·약점, 위원별 종합 점수)를 둔다(시안의 배치).
 * 시안은 와이어프레임이라 배치만 따르고 색·글자·간격은 다른 콘솔 화면과 맞췄다. 시안에 없는 것: 두 사람이 나온 까닭과 사이를 적은 윗줄,
 * 그래프 위의 풀이 글, 그래프 아래의 표(막대로 읽기 어려운 작은 차이와 배점을 같이 본다), 위원별 종합 점수.
 *
 * 세 단은 상자 하나 안에 있고 사이의 선은 상자 바탕(선 색)이 1px 틈으로 비치는 것이다. 상자 폭에 따라 배치가 바뀐다(@container/compare):
 * 880px 이상은 지원자 · 그래프 · 지원자, 그보다 좁으면 두 지원자가 나란히 놓이고 그래프가 그 아래로, 520px 보다 좁으면 한 줄에 하나씩이다.
 */
export function DecisionCompareTab({ note, facts, recommendHref, sides, headline, leads, chart, table }: DecisionCompareView) {
  return (
    <>
      <div className="mt-[16px] flex flex-wrap items-center gap-x-[10px] gap-y-[8px]">
        <p className="text-[13px] leading-[18px] text-[#505050] tabular-nums">{note}</p>
        <ul aria-label="두 지원자의 사이" className="flex flex-wrap gap-[4px]">
          {facts.map((fact) => (
            <li key={fact} className={`${TAG_CLASS} tabular-nums`}>
              {fact}
            </li>
          ))}
        </ul>
        <Link href={recommendHref} className={`${BUTTON_SECONDARY_CLASS} ml-auto h-[32px] scroll-m-[8px] px-[12px] leading-[normal]`}>
          지원자 다시 고르기
        </Link>
      </div>
      <div className={`${PANEL_CLASS} @container/compare mt-[12px] overflow-hidden bg-[#E4E4E4]`}>
        <div className="grid grid-cols-1 gap-px @min-[520px]/compare:grid-cols-2 @min-[880px]/compare:grid-cols-[minmax(0,1fr)_minmax(0,2.1fr)_minmax(0,1fr)]">
          <SidePanel side={sides[0]} />
          <section
            aria-labelledby="compare-chart-title"
            className="min-w-0 bg-white @max-[879px]/compare:order-last @max-[879px]/compare:col-span-full"
          >
            <div className={`${HEAD_CLASS} justify-between`}>
              <h2 id="compare-chart-title" className={PANEL_TITLE_CLASS}>
                평가 요소별 점수
              </h2>
              <ul aria-label="막대 색" className="flex flex-wrap gap-x-[12px] gap-y-[2px] text-[12px] leading-[16px] text-[#505050]">
                {sides.map((side) => (
                  <li key={side.code} className="inline-flex items-center gap-[5px] tabular-nums">
                    <SeriesSwatch side={side.side} />
                    {side.code}
                  </li>
                ))}
              </ul>
            </div>
            <div className={`p-[20px] ${GRAY_CLASS}`}>
              <p className={`text-[14px] leading-[20px] font-semibold tabular-nums ${INK_CLASS}`}>{headline}</p>
              <ul className="mt-[8px] flex flex-col gap-[4px] text-[13px] leading-[18px]">
                {leads.map((lead) => (
                  <li key={lead.code} className="flex items-baseline gap-[6px] tabular-nums">
                    <SeriesSwatch side={lead.side} />
                    <span>
                      <strong className="font-semibold">{lead.code}</strong> 우세: {lead.text}
                    </span>
                  </li>
                ))}
              </ul>
              <ScoreChart chart={chart} />
              <ScoreTable table={table} sides={sides} />
            </div>
          </section>
          <SidePanel side={sides[1]} />
        </div>
      </div>
    </>
  );
}

/** 한 지원자의 단: 머리 줄(색 점, 코드, "30위 · 합격권")과 최종 평가, AI 한 줄 요약, 강점·약점, 위원별 종합 점수 */
function SidePanel({ side }: { side: DecisionCompareView["sides"][number] }) {
  const titleId = `compare-side-${side.side}`;
  return (
    <section aria-labelledby={titleId} className="min-w-0 bg-white">
      <div className={HEAD_CLASS}>
        <SeriesSwatch side={side.side} />
        <h2 id={titleId} className="text-[18px] leading-[26px] font-bold tracking-[-0.01em] tabular-nums">
          {side.code}
        </h2>
        {/* 순위와 구분은 시안처럼 글로만 적는다("30위 · 합격권"). 색 표시를 쓰지 않는다. */}
        <span className={`text-[13px] leading-[18px] tabular-nums ${GRAY_CLASS}`}>
          {side.rankText} · {side.standing.text}
        </span>
      </div>
      <div className={`p-[20px] ${GRAY_CLASS}`}>
        <p className={LABEL_CLASS}>최종 평가</p>
        {/* 크게 적는 수는 글꼴의 기본 숫자 폭 그대로다(숫자 폭을 맞추면 벌어져 보인다). */}
        <p className={`mt-[2px] text-[28px] leading-[36px] font-bold tracking-[-0.01em] ${INK_CLASS}`}>
          {side.finalText}
          <span className="ml-[2px] text-[16px] font-semibold">점</span>
        </p>
        <p className={`${LABEL_CLASS} mt-[16px]`}>AI 한 줄 요약</p>
        <p className="mt-[4px] text-[14px] leading-[22px] [overflow-wrap:anywhere] break-keep">{side.summary}</p>
        {/* 시안의 "+ 강점 / - 약점" 두 줄. 기호는 장식이고 화면 낭독기에는 "강점"·"약점" 으로 읽힌다. */}
        <dl className="mt-[16px] flex flex-col gap-[6px] border-t border-t-[#E4E4E4] pt-[16px] text-[13px] leading-[18px]">
          <div className="flex gap-[8px]">
            <dt className="w-[10px] flex-none font-semibold">
              <span aria-hidden="true">+</span>
              <span className="sr-only">강점</span>
            </dt>
            <dd className="[overflow-wrap:anywhere] break-keep">{side.strength}</dd>
          </div>
          <div className="flex gap-[8px]">
            <dt className="w-[10px] flex-none font-semibold">
              <span aria-hidden="true">−</span>
              <span className="sr-only">약점</span>
            </dt>
            <dd className="[overflow-wrap:anywhere] break-keep">{side.weakness}</dd>
          </div>
        </dl>
        <div className="mt-[16px] border-t border-t-[#E4E4E4] pt-[16px]">
          <p className={LABEL_CLASS}>위원별 종합 점수</p>
          <ul className="mt-[8px] flex flex-col gap-[6px] text-[13px] leading-[18px]">
            {side.members.map((member) => (
              <li key={member.name} className="flex justify-between gap-[12px]">
                <span>{member.name}</span>
                <span className="tabular-nums">{member.totalText}</span>
              </li>
            ))}
            <li className="mt-[2px] flex justify-between gap-[12px] border-t border-t-[#E4E4E4] pt-[8px]">
              <span>위원 간 차이</span>
              {/* 차이가 크면 색 대신 굵은 글자와 "차이 큼" 으로 알린다. */}
              <span className={`tabular-nums ${side.spreadWide ? "font-semibold" : ""}`}>
                {side.spreadText}
                {side.spreadWide && <span className="ml-[6px] text-[12px]">차이 큼</span>}
              </span>
            </li>
            <li className="flex justify-between gap-[12px]">
              <span>인재상 적합도 (AI)</span>
              <span className="tabular-nums">{side.aiText}</span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

/**
 * 평가 요소별 점수의 막대 그래프: 요소마다 두 지원자의 막대가 나란히 있다(왼쪽 막대가 왼쪽 지원자).
 * - 세로 눈금은 0~100 이고 막대는 0 에서 시작한다(차이를 부풀리지 않는다). 작은 차이는 막대 위의 점수와 아래의 표로 읽는다.
 * - 막대는 폭 24px, 위쪽 모서리만 둥글고(4px), 두 막대 사이는 2px 띈다. 막대는 나타날 때 아래에서 자라고 점수는 옅게 나타난다.
 * - 요소 수(1~6)만큼 칸을 똑같이 나누고, 요소 이름은 칸 안에서 줄을 바꾼다. 그림 전체가 하나의 그림(role="img")이고 이름에 값을 풀어 적었다.
 */
function ScoreChart({ chart }: { chart: DecisionCompareView["chart"] }) {
  const columns: CSSProperties = { gridTemplateColumns: `repeat(${Math.max(1, chart.groups.length)}, minmax(0, 1fr))` };
  return (
    <div role="img" aria-label={chart.label} className="mt-[16px] pt-[20px] pl-[28px]">
      <div className="relative h-[220px]">
        {chart.ticks.map((tick) => (
          <div
            key={tick}
            className={`absolute inset-x-0 border-t ${tick === 0 ? "border-t-[#767676]" : "border-t-[#E4E4E4]"}`}
            style={{ bottom: `${tick}%` }}
          >
            <span className="absolute right-full mr-[6px] -translate-y-1/2 text-[11px] leading-[14px] tabular-nums">
              {tick}
            </span>
          </div>
        ))}
        <div className="absolute inset-0 grid" style={columns}>
          {chart.groups.map((group) => (
            <div key={group.id} className="flex justify-center gap-[2px]">
              {group.bars.map((bar) => (
                <div key={bar.side} title={bar.title} className="relative h-full w-[24px]">
                  <span
                    className="absolute left-1/2 -translate-x-1/2 animate-fade-in text-[12px] leading-[14px] font-semibold whitespace-nowrap tabular-nums"
                    style={{ bottom: `calc(${bar.percent}% + 4px)` }}
                  >
                    {bar.valueText}
                  </span>
                  <span
                    className={`absolute inset-x-0 bottom-0 origin-bottom animate-column-grow rounded-t-[4px] ${SERIES_CLASS[bar.side]}`}
                    style={{ height: `${bar.percent}%` }}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-[8px] grid" style={columns}>
        {chart.groups.map((group) => (
          <p key={group.id} className="px-[4px] text-center text-[12px] leading-[16px] [overflow-wrap:anywhere] break-keep">
            {group.name}
          </p>
        ))}
      </div>
    </div>
  );
}

const CELL_CLASS = "px-[8px] py-[10px] text-right tabular-nums";

/** 평가 요소별 점수의 표: 요소(배점), 두 지원자의 점수(위원 평균), 차이(앞선 지원자와 점수 차). 마지막 줄은 최종 평가다. */
function ScoreTable({ table, sides }: { table: DecisionCompareView["table"]; sides: DecisionCompareView["sides"] }) {
  return (
    <div className="mt-[16px] overflow-x-auto">
      <table className="w-full min-w-[360px] border-collapse text-[13px] leading-[18px]">
        <caption className="sr-only">평가 요소별 점수 (위원 평균)와 두 지원자의 차이</caption>
        <thead>
          <tr className="text-[12px] leading-[16px]">
            <th scope="col" className="py-[10px] pr-[8px] text-left font-medium">
              평가 요소
            </th>
            <th scope="col" className={`${CELL_CLASS} font-medium`}>
              배점
            </th>
            {sides.map((side) => (
              <th key={side.code} scope="col" className={`${CELL_CLASS} font-medium`}>
                <span className="inline-flex items-center gap-[5px]">
                  <SeriesSwatch side={side.side} />
                  {side.code}
                </span>
              </th>
            ))}
            <th scope="col" className="py-[10px] pl-[8px] text-right font-medium">
              차이
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
              <td className={CELL_CLASS}>{row.leftText}</td>
              <td className={CELL_CLASS}>{row.rightText}</td>
              <td className="py-[10px] pl-[8px] text-right whitespace-nowrap tabular-nums">{row.diffText}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-t-[#CFCFCF] font-semibold">
            <th scope="row" className="py-[10px] pr-[8px] text-left font-semibold">
              최종 평가
            </th>
            <td className={CELL_CLASS}>{table.total.weightText}</td>
            <td className={CELL_CLASS}>{table.total.leftText}</td>
            <td className={CELL_CLASS}>{table.total.rightText}</td>
            <td className="py-[10px] pl-[8px] text-right whitespace-nowrap tabular-nums">{table.total.diffText}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/**
 * 고른 지원자를 브라우저에서 읽기 전(서버 렌더링·hydration 중)의 자리: 윗줄과 상자의 자리만 잡아 둔다.
 * 기본 두 사람이 잠깐 보였다가 고른 두 사람으로 바뀌지 않게 하려는 것이다. 콘솔 안에서 탭을 옮겨 올 때에는 거치지 않는다.
 */
export function DecisionComparePending() {
  return (
    <div aria-hidden="true">
      <div className="mt-[16px] h-[32px]" />
      <div className={`${PANEL_CLASS} mt-[12px] min-h-[560px]`} />
    </div>
  );
}

/** 비교할 지원자가 없을 때 (예시 자료에서는 일어나지 않는다) */
export function DecisionCompareEmpty({ recommendHref }: { recommendHref: string }) {
  return (
    <div className={`${PANEL_CLASS} mt-[16px] flex flex-col items-center gap-[6px] px-[20px] py-[32px] text-center`}>
      <p className="text-[15px] leading-[22px] font-semibold">비교할 지원자가 없습니다.</p>
      <p className="text-[14px] leading-[20px] text-[#505050]">인재상 적합 추천에서 비교할 지원자를 2명 골라 주세요.</p>
      <Link href={recommendHref} className={`${BUTTON_SECONDARY_CLASS} mt-[10px] h-[36px] px-[14px]`}>
        인재상 적합 추천으로 가기
      </Link>
    </div>
  );
}
