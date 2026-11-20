import Link from "next/link";
import type { ReactNode } from "react";
import { AccentTag, ConsoleCrumbs, PANEL_CLASS, PANEL_HEAD_CLASS, PANEL_TITLE_CLASS } from "@/components/consoleUi";
import type { DeadlineRemaining } from "@/lib/applicants/deadline";
import type { StageStatus } from "@/lib/home/home";

type HomeScreenProps = {
  /** 제목: 모집 시기(굵게)와 지금 하는 일(흐리게) */
  heading: { season: string; work: string };
  /** "오늘 2026. 11. 14. (토)". 브라우저에서 읽기 전(서버 렌더링·hydration 중)에는 null 이라 비워 둔다. */
  today: string | null;
  /** 1차 평가 마감. remaining 은 브라우저에서 읽기 전에는 null. */
  deadline: { label: string; remaining: DeadlineRemaining | null };
  /** 전형 일정의 단계. status·note 는 오늘을 읽기 전에는 null. */
  stages: {
    key: string;
    name: string;
    period: string;
    status: StageStatus | null;
    note: string | null;
    current: boolean;
    /** 다음 단계로 이어지는 줄을 짙게 그리는지 */
    passed: boolean;
  }[];
  /** 오늘 할 일. empty 는 남은 것이 없는 줄(건수 자리에 "없음") */
  todos: { key: string; title: string; note: string; countText: string; empty: boolean; href: string }[];
  /** 최근 작업 (최신 순) */
  recent: { key: string; title: string; timeText: string; href: string }[];
  notices: { key: string; dateText: string; title: string; body: string }[];
  /** 전형 목록. on 은 지금 고른 전형 */
  tracks: { key: string; name: string; quotaText: string; appliedText: string; on: boolean; onPick: () => void }[];
  /** 고른 전형의 단계별 진행률 그래프 */
  chart: {
    title: string;
    label: string;
    ticks: readonly number[];
    bars: { key: string; name: string; percent: number; valueText: string; title: string }[];
  };
  /** 고른 전형의 모집 단위별 평가 진행 */
  units: {
    title: string;
    rows: { key: string; name: string; mineText: string | null; percent: number; remainText: string; percentText: string }[];
  };
};

/**
 * 홈 화면(/home). 시안의 배치를 따르고 조각·색·글자는 다른 새 화면의 것(components/consoleUi.tsx)을 쓴다.
 * - 제목 줄: 모집 시기와 하는 일, 그 아래 오늘 날짜와 1차 평가 마감까지 남은 날(남은 날만 빨강).
 * - 전형 일정: 단계 다섯이 한 줄로 이어진다. 끝난 단계는 짙은 남색 점(체크), 지금 단계는 파란 점과 파란 이름, 올 단계는 회색 고리다.
 *   줄은 시작한 단계까지 짙다. 상자 안쪽 폭이 880px 보다 좁으면 위에서 아래로 쌓인다.
 * - 왼쪽 단: 오늘 할 일(줄 전체가 그 일을 하는 화면으로 가는 링크), 최근 작업, 공지(누르면 본문이 펼쳐진다).
 * - 오른쪽 단: 진행 현황. 전형을 고르면(aria-pressed) 옆의 단계별 진행률 그래프와 아래의 모집 단위별 평가 진행이 그 전형의 것으로 바뀐다.
 * 두 단은 본문 폭이 896px 보다 좁으면 위아래로 쌓인다. 그래프·막대는 다른 화면과 같은 채움 그라데이션이다(app/globals.css).
 * 움직임: 막대는 나타날 때 자라고 전형을 바꾸면 높이·너비가 따라 움직인다. 줄은 마우스를 올리면 옅은 회색 바탕이 된다.
 */
