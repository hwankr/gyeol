import Link from "next/link";
import type { ReactNode } from "react";
import { consoleMulish, consolePretendard } from "@/components/consoleFonts";
import { ADMISSION } from "@/lib/admission";
import type { ConsoleMenu } from "@/lib/consoleMenu";

type ConsoleShellProps = {
  /** 주 메뉴. active 는 지금 주소가 그 메뉴 아래인지 */
  menus: (ConsoleMenu & { active: boolean })[];
  /** 로그아웃이 가는 주소 */
  logoutPath: string;
  /** 상단 바 아래에 그릴 화면 내용 */
  children: ReactNode;
};

/**
 * 새 화면(전형 준비 등)의 껍데기: 왼쪽 사이드바와 본문(<main>)의 첫 줄인 검색·계정 줄.
 * 치수·색·글자는 디자인 값 그대로다. 바깥 상자는 화면 높이 이상이고 줄을 바꿔(flex-wrap) 좁은 화면에서는 본문이 사이드바 아래로 내려간다.
 * 최소 폭 제한은 없고 내용이 길면 문서가 세로로 스크롤된다.
 * 줄 높이는 디자인(브라우저 기본 normal)에 맞춰 바깥 상자에서 normal 로 되돌린다.
 * 다른 주소로 가는 것은 모두 보통 링크(next/link)라서 화면의 JavaScript 가 준비되기 전에 눌러도 그 주소의 문서로 이동한다.
 */
export function ConsoleShell({ menus, logoutPath, children }: ConsoleShellProps) {
  return (
    <div
      className={`${consolePretendard.className} box-border flex min-h-screen flex-wrap bg-[#F3F3F3] leading-[normal] text-[#111111]`}
    >
      <div className="box-border flex flex-[1_0_258px] flex-col rounded-[10px] bg-white pt-[41px] pb-[33px] text-[#000947]">
        <div className="ml-[43px] flex items-center gap-[0.33em] text-[25.6px] leading-none text-[#001AD0]">
          <svg aria-hidden="true" viewBox="0 0 107 147" className="h-[0.96em] w-[0.7em] flex-none">
            <path fill="#001AD0" d="M0 0A53.5 53.5 0 0 0 107 0L91 0Q85.5 0 85.1 5A32 32 0 0 1 21.9 5Q21.5 0 16 0Z" />
            <path
              fill="#001AD0"
              d="M0 46.75A53.5 53.5 0 0 0 107 46.75L91 46.75Q85.5 46.75 85.1 51.75A32 32 0 0 1 21.9 51.75Q21.5 46.75 16 46.75Z"
            />
            <path
              fill="#001AD0"
              d="M0 93.5A53.5 53.5 0 0 0 107 93.5L91 93.5Q85.5 93.5 85.1 98.5A32 32 0 0 1 21.9 98.5Q21.5 93.5 16 93.5Z"
            />
          </svg>
          {/* 글자를 무늬와 눈으로 가운데가 맞게 조금 올린다(디자인 값). */}
          <span className={`${consoleMulish.className} relative -top-[0.123em] font-medium tracking-[-0.01em]`}>
            Gyeol
          </span>
        </div>
        <p className="mt-[26px] ml-[43px] text-[16px] leading-[20px] font-bold">{ADMISSION.university}</p>
        <p className="ml-[43px] text-[14px] leading-[18px] font-normal">{ADMISSION.systemName}</p>
        {/* 전형이 하나뿐이라 기능이 없는 컨트롤이다(눌리지 않음). 모양은 디자인 그대로다. */}
        <button
          type="button"
          aria-haspopup="listbox"
          disabled
          className={`${BUTTON_DEFAULT_FONT} relative mt-[28px] mr-[25px] ml-[43px] cursor-default rounded-[8px] border-0 bg-[#F4F4F4] pt-[10px] pr-[40px] pb-[10px] pl-[16px] text-left font-normal text-[#000947]`}
        >
          <span className="block text-[13px] leading-[16px] font-semibold text-[#485A83]">전형 선택</span>
          <span className="mt-[7px] block text-[16px] leading-[20px] font-bold">{ADMISSION.trackShort}</span>
          <svg aria-hidden="true" viewBox="0 0 14 9" className="absolute top-[39px] right-[13px] h-[9px] w-[14px]">
            <path
              fill="none"
              stroke="#000947"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M1 1.5l6 6 6-6"
            />
          </svg>
        </button>
        <nav aria-label="주 메뉴" className="mt-[39px] flex flex-col gap-[10px]">
          {menus.map((menu) => (
            <MenuLink key={menu.key} menu={menu} />
          ))}
        </nav>
        <Link
          href={logoutPath}
          className="mt-auto mr-[33px] ml-auto pt-[24px] text-[12px] leading-[16px] font-medium text-[#505050] underline"
        >
          로그아웃
        </Link>
      </div>
      <main className="box-border min-w-0 flex-[999_1_560px] pt-[35px] pr-[clamp(16px,3.9vw,56px)] pb-[23px] pl-[clamp(20px,5.4vw,78px)]">
        <TopBar />
        {children}
      </main>
    </div>
  );
}

