import { extractText, getDocumentProxy, inspectPages, registerImageDecoders } from "unpdf";
import type { AnalysisResult, Section } from "@/types/analysis";
import { describePdfParseError } from "./pdf.ts";
import { parsePdfDocument, type ParseReport } from "./pipeline/parsePdf.ts";
import { recordFormPart } from "./recordForm.ts";
import { buildRecordPages, type RecordPages } from "./recordPages.ts";
import {
  MAX_PAGE_IMAGE_BASE64_LENGTH,
  MAX_PAGE_TEXT_LENGTH,
  MAX_RECORD_PAGES,
  NARRATIVE_CATEGORIES,
} from "./recordSections.ts";

// 학생부 PDF 를 브라우저에서 읽는다. 학생부 올리기(lib/analyzeClient.ts)가 분석을 시작할 때 이 모듈을 그때 불러온다
// (PDF 라이브러리가 커서 화면을 열 때는 받지 않는다). 브라우저에서만 쓴다.
// PDF 파일은 서버로 보내지 않는다. 그래서 파일이 커도 배포 환경의 요청 본문 한도(4.5MB)에 걸리지 않는다.
//
// 쪽마다 읽는 방법을 정한다.
// - 글자가 있는 쪽: 파서(lib/pipeline/parsePdf.ts)가 글자를 그대로 읽어 항목으로 나눈다. AI 를 쓰지 않는다.
// - 글자가 없는 쪽(스캔본, 쪽 전체가 그림): 그 쪽을 그림(JPEG)으로 그려 AI 가 읽게 한다(/api/record-page).
// - 글자는 있는데 파서가 양식을 알아보지 못한 문서(파서는 가상 학생부 양식에 맞춰져 있다): 모든 쪽을 AI 가 읽게 한다.
//   이때는 쪽 그림과 함께 그 쪽에서 뽑은 글자도 보내 AI 가 글자를 그대로 옮기게 한다.

/** 화면에 그대로 보여 줄 문구를 담은 오류 */
export class RecordPdfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecordPdfError";
  }
}

/** 쪽 수가 한도를 넘을 때의 문구 */
function tooManyPagesError(pages: number): string {
  return `학생부가 ${pages}쪽입니다. ${MAX_RECORD_PAGES}쪽 이하의 PDF 만 올릴 수 있습니다.`;
}

/** 쪽을 그림으로 만들지 못했을 때의 문구 */
const RENDER_ERROR = "PDF 의 쪽을 그림으로 바꾸지 못했습니다. 다른 PDF 로 다시 시도해 주세요.";

/** 보이는 글자가 이보다 적은 쪽은 글자가 없는 쪽으로 본다(쪽 번호 같은 몇 글자만 있는 스캔 쪽) */
const MIN_TEXT_PAGE_CHARS = 20;

/** 그림이 쪽의 이만큼 이상을 덮고 보이는 글자가 SCAN_MAX_CHARS 보다 적으면 스캔한 쪽으로 본다(스캔 위에 짧은 글자만 얹힌 쪽) */
const SCAN_MIN_COVERAGE = 0.8;
const SCAN_MAX_CHARS = 200;

/** 파서가 읽은 글자 가운데 항목·표 구조로 알아본 글자가 이 비율보다 적으면 양식을 알아보지 못한 것으로 본다 */
const MIN_RECOGNIZED_RATIO = 0.7;

/**
 * 쪽을 그림으로 그릴 때의 긴 변 길이(픽셀)와 JPEG 화질. 앞에서부터 그려 보고 MAX_PAGE_IMAGE_BASE64_LENGTH 안에 들어오는 첫 번째를 쓴다.
 * 첫 번째(긴 변 2200px)는 A4 를 약 190dpi 로 그린 크기로, AI 가 받는 그림의 최대 크기(긴 변 2576px) 안이다.
 */
const RENDER_PRESETS = [
  { edge: 2200, quality: 0.85 },
  { edge: 2200, quality: 0.6 },
  { edge: 1600, quality: 0.6 },
  { edge: 1200, quality: 0.5 },
] as const;

/** AI 가 읽어야 하는 쪽 */
export type RecordImagePage = {
  /** 쪽 번호(1부터) */
  page: number;
  /** 그 쪽에서 뽑은 글자(글자가 있는데 파서가 양식을 알아보지 못한 문서일 때만). 글자가 없는 쪽은 null */
  text: string | null;
};

