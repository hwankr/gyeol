import Link from "next/link";
import type { ReactNode, Ref } from "react";
import { consolePretendard } from "@/components/consoleFonts";
import { GyeolLogo } from "@/components/GyeolLogo";
import { ADMISSION } from "@/lib/admission";
import type { ConsoleMenu } from "@/lib/consoleMenu";

type ConsoleShellProps = {
  /** 주 메뉴. active 는 지금 주소가 그 메뉴 아래인지 */
  menus: (ConsoleMenu & { active: boolean })[];
  /** 로그아웃이 가는 주소 */
  logoutPath: string;
  /** 상단 바의 검색 입력란. enabled 가 false 인 동안은 기능이 없는 컨트롤(disabled)이다. */
  search: SearchInputProps;
  /** 검색 입력란 (검색을 쓰는 화면을 나갈 때 그 화면이 실제 값을 비운다) */
  searchInputRef: Ref<HTMLInputElement>;
  /** 상단 바 아래 본문(<main>)에 그릴 화면 내용 */
  children: ReactNode;
};

type SearchInputProps = {
  /** 검색이 동작하는지. 검색을 쓰는 화면(지원자 관리, 평가 대기 목록)이 준비돼 보이는 동안만 true 다(서버 HTML·hydration 때와 그 밖의 화면에서는 false). */
  enabled: boolean;
  /** 입력란의 안내 글자(placeholder)이자 이름(aria-label). 검색을 쓰는 화면이 정하고, 그 밖에는 "검색" 이다. */
  label: string;
  /** 글을 칠 때마다 (지우기 표시를 눌렀을 때 포함). 입력란의 지금 값 전체를 넘긴다. */
  onChange: (value: string) => void;
};

/**
 * 새 화면(전형 준비, 지원자 관리, 평가하기)의 껍데기: 왼쪽 사이드바, 오른쪽 위의 상단 바(검색·계정), 그 아래 본문(<main>).
 * 치수·색·글자는 디자인 값 그대로다. 바깥 상자는 화면 높이 이상이고 줄을 바꿔(flex-wrap) 좁은 화면에서는 오른쪽 단이 사이드바 아래로 내려간다.
 * 최소 폭 제한은 없고 내용이 길면 문서가 세로로 스크롤된다. 본문은 세로로 쌓는 flex 상자라 화면의 마지막 상자가 남는 높이를 채울 수 있다.
 * 다른 주소로 가는 것은 모두 보통 링크(next/link)라서 화면의 JavaScript 가 준비되기 전에 눌러도 그 주소의 문서로 이동한다.
 */
export function ConsoleShell({ menus, logoutPath, search, searchInputRef, children }: ConsoleShellProps) {
  return (
    <div
      className={`${consolePretendard.className} box-border flex min-h-screen flex-wrap bg-white text-[14px] leading-[20px] text-[#111111]`}
    >
      <div className="box-border flex flex-[1_0_248px] flex-col border-r border-r-[#E4E4E4] px-[12px] pt-[20px] pb-[16px]">
        {/* 로고 그림 높이 19px 은 바뀌기 전 로고(22px 글자)의 대문자 높이에 맞춘 값이다. 상자 높이 22px 은 그대로라 아래 간격이 바뀌지 않는다. */}
        <div className="flex h-[22px] items-center px-[12px]">
          <GyeolLogo className="h-[19px] text-[#000947]" />
        </div>
        <div className="mt-[24px] px-[12px]">
          <p className="text-[14px] leading-[20px] font-semibold">{ADMISSION.university}</p>
          <p className="mt-[2px] text-[12px] leading-[16px] text-[#767676]">{ADMISSION.systemName}</p>
        </div>
        <div className="mt-[16px] px-[12px]">
          <span id="track-label" className="block text-[12px] leading-[16px] font-medium text-[#767676]">
            전형 선택
          </span>
          {/* 전형이 하나뿐이라 기능이 없는 컨트롤이다(눌리지 않음). 모양은 디자인 그대로다. */}
          <button
            type="button"
            aria-haspopup="listbox"
            aria-labelledby="track-label track-value"
            disabled
            className="mt-[6px] box-border flex h-[36px] w-full cursor-default items-center justify-between rounded-[6px] border border-[#CFCFCF] bg-white pr-[10px] pl-[12px] text-[14px] font-medium text-[#111111]"
          >
            <span id="track-value">{ADMISSION.trackShort}</span>
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              fill="none"
              stroke="#767676"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-[16px] w-[16px]"
            >
              <path d="M4 6l4 4 4-4" />
            </svg>
          </button>
        </div>
        <nav aria-label="주 메뉴" className="mt-[24px] flex flex-col gap-[2px]">
          {menus.map((menu) => (
            <MenuLink key={menu.key} menu={menu} />
          ))}
        </nav>
        <Link
          href={logoutPath}
          className="motion-colors mt-auto flex h-[42px] items-center rounded-[6px] px-[12px] text-[13px] font-medium text-[#767676] no-underline hover-on:bg-[#F6F7FB] hover-on:text-[#111111]"
        >
          로그아웃
        </Link>
      </div>
      <div className="flex min-w-0 flex-[999_1_560px] flex-col">
        <TopBar search={search} inputRef={searchInputRef} />
        <main className="box-border flex flex-[1_1_auto] flex-col px-[clamp(16px,2.3vw,32px)] pt-[20px] pb-[24px]">
          {children}
        </main>
      </div>
    </div>
  );
}

