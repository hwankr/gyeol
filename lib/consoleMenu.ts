// 새 화면 껍데기(사이드바)의 주 메뉴와 전형 준비·선발 결정 화면의 탭. 아이콘은 화면 컴포넌트(components/ConsoleShell.tsx)가 그린다.

/** 주 메뉴 하나. href 가 null 이면 갈 곳이 없는 메뉴다(화면이 없음). */
export type ConsoleMenu = {
  key: "home" | "prep" | "applicants" | "evaluate" | "decision" | "settings";
  label: string;
  href: string | null;
};

/** 지원자 관리 화면의 주소 (주 메뉴, 현재 위치 줄의 "지원자 관리") */
export const APPLICANTS_PATH = "/applicants";

/** 지원자 관리 · 학생부 올리기 화면의 주소 */
export const APPLICANTS_UPLOAD_PATH = "/applicants/upload";

/** 지원자 관리 · 원문보기 화면의 주소 (그 지원자의 학생부 원문과 기준별 근거) */
export function applicantOriginalPath(code: string): string {
  return `/applicants/original?code=${encodeURIComponent(code)}`;
}

/** 평가하기 화면의 첫 주소: 평가 대기 목록 (주 메뉴, 현재 위치 줄의 "평가하기") */
export const EVALUATE_PATH = "/evaluate";

/** 선발 결정 화면의 첫 주소: 인재상 적합 추천 탭 (주 메뉴, 현재 위치 줄의 "선발 결정") */
export const DECISION_PATH = "/decision";

/** 선발 결정 · 지원자 비교 탭의 주소 */
export const DECISION_COMPARE_PATH = "/decision/compare";

/** 선발 결정 · 위원 의견 모아보기 탭의 주소 */
export const DECISION_OPINIONS_PATH = "/decision/opinions";

export const CONSOLE_MENUS: readonly ConsoleMenu[] = [
  { key: "home", label: "홈", href: null },
  { key: "prep", label: "전형 준비", href: "/prep" },
  { key: "applicants", label: "지원자 관리", href: APPLICANTS_PATH },
  { key: "evaluate", label: "평가하기", href: EVALUATE_PATH },
  { key: "decision", label: "선발 결정", href: DECISION_PATH },
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
  { href: "/prep", label: "모집요강 올리기", crumb: "모집요강 올리기" },
  { href: "/prep/consensus", label: "공통 기준 협의", crumb: "공통 기준 협의" },
  { href: "/prep/weights", label: "평가 · 배점 설정", crumb: "평가 · 배점 설정" },
  { href: "/prep/history", label: "기준 변경 기록", crumb: "기준 변경 기록" },
];

/** 전형 준비 화면의 첫 주소 (현재 위치 줄의 "전형 준비") */
export const PREP_PATH = "/prep";

/** 선발 결정 화면의 탭 하나. href 가 null 이면 화면이 없는 탭이다(탭 줄에 이름만 있고 눌리지 않는다). */
export type DecisionTab = {
  key: "recommend" | "compare" | "opinions" | "confirm";
  href: string | null;
  /** 탭 이름이자 현재 위치 줄의 마지막 이름 */
  label: string;
};

export const DECISION_TABS: readonly DecisionTab[] = [
  { key: "recommend", href: DECISION_PATH, label: "인재상 적합 추천" },
  { key: "compare", href: DECISION_COMPARE_PATH, label: "지원자 비교" },
  { key: "opinions", href: DECISION_OPINIONS_PATH, label: "위원 의견 모아보기" },
  { key: "confirm", href: null, label: "최종 확정" },
];
