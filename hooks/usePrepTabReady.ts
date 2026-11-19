import { useLayoutEffect, useRef, useState, type RefObject } from "react";

/**
 * 전형 준비 탭이 "준비"됐는지와, 탭 본문 요소에 붙일 ref. 준비 전에는 탭 본문(탭 줄 아래 내용)에 inert 를 걸어 그 안의 어떤 것도
 * 초점을 받지 않고 눌리지 않게 한다(모양은 그대로다. components 의 각 탭이 lib/prep/focusMarks.ts 의 prepBodyProps 로 쓴다).
 *
 * "준비" = 그 탭의 훅이 브라우저에서 실행되고, 저장소에서 읽은 값(저장한 기준·변경 사항·기록)이 화면에 반영된 뒤.
 * - 서버 HTML 과 hydration 중(첫 클라이언트 렌더링)에는 false 다(서버와 같아 hydration 경고가 없다).
 * - 본문 요소가 문서에 붙은 커밋의 layout effect 에서 true 로 바꾼다. 이 갱신은 그리기 전에 동기로 다시 그리고, 그때
 *   useSyncExternalStore 는 서버 값이 아니라 저장소의 값(getSnapshot)을 읽으므로 저장소 값이 반영된 화면과 준비가 같은 커밋에 함께 나온다.
 * - cacheComponents 로 다른 화면에 다녀와 다시 보일 때: 숨겨질 때(cleanup) false 로 돌려 두고, 다시 보이는 커밋의 layout effect 에서
 *   true 로 바꾼다. 이 다시 그리기가 저장소를 다시 읽으므로 "숨겨진 동안 바뀐 저장소 값이 아직 반영되지 않은 틈"에도 본문은 inert 다.
 * - 개발 모드 StrictMode 가 effect 를 한 번 더 돌려도(mount → cleanup → mount) 같은 커밋 안의 갱신이라 마지막 값(true)만 그려진다.
 * 값은 본문 요소가 실제로 문서에 붙었는지(ref)로 정한다.
 */
export function usePrepTabReady<T extends HTMLElement>(): { ready: boolean; bodyRef: RefObject<T | null> } {
  const bodyRef = useRef<T>(null);
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    setReady(bodyRef.current?.isConnected === true);
    return () => setReady(false);
  }, []);
  return { ready, bodyRef };
}