export function HomeScreen({ heading, today, deadline, stages, todos, recent, notices, tracks, chart, units }: HomeScreenProps) {
  return (
    <>
      <ConsoleCrumbs items={[{ label: "홈" }]} />
      <div className="mt-[12px]">
        <h1 className="flex flex-wrap items-baseline gap-x-[10px] text-[22px] leading-[30px] font-bold tracking-[-0.01em]">
          {heading.season}
          <span className="font-medium text-[#767676]">{heading.work}</span>
        </h1>
        {/* 오늘 날짜와 남은 날은 브라우저에서 읽은 뒤에 채운다. 그 전에도 줄의 높이는 같다(min-height). */}
        <p className="mt-[4px] flex min-h-[20px] flex-wrap gap-x-[12px] text-[14px] leading-[20px] text-[#505050]">
          <span>{today}</span>
          <span>
            <DeadlineText label={deadline.label} remaining={deadline.remaining} />
          </span>
        </p>
      </div>

      <section aria-labelledby="home-schedule-title" className={`${PANEL_CLASS} @container mt-[20px] px-[20px] py-[18px]`}>
        <h2 id="home-schedule-title" className="sr-only">
          전형 일정
        </h2>
        <ol className="flex flex-col @[880px]:grid @[880px]:grid-cols-5">
          {stages.map((stage, index) => (
            <li
              key={stage.key}
              aria-current={stage.current ? "step" : undefined}
              className="relative pb-[16px] pl-[30px] last:pb-0 @[880px]:pt-[28px] @[880px]:pr-[16px] @[880px]:pb-0 @[880px]:pl-0"
            >
              {/* 다음 단계로 이어지는 줄: 이 점의 가운데에서 다음 점의 가운데까지. 점이 그 위에 놓인다. */}
              {index < stages.length - 1 && (
                <span
                  aria-hidden="true"
                  className={`motion-colors absolute top-[10px] -bottom-[10px] left-[8px] w-[2px] @[880px]:top-[8px] @[880px]:-right-[9px] @[880px]:bottom-auto @[880px]:left-[9px] @[880px]:h-[2px] @[880px]:w-auto ${
                    stage.passed ? "bg-[#000947]" : "bg-[#E4E4E4]"
                  }`}
                />
              )}
              <span aria-hidden="true" className="absolute top-px left-0 z-[1] flex h-[18px] w-[18px] items-center justify-center @[880px]:top-0">
                <StageDot status={stage.status} current={stage.current} />
              </span>
              <p
                className={`motion-colors text-[14px] leading-[20px] ${
                  stage.current ? "font-semibold text-[#001AD0]" : "font-medium text-[#111111]"
                }`}
              >
                {stage.name}
              </p>
              <p className="mt-[2px] text-[13px] leading-[18px] text-[#767676] tabular-nums">{stage.period}</p>
              {/* 상태는 오늘을 읽은 뒤에 채운다. 그 전에도 줄의 높이는 같다(min-height). */}
              <p
                className={`min-h-[18px] text-[13px] leading-[18px] tabular-nums ${
                  stage.current ? "font-semibold text-[#001AD0]" : "font-medium text-[#505050]"
                }`}
              >
                {stage.note !== null && <span className="animate-fade-in">{stage.note}</span>}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <div className="@container mt-[16px]">
        <div className="grid items-start gap-[16px] @4xl:grid-cols-[minmax(300px,0.42fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-[16px]">
            <ListPanel titleId="home-todo-title" title="오늘 할 일">
              {todos.map((todo, index) => (
                <RowLink key={todo.key} href={todo.href} title={todo.title} note={todo.note} strong last={index === todos.length - 1}>
                  <span
                    className={`flex-none text-[14px] leading-[20px] tabular-nums ${
                      todo.empty ? "text-[#767676]" : "font-semibold text-[#111111]"
                    }`}
                  >
                    {todo.countText}
                  </span>
                </RowLink>
              ))}
            </ListPanel>

            <ListPanel titleId="home-recent-title" title="최근 작업">
              {recent.map((work, index) => (
                <RowLink key={work.key} href={work.href} title={work.title} note={work.timeText} last={index === recent.length - 1} />
              ))}
            </ListPanel>

            <section aria-labelledby="home-notice-title" className={PANEL_CLASS}>
              <h2 id="home-notice-title" className="sr-only">
                공지
              </h2>
              {notices.map((notice, index) => (
                <details key={notice.key} className={`group ${index === 0 ? "" : "border-t border-t-[#E4E4E4]"}`}>
                  <summary className="motion-colors flex min-h-[48px] cursor-pointer list-none scroll-m-[8px] items-center gap-[10px] rounded-[7px] px-[20px] py-[8px] hover-on:bg-[#F6F7FB] focus-visible:outline-offset-[-2px]! [&::-webkit-details-marker]:hidden">
                    <AccentTag>공지</AccentTag>
                    <span className="flex-none text-[13px] leading-[18px] text-[#767676] tabular-nums">{notice.dateText}</span>
                    <span className="min-w-0 flex-[1_1_auto] text-[14px] leading-[20px] font-semibold [overflow-wrap:anywhere]">
                      {notice.title}
                    </span>
                    <Chevron direction="down" className="transition-[rotate] duration-150 ease-swift group-open:rotate-180" />
                  </summary>
                  <p className="animate-fade-in px-[20px] pt-[2px] pb-[14px] text-[13px] leading-[20px] text-[#505050] break-keep">
                    {notice.body}
                  </p>
                </details>
              ))}
            </section>
          </div>

          <section aria-labelledby="home-progress-title" className={`${PANEL_CLASS} min-w-0`}>
            <div className={`${PANEL_HEAD_CLASS} flex h-[40px] items-center rounded-t-[7px] px-[20px]`}>
              <h2 id="home-progress-title" className={PANEL_TITLE_CLASS}>
                진행 현황
              </h2>
            </div>
            <div className="flex flex-wrap gap-x-[32px] gap-y-[24px] px-[20px] pt-[16px] pb-[20px]">
              <div className="min-w-0 flex-[1_1_300px]">
                <div
                  aria-hidden="true"
                  className={`${TRACK_GRID_CLASS} border-b border-b-[#CFCFCF] px-[12px] pb-[8px] text-[12px] leading-[16px] font-semibold text-[#505050]`}
                >
                  <span>전형</span>
                  <span className="text-right">지원</span>
                  <span />
                </div>
                <ul aria-label="전형">
                  {tracks.map((track) => (
                    <li key={track.key} className="border-b border-b-[#E4E4E4]">
                      <button
                        type="button"
                        aria-pressed={track.on}
                        onClick={track.onPick}
                        className={`${TRACK_GRID_CLASS} motion-colors box-border min-h-[56px] w-full cursor-pointer scroll-m-[8px] border-0 px-[12px] py-[8px] text-left focus-visible:outline-offset-[-2px]! ${
                          track.on ? "bg-[#EEF0FF]" : "bg-white hover-on:bg-[#F6F7FB] press-on:bg-[#ECEEF5]"
                        }`}
                      >
                        <span className="min-w-0">
                          <span
                            className={`motion-colors block text-[14px] leading-[20px] font-semibold [overflow-wrap:anywhere] ${
                              track.on ? "text-[#001AD0]" : "text-[#111111]"
                            }`}
                          >
                            {track.name}
                          </span>
                          <span className="block text-[12px] leading-[16px] text-[#767676] tabular-nums">{track.quotaText}</span>
                        </span>
                        <span className="text-right text-[15px] leading-[22px] font-semibold text-[#111111] tabular-nums">
                          <span className="sr-only">지원 </span>
                          {track.appliedText}
                        </span>
                        <Chevron direction="right" tone={track.on ? "accent" : "muted"} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="min-w-0 flex-[1_1_260px]">
                <h3 className="text-[13px] leading-[18px] font-semibold">{chart.title}</h3>
                <StageChart chart={chart} />
              </div>
            </div>

            <div className="border-t border-t-[#E4E4E4] px-[20px] pt-[16px] pb-[12px]">
              <h3 className="text-[13px] leading-[18px] font-semibold">{units.title}</h3>
              <ul className="mt-[8px]">
                {units.rows.map((unit) => (
                  <li key={unit.key} className="grid min-h-[44px] grid-cols-[minmax(84px,128px)_minmax(0,1fr)_auto] items-center gap-x-[16px] py-[6px]">
                    <div className="min-w-0">
                      <p className="text-[13px] leading-[18px] font-semibold [overflow-wrap:anywhere]">{unit.name}</p>
                      {unit.mineText !== null && (
                        <p className="text-[12px] leading-[16px] font-medium text-[#001AD0] tabular-nums">{unit.mineText}</p>
                      )}
                    </div>
                    {/* 채움 너비는 오른쪽의 비율과 같은 값이다. 나타날 때 왼쪽에서 채워지고 값이 바뀌면 너비가 따라 움직인다. */}
                    <div aria-hidden="true" className="h-[6px] overflow-hidden rounded-[3px] bg-[#E4E6EE]">
                      <div
                        className="chart-fill-x h-[6px] origin-left animate-bar-grow transition-[width] duration-500 ease-soft"
                        style={{ width: `${unit.percent}%` }}
                      />
                    </div>
                    <p className="min-w-[112px] text-right text-[12px] leading-[16px] whitespace-nowrap text-[#767676] tabular-nums">
                      {unit.remainText} · <strong className="font-semibold text-[#111111]">{unit.percentText}</strong>
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

/** 제목 아래의 남은 날: "1차 평가 마감까지 6일"(숫자와 "일" 만 빨강), 당일과 지난 뒤에는 전체가 빨강. 읽기 전에는 비운다. */
function DeadlineText({ label, remaining }: { label: string; remaining: DeadlineRemaining | null }) {
  if (remaining === null) return null;
  if (remaining.kind === "today") return <strong className={DEADLINE_ALERT_CLASS}>오늘 {label}</strong>;
  if (remaining.kind === "passed") return <strong className={DEADLINE_ALERT_CLASS}>{label} 지남</strong>;
  return (
    <>
      {label}까지 <strong className={DEADLINE_ALERT_CLASS}>{remaining.days}일</strong>
    </>
  );
}

const DEADLINE_ALERT_CLASS = "font-semibold text-[#BA1A1A]";

/** 전형 목록의 칸 나눔: 전형 이름·모집 인원, 지원 건수, 꺾쇠 (머리 줄과 줄 버튼이 같이 쓴다) */
const TRACK_GRID_CLASS = "grid grid-cols-[minmax(0,1fr)_auto_16px] items-center gap-x-[12px]";

/**
 * 전형 일정의 점 (18px 칸의 가운데). 지금 단계는 파란 고리 안의 파란 점, 끝난 단계는 체크가 든 짙은 남색 점,
 * 진행 중이거나 마무리 중인 단계는 남색 고리, 올 단계(와 오늘을 읽기 전)는 회색 고리다. 색만으로 가르지 않도록 상태를 글로도 적는다.
 */
function StageDot({ status, current }: { status: StageStatus | null; current: boolean }) {
  if (current) {
    return (
      <span className="box-border flex h-[18px] w-[18px] items-center justify-center rounded-[50%] border-2 border-[#001AD0] bg-white">
        <span className="h-[8px] w-[8px] rounded-[50%] bg-[#001AD0]" />
      </span>
    );
  }
  if (status === "완료") {
    return (
      <span className="flex h-[14px] w-[14px] items-center justify-center rounded-[50%] bg-[#000947]">
        <svg viewBox="0 0 12 12" fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-[10px] w-[10px]">
          <path d="M2.5 6.3 4.9 8.6 9.5 3.6" />
        </svg>
      </span>
    );
  }
  const started = status === "진행 중" || status === "마무리 중";
  return (
    <span
      className={`motion-colors box-border h-[14px] w-[14px] rounded-[50%] border-2 bg-white ${started ? "border-[#000947]" : "border-[#CFCFCF]"}`}
    />
  );
}

/** 머리 줄이 있는 목록 상자 (오늘 할 일, 최근 작업) */
function ListPanel({ titleId, title, children }: { titleId: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={titleId} className={PANEL_CLASS}>
      <div className={`${PANEL_HEAD_CLASS} flex h-[40px] items-center rounded-t-[7px] px-[20px]`}>
        <h2 id={titleId} className={PANEL_TITLE_CLASS}>
          {title}
        </h2>
      </div>
      <ul>{children}</ul>
    </section>
  );
}

/**
 * 목록의 줄 하나: 줄 전체가 링크다(제목, 그 아래 흐린 글, 오른쪽에 건수 같은 덧붙임과 꺾쇠).
 * 줄이 상자의 양 끝까지 닿아 있어 키보드 초점 표시는 줄 안쪽에 그린다(지원자 관리의 표와 같다). 마지막 줄은 상자의 아래 모서리를 따라 둥글다.
 */
function RowLink({
  href,
  title,
  note,
  strong = false,
  last,
  children,
}: {
  href: string;
  title: string;
  note: string;
  /** 제목을 굵게(600) 적는지. 아니면 500. */
  strong?: boolean;
  last: boolean;
  children?: ReactNode;
}) {
  return (
    <li className={last ? "" : "border-b border-b-[#E4E4E4]"}>
      <Link
        href={href}
        className={`motion-colors box-border flex min-h-[56px] scroll-m-[8px] items-center gap-[12px] px-[20px] py-[8px] no-underline hover-on:bg-[#F6F7FB] press-on:bg-[#ECEEF5] focus-visible:outline-offset-[-2px]! ${
          last ? "rounded-b-[7px]" : ""
        }`}
      >
        <span className="min-w-0 flex-[1_1_auto]">
          <span className={`block text-[14px] leading-[20px] text-[#111111] [overflow-wrap:anywhere] ${strong ? "font-semibold" : "font-medium"}`}>
            {title}
          </span>
          <span className="block text-[12px] leading-[16px] text-[#767676] tabular-nums">{note}</span>
        </span>
        {children}
        <Chevron direction="right" />
      </Link>
    </li>
  );
}

const CHEVRON_PATH = { right: "M6 4l4 4-4 4", down: "M4 6l4 4 4-4" } as const;

/** 꺾쇠 (16px, 장식). 오른쪽은 "이 줄로 간다·고른다", 아래는 "펼친다" 다. */
function Chevron({
  direction,
  tone = "muted",
  className = "",
}: {
  direction: keyof typeof CHEVRON_PATH;
  tone?: "muted" | "accent";
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`motion-colors h-[16px] w-[16px] flex-none ${tone === "accent" ? "text-[#001AD0]" : "text-[#767676]"} ${className}`}
    >
      <path d={CHEVRON_PATH[direction]} />
    </svg>
  );
}

/**
 * 단계별 진행률의 막대 그래프 (한 계열). 세로 눈금은 0~100% 이고 막대는 0 에서 시작한다. 눈금 글자는 오른쪽에 둔다(왼쪽은 전형 목록이다).
 * 막대는 폭 36px, 위쪽 모서리만 둥글고(4px), 위에 값을 적는다. 나타날 때 아래에서 자라고, 전형을 바꾸면 높이와 값의 자리가 따라 움직인다.
 * 그림 전체가 하나의 그림(role="img")이고 이름에 값을 풀어 적었다. 막대에 마우스를 올리면 값이 뜬다(title).
 */
function StageChart({ chart }: { chart: HomeScreenProps["chart"] }) {
  return (
    <div role="img" aria-label={chart.label} className="mt-[8px] pt-[20px] pr-[40px]">
      <div className="relative h-[176px]">
        {chart.ticks.map((tick) => (
          <div
            key={tick}
            className={`absolute inset-x-0 border-t ${tick === 0 ? "border-t-[#767676]" : "border-t-[#E4E4E4]"}`}
            style={{ bottom: `${tick}%` }}
          >
            <span className="absolute left-full ml-[8px] -translate-y-1/2 text-[11px] leading-[14px] whitespace-nowrap text-[#767676] tabular-nums">
              {tick}%
            </span>
          </div>
        ))}
        <div className="absolute inset-0 grid grid-cols-3">
          {chart.bars.map((bar) => (
            <div key={bar.key} className="flex justify-center">
              <div title={bar.title} className="relative h-full w-[36px]">
                <span
                  className="absolute left-1/2 -translate-x-1/2 animate-fade-in text-[12px] leading-[14px] font-semibold whitespace-nowrap tabular-nums transition-[bottom] duration-500 ease-soft"
                  style={{ bottom: `calc(${bar.percent}% + 4px)` }}
                >
                  {bar.valueText}
                </span>
                <span
                  className="chart-fill-y absolute inset-x-0 bottom-0 origin-bottom animate-column-grow rounded-t-[4px] transition-[height] duration-500 ease-soft"
                  style={{ height: `${bar.percent}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-[8px] grid grid-cols-3">
        {chart.bars.map((bar) => (
          <p key={bar.key} className="px-[4px] text-center text-[12px] leading-[16px] break-keep">
            {bar.name}
          </p>
        ))}
      </div>
    </div>
  );
}
