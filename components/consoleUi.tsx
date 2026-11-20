import Link from "next/link";
import type { ReactNode, Ref, SVGProps } from "react";

// 새 화면(전형 준비, 지원자 관리, 평가하기)이 같이 쓰는 작은 조각과 클래스 묶음. 치수·색·글자는 디자인 값 그대로다.
// 색: 글자 #111111, 흐린 글자 #505050·#767676, 선 #E4E4E4, 컨트롤 테두리 #CFCFCF, 표 머리 바탕 #F6F7FB,
//     강조 #001AD0(바탕 #EEF0FF), 짙은 남색 #000947, 경고 #BA1A1A. 모서리는 컨트롤 6px, 상자 8px.
// 움직임(디자인 시안에는 없어 정한 것. 값은 app/globals.css): 누를 수 있는 것은 마우스를 올리면 바탕이 #F6F7FB(주 버튼은 #1A2259),
//     누르는 동안 #ECEEF5(주 버튼은 #00062E)가 되고 색은 150ms 에 걸쳐 바뀐다(motion-colors). 고른 것(파란 바탕)은 올려도 그대로다.

/** 현재 위치 줄의 항목 하나. href 가 없으면 갈 곳이 없는 항목이다(마지막 항목은 지금 화면). */
export type ConsoleCrumb = {
  label: string;
  href?: string;
};

type ConsoleCrumbsProps = {
  /** 앞에서부터 차례로. 마지막 항목이 지금 화면이다(굵게, 링크 아님). */
  items: readonly ConsoleCrumb[];
  navRef?: Ref<HTMLElement>;
};

/**
 * 현재 위치 줄: "홈 / 전형 준비 / 기준 변경 기록". 항목 사이는 "/"(장식)다.
 * 갈 곳이 있는 항목은 보통 링크(next/link)이고, 갈 곳이 없는 항목(홈)은 href 없는 <a> 라서 초점을 받지 않고 눌러도 아무 일도 없다.
 */
export function ConsoleCrumbs({ items, navRef }: ConsoleCrumbsProps) {
  const last = items.length - 1;
  return (
    <nav ref={navRef} aria-label="현재 위치">
      <ol className="flex flex-wrap items-center gap-x-[6px] gap-y-[4px] text-[13px] leading-[18px] text-[#505050]">
        {items.map((item, index) => (
          <CrumbItem key={`${index}-${item.label}`} item={item} current={index === last} first={index === 0} />
        ))}
      </ol>
    </nav>
  );
}

function CrumbItem({ item, current, first }: { item: ConsoleCrumb; current: boolean; first: boolean }) {
  return (
    <>
      {!first && (
        <li aria-hidden="true" className="text-[#AEAEAE]">
          /
        </li>
      )}
      {current ? (
        <li aria-current="page" className="font-semibold text-[#111111] [overflow-wrap:anywhere]">
          {item.label}
        </li>
      ) : (
        <li>
          {item.href === undefined ? (
            <a aria-disabled="true" className="cursor-default text-[#505050] no-underline">
              {item.label}
            </a>
          ) : (
            <Link href={item.href} className="motion-colors scroll-m-[8px] text-[#505050] no-underline hover-on:text-[#111111]">
              {item.label}
            </Link>
          )}
        </li>
      )}
    </>
  );
}

/** 제목 줄: 화면 제목(h1)과 그 옆의 덧붙이는 글(오늘 날짜, 전형·모집 단위 등). note 가 비면 제목만 그린다. */
export function ConsoleTitle({ title, note }: { title: string; note?: ReactNode }) {
  return (
    <div className="mt-[12px] flex flex-wrap items-baseline gap-x-[12px] gap-y-[2px]">
      <h1 className="text-[22px] leading-[30px] font-bold tracking-[-0.01em]">{title}</h1>
      <p className="text-[14px] leading-[20px] text-[#505050]">{note}</p>
    </div>
  );
}

/** 상태 표시의 색: 빨강(확인 필요), 파랑(진행 중·평가 중), 주황(임시 저장), 회색(대기), 초록(완료·제출 완료) */
export type ChipTone = "red" | "blue" | "amber" | "gray" | "green";