/** 열어 둔 학생부 PDF */
export type OpenedRecord = {
  pageCount: number;
  /** 글자가 있는 쪽에서 파서가 읽은 항목 */
  textSections: Section[];
  /** AI 가 읽어야 하는 쪽(쪽 번호 순서). 없으면 빈 배열 */
  imagePages: RecordImagePage[];
  /** 쪽 하나를 JPEG 로 그려 base64 문자열로 돌려준다. 실패하면 RecordPdfError */
  renderPage(page: number): Promise<string>;
  /**
   * 분석이 끝난 뒤: 가린 정보의 자리를 덮은 쪽 그림과 항목·근거의 자리를 만든다(lib/recordPages.ts). originals 는 서버에 보낸
   * 가리기 전 항목(같은 순서), result 는 받은 분석 결과다. 취소되거나 만들지 못하면 null(분석 결과는 그대로 쓴다).
   */
  buildPages(originals: readonly Section[], result: AnalysisResult, signal?: AbortSignal): Promise<RecordPages | null>;
  /** 문서를 닫는다(여러 번 불러도 된다) */
  close(): void;
};

/**
 * 학생부 PDF 를 열어 쪽마다 읽는 방법을 정하고, 글자가 있는 쪽은 바로 항목으로 읽는다.
 * 실패하면 화면 문구를 담은 RecordPdfError 를 던진다: 손상된 PDF·암호가 걸린 PDF(lib/pdf.ts 의 describePdfParseError 문구),
 * 쪽 수가 MAX_RECORD_PAGES 를 넘음, 그 밖에는 "PDF 를 읽지 못했습니다.".
 * PDF 라이브러리의 오류 문구는 화면에 넣지 않는다(영어이고, 학생부 내용이 섞일 수 있다).
 */
export async function openRecordPdf(file: File): Promise<OpenedRecord> {
  let pdf: Awaited<ReturnType<typeof getDocumentProxy>>;
  try {
    pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
  } catch (error) {
    throw new RecordPdfError(describePdfParseError(error));
  }

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    void pdf.loadingTask.destroy().catch(() => undefined);
  };

  try {
    const pageCount = pdf.numPages;
    if (pageCount > MAX_RECORD_PAGES) throw new RecordPdfError(tooManyPagesError(pageCount));

    // 쪽마다 보이는 글자 수와 그림이 덮은 넓이를 재서 글자가 없는 쪽을 찾는다(스캔본의 숨은 글자 층은 글자로 치지 않는다).
    const { pages } = await inspectPages(pdf);
    const scanned = new Set<number>();
    pages.forEach((page, index) => {
      const visible = page.textLength - page.invisibleTextLength;
      if (visible < MIN_TEXT_PAGE_CHARS || (page.imageCoverage >= SCAN_MIN_COVERAGE && visible < SCAN_MAX_CHARS)) {
        scanned.add(index + 1);
      }
    });

    let textSections: Section[] = [];
    let imagePages: RecordImagePage[] = [...scanned].map((page) => ({ page, text: null }));
    if (scanned.size < pageCount) {
      const report = await parsePdfDocument(pdf, { skipPages: scanned, allowEmpty: true });
      if (parserUnderstood(report)) {
        textSections = report.sections;
      } else {
        // 글자는 있는데 파서가 양식을 알아보지 못했다. 모든 쪽을 AI 가 읽게 하고, 글자가 있는 쪽은 뽑은 글자를 함께 보낸다.
        const { text } = await extractText(pdf, { mergePages: false });
        imagePages = Array.from({ length: pageCount }, (_, index) => {
          const page = index + 1;
          const pageText = scanned.has(page) ? "" : tidyPageText(text[index] ?? "");
          return { page, text: pageText === "" || pageText.length > MAX_PAGE_TEXT_LENGTH ? null : pageText };
        });
      }
    }

    return {
      pageCount,
      textSections,
      imagePages,
      close,
      renderPage: async (page) => {
        try {
          return await renderPage(pdf, page);
        } catch (error) {
          throw error instanceof RecordPdfError ? error : new RecordPdfError(RENDER_ERROR);
        }
      },
      buildPages: async (originals, result, signal) => {
        try {
          return await buildRecordPages({ pdf, scannedPages: scanned, originals, result, signal });
        } catch {
          return null;
        }
      },
    };
  } catch (error) {
    close();
    throw error instanceof RecordPdfError ? error : new RecordPdfError(describePdfParseError(error));
  }
}

