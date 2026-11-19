import type { PDFDocumentProxy } from "unpdf/pdfjs";
import type { PageItems } from "./recordLocate.ts";

// 열어 둔 PDF(pdf.js 문서)의 한 쪽에서 글자 조각과 그 자리를 읽는다. 원문의 자리를 찾는 계산(lib/recordLocate.ts)의 재료다.
// 화면 요소를 쓰지 않아 브라우저(lib/recordPages.ts)와 Node 스크립트(scripts/check-record-locate.ts)가 같이 쓴다.

/** 기울어진 글자로 보는 기준: 글자 방향의 세로 성분이 가로 성분의 이 비율을 넘으면 */
const TILT_LIMIT = 0.02;

/**
 * 쪽 하나의 글자 조각을 읽는다. 자리는 쪽의 왼쪽 위가 원점인 pt 다(쪽을 scale 1 로 그렸을 때의 자리).
 * 쪽이 돌아가 있거나(Rotate) 기울어진 글자(두 글자 이상)가 있으면 글자 조각 없이 돌려준다: 그런 쪽은 글자의 자리를 네모로 어림할 수 없어
 * 가릴 자리를 믿을 수 없다(그 쪽은 그림을 만들지 않는다).
 */
export async function readPageItems(pdf: PDFDocumentProxy, pageNumber: number): Promise<PageItems> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  const empty: PageItems = { page: pageNumber, width: viewport.width, height: viewport.height, items: [] };
  if (viewport.rotation % 360 !== 0) return empty;
  const content = await page.getTextContent();
  const items: { str: string; x: number; y: number; w: number; size: number }[] = [];
  for (const item of content.items) {
    if (!("str" in item) || item.str === "") continue;
    const [a, b, c, d, e, f] = item.transform as number[];
    const tilted = Math.abs(b) > Math.abs(a) * TILT_LIMIT || Math.abs(c) > Math.abs(d) * TILT_LIMIT || a <= 0;
    if (tilted) {
      if (item.str.replace(/\s/g, "").length >= 2) return empty;
      continue;
    }
    const [x, y] = viewport.convertToViewportPoint(e, f);
    items.push({ str: item.str, x, y, w: item.width, size: Math.hypot(c, d) });
  }
  return { ...empty, items };
}
