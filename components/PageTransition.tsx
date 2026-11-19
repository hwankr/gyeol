import { ViewTransition, type ReactNode } from "react";
import { SWAP_TRANSITION_TYPE } from "@/lib/motion";

type PageTransitionProps = {
  /**
   * 화면 전체를 덮는 덩어리(로그인 화면, 사이드바·상단 바까지 든 콘솔 껍데기)인지.
   * 그런 덩어리는 올라오지 않고, 나가는 쪽과 들어오는 쪽이 같은 시간(220ms) 동안 겹쳐 바뀐다.
   */
  cover?: boolean;
  children: ReactNode;
};

/** 같은 화면에서 내용만 바꾸는 이동(lib/motion.ts)은 전환하지 않는다. 그 밖의 이동은 나가는 화면이 사라지고 들어오는 화면이 나타난다. */
const EXIT = { [SWAP_TRANSITION_TYPE]: "none", default: "page-out" };
const ENTER = { [SWAP_TRANSITION_TYPE]: "none", default: "page-in" };
const EXIT_COVER = { [SWAP_TRANSITION_TYPE]: "none", default: "page-cover-out" };
const ENTER_COVER = { [SWAP_TRANSITION_TYPE]: "none", default: "page-cover-in" };

/**
 * 화면 하나의 내용을 감싸 다른 화면으로 오갈 때 전환을 건다(React 의 <ViewTransition>. 움직임은 app/globals.css 의 page-out·page-in 등).
 * 각 화면의 page.tsx 가 화면 내용을, 전형 준비의 레이아웃이 머리를 이것으로 감싼다. 상자를 더하지 않으므로(바로 아래 요소들이 각자
 * 전환에 참여한다) 화면의 배치는 그대로다.
 *
 * React 는 새로 생기거나 사라지는 덩어리의 맨 바깥 경계에만 들어옴·나감을 건다. DOM 요소 안쪽에 든 경계는 그 요소가 통째로
 * 생기거나 사라질 때 따로 움직이지 않는다. 그래서 경계가 두 겹이다.
 * - 콘솔 껍데기 바깥(app/(console)/layout.tsx, cover): 로그인 ↔ 콘솔처럼 껍데기가 통째로 생기거나 사라질 때.
 * - 화면 내용 바깥(page.tsx): 콘솔 안에서 화면이 바뀔 때. 껍데기(사이드바·상단 바)는 남아 있어 움직이지 않는다.
 *
 * 화면이 바뀌는 이동(React 의 Transition)에서만 움직이고, 화면 안의 상태 변화나 처음 불러올 때에는 움직이지 않는다.
 * 브라우저가 View Transitions 를 지원하지 않으면 전환 없이 바로 바뀐다.
 */
export function PageTransition({ cover = false, children }: PageTransitionProps) {
  return (
    <ViewTransition enter={cover ? ENTER_COVER : ENTER} exit={cover ? EXIT_COVER : EXIT} default="none">
      {children}
    </ViewTransition>
  );
}
