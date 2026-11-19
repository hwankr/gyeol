import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { PREP_PATH, PREP_TABS } from "@/lib/consoleMenu";
import { formatSeoulToday } from "@/lib/koreanTime";
import { revealVertically } from "@/lib/prep/reveal";

/** 전형 준비 머리의 탭 줄(components/PrepHeader.tsx 의 <nav aria-label>) */
const PREP_TABS_LABEL = "전형 준비 단계";

/**
 * 탭 본문 안의 링크(link)로 같은 브라우저 탭에서 전형 준비의 다른 탭(href)으로 실제로 이동할 때 부른다(next/link 의 onNavigate:
 * 보조 키·가운데 버튼·기본 동작이 막힌 누름에서는 불리지 않는다). 그 링크는 탭 본문 안에 있어 이동하면 본문과 함께 숨겨지므로,
 * 링크에 초점이 있었으면(키보드로 눌렀거나 누르면서 초점이 간 경우) 초점이 body 로 빠지지 않게 이동하기 전에 머리의 같은 주소
 * 탭 링크(이동한 뒤 지금 탭이 된다. 숨겨지지 않는다)로 옮긴다. 새 탭으로 여는 누름에서는 원래 탭의 초점·스크롤을 건드리지 않는다.
 * 모집요강 올리기의 초안 안내 링크(hooks/useGuidelineUpload.ts)와 기준 변경 기록의 빈 목록 링크(hooks/usePrepHistory.ts)가 쓴다.
 */
export function handOverFocusToPrepTab(link: HTMLAnchorElement | null, href: string): void {
  if (link === null || document.activeElement !== link) return;
  const tabLink = document.querySelector<HTMLAnchorElement>(`nav[aria-label="${PREP_TABS_LABEL}"] a[href="${href}"]`);
  if (tabLink === null) return;
  // 탭 링크가 (초점 표시까지) 가려져 있으면 보일 만큼만 세로로 스크롤한다. 그러면 탭 바로 아래에서 시작하는 새 화면의 윗변도
  // 화면 안이라 Next.js 가 이동 뒤에 새 화면 쪽으로 다시 스크롤하지 않아 초점이 간 탭이 보인 채로 남는다.
  tabLink.focus({ preventScroll: true });
  revealVertically(tabLink);
}

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