const CHIP_TONE_CLASS: Record<ChipTone, { box: string; dot: string }> = {
  red: { box: "bg-[#FDECEC] text-[#BA1A1A]", dot: "bg-[#BA1A1A]" },
  blue: { box: "bg-[#EEF0FF] text-[#001AD0]", dot: "bg-[#001AD0]" },
  amber: { box: "bg-[#FFF1DC] text-[#8A4B00]", dot: "bg-[#8A4B00]" },
  gray: { box: "bg-[#F0F0F2] text-[#505050]", dot: "bg-[#505050]" },
  green: { box: "bg-[#E8F5EE] text-[#1B6E45]", dot: "bg-[#1B6E45]" },
};

/** 상태 표시: 점 하나와 글자 (높이 22px). 색만으로 구분하지 않도록 글자를 늘 같이 적는다. */
export function StatusChip({ tone, children }: { tone: ChipTone; children: ReactNode }) {
  const toneClass = CHIP_TONE_CLASS[tone];
  return (
    <span
      className={`inline-flex h-[22px] items-center gap-[6px] rounded-[4px] px-[8px] text-[12px] font-semibold whitespace-nowrap ${toneClass.box}`}
    >
      <span aria-hidden="true" className={`h-[6px] w-[6px] rounded-[50%] ${toneClass.dot}`} />
      {children}
    </span>
  );
}

/** 작은 꼬리표 ("AI 제안", 고른 평가 요소 이름 등): 파란 글자, 옅은 파란 바탕 */
export function AccentTag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-[4px] bg-[#EEF0FF] px-[6px] py-px text-[12px] leading-[16px] font-semibold text-[#001AD0]">
      {children}
    </span>
  );
}

/**
 * 이어 붙인 버튼 묶음(걸러 보기, 목록 구분, 서류 구분)의 버튼 하나에 줄 클래스.
 * 첫 버튼은 왼쪽, 마지막 버튼은 오른쪽 모서리만 둥글고, 사이 테두리가 겹치게 둘째부터 왼쪽으로 1px 당긴다. 눌린 버튼은 파란 테두리가
 * 이웃 테두리 위에 보이게 위로 올린다(z-index). 높이·안쪽 여백은 쓰는 쪽이 정한다(h-[32px] px-[12px] 등).
 * 눌리지 않은 버튼은 마우스를 올리면 바탕이 옅은 회색이 되고, 눌린 버튼이 바뀔 때 색이 150ms 에 걸쳐 옮겨 간다.
 */
export function segmentClass(index: number, count: number, on: boolean): string {
  const radius = index === 0 ? "rounded-l-[6px]" : index === count - 1 ? "rounded-r-[6px]" : "";
  const pull = index === 0 ? "" : "-ml-px";
  const tone = on
    ? "z-[1] border-[#001AD0] bg-[#EEF0FF] font-semibold text-[#001AD0]"
    : "z-0 border-[#CFCFCF] bg-white font-medium text-[#505050] hover-on:bg-[#F6F7FB] hover-on:text-[#111111]";
  return `motion-colors relative box-border inline-flex cursor-pointer items-center border text-[13px] ${radius} ${pull} ${tone}`;
}

/** 테두리 상자 (표·패널의 바깥 상자) */
export const PANEL_CLASS = "rounded-[8px] border border-[#E4E4E4]";

/** 표 머리 줄·패널 머리 줄의 바탕과 아래 선 (높이·안쪽 여백·모서리는 쓰는 쪽이 정한다) */
export const PANEL_HEAD_CLASS = "border-b border-b-[#E4E4E4] bg-[#F6F7FB]";

/** 패널 머리 줄의 제목 글자 (13px, 굵기 600) */
export const PANEL_TITLE_CLASS = "text-[13px] leading-[18px] font-semibold";

/**
 * 버튼 공통: 글꼴은 물려받고 모서리 6px, 테두리 1px. 높이·안쪽 여백은 쓰는 쪽이 정한다.
 * 색은 150ms 에 걸쳐 바뀌고(motion-colors) 손가락 커서다. 꺼진 버튼(disabled, aria-disabled)에는 올려놓음·누름 색이 걸리지 않는다.
 */
