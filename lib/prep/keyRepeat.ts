// 전형 준비 화면의 키 반복 규칙(hooks/useKeyRepeatGuard.ts)에서 버튼과 상태 훅이 같이 쓰는 표시.

/** 길게 누르면 계속 동작하는 버튼(배점 −·+)에 붙이는 속성과 값. 이 표시가 없는 버튼은 Enter 를 길게 눌러도 한 번만 동작한다. */
export const HOLD_REPEAT_ATTRIBUTE = "data-key-repeat";
export const HOLD_REPEAT_VALUE = "hold";