/**
 * 파서가 이 문서의 양식을 알아보았는지: 서술형 항목(자율활동, 세부능력 및 특기사항 등)을 하나라도 읽었고,
 * 읽은 글자의 MIN_RECOGNIZED_RATIO 이상을 항목·항목 이름·표 구조로 알아보았고, 경고가 하나도 없고(처음 보는 표 머리글, 분류하지 못한 줄 등),
 * 모든 항목이 학생부 서식(lib/recordForm.ts)의 칸으로 읽혔을 때.
 * 파서는 가상 학생부의 표 모양에 맞춰져 있다. 실제 발급 학생부(별지 제8호 서식)는 표 머리글이 달라 일부만 맞는 경우가 있는데,
 * 그때 맞지 않는 표(예: 창의적 체험활동상황)가 통째로 한 항목이 되어 분석에서 빠지지 않도록, 조금이라도 어긋나면 AI 가 서식에 맞춰 읽게 한다.
 */
function parserUnderstood(report: ParseReport): boolean {
  const { stats } = report;
  const recognized = stats.sections + stats.labels + stats.structure;
  return (
    report.sections.some((section) => NARRATIVE_CATEGORIES.includes(section.category)) &&
    recognized >= stats.total * MIN_RECOGNIZED_RATIO &&
    report.warnings.length === 0 &&
    report.sections.every((section) => recordFormPart(section.fieldId)?.category === section.category)
  );
}

/** 쪽에서 뽑은 글을 정리한다: 줄바꿈을 뺀 연속 공백은 하나로, 줄 앞뒤 공백은 빼고, 빈 줄은 하나까지만 남긴다. */
function tidyPageText(text: string): string {
  return text
    .replace(/[^\S\n]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * 쪽 하나를 JPEG 로 그려 base64 문자열로 돌려준다. 어느 크기로도 한도 안에 들어오지 않으면 RecordPdfError.
 * PDF 라이브러리의 그리기를 intent "print" 로 부른다. 기본값(화면 표시용)은 그리기를 requestAnimationFrame 으로 나눠 하는데,
 * 탭이 뒤에 있거나 가려져 있으면 브라우저가 그 호출을 멈춰 그리기가 끝나지 않는다(여러 쪽을 읽는 동안 다른 탭을 볼 수 있다).
 * "print" 는 그 호출을 쓰지 않는다. 배경은 흰색으로 칠해진다(JPEG 는 투명을 담지 못한다).
 */
async function renderPage(pdf: Awaited<ReturnType<typeof getDocumentProxy>>, pageNumber: number): Promise<string> {
  // 스캔본에 흔한 그림 형식(JBIG2, JPEG 2000, CCITT)을 풀 수 있게 한다(여러 번 불러도 된다).
  registerImageDecoders();
  const page = await pdf.getPage(pageNumber);
  const view = page.getViewport({ scale: 1 });
  const longEdge = Math.max(view.width, view.height);
  let canvas: HTMLCanvasElement | null = null;
  let canvasEdge = 0;
  try {
    for (const preset of RENDER_PRESETS) {
      if (canvas === null || canvasEdge !== preset.edge) {
        const viewport = page.getViewport({ scale: preset.edge / longEdge });
        canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(viewport.width));
        canvas.height = Math.max(1, Math.round(viewport.height));
        canvasEdge = preset.edge;
        await page.render({ canvas, viewport, intent: "print" }).promise;
      }
      const dataUrl = canvas.toDataURL("image/jpeg", preset.quality);
      const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
      if (dataUrl.startsWith("data:image/jpeg") && base64.length <= MAX_PAGE_IMAGE_BASE64_LENGTH) return base64;
    }
  } finally {
    // 그린 그림의 메모리를 바로 돌려준다(쪽마다 수십 MB 다).
    if (canvas !== null) {
      canvas.width = 0;
      canvas.height = 0;
    }
    page.cleanup();
  }
  throw new RecordPdfError(RENDER_ERROR);
}
