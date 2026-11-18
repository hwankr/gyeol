import Link from "next/link";
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
 * 전형 준비 화면 세 탭의 공통 머리: 현재 위치 줄, 제목 줄(오늘 날짜), 전형 요약 카드, 탭 줄.
 * 치수·색·글자는 디자인 값 그대로다. 탭과 현재 위치의 "전형 준비" 는 보통 링크(next/link)다.
 */
export function PrepHeader({ prepPath, crumb, today, tabs }: PrepHeaderProps) {
  return (
    <>
      <nav aria-label="현재 위치" className="mt-[24px] border-b border-b-[#AEAEAE] pb-[8px] pl-[5px]">
        <ol className="flex flex-wrap items-center gap-x-[22px] gap-y-[4px] text-[14px] leading-[20px] font-medium tracking-[-0.02em] text-[#505050]">
          <li>
            {/* 홈 화면은 없다: href 없는 <a> 라서 초점을 받지 않고 눌러도 아무 일도 없다. */}
            <a aria-disabled="true" className="cursor-default text-[#505050] no-underline">
              홈
            </a>
          </li>
          <CrumbArrow />
          <li>
            <Link href={prepPath} className="text-[#505050] no-underline">
              전형 준비
            </Link>
          </li>
          <CrumbArrow />
          <li aria-current="page" className="font-extrabold">
            {crumb}
          </li>
        </ol>
      </nav>

      <div className="mt-[17px] flex flex-wrap items-baseline gap-x-[19px] gap-y-0">
        <h1 className="text-[28px] leading-[36px] font-extrabold tracking-[-0.02em]">전형 준비</h1>
        <p className="text-[16px] leading-[24px] font-semibold text-[#505050]">{today}</p>
      </div>

      <dl className="mt-[11px] -mr-[10px] -ml-[6px] flex flex-wrap justify-between gap-x-[24px] gap-y-[14px] rounded-[12px] bg-white pt-[22px] pr-[24px] pb-[20px] pl-[31px]">
        <div>
          <dt className={DT_CLASS}>전형</dt>
          <dd className={DD_CLASS}>{ADMISSION.trackFull}</dd>
        </div>
        <div>
          <dt className={DT_CLASS}>모집 단위</dt>
          <dd className={DD_CLASS}>
            {ADMISSION.unit}
            <span className="ml-[7px] text-[16px] text-[#767676]">{ADMISSION.unitExtra}</span>
          </dd>
        </div>
        <div>
          <dt className={DT_CLASS}>모집 인원</dt>
          <dd className={DD_CLASS}>
            <span className="text-[24px]">{ADMISSION.quota}</span> 명
            <span className="ml-[12px] text-[16px] text-[#767676]">{ADMISSION.quotaTotalText}</span>
          </dd>
        </div>
        <div>
          <dt className={DT_CLASS}>평가 방식</dt>
          <dd className={DD_CLASS}>
            {ADMISSION.methodMain} <span className="text-[24px] tracking-[-0.02em]">{ADMISSION.methodPercent}</span>
            <span className="ml-[10px] text-[16px] text-[#767676]">{ADMISSION.methodExtra}</span>
          </dd>
        </div>
      </dl>

      <nav aria-label="전형 준비 단계" className="mt-[39px] flex flex-wrap gap-x-[54px] gap-y-0 border-b border-b-[#AEAEAE]">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={tab.current ? "page" : undefined}
            className={`-mb-[2px] border-b-4 px-[6px] pb-[9px] text-[20px] leading-[28px] tracking-[-0.02em] text-[#111111] no-underline ${
              tab.current ? "border-b-[#111111] font-extrabold" : "border-b-transparent font-medium"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </>
  );
}

const DT_CLASS = "text-[16px] leading-[20px] font-semibold text-[#505050]";
const DD_CLASS = "mt-[5px] text-[20px] leading-[28px] font-extrabold";

/** 현재 위치 줄의 항목 사이 화살표 (장식) */
function CrumbArrow() {
  return (
    <li aria-hidden="true" className="flex">
      <svg viewBox="0 0 7 10" className="h-[10px] w-[7px]">
        <path
          fill="none"
          stroke="#131927"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M1.5 1l4 4-4 4"
        />
      </svg>
    </li>
  );
}