const BUTTON_BASE =
  "motion-colors box-border inline-flex cursor-pointer items-center justify-center rounded-[6px] border text-[13px] no-underline";

/** 흰 바탕 버튼의 올려놓음·누름 바탕 (보조 버튼, 테두리만 있는 주 버튼) */
const BUTTON_LIGHT_HOVER = "hover-on:bg-[#F6F7FB] press-on:bg-[#ECEEF5]";

/** 보조 버튼: 흰 바탕, 회색 테두리, 검은 글자 (굵기 500) */
export const BUTTON_SECONDARY_CLASS = `${BUTTON_BASE} ${BUTTON_LIGHT_HOVER} border-[#CFCFCF] bg-white font-medium text-[#111111] disabled:cursor-default disabled:opacity-[0.45]`;

/** 눌린 채로 있는 보조 버튼(보류·재검토 요청): 파란 테두리, 옅은 파란 바탕, 파란 글자 (굵기 600). 올려도 그대로다. */
export const BUTTON_PRESSED_CLASS = `${BUTTON_BASE} border-[#001AD0] bg-[#EEF0FF] font-semibold text-[#001AD0] disabled:cursor-default disabled:opacity-[0.45]`;

/** 주 버튼: 짙은 남색 바탕, 흰 글자 (굵기 600). 꺼지면 옅은 회색 바탕에 회색 글자. */
export const BUTTON_PRIMARY_CLASS = `${BUTTON_BASE} border-[#000947] bg-[#000947] font-semibold text-white hover-on:border-[#1A2259] hover-on:bg-[#1A2259] press-on:border-[#00062E] press-on:bg-[#00062E] disabled:cursor-default disabled:border-[#E4E6EE] disabled:bg-[#E4E6EE] disabled:text-[#505050]`;

/** 테두리만 있는 주 버튼(임시저장): 흰 바탕, 남색 테두리·글자 (굵기 600) */
export const BUTTON_OUTLINE_CLASS = `${BUTTON_BASE} ${BUTTON_LIGHT_HOVER} border-[#000947] bg-white font-semibold text-[#000947] disabled:cursor-default disabled:opacity-[0.45]`;

type ChartFillGradientProps = Pick<
  SVGProps<SVGLinearGradientElement>,
  "x1" | "y1" | "x2" | "y2" | "gradientUnits" | "gradientTransform"
> & {
  /** fill·stroke 에서 url(#id) 로 가리킬 이름. 한 화면에서 겹치지 않아야 한다. */
  id: string;
};

/**
 * SVG 차트의 채움 그라데이션. 막대(div)의 chart-fill-x·chart-fill-y 와 같은 값이다(app/globals.css): 0% 는 --chart-fill-from,
 * 51% 부터는 --chart-fill-to. 두 색은 이 요소가 놓인 자리의 변수를 따르므로, 감싼 svg 에 chart-fill-soft 를 주면 옅은 색이 된다.
 * 방향(x1·y1·x2·y2 등)은 쓰는 쪽이 정한다. <svg> 안의 <defs> 에 넣는다.
 */
export function ChartFillGradient({ id, ...direction }: ChartFillGradientProps) {
  return (
    <linearGradient id={id} {...direction}>
      <stop offset="0" style={{ stopColor: "var(--chart-fill-from)" }} />
      <stop offset="0.51" style={{ stopColor: "var(--chart-fill-to)" }} />
    </linearGradient>
  );
}

/**
 * 기다리는 중 표시: 돌아가는 고리(14px). 장식이라 화면 낭독기에는 숨긴다(옆의 상태 글이 읽힌다).
 * 움직임을 줄이도록 설정한 사람에게도 돈다(motion-essential): 멈춰 있으면 기다리는 중인지 알 수 없다.
 */
export function Spinner() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" className="motion-essential h-[14px] w-[14px] flex-none animate-spin">
      <circle cx="8" cy="8" r="6.25" stroke="#E4E6EE" strokeWidth="1.5" />
      <path d="M14.25 8A6.25 6.25 0 0 0 8 1.75" stroke="#001AD0" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
