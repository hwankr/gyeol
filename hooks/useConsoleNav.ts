import { usePathname } from "next/navigation";
import { CONSOLE_MENUS, LOGOUT_PATH, isMenuActive } from "@/lib/consoleMenu";

/** 새 화면 껍데기 상태: 주 메뉴와 지금 주소에 맞는 선택 메뉴, 로그아웃이 가는 곳. */
export function useConsoleNav() {
  const pathname = usePathname();
  return {
    menus: CONSOLE_MENUS.map((menu) => ({ ...menu, active: isMenuActive(menu, pathname) })),
    logoutPath: LOGOUT_PATH,
  };
}
