import { useEffect } from "react";
import { FOCUS_FALLBACK_ATTRIBUTE, PREP_BODY_ATTRIBUTE } from "@/lib/prep/focusMarks";
import { FOCUS_REVEAL_MARGIN, revealVertically } from "@/lib/prep/reveal";

const BODY_SELECTOR = `[${PREP_BODY_ATTRIBUTE}]`;
const FALLBACK_SELECTOR = `[${FOCUS_FALLBACK_ATTRIBUTE}]`;

function isShown(element: Element): boolean {
  return element.getClientRects().length > 0;
}

/** 초점 표시가 그려지는 상자: 숨긴 파일 입력란은 점선 상자(label), 그 밖은 그 요소 */
function focusBox(element: HTMLElement): HTMLElement {
  if (element instanceof HTMLInputElement && element.type === "file") return element.closest("label") ?? element;
  return element;
}

/** 초점 표시까지(위아래 8px) 세로로 화면 안에 다 보이는지. 상자가 화면보다 크면 위쪽 끝만 본다. */
function inViewVertically(element: HTMLElement): boolean {
  const rect = focusBox(element).getBoundingClientRect();
  const viewportHeight = document.documentElement.clientHeight;
  if (rect.height + 2 * FOCUS_REVEAL_MARGIN > viewportHeight) return rect.top - FOCUS_REVEAL_MARGIN >= -0.5;
  return rect.top - FOCUS_REVEAL_MARGIN >= -0.5 && rect.bottom + FOCUS_REVEAL_MARGIN <= viewportHeight + 0.5;
}

function isDisabled(element: HTMLElement): boolean {
  return "disabled" in element && (element as HTMLButtonElement).disabled === true;
}

/**
 * 전형 준비 세 탭의 초점을 한 곳에서 일반 규칙으로 지킨다(app/(console)/prep/layout.tsx 에서 한 번 부른다). 경로마다 따로 넣지 않는다.
 *
 * B. 밀려 나가면 다시 보이게: 본문 안 컨트롤에 키보드 초점 표시가 있는 채로(:focus-visible) 화면 갱신(응답 도착, 저장소 값 반영,
 *    접기·펼치기, 문구·경고·안내가 나타나거나 사라짐, 요소 고르기 등 DOM 이 바뀌는 것 무엇이든) 때문에, 갱신 직전에는 위아래 8px 까지
 *    화면 안에 다 보였는데 갱신 뒤에 벗어나면 벗어난 만큼만 세로로 문서를 스크롤한다(lib/prep/reveal.ts). 갱신 직전에 이미 화면 밖이었으면
 *    (사람이 스크롤해 둔 것) 건드리지 않는다. 사람이 스크롤하는 것에는 반응하지 않고(기준만 다시 잰다), 가로로는 스크롤하지 않는다.
 * C. 사라지거나 꺼지면 되돌리기(안전망): 본문 안 컨트롤에 초점이 있다가 그 컨트롤이 문서에서 빠지거나 disabled 가 되어 초점이 body 로
 *    빠지면, 보이는 탭 본문의 되돌릴 곳(data-focus-fallback)으로 초점을 옮기고(preventScroll) 벗어난 만큼만 세로로 스크롤한다.
 *    따로 정한 곳(저장하기 → 수정하기, 배점 0·100 → 반대쪽, 안내 링크 → 머리의 탭)은 각 훅이 먼저 옮기므로
 *    여기까지 오지 않는다. 되돌리지 않는 경우: 사람이 컨트롤이 아닌 곳을 눌러 초점을 뗀 경우(그 컨트롤은 그대로 있다), 다른 화면·탭으로
 *    이동한 경우(그 탭 본문이 숨겨진다), 브라우저 창·탭이 초점을 잃은 경우(활성 요소는 그대로다).
 *
 * 화면 갱신은 main 안의 DOM 변경(MutationObserver)으로 알아챈다. 콜백은 변경 직후(그리기 전) 마이크로태스크라 그 자리에서 잰다.
 */
