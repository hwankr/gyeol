// 학년별 연계 상자의 선을 그리는 계산. 순수 함수라 브라우저와 Node 어디서나 돈다(화면은 hooks/useLinkageLayout.ts 가 잰 카드 자리를 준다).
// 카드는 학년 줄(1·2·3학년)에 위아래로 놓이고, 선은 앞 학년 카드의 오른쪽 변에서 뒤 학년 카드의 왼쪽 변으로 간다.
// 좌표는 그림 영역(카드와 선이 같이 든 상자)의 왼쪽 위를 원점으로 한 px 이다.

/** 카드 하나의 자리 */
export type LinkRect = { left: number; top: number; right: number; bottom: number };

/** 선 하나의 양 끝: 어느 카드에서 어느 카드로 가는지 */
export type LinkEnds = { id: string; fromId: string; toId: string };

/** 선 하나를 그릴 값: 선의 길(SVG path 의 d)과 화살표 머리 삼각형의 꼭짓점들(SVG polygon 의 points) */
export type LinkShape = { id: string; path: string; arrow: string };

/** 화살표 머리의 길이와 반 너비(px). 선은 머리의 밑변에서 끝나고 머리의 끝이 뒤 카드의 왼쪽 변에서 ARROW_GAP 만큼 떨어져 있다. */
const ARROW_LENGTH = 7;
const ARROW_HALF_WIDTH = 4;
const ARROW_GAP = 2;

/** 가운데 줄의 카드 맨 위·맨 아래 바깥으로 돌아갈 때 카드에서 떨어지는 거리(px) */
const OUTSIDE_GAP = 6;

const round = (value: number) => Math.round(value * 10) / 10;

const centerY = (rect: LinkRect) => (rect.top + rect.bottom) / 2;

/**
 * 가운데 줄의 카드들(between)을 피해 가로로 지날 높이: 카드 사이의 틈의 가운데, 맨 위 카드의 위, 맨 아래 카드의 아래 가운데
 * 바라는 높이(wanted)에 가장 가까운 것. 카드가 없으면 바라는 높이 그대로다.
 * 틈이 좁아(카드가 겹치거나 맞닿음) 가운데가 카드 안이면 그 틈은 쓰지 않는다.
 */
export function gapY(between: readonly LinkRect[], wanted: number): number {
  if (between.length === 0) return wanted;
  const sorted = [...between].sort((a, b) => a.top - b.top);
  const candidates = [sorted[0].top - OUTSIDE_GAP, sorted[sorted.length - 1].bottom + OUTSIDE_GAP];
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const upper = sorted[index].bottom;
    const lower = sorted[index + 1].top;
    if (lower > upper) candidates.push((upper + lower) / 2);
  }
  return candidates.reduce((best, candidate) => (Math.abs(candidate - wanted) < Math.abs(best - wanted) ? candidate : best));
}

/**
 * 선들을 그릴 값. 자리를 모르는 카드에 닿은 선은 뺀다.
 * - 한 카드에서 여러 선이 나가거나 들어오면 그 변을 고르게 나눠 닿는다(위에서 아래로, 상대 카드의 높이 순서라 선이 덜 엇갈린다).
 * - 이웃한 줄 사이의 선은 S 꼴 곡선 하나다.
 * - 줄을 건너뛰는 선(1학년 → 3학년)은 가운데 줄의 카드 위를 지나지 않게 카드 사이의 틈(gapY)으로 가로질러 간다.
 *   가운데 줄의 카드는 betweenOf(선) 가 준다(그 줄에 카드가 없으면 빈 배열이고 곡선 하나로 간다).
 * - 선은 화살표 머리의 밑변에서 끝나고, 머리는 오른쪽을 가리킨다(선의 끝이 늘 가로 방향이다).
 */
export function linkShapes(
  links: readonly LinkEnds[],
  rects: Readonly<Record<string, LinkRect>>,
  betweenOf: (link: LinkEnds) => readonly LinkRect[],
): LinkShape[] {
  const usable = links.filter((link) => rects[link.fromId] !== undefined && rects[link.toId] !== undefined);
  const startY = new Map<string, number>();
  const endY = new Map<string, number>();
  const spread = (side: "from" | "to", target: Map<string, number>) => {
    const groups = new Map<string, LinkEnds[]>();
    for (const link of usable) {
      const key = side === "from" ? link.fromId : link.toId;
      groups.set(key, [...(groups.get(key) ?? []), link]);
    }
    for (const [cardId, group] of groups) {
      const rect = rects[cardId];
      const other = (link: LinkEnds) => centerY(rects[side === "from" ? link.toId : link.fromId]);
      // Array.prototype.sort 는 안정 정렬이라 상대 카드가 같은 높이면 받은 순서다.
      const ordered = [...group].sort((a, b) => other(a) - other(b));
      ordered.forEach((link, index) => {
        target.set(link.id, rect.top + ((rect.bottom - rect.top) * (index + 1)) / (ordered.length + 1));
      });
    }
  };
  spread("from", startY);
  spread("to", endY);

  return usable.map((link) => {
    const from = rects[link.fromId];
    const to = rects[link.toId];
    const x1 = from.right;
    const y1 = startY.get(link.id) ?? centerY(from);
    const tip = to.left - ARROW_GAP;
    const x2 = tip - ARROW_LENGTH;
    const y2 = endY.get(link.id) ?? centerY(to);
    const between = betweenOf(link);
    let path: string;
    if (between.length === 0) {
      const bend = (x2 - x1) / 2;
      path = `M${round(x1)} ${round(y1)} C${round(x1 + bend)} ${round(y1)} ${round(x2 - bend)} ${round(y2)} ${round(x2)} ${round(y2)}`;
    } else {
      const left = Math.min(...between.map((rect) => rect.left));
      const right = Math.max(...between.map((rect) => rect.right));
      const y = gapY(between, (y1 + y2) / 2);
      const first = (left - x1) / 2;
      const second = (x2 - right) / 2;
      path =
        `M${round(x1)} ${round(y1)} C${round(x1 + first)} ${round(y1)} ${round(left - first)} ${round(y)} ${round(left)} ${round(y)} ` +
        `L${round(right)} ${round(y)} C${round(right + second)} ${round(y)} ${round(x2 - second)} ${round(y2)} ${round(x2)} ${round(y2)}`;
    }
    const arrow = `${round(tip)},${round(y2)} ${round(x2)},${round(y2 - ARROW_HALF_WIDTH)} ${round(x2)},${round(y2 + ARROW_HALF_WIDTH)}`;
    return { id: link.id, path, arrow };
  });
}
