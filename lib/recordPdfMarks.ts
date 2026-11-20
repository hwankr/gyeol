import type { PageRect } from "./recordLocate.ts";

// 실제 PDF 의 쪽 그림 위에 그리는 표시(형광펜)를 만드는 순수 함수. 원문보기 화면과 평가하기의 서류 원문이 같이 쓴다.
// 표시는 묶음(근거 하나의 인용 구절, 또는 항목 하나의 원문) 단위로 받고, 쪽마다 그 쪽에 있는 네모로 나눈다.

/**
 * 표시의 세기.
 * - focus: 지금 고른 근거의 인용 구절 (가장 짙고 테두리가 있다. 나타날 때 잠깐 더 짙어진다)
 * - strong: 지금 고른 평가 요소의 근거
 * - soft: 다른 평가 요소의 근거 (옅다)
 * - section: 고른 항목(또는 자리를 찾지 못한 근거가 든 항목)의 원문 (요소 색이 아닌 옅은 남색)
 */
export type PdfMarkLevel = "focus" | "strong" | "soft" | "section";

/** 쪽 위에 그릴 표시 묶음 하나 */
export type PdfMarkGroup = {
  /** 묶음의 이름 (근거 id, 항목은 "section:<항목 id>"). 표시의 key 와 스크롤 대상을 정하는 데 쓴다 */
  id: string;
  /** 그 묶음의 자리. 자리를 찾지 못했으면 undefined */
  rects: readonly PageRect[] | undefined;
  /** 형광펜 색의 순번(평가 요소 순번. components/evidenceTone.ts). 요소 색이 아닌 표시는 null */
  tone: number | null;
  level: PdfMarkLevel;
  /** 같은 묶음을 다시 골랐을 때 표시를 새로 그려(나타나는 움직임을 다시 걸려고) 바꾸는 값 */
  stamp?: number;
};

/** PDF 쪽 위에 그리는 표시 하나 (자리는 쪽 크기에 대한 비율) */
export type PdfMark = {
  key: string;
  /** 이 표시가 속한 묶음 (근거 id 등) */
  groupId: string;
  level: PdfMarkLevel;
  tone: number | null;
  x: number;
  y: number;
  w: number;
  h: number;
  /** 스크롤 대상인지 (대상 묶음의 맨 앞 표시 하나) */
  isTarget: boolean;
};

/** 표시를 얹을 쪽 하나 (hooks/useRecordPages.ts 의 RecordPageView 와 같은 모양) */
export type PdfPageSource = {
  page: number;
  width: number;
  height: number;
  state: "shown" | "scan" | "unverified";
  url: string | null;
};

export type PdfPageView = {
  page: number;
  /** 쪽의 가로세로 크기(pt). 그림을 받기 전에도 자리를 잡는다 */
  width: number;
  height: number;
  /** 가린 그림의 주소. 그림이 없는 쪽은 null */
  url: string | null;
  /** 그림이 없는 쪽의 상태 글. 그림이 있으면 빈 글 */
  stateText: string;
  marks: PdfMark[];
};

/** 겹칠 때 위에 오는 순서: 항목 < 다른 요소 < 지금 요소 < 고른 근거 */
const LEVEL_ORDER: Record<PdfMarkLevel, number> = { section: 0, soft: 1, strong: 2, focus: 3 };

/**
 * 쪽마다 그 쪽의 표시를 만든다. 표시는 세기 순서(옅은 것부터)로 놓아 짙은 것이 위에 그려진다.
 * targetId 는 스크롤 대상 묶음이다: 그 묶음의 표시 가운데 문서에서 맨 앞의 것(쪽이 앞선 것, 같은 쪽에서는 받은 순서) 하나가 대상이 된다.
 * 자리가 없는 묶음은 표시가 없다(대상이 그런 묶음이면 대상도 없다).
 */
export function buildPdfPages(
  pages: readonly PdfPageSource[],
  groups: readonly PdfMarkGroup[],
  targetId: string | null,
): PdfPageView[] {
  const ordered = [...groups].sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
  let targeted = false;
  return pages.map((page) => {
    const marks: PdfMark[] = [];
    for (const group of ordered) {
      (group.rects ?? []).forEach((rect, index) => {
        if (rect[0] !== page.page) return;
        const isTarget = !targeted && group.id === targetId;
        if (isTarget) targeted = true;
        marks.push({
          key: `${group.id}#${index}#${group.stamp ?? 0}`,
          groupId: group.id,
          level: group.level,
          tone: group.tone,
          x: rect[1],
          y: rect[2],
          w: rect[3],
          h: rect[4],
          isTarget,
        });
      });
    }
    return {
      page: page.page,
      width: page.width,
      height: page.height,
      url: page.url,
      stateText: page.state === "shown" ? "" : page.state === "scan" ? "스캔본 · 가린 그림 없음" : "가림 확인 안 됨 · 그림 없음",
      marks,
    };
  });
}