/**
 * 글자가 없는 버튼(아이콘 버튼 등)의 글자 크기. 디자인은 이 버튼들에 글꼴을 정하지 않아 브라우저 기본 버튼 글자(13.333px)가 쓰였다.
 * 보이는 모양에는 영향이 없지만 계산된 값을 디자인과 맞춘다.
 */
const BUTTON_DEFAULT_FONT = "text-[13.3333px]";

const MENU_LINK_CLASS = "flex h-[76px] items-center gap-[20px] ml-[18px] pl-[25px] text-[20px] tracking-[-0.02em] no-underline";

/** 주 메뉴 하나. 선택된 메뉴는 왼쪽이 둥근 회색 띠와 위아래 오목한 모서리 조각, 파란 글자·아이콘(굵기 800)이다. */
function MenuLink({ menu }: { menu: ConsoleMenu & { active: boolean } }) {
  const color = menu.active ? "#001AD0" : "#000947";
  const content = (
    <>
      {menu.active && (
        <>
          <span
            aria-hidden="true"
            className="absolute -top-[12px] right-0 h-[12px] w-[12px] bg-[radial-gradient(circle_at_0_0,#FFFFFF_11.5px,#F3F3F3_12px)]"
          />
          <span
            aria-hidden="true"
            className="absolute right-0 -bottom-[12px] h-[12px] w-[12px] bg-[radial-gradient(circle_at_0_100%,#FFFFFF_11.5px,#F3F3F3_12px)]"
          />
        </>
      )}
      <MenuIcon menuKey={menu.key} color={color} />
      <span>{menu.label}</span>
    </>
  );

  // 갈 곳이 없는 메뉴: href 없는 <a> 라서 초점을 받지 않고 눌러도 아무 일도 없다.
  if (menu.href === null) {
    return (
      <a aria-disabled="true" className={`${MENU_LINK_CLASS} cursor-default font-bold text-[#000947]`}>
        {content}
      </a>
    );
  }
  return (
    <Link
      href={menu.href}
      aria-current={menu.active ? "page" : undefined}
      className={
        menu.active
          ? `${MENU_LINK_CLASS} relative rounded-[12px_0_0_12px] bg-[#F3F3F3] font-extrabold text-[#001AD0]`
          : `${MENU_LINK_CLASS} font-bold text-[#000947]`
      }
    >
      {content}
    </Link>
  );
}

/** 메뉴 아이콘 (디자인의 SVG 그대로). 색은 선택 여부에 따라 바뀐다. */
function MenuIcon({ menuKey, color }: { menuKey: ConsoleMenu["key"]; color: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[24px] w-[24px] flex-none"
    >
      {MENU_ICON_PATHS[menuKey]}
    </svg>
  );
}

const MENU_ICON_PATHS: Record<ConsoleMenu["key"], ReactNode> = {
  home: (
    <>
      <path d="M4.5 10.2 12 4l7.5 6.2v8.3A1.5 1.5 0 0 1 18 20H6a1.5 1.5 0 0 1-1.5-1.5z" />
      <path d="M9.8 20v-5a1 1 0 0 1 1-1h2.4a1 1 0 0 1 1 1v5" />
    </>
  ),
  prep: (
    <>
      <path d="M9.5 6.5H20M9.5 12H20M9.5 17.5H20" />
      <path strokeWidth="2.4" d="M4.3 6.5h.01M4.3 12h.01" />
      <path d="M3 17.6l1.3 1.3 2.3-2.5" />
    </>
  ),
  applicants: (
    <>
      <circle cx="12" cy="8.5" r="3" />
      <path d="M6.8 18.5v-1a5.2 5.2 0 0 1 10.4 0v1" />
      <circle cx="4.6" cy="10.8" r="1.8" />
      <path d="M1.6 18v-.6a3 3 0 0 1 4-2.8" />
      <circle cx="19.4" cy="10.8" r="1.8" />
      <path d="M22.4 18v-.6a3 3 0 0 0-4-2.8" />
    </>
  ),
  evaluate: (
    <>
      <path d="M9 5H7.5a2 2 0 0 0-2 2v11.5a2 2 0 0 0 2 2H12" />
      <path d="M15 5h1.5a2 2 0 0 1 2 2v5.5" />
      <path d="M9 6V5a1 1 0 0 1 1-1h.3a1.8 1.8 0 0 1 3.4 0h.3a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1z" />
      <path d="M14.5 18.5l2 2 4-4.5" />
    </>
  ),
  decision: (
    <>
      <path d="M9 13.5h6V21H9zM3.5 16.5H9V21H3.5zM15 16.5h5.5V21H15z" />
      <path d="M12 3l1.1 2.3 2.5.3-1.8 1.8.4 2.5L12 8.7 9.8 9.9l.4-2.5-1.8-1.8 2.5-.3z" />
    </>
  ),
  settings: (
    <>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      <path d="M3.5 3.5l3 .8 2.2 2.2-1.9 1.9-2.2-2.2z" />
      <path d="M15.5 15.5l4.8 4.8" />
    </>
  ),
};

