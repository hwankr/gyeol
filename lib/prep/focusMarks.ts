// 전형 준비 화면의 초점 규칙(hooks/usePrepFocusKeeper.ts)에서 화면 컴포넌트와 훅이 같이 쓰는 표시.

/** 전형 준비 탭 본문(탭 줄 아래 내용. 준비 전에는 inert)에 붙이는 속성 */
export const PREP_BODY_ATTRIBUTE = "data-prep-body";

/** 초점이 있던 컨트롤이 사라지거나 꺼졌을 때 되돌릴 곳에 붙이는 속성 (모집요강: 파일 입력란, 평가·배점: 고른 요소의 화살표 버튼) */
export const FOCUS_FALLBACK_ATTRIBUTE = "data-focus-fallback";

/** 탭 본문 요소에 펼쳐 넣는 속성: 준비 전에는 inert, 본문 표시 */
export function prepBodyProps(ready: boolean): { inert: boolean; [PREP_BODY_ATTRIBUTE]: string } {
  return { inert: !ready, [PREP_BODY_ATTRIBUTE]: "" };
}

/** 되돌릴 곳에 펼쳐 넣는 속성 */
export const FOCUS_FALLBACK_PROPS = { [FOCUS_FALLBACK_ATTRIBUTE]: "" };