const MENU_LINK_CLASS = "motion-colors flex h-[42px] items-center gap-[12px] rounded-[6px] px-[12px] text-[14px] no-underline";

/**
 * 주 메뉴 하나. 선택된 메뉴는 옅은 파란 바탕에 파란 글자·아이콘(굵기 600)이고, 나머지는 회색 글자·아이콘(굵기 500)이다.
 * 갈 곳이 있는 메뉴는 마우스를 올리면 옅은 회색 바탕에 검은 글자가 되고, 선택이 옮겨 갈 때 색이 150ms 에 걸쳐 바뀐다.
 */
function MenuLink({ menu }: { menu: ConsoleMenu & { active: boolean } }) {
  const content = (
    <>
      <MenuIcon menuKey={menu.key} active={menu.active} />
      <span>{menu.label}</span>
    </>
  );

  // 갈 곳이 없는 메뉴: href 없는 <a> 라서 초점을 받지 않고 눌러도 아무 일도 없다.
  if (menu.href === null) {
    return (
      <a aria-disabled="true" className={`${MENU_LINK_CLASS} cursor-default font-medium text-[#505050]`}>
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
          ? `${MENU_LINK_CLASS} bg-[#EEF0FF] font-semibold text-[#001AD0]`
          : `${MENU_LINK_CLASS} font-medium text-[#505050] hover-on:bg-[#F6F7FB] hover-on:text-[#111111]`
      }
    >
      {content}
    </Link>
  );
}

