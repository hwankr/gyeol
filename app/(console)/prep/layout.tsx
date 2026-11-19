"use client";

import type { ReactNode } from "react";
import { PageTransition } from "@/components/PageTransition";
import { PrepHeader } from "@/components/PrepHeader";
import { useKeyRepeatGuard } from "@/hooks/useKeyRepeatGuard";
import { usePrepFocusKeeper } from "@/hooks/usePrepFocusKeeper";
import { usePrepHeader } from "@/hooks/usePrepHeader";

/**
 * 전형 준비 화면 세 탭(/prep, /prep/weights, /prep/history)의 공통 머리: 현재 위치·제목·전형 요약·탭 줄(usePrepHeader → PrepHeader).
 * 세 탭의 버튼에 같은 키 반복 규칙(Enter 를 누르고 있는 동안의 반복은 처음 누른 버튼에서만, hooks/useKeyRepeatGuard.ts)과
 * 초점 규칙(밀려 나가면 다시 보이게, 사라지거나 꺼지면 되돌리기, hooks/usePrepFocusKeeper.ts)을 건다.
 * 머리(현재 위치·탭 줄)는 준비 전에도 동작한다. 탭 본문은 각 탭이 준비될 때까지 inert 다(hooks/usePrepTabReady.ts).
 * 머리도 화면 전환에 참여한다: 전형 준비로 들어오거나 나갈 때 탭 본문과 함께 나타나고 사라진다. 탭 사이를 오갈 때는 머리가 남아 있어
 * 움직이지 않고 탭 본문만 바뀐다.
 */
export default function PrepLayout({ children }: Readonly<{ children: ReactNode }>) {
  const header = usePrepHeader();
  useKeyRepeatGuard();
  usePrepFocusKeeper();
  return (
    <>
      <PageTransition>
        <PrepHeader {...header} />
      </PageTransition>
      {children}
    </>
  );
}
