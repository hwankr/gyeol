// 새 화면 껍데기(사이드바)의 주 메뉴와 전형 준비 화면의 탭. 아이콘은 화면 컴포넌트(components/ConsoleShell.tsx)가 그린다.

/** 주 메뉴 하나. href 가 null 이면 갈 곳이 없는 메뉴다(화면이 없음). */
export type ConsoleMenu = {
  key: "home" | "prep" | "applicants" | "evaluate" | "decision" | "settings";
  label: string;
  href: string | null;
};

/** 지원자 관리 화면의 주소 (주 메뉴, 현재 위치 줄의 "지원자 관리") */
export const APPLICANTS_PATH = "/applicants";

// 평가하기는 지금의 업로드 화면으로 간다.
export const CONSOLE_MENUS: readonly ConsoleMenu[] = [
  { key: "home", label: "홈", href: null },
  { key: "prep", label: "전형 준비", href: "/prep" },
  { key: "applicants", label: "지원자 관리", href: APPLICANTS_PATH },
  { key: "evaluate", label: "평가하기", href: "/upload" },
  { key: "decision", label: "선발 결정", href: null },
  { key: "settings", label: "이력·설정", href: null },
];

/** 주소가 이 메뉴 아래인지 (메뉴 주소와 같거나 "메뉴 주소/" 로 시작) */
export function isMenuActive(menu: ConsoleMenu, pathname: string): boolean {
  return menu.href !== null && (pathname === menu.href || pathname.startsWith(`${menu.href}/`));
}

/** 로그아웃이 가는 곳: 로그인 화면. 로그인이 모양뿐이라 로그아웃도 이동만 한다(저장된 값은 지우지 않는다). */
export const LOGOUT_PATH = "/";

/** 전형 준비 화면의 탭 하나: 주소, 탭 이름, 현재 위치 줄의 마지막 이름 */
export type PrepTab = {
  href: string;
  label: string;
  crumb: string;
};

export const PREP_TABS: readonly PrepTab[] = [
  { href: "/prep", label: "모집요강 올리기", crumb: "모집요강" },
  { href: "/prep/weights", label: "평가 · 배점 설정", crumb: "평가·배점" },
  { href: "/prep/history", label: "기준 변경 기록", crumb: "변경 기록" },
];

/** 전형 준비 화면의 첫 주소 (현재 위치 줄의 "전형 준비") */
export const PREP_PATH = "/prep";
