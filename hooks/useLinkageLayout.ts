import { useEffect, useRef, useState } from "react";
import type { LinkRect } from "@/lib/evaluate/linkagePaths";

const NO_RECTS: Readonly<Record<string, LinkRect>> = Object.freeze({});

function sameRects(a: Readonly<Record<string, LinkRect>>, b: Readonly<Record<string, LinkRect>>): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => {
    const other = b[key];
    const rect = a[key];
    return other !== undefined && rect.left === other.left && rect.top === other.top && rect.right === other.right && rect.bottom === other.bottom;
  });
}

/**
 * 학년별 연계 상자의 그림 영역에서 카드의 자리를 잰다(선을 카드의 변에 붙여 그리는 데 쓴다. lib/evaluate/linkagePaths.ts).
 * - areaRef 를 단 요소가 그림 영역이고, 그 안에서 data-link-card 속성(값은 카드 id)을 단 요소가 카드다.
 * - 자리는 그림 영역의 왼쪽 위를 원점으로 한 px 이다. 선을 그리는 SVG 가 같은 영역을 덮으므로, 그림 영역이 가로로 스크롤되거나
 *   문서가 스크롤돼도 다시 잴 필요가 없다(카드와 선이 같이 움직인다).
 * - 그림 영역이나 카드의 크기가 바뀌면(창 크기, 글자가 늦게 그려짐) 다시 잰다. layoutKey 가 바뀌면(다른 평가 요소의 카드) 새로 잰다.
 *   처음 재기 전과 새 카드를 재기 전에는 그 카드의 자리가 없다(그 카드에 닿은 선은 그려지지 않는다).
 */
export function useLinkageLayout(layoutKey: string) {
  const areaRef = useRef<HTMLDivElement>(null);
  const [rects, setRects] = useState<Readonly<Record<string, LinkRect>>>(NO_RECTS);

  useEffect(() => {
    const area = areaRef.current;
    if (area === null) return;
    const cards = [...area.querySelectorAll<HTMLElement>("[data-link-card]")];
    // 관찰을 시작하면 ResizeObserver 가 곧바로 한 번 알려 주므로 처음 자리도 여기서 잰다.
    const observer = new ResizeObserver(() => {
      const origin = area.getBoundingClientRect();
      const next: Record<string, LinkRect> = {};
      for (const card of cards) {
        const id = card.dataset.linkCard;
        if (id === undefined || id === "") continue;
        const rect = card.getBoundingClientRect();
        next[id] = {
          left: Math.round(rect.left - origin.left),
          top: Math.round(rect.top - origin.top),
          right: Math.round(rect.right - origin.left),
          bottom: Math.round(rect.bottom - origin.top),
        };
      }
      setRects((current) => (sameRects(current, next) ? current : next));
    });
    observer.observe(area);
    for (const card of cards) observer.observe(card);
    return () => observer.disconnect();
  }, [layoutKey]);

  return { areaRef, rects };
}
