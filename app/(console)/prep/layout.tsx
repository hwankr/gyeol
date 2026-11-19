"use client";

import type { ReactNode } from "react";
import { PrepHeader } from "@/components/PrepHeader";
import { useKeyRepeatGuard } from "@/hooks/useKeyRepeatGuard";
import { usePrepFocusKeeper } from "@/hooks/usePrepFocusKeeper";
import { usePrepHeader } from "@/hooks/usePrepHeader";

/**
 * 전형 준비 화면 세 탭(/prep, /prep/weights, /prep/history)의 공통 머리: 현재 위치·제목·전형 요약·탭 줄(usePrepHeader → PrepHeader).
 * 세 탭의 버튼에 같은 키 반복 규칙(Enter 를 누르고 있는 동안의 반복은 처음 누른 버튼에서만, hooks/useKeyRepeatGuard.ts)과
 * 초점 규칙(밀려 나가면 다시 보이게, 사라지거나 꺼지면 되돌리기, hooks/usePrepFocusKeeper.ts)을 건다.
 * 머리(현재 위치·탭 줄)는 준비 전에도 동작한다. 탭 본문은 각 탭이 준비될 때까지 inert 다(hooks/usePrepTabReady.ts).
 */
export default function PrepLayout({ children }: Readonly<{ children: ReactNode }>) {
  const header = usePrepHeader();
  useKeyRepeatGuard();
  usePrepFocusKeeper();
  return (
    <>
      <PrepHeader {...header} />
      {children}
    </>
  );
}
