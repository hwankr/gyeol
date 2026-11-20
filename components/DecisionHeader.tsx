import Link from "next/link";
import { ViewTransition } from "react";
import { ConsoleCrumbs, ConsoleTitle, type ConsoleCrumb } from "@/components/consoleUi";

type DecisionHeaderProps = {
  crumbs: readonly ConsoleCrumb[];
  /** 제목 옆의 글: 전형 · 모집 단위 · 모집 인원 · 평가 완료 수 */
  note: string;
  /** 탭 줄. badge 는 이름 옆의 작은 표시(고른 사람 수, 조정 건수, 확정 완료) */
  tabs: {
    key: string;
    href: string;
    label: string;
    current: boolean;
    badge: { text: string; label: string; alert: boolean } | null;
  }[];
};

const TAB_CLASS = "relative -mb-px inline-flex items-baseline gap-[6px] border-b-2 border-b-transparent px-[2px] py-[10px] text-[14px] leading-[20px] no-underline";

/**
 * 선발 결정 화면의 공통 머리: 현재 위치 줄, 제목 줄, 탭 줄. 탭 줄의 모양과 움직임은 전형 준비의 탭 줄과 같다(components/PrepHeader.tsx):
 * 지금 탭은 파란 글자에 파란 밑줄(2px)이고, 탭을 옮기면 밑줄이 전의 탭에서 지금 탭으로 미끄러져 간다(app/globals.css 의 tab-line).
 * 탭 넷(인재상 적합 추천, 지원자 비교, 위원 의견 모아보기, 기록 확정)은 모두 보통 링크(next/link)다.
 * 이름 옆의 표시: `지원자 비교` 옆은 고른 지원자 수, `위원 의견 모아보기` 옆은 조정이 필요한 건수(빨간 글자. 여기까지 시안의 것),
 * `기록 확정` 옆은 기록을 확정했을 때의 `완료`.
 */
export function DecisionHeader({ crumbs, note, tabs }: DecisionHeaderProps) {
  return (
    <>
      <ConsoleCrumbs items={crumbs} />
      <ConsoleTitle title="선발 결정" note={note} />
      <nav aria-label="선발 결정 단계" className="mt-[16px] flex flex-wrap gap-x-[24px] gap-y-0 border-b border-b-[#E4E4E4]">
        {tabs.map((tab) => {
          const badge = tab.badge !== null && (
            <span className={`text-[12px] leading-[16px] font-semibold tabular-nums ${tab.badge.alert ? "text-[#BA1A1A]" : "text-[#001AD0]"}`}>
              <span aria-hidden="true">{tab.badge.text}</span>
              <span className="sr-only">{tab.badge.label}</span>
            </span>
          );
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={tab.current ? "page" : undefined}
              className={`${TAB_CLASS} motion-colors scroll-m-[8px] ${
                tab.current ? "font-semibold text-[#001AD0]" : "font-medium text-[#505050] hover-on:text-[#111111]"
              }`}
            >
              {tab.label}
              {badge}
              {tab.current && (
                <ViewTransition name="decision-tab-line" share="tab-line" default="none">
                  <span aria-hidden="true" className="absolute inset-x-0 -bottom-[2px] h-[2px] bg-[#001AD0]" />
                </ViewTransition>
              )}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
