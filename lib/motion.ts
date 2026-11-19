// 화면 전환(components/PageTransition.tsx)에서 링크와 화면이 같이 쓰는 이름. 움직임의 빠르기·곡선은 app/globals.css 에 있다.

/** 같은 화면에서 내용만 바꾸는 이동(평가하기의 이전·다음 지원자, 세부 항목 평가의 평가 요소 고르기)에 붙이는 전환 종류의 이름 */
export const SWAP_TRANSITION_TYPE = "swap";

/**
 * 그런 링크의 transitionTypes 에 넣는 값. 이 종류의 이동은 화면 전환을 하지 않고 바로 바꾼다.
 * 전환 중인 화면 조각은 그동안 눌리지 않아서(브라우저 규칙), 이전·다음을 잇달아 누를 때 누름이 빠지지 않게 하려는 것이다.
 */
export const SWAP_TRANSITION: string[] = [SWAP_TRANSITION_TYPE];
