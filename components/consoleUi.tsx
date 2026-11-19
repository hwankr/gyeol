import Link from "next/link";
import type { ReactNode, Ref } from "react";

// 새 화면(전형 준비, 지원자 관리, 평가하기)이 같이 쓰는 작은 조각과 클래스 묶음. 치수·색·글자는 디자인 값 그대로다.
// 색: 글자 #111111, 흐린 글자 #505050·#767676, 선 #E4E4E4, 컨트롤 테두리 #CFCFCF, 표 머리 바탕 #F6F7FB,
//     강조 #001AD0(바탕 #EEF0FF), 짙은 남색 #000947, 경고 #BA1A1A. 모서리는 컨트롤 6px, 상자 8px.

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
            <Link href={item.href} className="scroll-m-[8px] text-[#505050] no-underline">
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
 */
export function segmentClass(index: number, count: number, on: boolean): string {
  const radius = index === 0 ? "rounded-l-[6px]" : index === count - 1 ? "rounded-r-[6px]" : "";
  const pull = index === 0 ? "" : "-ml-px";
  const tone = on
    ? "z-[1] border-[#001AD0] bg-[#EEF0FF] font-semibold text-[#001AD0]"
    : "z-0 border-[#CFCFCF] bg-white font-medium text-[#505050]";
  return `relative box-border inline-flex items-center border text-[13px] ${radius} ${pull} ${tone}`;
}

/** 테두리 상자 (표·패널의 바깥 상자) */
export const PANEL_CLASS = "rounded-[8px] border border-[#E4E4E4]";

/** 표 머리 줄·패널 머리 줄의 바탕과 아래 선 (높이·안쪽 여백·모서리는 쓰는 쪽이 정한다) */
export const PANEL_HEAD_CLASS = "border-b border-b-[#E4E4E4] bg-[#F6F7FB]";

/** 패널 머리 줄의 제목 글자 (13px, 굵기 600) */
export const PANEL_TITLE_CLASS = "text-[13px] leading-[18px] font-semibold";

/** 버튼 공통: 글꼴은 물려받고 모서리 6px, 테두리 1px. 높이·안쪽 여백은 쓰는 쪽이 정한다. */
const BUTTON_BASE = "box-border inline-flex items-center justify-center rounded-[6px] border text-[13px] no-underline";

/** 보조 버튼: 흰 바탕, 회색 테두리, 검은 글자 (굵기 500) */
export const BUTTON_SECONDARY_CLASS = `${BUTTON_BASE} border-[#CFCFCF] bg-white font-medium text-[#111111] disabled:cursor-default disabled:opacity-[0.45]`;

/** 주 버튼: 짙은 남색 바탕, 흰 글자 (굵기 600). 꺼지면 옅은 회색 바탕에 회색 글자. */
export const BUTTON_PRIMARY_CLASS = `${BUTTON_BASE} border-[#000947] bg-[#000947] font-semibold text-white disabled:cursor-default disabled:border-[#E4E6EE] disabled:bg-[#E4E6EE] disabled:text-[#505050]`;

/** 테두리만 있는 주 버튼(임시저장): 흰 바탕, 남색 테두리·글자 (굵기 600) */
export const BUTTON_OUTLINE_CLASS = `${BUTTON_BASE} border-[#000947] bg-white font-semibold text-[#000947] disabled:cursor-default disabled:opacity-[0.45]`;