/** 메뉴 아이콘 (디자인의 SVG 그대로). 색은 선택 여부에 따라 바뀐다(선은 글자색을 따르게 두어 색 전환이 같이 걸린다). */
function MenuIcon({ menuKey, active }: { menuKey: ConsoleMenu["key"]; active: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`motion-colors h-[20px] w-[20px] flex-none ${active ? "text-[#001AD0]" : "text-[#767676]"}`}
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

/** 상단 바의 아이콘 버튼(내보내기·알림): 36px 정사각형, 회색 테두리. 기능이 없는 컨트롤이다(눌리지 않음). */
const ICON_BUTTON_CLASS =
  "box-border flex h-[36px] w-[36px] flex-none cursor-default items-center justify-center rounded-[6px] border border-[#CFCFCF] bg-white p-0";

/**
 * 상단 바: 검색 입력란, 사정관·소속, 프로필 그림, 내보내기·알림 버튼. 아래에 선이 하나 있다. 내보내기·알림은 기능이 없는 컨트롤이다(눌리지 않음).
 * 검색 입력란은 검색을 쓰는 화면(지원자 관리, 평가 대기 목록)이 준비된 뒤에만 켜져 동작하고(글을 칠 때마다 그 화면의 걸러 보기에 반영),
 * 그 전과 그 밖의 화면에서는 기능이 없는 컨트롤(disabled)이다. 모양은 어느 쪽이든 디자인 그대로이고 안내 글자만 화면에 따라 다르다
 * (type="search" 의 브라우저 기본 지우기 표시는 그대로).
 */
function TopBar({ search, inputRef }: { search: SearchInputProps; inputRef: Ref<HTMLInputElement> }) {
  return (
    <div className="box-border flex min-h-[60px] flex-wrap items-center justify-between gap-x-[24px] gap-y-[8px] border-b border-b-[#E4E4E4] px-[clamp(16px,2.3vw,32px)] py-[10px]">
      <label className="motion-colors box-border flex h-[36px] min-w-[200px] flex-[0_1_480px] items-center gap-[8px] rounded-[6px] border border-[#CFCFCF] bg-white px-[12px] has-[input:enabled]:hover:border-[#AEAEAE]">
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          stroke="#767676"
          strokeWidth="1.6"
          strokeLinecap="round"
          className="h-[16px] w-[16px] flex-none"
        >
          <circle cx="8.8" cy="8.8" r="6.3" />
          <path d="M13.5 13.5 18 18" />
        </svg>
        {/*
          기본은 꺼져(disabled) 있고 검색을 쓰는 화면이 준비되면 켜진다(hooks/useConsoleSearch.ts). 서버 HTML 에서는 어느 주소에서나 꺼져 있다.
          React 가 값을 쥐지 않는 입력란(defaultValue)이라 사람이 적은 글자를 React 가 덮어쓰지 않는다. 값을 비우는 것은 검색을 쓰는 화면을
          나갈 때뿐이다(hooks/useApplicants.ts, hooks/useEvaluateList.ts). autoComplete="off" 는 새로고침·뒤로 가기 때 브라우저가 전에 적은
          글자를 채워 넣지 않게(돌아온 화면이 처음 상태이게) 한다.
        */}
        <input
          ref={inputRef}
          type="search"
          aria-label={search.label}
          placeholder={search.label}
          autoComplete="off"
          disabled={!search.enabled}
          defaultValue=""
          onChange={(event) => search.onChange(event.currentTarget.value)}
          className="min-w-0 flex-[1_1_auto] scroll-m-[8px] border-0 bg-transparent text-[14px] text-[#111111] placeholder:text-[#767676] disabled:cursor-default"
        />
      </label>
      <div className="flex items-center gap-[4px]">
        <div className="mr-[8px] text-right">
          <div className="text-[13px] leading-[18px] font-semibold">
            {ADMISSION.reviewerName} {ADMISSION.reviewerRole}
          </div>
          <div className="text-[12px] leading-[16px] text-[#767676]">{ADMISSION.office}</div>
        </div>
        <svg
          role="img"
          aria-label={`${ADMISSION.reviewerName} ${ADMISSION.reviewerRole} 프로필`}
          viewBox="0 0 40 40"
          className="mr-[8px] h-[32px] w-[32px] flex-none rounded-[50%]"
        >
          <rect width="40" height="40" fill="#000947" />
          <circle cx="20" cy="36" r="12.5" fill="#FFFFFF" />
          <path fill="#FFFFFF" d="M14.5 16.5c0-4.5 3-7 10.5-7 0 7.5-2.5 11-7 11-2 0-3.5-1.5-3.5-4z" />
        </svg>
        <button type="button" aria-label="내보내기" disabled className={ICON_BUTTON_CLASS}>
          <svg
            aria-hidden="true"
            viewBox="0 0 18 20"
            fill="none"
            stroke="#505050"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-[18px] w-[16px]"
          >
            <path d="M9 13V2M4.8 6 9 1.8 13.2 6M1.5 11.5V18h15v-6.5" />
          </svg>
        </button>
        <button type="button" aria-label="알림" disabled className={`${ICON_BUTTON_CLASS} ml-[4px]`}>
          <svg
            aria-hidden="true"
            viewBox="0 0 20 22"
            fill="none"
            stroke="#505050"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-[19px] w-[17px]"
          >
            <path d="M10 2.2a6 6 0 0 0-6 6v4.3l-1.6 3.4h15.2L16 12.5V8.2a6 6 0 0 0-6-6z" />
            <path d="M8.3 19.2a1.8 1.8 0 0 0 3.4 0" />
          </svg>
        </button>
      </div>
    </div>
  );
}
