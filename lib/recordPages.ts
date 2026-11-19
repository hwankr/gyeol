import { getResolvedPDFJS, registerImageDecoders } from "unpdf";
import type { PDFDocumentProxy } from "unpdf/pdfjs";
import type { AnalysisResult, Section } from "@/types/analysis";
import { buildRecordStream, locateRecord, type PageItems, type PageRect } from "./recordLocate.ts";
import { readPageItems } from "./recordPageItems.ts";

// 가린 쪽 그림 만들기: 올린 학생부 PDF 의 쪽마다, 가린 정보(이름·학교명·인적사항 등)의 자리를 덮은 그림을 만든다.
// 원문보기 화면이 항목·근거가 실제 PDF 의 어디에 있는지 보여 줄 때 이 그림을 쓴다. 브라우저에서만 쓴다(PDF 는 서버로 보내지 않는다).
// 학생부 올리기(lib/analyzeClient.ts)가 분석이 끝난 직후, PDF 를 닫기 전에 부른다. 가리기 전 PDF 와 가리기 전 원문은 이 계산에만 쓰고
// 남기지 않는다. 남는 것은 가린 그림과 자리 목록(lib/recordPagesStorage.ts)뿐이라, 평가자가 보는 화면에 가리기 전 정보가 나오지 않는다.
//
// 그림을 만들지 않는 쪽(가릴 자리를 다 찾았다고 확인할 수 없는 쪽)
// - 글자가 없는 쪽(스캔본, 쪽 전체가 그림): 가릴 자리를 글자로 찾을 수 없다.
// - 가린 구간의 자리를 PDF 의 글자에서 찾지 못한 쪽, 돌아가 있거나 기울어진 글자가 있는 쪽, 그림의 자리를 읽지 못한 쪽.

/** 쪽 그림의 긴 변 길이(픽셀)와 JPEG 화질. A4 를 약 130dpi 로 그린 크기로, 화면에서 본문 글자를 읽을 수 있다. */
const PAGE_IMAGE_EDGE = 1500;
const PAGE_IMAGE_QUALITY = 0.82;

/** 가린 자리를 덮는 색 */
const COVER_COLOR = "#2B2B2B";

/** 쪽 넓이의 이 비율보다 작은 그림(증명사진, 직인, 바코드 등)은 덮는다. 더 큰 그림(바탕 무늬 등)은 그대로 둔다 */
const MAX_COVERED_IMAGE_AREA = 0.25;

/** 쪽 그림 하나 */
export type RecordPageImage = {
  /** 쪽의 크기(pt) */
  width: number;
  height: number;
  /**
   * shown: 가린 그림이 있다. scan: 글자가 없는 쪽이라 그림을 만들지 않았다. unverified: 가릴 자리를 확인하지 못해 그림을 만들지 않았다.
   */
  state: "shown" | "scan" | "unverified";
  /** 가린 그림(JPEG). shown 일 때만 있다 */
  image: Blob | null;
};

/** 학생부 하나의 쪽 그림과 자리 */
export type RecordPages = {
  pages: RecordPageImage[];
  /** 항목 id → 그 항목의 원문이 있는 자리 */
  sections: Record<string, PageRect[]>;
  /** 근거 id → 그 인용 구절이 있는 자리 */
  evidences: Record<string, PageRect[]>;
};

export type BuildRecordPagesInput = {
  /** 열어 둔 PDF */
  pdf: PDFDocumentProxy;
  /** 글자가 없는 쪽(스캔본). 숨은 글자 층(OCR)이 있어도 가릴 자리를 찾는 데 쓰지 않는다 */
  scannedPages: ReadonlySet<number>;
  /** 가리기 전 항목 (서버에 보낸 순서 그대로) */
  originals: readonly Section[];
  /** 분석 결과 (가려진 항목과 근거) */
  result: AnalysisResult;
  /** 취소 신호. 취소되면 null 을 돌려준다 */
  signal?: AbortSignal;
};

/**
 * 쪽마다 가린 그림을 만들고 항목·근거의 자리를 찾는다. 취소되면 null.
 * 한 쪽의 그림을 만들지 못하면(그리기 실패) 그 쪽만 unverified 로 두고 계속한다.
 */
export async function buildRecordPages({
  pdf,
  scannedPages,
  originals,
  result,
  signal,
}: BuildRecordPagesInput): Promise<RecordPages | null> {
  const pageCount = pdf.numPages;
  const items: PageItems[] = [];
  for (let page = 1; page <= pageCount; page += 1) {
    if (signal?.aborted) return null;
    const read = await readPageItems(pdf, page);
    items.push(scannedPages.has(page) ? { ...read, items: [] } : read);
  }
  const location = locateRecord({
    stream: buildRecordStream(items),
    pageCount,
    originals,
    blinded: result.sections,
    evidences: result.evidences,
  });
  const unverified = new Set(location.unverified);

  const pages: RecordPageImage[] = [];
  for (let page = 1; page <= pageCount; page += 1) {
    if (signal?.aborted) return null;
    const { width, height } = items[page - 1];
    if (scannedPages.has(page)) {
      pages.push({ width, height, state: "scan", image: null });
      continue;
    }
    let image: Blob | null = null;
    if (!unverified.has(page)) {
      try {
        const covers = [
          ...location.covers.filter((rect) => rect[0] === page),
          ...(await smallImageRects(pdf, page)),
        ];
        image = await renderCoveredPage(pdf, page, covers);
      } catch {
        image = null;
      }
    }
    pages.push({ width, height, state: image === null ? "unverified" : "shown", image });
  }
  return { pages, sections: location.sections, evidences: location.evidences };
}