export function usePrepFocusKeeper() {
  useEffect(() => {
    const root = document.querySelector("main") ?? document.body;
    /** 지금(또는 마지막으로) 초점이 있던 본문 안 컨트롤, 그 컨트롤이 속한 탭 본문, 마지막으로 잰 "화면 안에 다 보임" */
    let tracked: { element: HTMLElement; body: Element; wasVisible: boolean } | null = null;

    function track(element: HTMLElement) {
      const body = element.closest(BODY_SELECTOR);
      tracked = body !== null && isShown(body) ? { element, body, wasVisible: inViewVertically(element) } : null;
    }

    function onFocusIn(event: FocusEvent) {
      if (event.target instanceof HTMLElement) track(event.target);
    }

    /** 사람이 스크롤했거나 창 크기가 바뀌면 기준(갱신 직전에 보였는지)만 다시 잰다. */
    function remeasure() {
      if (tracked !== null && document.activeElement === tracked.element) tracked.wasVisible = inViewVertically(tracked.element);
    }

    /** C: 초점이 body 로 빠졌고 그 이유가 컨트롤이 빠지거나 꺼진 것이면(같은 탭에 머무는 동안) 되돌릴 곳으로 옮긴다. */
    function restoreIfLost(): boolean {
      if (tracked === null) return false;
      const { element, body } = tracked;
      const active = document.activeElement;
      const lostToBody = active === null || active === document.body;
      const stuckOnDisabled = active === element && isDisabled(element);
      if (!lostToBody && !stuckOnDisabled) return false;
      // 다른 화면·탭으로 이동해 그 탭 본문이 숨겨졌으면 되돌리지 않는다.
      if (!body.isConnected || !isShown(body)) {
        tracked = null;
        return false;
      }
      // 컨트롤이 그대로 있고 꺼지지도 않았으면 사람이 다른 곳을 눌러 초점을 뗀 것이다. 되돌리지 않는다.
      if (element.isConnected && !isDisabled(element)) {
        tracked = null;
        return false;
      }
      const fallback = [...document.querySelectorAll<HTMLElement>(`${BODY_SELECTOR} ${FALLBACK_SELECTOR}`)].find(
        (candidate) => isShown(candidate.closest(BODY_SELECTOR) ?? candidate) && !isDisabled(candidate) && candidate.closest("[inert]") === null,
      );
      tracked = null;
      if (fallback === undefined) return false;
      fallback.focus({ preventScroll: true });
      revealVertically(focusBox(fallback));
      track(fallback);
      return true;
    }

    /** B: 키보드 초점 표시가 있는 컨트롤이 갱신으로 화면 밖으로 밀려났으면 다시 보이게 한다. */
    function revealIfPushed() {
      if (tracked === null || document.activeElement !== tracked.element) return;
      const { element } = tracked;
      const visibleNow = inViewVertically(element);
      if (tracked.wasVisible && !visibleNow && element.matches(":focus-visible")) {
        revealVertically(focusBox(element));
      }
      tracked.wasVisible = inViewVertically(element);
    }

    const observer = new MutationObserver(() => {
      if (!restoreIfLost()) revealIfPushed();
    });
    observer.observe(root, { childList: true, subtree: true, attributes: true, characterData: true });

    // 초점이 빠질 때(blur) DOM 이 바뀌지 않는 경로(꺼진 컨트롤에서 초점이 풀림 등)도 본다. 판단은 다음 차례에(빠진 뒤의 상태로) 한다.
    function onFocusOut() {
      queueMicrotask(() => {
        restoreIfLost();
      });
    }

    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("focusout", onFocusOut, true);
    window.addEventListener("scroll", remeasure, { passive: true });
    window.addEventListener("resize", remeasure);
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== document.body) track(active);
    return () => {
      observer.disconnect();
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("focusout", onFocusOut, true);
      window.removeEventListener("scroll", remeasure);
      window.removeEventListener("resize", remeasure);
    };
  }, []);
}
