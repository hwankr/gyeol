// 전형 준비 화면에서 초점을 코드로 옮긴 뒤, 옮긴 대상(과 초점 표시)이 화면에 보이게 하는 도우미. 브라우저에서만 호출한다.
// hooks/usePrepWeights.ts(요소 고르기·저장하기 뒤)와 hooks/useGuidelineUpload.ts(초안 안내의 링크 뒤)가 같이 쓴다.

/** 초점을 옮긴 버튼·링크 위아래로 함께 보여야 하는 범위(px): 초점 표시(2px 띄움 + 2px 선) 4px 와 여유 */
export const FOCUS_REVEAL_MARGIN = 8;

/**
 * element 의 위아래 margin 까지가 화면(뷰포트, 가로 스크롤바 제외) 안에 다 보이게 한다. 이미 다 보이면 스크롤하지 않고, 위나 아래로
 * 벗어났으면 벗어난 만큼만 문서를 세로로 바로 스크롤한다. scrollIntoView 는 가로로도 움직일 수 있어 쓰지 않는다.
 * 위치는 지금 배치(문서가 짧아져 브라우저가 스크롤 위치를 문서 끝에 맞춘 뒤 포함)에서 잰다.
 */
export function revealVertically(element: HTMLElement, margin: number = FOCUS_REVEAL_MARGIN) {
  const rect = element.getBoundingClientRect();
  const viewportHeight = document.documentElement.clientHeight;
  const overTop = rect.top - margin;
  const overBottom = rect.bottom + margin - viewportHeight;
  let delta = 0;
  if (overTop < 0) delta = overTop;
  else if (overBottom > 0) delta = Math.min(overBottom, overTop);
  if (delta !== 0) window.scrollBy({ top: delta, left: 0, behavior: "instant" });
}
