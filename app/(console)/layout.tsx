"use client";

import type { ReactNode } from "react";
import { ConsoleShell } from "@/components/ConsoleShell";
import { useConsoleNav } from "@/hooks/useConsoleNav";
import { ConsoleSearchContext, useConsoleSearchState } from "@/hooks/useConsoleSearch";

/**
 * 새 화면(전형 준비, 지원자 관리) 묶음의 껍데기: 사이드바와 상단 바(useConsoleNav → ConsoleShell).
 * 라우트 그룹이라 주소에는 나타나지 않는다. 업로드·결과 화면의 데스크톱 전용 껍데기(app/(workspace)/layout.tsx)와 달리
 * 화면 폭에 맞춰 늘고 줄며 최소 폭 제한이 없다.
 * 상단 바의 검색 입력란은 지원자 관리 화면에서만 동작한다. 입력란은 기본이 꺼진(disabled) 상태이고, 입력란·입력 이벤트를 받을 곳(ref)과
 * 입력란을 켜고 끄는 함수를 context 로 지원자 관리 화면에 건넨다. 그 화면이 준비되면 켜고 숨겨지면 비우고 끈다. 검색어 상태도 그 화면이 갖는다
 * (hooks/useConsoleSearch.ts).
 * 본문(<main>) 아래 안쪽 여백은 디자인대로 지원자 관리 화면만 0 이다(전형 준비는 23px).
 */
export default function ConsoleLayout({ children }: Readonly<{ children: ReactNode }>) {
  const nav = useConsoleNav();
  /** 지금 주소가 지원자 관리 화면인지 (주 메뉴의 "지원자 관리" 가 선택된 모양인지와 같다) */
  const onApplicants = nav.menus.some((menu) => menu.key === "applicants" && menu.active);
  const search = useConsoleSearchState();
  return (
    <ConsoleSearchContext value={search.context}>
      <ConsoleShell {...nav} search={search.input} searchInputRef={search.inputRef} flushBottom={onApplicants}>
        {children}
      </ConsoleShell>
    </ConsoleSearchContext>
  );
}
