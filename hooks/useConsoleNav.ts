import { usePathname } from "next/navigation";
import { useState } from "react";
import { CONSOLE_MENUS, LOGOUT_PATH, isMenuActive } from "@/lib/consoleMenu";

/**
 * 사이드바가 열려 있는지.
 * - initial: 처음 그대로 열려 있다(한 번도 닫지 않음).
 * - closed: 닫혀 있다.
 * - reopened: 닫았다가 다시 열었다. 열리는 움직임은 이때에만 건다(처음 그릴 때에는 움직이지 않게).
 */
export type ConsoleSidebarState = "initial" | "closed" | "reopened";

/**
 * 새 화면 껍데기 상태: 주 메뉴와 지금 주소에 맞는 선택 메뉴, 로그아웃이 가는 곳, 사이드바를 열고 닫기.
 * 사이드바 상태는 껍데기가 화면에 있는 동안만 남는다(콘솔 안에서 화면을 옮겨도 그대로이고, 새로고침하거나 로그인 화면에 다녀오면 다시 열려 있다).
 */
export function useConsoleNav() {
  const pathname = usePathname();
  const [sidebarState, setSidebarState] = useState<ConsoleSidebarState>("initial");
  return {
    menus: CONSOLE_MENUS.map((menu) => ({ ...menu, active: isMenuActive(menu, pathname) })),
    logoutPath: LOGOUT_PATH,
    sidebar: {
      state: sidebarState,
      onToggle: () => setSidebarState((state) => (state === "closed" ? "reopened" : "closed")),
    },
  };
}