/** 본문 첫 줄: 검색 입력란, 소속·사정관, 프로필 그림, 내보내기·알림 버튼. 검색·내보내기·알림은 기능이 없는 컨트롤이다(눌리지 않음). */
function TopBar() {
  return (
    <div className="-ml-[19px] flex flex-wrap items-center justify-between gap-x-[24px] gap-y-[12px]">
      <label className="box-border flex h-[40px] min-w-[200px] flex-[0_1_603px] items-center gap-[10px] rounded-[20px] bg-white pr-[20px] pl-[22px]">
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          stroke="#131927"
          strokeWidth="1.6"
          strokeLinecap="round"
          className="h-[20px] w-[20px] flex-none"
        >
          <circle cx="8.8" cy="8.8" r="6.3" />
          <path d="M13.5 13.5 18 18" />
        </svg>
        {/* 안쪽 여백(1px 2px)은 디자인이 정하지 않아 브라우저 기본값이 쓰인 것을 그대로 맞춘다. */}
        <input
          type="search"
          aria-label="검색"
          disabled
          className="min-w-0 flex-[1_1_auto] cursor-default border-0 bg-transparent px-[2px] py-px text-[15px] text-[#111111]"
        />
      </label>
      <div className="flex items-center">
        <div className="mr-[22px] text-right text-[#333333]">
          <div className="text-[12px] leading-[17px] font-semibold">{ADMISSION.office}</div>
          <div className="text-[12px] leading-[20px] font-semibold">
            <span className="text-[14px] font-extrabold">{ADMISSION.reviewerName}</span> {ADMISSION.reviewerRole}
          </div>
        </div>
        <svg
          role="img"
          aria-label={`${ADMISSION.reviewerName} ${ADMISSION.reviewerRole} 프로필`}
          viewBox="0 0 40 40"
          className="h-[40px] w-[40px] flex-none rounded-[50%]"
        >
          <rect width="40" height="40" fill="#000947" />
          <circle cx="20" cy="36" r="12.5" fill="#FFFFFF" />
          <path fill="#FFFFFF" d="M14.5 16.5c0-4.5 3-7 10.5-7 0 7.5-2.5 11-7 11-2 0-3.5-1.5-3.5-4z" />
        </svg>
        <button
          type="button"
          aria-label="내보내기"
          disabled
          className={`${BUTTON_DEFAULT_FONT} ml-[18px] flex h-[40px] w-[40px] flex-none cursor-default items-center justify-center rounded-[50%] border-0 bg-white p-0 font-normal text-black`}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 18 20"
            fill="none"
            stroke="#000947"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-[20px] w-[18px]"
          >
            <path d="M9 13V2M4.8 6 9 1.8 13.2 6M1.5 11.5V18h15v-6.5" />
          </svg>
        </button>
        <button
          type="button"
          aria-label="알림"
          disabled
          className={`${BUTTON_DEFAULT_FONT} ml-[18px] flex h-[40px] w-[40px] flex-none cursor-default items-center justify-center rounded-[50%] border-0 bg-white p-0 font-normal text-black`}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 22"
            fill="none"
            stroke="#000947"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-[22px] w-[20px]"
          >
            <path d="M10 2.2a6 6 0 0 0-6 6v4.3l-1.6 3.4h15.2L16 12.5V8.2a6 6 0 0 0-6-6z" />
            <path d="M8.3 19.2a1.8 1.8 0 0 0 3.4 0" />
          </svg>
        </button>
      </div>
    </div>
  );
}
