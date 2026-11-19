"use client";

import type { ReactNode } from "react";
import { ConsoleShell } from "@/components/ConsoleShell";
import { useConsoleNav } from "@/hooks/useConsoleNav";
import { ConsoleSearchContext, useConsoleSearchState } from "@/hooks/useConsoleSearch";

/**
 * 새 화면(전형 준비, 지원자 관리, 평가하기) 묶음의 껍데기: 사이드바와 상단 바(useConsoleNav → ConsoleShell).
 * 라우트 그룹이라 주소에는 나타나지 않는다. 화면 폭에 맞춰 늘고 줄며 최소 폭 제한이 없다.
 * 상단 바의 검색 입력란은 검색을 쓰는 화면(지원자 관리, 평가 대기 목록)에서만 동작한다. 입력란은 기본이 꺼진(disabled) 상태이고,
 * 입력란·입력 이벤트를 받을 곳(ref)과 입력란을 켜고 끄는 함수를 context 로 그 화면에 건넨다. 그 화면이 준비되면 켜고 숨겨지면 비우고 끈다.
 * 검색어 상태도 그 화면이 갖는다(hooks/useConsoleSearch.ts).
 */
export default function ConsoleLayout({ children }: Readonly<{ children: ReactNode }>) {
  const nav = useConsoleNav();
  const search = useConsoleSearchState();
  return (
    <ConsoleSearchContext value={search.context}>
      <ConsoleShell {...nav} search={search.input} searchInputRef={search.inputRef}>
        {children}
      </ConsoleShell>
    </ConsoleSearchContext>
  );
}