type Matrix = readonly [number, number, number, number, number, number];

function multiply(m1: Matrix, m2: Matrix): Matrix {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

/**
 * 쪽에 그려진 그림 가운데 작은 것(쪽 넓이의 MAX_COVERED_IMAGE_AREA 미만)의 자리. 증명사진·직인·바코드에는 글자로 찾을 수 없는 식별 정보가
 * 있을 수 있어 덮는다. PDF 의 그리기 명령을 차례로 보며 그림을 그리는 명령의 변환 행렬로 자리를 구한다(저장·되돌리기·변환·묶음을 따라간다).
 * 읽다가 실패하면 예외를 던진다(그 쪽은 그림을 만들지 않는다).
 */
export async function smallImageRects(pdf: PDFDocumentProxy, pageNumber: number): Promise<PageRect[]> {
  const { OPS } = await getResolvedPDFJS();
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  const operatorList = await page.getOperatorList();
  const rects: PageRect[] = [];
  const stack: Matrix[] = [];
  let transform: Matrix = [1, 0, 0, 1, 0, 0];
  for (let index = 0; index < operatorList.fnArray.length; index += 1) {
    const fn = operatorList.fnArray[index];
    const args = operatorList.argsArray[index] as unknown[] | null;
    if (fn === OPS.save) {
      stack.push(transform);
    } else if (fn === OPS.restore || fn === OPS.paintFormXObjectEnd) {
      transform = stack.pop() ?? transform;
    } else if (fn === OPS.transform && args !== null) {
      transform = multiply(transform, args as unknown as Matrix);
    } else if (fn === OPS.paintFormXObjectBegin) {
      stack.push(transform);
      const matrix = args?.[0];
      if (Array.isArray(matrix) || ArrayBuffer.isView(matrix)) {
        transform = multiply(transform, Array.from(matrix as ArrayLike<number>) as unknown as Matrix);
      }
    } else if (
      fn === OPS.paintImageXObject ||
      fn === OPS.paintInlineImageXObject ||
      fn === OPS.paintImageMaskXObject ||
      fn === OPS.paintImageXObjectRepeat ||
      fn === OPS.paintSolidColorImageMask
    ) {
      // 그림은 단위 정사각형에 그려진다: 네 모서리를 변환해 쪽 위의 네모를 구한다.
      const [a, b, c, d, e, f] = transform;
      const corners = [
        viewport.convertToViewportPoint(e, f),
        viewport.convertToViewportPoint(a + e, b + f),
        viewport.convertToViewportPoint(c + e, d + f),
        viewport.convertToViewportPoint(a + c + e, b + d + f),
      ];
      const xs = corners.map((corner) => corner[0] / viewport.width);
      const ys = corners.map((corner) => corner[1] / viewport.height);
      const left = Math.max(0, Math.min(...xs));
      const top = Math.max(0, Math.min(...ys));
      const right = Math.min(1, Math.max(...xs));
      const bottom = Math.min(1, Math.max(...ys));
      const area = Math.max(0, right - left) * Math.max(0, bottom - top);
      if (area > 0 && area < MAX_COVERED_IMAGE_AREA) rects.push([pageNumber, left, top, right - left, bottom - top]);
    }
  }
  return rects;
}

/**
 * 쪽을 그리고 가린 자리를 덮어 JPEG 로 만든다. 그리기는 intent "print" 로 한다(lib/recordPdf.ts 의 renderPage 와 같은 까닭:
 * 화면 표시용 그리기는 탭이 뒤에 있을 때 멈춘다). 덮는 네모는 그림 위에 불투명하게 칠하므로 그 아래의 글자·그림은 남지 않는다.
 */
async function renderCoveredPage(pdf: PDFDocumentProxy, pageNumber: number, covers: readonly PageRect[]): Promise<Blob> {
  registerImageDecoders();
  const page = await pdf.getPage(pageNumber);
  const view = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: PAGE_IMAGE_EDGE / Math.max(view.width, view.height) });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(viewport.width));
  canvas.height = Math.max(1, Math.round(viewport.height));
  try {
    await page.render({ canvas, viewport, intent: "print" }).promise;
    const context = canvas.getContext("2d");
    if (context === null) throw new Error("canvas");
    context.fillStyle = COVER_COLOR;
    for (const [, x, y, w, h] of covers) {
      // 픽셀 경계에 걸친 가장자리가 비치지 않게 바깥쪽으로 한 픽셀씩 넓혀 칠한다.
      const left = Math.floor(x * canvas.width) - 1;
      const top = Math.floor(y * canvas.height) - 1;
      const right = Math.ceil((x + w) * canvas.width) + 1;
      const bottom = Math.ceil((y + h) * canvas.height) + 1;
      context.fillRect(left, top, right - left, bottom - top);
    }
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob !== null && blob.type === "image/jpeg" ? resolve(blob) : reject(new Error("blob"))),
        "image/jpeg",
        PAGE_IMAGE_QUALITY,
      );
    });
  } finally {
    canvas.width = 0;
    canvas.height = 0;
    page.cleanup();
  }
}
