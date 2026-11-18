"use client";

import type { ReactNode } from "react";
import { ConsoleShell } from "@/components/ConsoleShell";
import { useConsoleNav } from "@/hooks/useConsoleNav";

/**
 * 새 화면(전형 준비, 그리고 T2 의 지원자 관리) 묶음의 껍데기: 사이드바와 상단 바(useConsoleNav → ConsoleShell).
 * 라우트 그룹이라 주소에는 나타나지 않는다. 업로드·결과 화면의 데스크톱 전용 껍데기(app/(workspace)/layout.tsx)와 달리
 * 화면 폭에 맞춰 늘고 줄며 최소 폭 제한이 없다.
 */
export default function ConsoleLayout({ children }: Readonly<{ children: ReactNode }>) {
  const nav = useConsoleNav();
  return <ConsoleShell {...nav}>{children}</ConsoleShell>;
}
