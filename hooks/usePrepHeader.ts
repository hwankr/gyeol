import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { PREP_PATH, PREP_TABS } from "@/lib/consoleMenu";
import { formatSeoulToday } from "@/lib/koreanTime";

// 오늘 날짜는 브라우저에서 화면이 뜬 뒤에 채운다. 서버 렌더링과 hydration 중에는 null(날짜 없음)로 그려서
// 사전 렌더링 결과에 날짜가 굳지 않고, 서버 HTML 과 첫 클라이언트 렌더링이 같아 hydration 경고가 나지 않는다.
// 화면을 열었을 때(다시 그릴 때)의 날짜이고, 자정에 저절로 바뀌지는 않는다(바뀜을 알리는 구독이 없다).
function subscribeNothing(): () => void {
  return () => {};
}

function getToday(): string {
  return formatSeoulToday(new Date());
}

function getServerToday(): null {
  return null;
}

/** 전형 준비 화면의 공통 머리 상태: 지금 탭(주소로 정함), 현재 위치 줄의 마지막 이름, 오늘 날짜(한국 시간). */
export function usePrepHeader() {
  const pathname = usePathname();
  const current = PREP_TABS.find((tab) => tab.href === pathname) ?? PREP_TABS[0];
  const today = useSyncExternalStore(subscribeNothing, getToday, getServerToday);
  return {
    prepPath: PREP_PATH,
    crumb: current.crumb,
    today,
    tabs: PREP_TABS.map((tab) => ({ href: tab.href, label: tab.label, current: tab.href === current.href })),
  };
}
