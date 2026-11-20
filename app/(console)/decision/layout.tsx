"use client";

import type { ReactNode } from "react";
import { DecisionHeader } from "@/components/DecisionHeader";
import { PageTransition } from "@/components/PageTransition";
import { useDecisionHeader } from "@/hooks/useDecisionHeader";

/**
 * 선발 결정 화면 네 탭(/decision, /decision/compare, /decision/opinions, /decision/confirm)의 공통 머리: 현재 위치·제목·탭 줄(useDecisionHeader → DecisionHeader).
 * 머리도 화면 전환에 참여한다(전형 준비와 같다): 선발 결정으로 들어오거나 나갈 때 탭 본문과 함께 나타나고 사라지고,
 * 탭 사이를 오갈 때는 머리가 남아 있어 움직이지 않고 탭 본문만 바뀐다.
 */
export default function DecisionLayout({ children }: Readonly<{ children: ReactNode }>) {
  const header = useDecisionHeader();
  return (
    <>
      <PageTransition>
        <DecisionHeader {...header} />
      </PageTransition>
      {children}
    </>
  );
}
