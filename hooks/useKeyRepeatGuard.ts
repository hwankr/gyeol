import { useEffect } from "react";
import { HOLD_REPEAT_ATTRIBUTE, HOLD_REPEAT_VALUE } from "@/lib/prep/keyRepeat";

/**
 * 전형 준비 세 탭의 버튼에 같은 키 반복 규칙을 건다(app/(console)/prep/layout.tsx 에서 한 번 부른다).
 * Enter 를 누르고 있으면 운영체제의 키 반복이 keydown(repeat 참)을 이어 보내고, 버튼은 keydown 마다 눌린다. 그런데 이 화면들은 누른 뒤
 * 초점을 다른 버튼으로 옮기는 곳이 있어(배점이 0·100 에 닿으면 반대쪽 버튼, 저장하면 수정하기, 창을 닫으면 크게 보기) 같은 Enter 의
 * 반복이 새 버튼을 누르게 된다. 규칙: 키를 누르고 있는 동안의 반복은 처음 누른 그 버튼에서만 이어진다.
 * - 한 번에 한 번만 동작하면 되는 버튼(표시가 없는 버튼)은 반복으로 생긴 누름을 막는다(Enter 를 길게 눌러도 한 번).
 * - 길게 누르면 계속 바뀌는 버튼(data-key-repeat="hold", 배점 −·+)은 이번 누름이 시작된 그 버튼에서만 반복을 받는다. 초점이 옮겨 와서
 *   반복을 받게 된 버튼은 손을 뗄 때까지 막는다(− 를 누른 채 0 에 닿으면 0 에서 멈춘다).
 * Space 는 뗄 때 한 번 동작하므로 건드리지 않는다. 새로 누른 Enter(repeat 거짓), 마우스 누름, 초점 이동은 그대로다.
 * 막는 방법은 반복 keydown 의 기본 동작(버튼 누름)을 preventDefault 하는 것이다. 화면이 숨겨지면 effect 정리로 듣기를 멈춘다.
 */
export function useKeyRepeatGuard() {
  useEffect(() => {
    /** 이번 누름(반복이 아닌 Enter keydown)이 시작된 요소. 손을 떼면 비운다. */
    let pressStart: Element | null = null;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Enter") return;
      const target = event.target instanceof Element ? event.target : null;
      if (!event.repeat) {
        pressStart = target;
        return;
      }
      const button = target?.closest("button") ?? null;
      if (button === null || button.closest("main") === null) return;
      const holdsRepeat = button.getAttribute(HOLD_REPEAT_ATTRIBUTE) === HOLD_REPEAT_VALUE;
      if (holdsRepeat && button === pressStart) return;
      event.preventDefault();
    }

    function onKeyUp(event: KeyboardEvent) {
      if (event.key === "Enter") pressStart = null;
    }

    // 다른 핸들러보다 먼저 보도록 캡처 단계에서 듣는다.
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("keyup", onKeyUp, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("keyup", onKeyUp, true);
    };
  }, []);
}
