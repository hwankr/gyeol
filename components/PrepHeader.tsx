import Link from "next/link";
import { ViewTransition } from "react";
import { ConsoleCrumbs, ConsoleTitle } from "@/components/consoleUi";
import { ADMISSION } from "@/lib/admission";

type PrepHeaderProps = {
  /** 현재 위치 줄의 "전형 준비" 가 가는 주소 */
  prepPath: string;
  /** 현재 위치 줄의 마지막 이름 (지금 탭) */
  crumb: string;
  /** "오늘 2026. 11. 18. (수)". 브라우저에서 읽기 전(서버 렌더링·hydration 중)에는 null 이라 비워 둔다. */
  today: string | null;
  /** 탭 줄. current 는 지금 탭 */
  tabs: { href: string; label: string; current: boolean }[];
};

/**
 * 전형 준비 화면 세 탭의 공통 머리: 현재 위치 줄, 제목 줄(오늘 날짜), 전형 요약(테두리 상자 안의 네 칸), 탭 줄.
 * 치수·색·글자는 디자인 값 그대로다. 현재 위치 줄과 제목 줄은 새 화면이 같이 쓰는 조각(components/consoleUi.tsx)이고,
 * 탭과 현재 위치의 "전형 준비" 는 보통 링크(next/link)다. 홈 화면은 없어 "홈" 은 눌러도 아무 일도 없다.
 * 전형 요약의 칸은 폭이 모자라면 아래 줄로 내려가고(flex-wrap), 지금 탭은 파란 글자에 파란 밑줄(2px)이다.
 * 탭 줄의 이름(aria-label)은 탭 본문의 링크가 초점을 넘길 탭을 찾는 데 쓴다(hooks/usePrepHeader.ts 의 handOverFocusToPrepTab).
 * 파란 밑줄은 지금 탭 안에 따로 그린 줄이다(자리·굵기는 링크의 아래 테두리와 같다). 탭을 옮기면 전의 탭에서 지금 탭으로 미끄러져 간다
 * (이름이 같은 <ViewTransition> 한 쌍. app/globals.css 의 tab-line). 지금 탭이 아닌 탭은 마우스를 올리면 검은 글자가 된다.
 */
export function PrepHeader({ prepPath, crumb, today, tabs }: PrepHeaderProps) {
  return (
    <>
      <ConsoleCrumbs items={[{ label: "홈" }, { label: "전형 준비", href: prepPath }, { label: crumb }]} />
      <ConsoleTitle title="전형 준비" note={today} />

      <dl className="mt-[20px] flex flex-wrap rounded-[8px] border border-[#E4E4E4]">
        <div className={`${CELL_CLASS} flex-[1.4_1_240px]`}>
          <dt className={DT_CLASS}>전형</dt>
          <dd className={DD_CLASS}>{ADMISSION.trackFull}</dd>
        </div>
        <div className={`${CELL_CLASS} ${CELL_LINE_CLASS} flex-[1_1_180px]`}>
          <dt className={DT_CLASS}>모집 단위</dt>
          <dd className={DD_CLASS}>
            {ADMISSION.unit} <span className={EXTRA_CLASS}>{ADMISSION.unitExtra}</span>
          </dd>
        </div>
        <div className={`${CELL_CLASS} ${CELL_LINE_CLASS} flex-[1_1_180px]`}>
          <dt className={DT_CLASS}>모집 인원</dt>
          <dd className={DD_CLASS}>
            <span className="tabular-nums">{ADMISSION.quota}</span>{" "}
            <span className={EXTRA_CLASS}>{ADMISSION.quotaTotalText}</span>
          </dd>
        </div>
        <div className={`${CELL_CLASS} ${CELL_LINE_CLASS} flex-[1.4_1_240px]`}>
          <dt className={DT_CLASS}>평가 방식</dt>
          <dd className={DD_CLASS}>
            {ADMISSION.methodMain} <span className="tabular-nums">{ADMISSION.methodPercent}</span>{" "}
            <span className={EXTRA_CLASS}>{ADMISSION.methodExtra}</span>
          </dd>
        </div>
      </dl>

      <nav aria-label="전형 준비 단계" className="mt-[16px] flex flex-wrap gap-x-[24px] gap-y-0 border-b border-b-[#E4E4E4]">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={tab.current ? "page" : undefined}
            className={`motion-colors relative -mb-px scroll-m-[8px] border-b-2 border-b-transparent px-[2px] py-[10px] text-[14px] leading-[20px] no-underline ${
              tab.current ? "font-semibold text-[#001AD0]" : "font-medium text-[#505050] hover-on:text-[#111111]"
            }`}
          >
            {tab.label}
            {tab.current && (
              <ViewTransition name="prep-tab-line" share="tab-line" default="none">
                <span aria-hidden="true" className="absolute inset-x-0 -bottom-[2px] h-[2px] bg-[#001AD0]" />
              </ViewTransition>
            )}
          </Link>
        ))}
      </nav>
    </>
  );
}

/** 전형 요약의 칸 하나 (안쪽 여백 14px 20px). 둘째 칸부터는 왼쪽에 선이 있다. */
const CELL_CLASS = "box-border px-[20px] py-[14px]";
const CELL_LINE_CLASS = "border-l border-l-[#E4E4E4]";
const DT_CLASS = "text-[13px] leading-[18px] font-medium text-[#767676]";
const DD_CLASS = "mt-[4px] text-[15px] leading-[22px] font-semibold";
/** 값 뒤에 덧붙이는 작은 글 ("외 45개", "전형 전체 412명" 등) */
const EXTRA_CLASS = "text-[13px] font-medium text-[#505050]";
