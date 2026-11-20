import type { AnalysisResult } from "@/types/analysis";
import type { PrepCriteria } from "./prep/criteria.ts";
import { CONNECTION_ERROR, RequestCanceledError, readErrorMessage } from "./apiClient.ts";
import { requestLinkage } from "./linkageClient.ts";
import type { RecordPages } from "./recordPages.ts";
import type { OpenedRecord, RecordImagePage } from "./recordPdf.ts";
import { mergeRecordSections, readPageSections, type PageReading, type PageSection } from "./recordSections.ts";
import { isAnalysisResult } from "./validateResult.ts";

// 화면에서 학생부 PDF 를 분석한다. 지원자 관리의 학생부 올리기(hooks/useRecordUpload.ts)가 쓴다. 브라우저에서만 쓴다.
// PDF 파일은 서버로 보내지 않는다. 브라우저에서 PDF 를 읽어(lib/recordPdf.ts) 항목만 POST /api/analyze 로 보내고,
// 글자가 없는 쪽(과 파서가 양식을 알아보지 못한 문서의 쪽)은 쪽마다 그림 한 장을 POST /api/record-page 로 보내 AI 가 읽게 한다.
// 그래서 파일이 커도 배포 환경(Vercel)의 요청 본문 한도(4.5MB)에 걸리지 않는다.
// 분석이 끝나면 PDF 를 닫기 전에, 가린 정보의 자리를 덮은 쪽 그림과 항목·근거의 자리를 만든다(lib/recordPages.ts). 원문보기가 쓴다.

const FALLBACK_ERROR = "분석에 실패했습니다. 다시 시도해 주세요.";

/** PDF 를 읽지 못했는데 화면 문구를 담은 오류가 아닐 때 */
const PDF_READ_ERROR = "PDF 를 읽지 못했습니다.";

/** PDF 에서 항목을 하나도 읽지 못했을 때 (빈 PDF, 학생부가 아닌 그림 등) */
const NO_RECORD_ERROR = "PDF 에서 학생부 기록을 찾지 못했습니다. 학생부 PDF 인지 확인해 주세요.";

/** 이미지 쪽을 읽지 못했는데 서버가 준 문구가 없을 때 */
const PAGE_FALLBACK_ERROR = "이미지로 된 쪽을 읽지 못했습니다. 다시 시도해 주세요.";

/**
 * 413 인데 서버가 준 문구가 없을 때(배포 플랫폼이 요청을 앱보다 먼저 막은 경우) 보여 주는 문구.
 * 항목과 쪽 그림은 한도보다 작게 만들어 보내므로 보통은 나오지 않는다.
 */
const PLATFORM_TOO_LARGE_ERROR = "요청이 너무 커서 서버가 받지 못했습니다. 다른 PDF 로 다시 시도해 주세요.";

/**
 * 이미지 쪽을 한 번에 몇 쪽씩 읽는지 (쪽마다 AI 호출 하나). 쪽 하나에 13~23초가 걸려, 파서가 양식을 알아보지 못한 학생부(모든 쪽을 AI 가 읽는다)는
 * 이 값이 분석 시간을 정한다(26쪽이면 4쪽씩일 때 2분쯤). 그래서 8쪽씩 읽는다. 더 늘리면 AI 호출 한도에 걸리기 쉽다
 * (걸리면 서버가 502 를 주고, 그 쪽은 PAGE_RETRY_DELAY_MS 뒤에 한 번만 더 한다).
 */
const PAGE_CONCURRENCY = 8;

/** 이미지 쪽 하나를 읽는 요청의 시도 횟수 (연결 실패·서버 오류면 한 번 더 한다) */
const PAGE_ATTEMPTS = 2;

/** 이미지 쪽 요청을 다시 하기 전에 기다리는 시간(밀리초) */
const PAGE_RETRY_DELAY_MS = 3000;

export type AnalysisRequest = {
  /** 학생부 PDF */
  file: File;
  /** 전형 준비의 평가 기준 (근거를 찾고 AI 제안을 만드는 기준) */
  prepCriteria: PrepCriteria;
};

/** 분석이 어디까지 왔는지 (화면의 상태 글에 쓴다) */
export type AnalysisProgress =
  | { stage: "reading" }
  /** 이미지 쪽을 AI 가 읽는 중. done 은 다 읽은 쪽 수, total 은 읽어야 하는 쪽 수 */
  | { stage: "pages"; done: number; total: number }
  | { stage: "analyzing" }
  /** 분석이 끝나 근거 사이의 학년별 연계를 찾는 중 (AI 를 한 번 더 부른다) */
  | { stage: "linking" }
  /** 분석이 끝나 가린 쪽 그림을 만드는 중 */
  | { stage: "rendering" };

/** 분석이 돌려주는 것 */
export type AnalysisOutcome = {
  /** 분석 결과(가려진 원문, 근거, AI 제안, 만들었으면 학년별 연계) */
  result: AnalysisResult;
  /** 가린 쪽 그림과 항목·근거의 자리. 만들지 못했으면 null(원문보기는 글만 보여 준다) */
  pages: RecordPages | null;
  /** 학년별 연계를 결과에 붙였는지. 근거가 없어 만들 것이 없었거나 연결 찾기가 실패했으면 false */
  linked: boolean;
};

/**
 * 학생부 PDF 를 전형 준비의 평가 기준으로 분석해 결과(가려진 원문, 근거, AI 제안)를 받는다.
 * 1. 브라우저에서 PDF 를 읽는다(lib/recordPdf.ts 를 이때 불러온다). 글자가 있는 쪽은 여기서 항목이 된다.
 * 2. AI 가 읽어야 하는 쪽이 있으면 쪽마다 그림을 그려 POST /api/record-page 로 보낸다(한 번에 PAGE_CONCURRENCY 쪽씩).
 * 3. 항목을 쪽 순서로 합쳐(mergeRecordSections) 평가 기준과 함께 POST /api/analyze 로 보낸다.
 *    평가 기준은 { version, department, elements } 만 보낸다(모집요강 파일 이름과 변경 사항(guideline)은 분석에 쓰이지 않는다.
 *    배점은 저장 값 확인이 합계를 보므로 들어가지만 서버는 AI 에 보내지 않는다).
 * 4. 근거가 있으면 받은 결과로 학년별 연계를 받아 결과에 붙인다(POST /api/linkage. lib/linkageClient.ts). AI 를 한 번 더 부른다.
 *    실패해도 분석은 성공이다(linked 가 false 이고 결과에 linkage 가 없다. 평가하기의 총평에서 다시 만들 수 있다).
 * 5. 받은 결과(가려진 원문)와 보낸 항목(가리기 전)을 견주어 가린 정보의 자리를 덮은 쪽 그림을 만든다(record.buildPages).
 *    만들지 못해도 분석은 성공이다(pages 가 null).
 * - onProgress 로 단계가 바뀔 때와 이미지 쪽을 하나 읽을 때마다 알린다.
 * - 실패하면 화면에 보여 줄 문구를 담은 Error 를 던진다. 서버가 준 { error } 문구가 있으면(공백만 있는 문자열 제외) 그대로 쓴다.
 *   PDF 라이브러리의 오류 문구는 쓰지 않는다(lib/recordPdf.ts 가 화면 문구로 바꾼다).
 * - signal 로 취소되면(어느 단계에서든) RequestCanceledError 를 던진다.
 */
export async function requestAnalysis(
  request: AnalysisRequest,
  signal?: AbortSignal,
  onProgress?: (progress: AnalysisProgress) => void,
): Promise<AnalysisOutcome> {
  onProgress?.({ stage: "reading" });
  const record = await openRecord(request.file, signal);
  try {
    if (signal?.aborted) throw new RequestCanceledError();
    const readings = await readImagePages(record, signal, onProgress);
    const sections = mergeRecordSections(record.textSections, readings);
    if (sections.length === 0) throw new Error(NO_RECORD_ERROR);

    onProgress?.({ stage: "analyzing" });
    const { version, department, elements } = request.prepCriteria;
    const data = await postJson("/api/analyze", { sections, prepCriteria: { version, department, elements } }, signal, FALLBACK_ERROR);
    if (!isAnalysisResult(data)) throw new Error(FALLBACK_ERROR);

    // 분석이 끝난 뒤 근거 사이의 학년별 연계를 따로 받아 결과에 붙인다. 실패해도(취소가 아니면) 분석은 성공이고 연계 없이 남긴다
    // (평가하기의 총평에서 다시 만들 수 있다). 근거가 없으면 연계를 만들 것이 없어 부르지 않는다.
    let result: AnalysisResult = data;
    let linked = false;
    if (data.evidences.length > 0) {
      onProgress?.({ stage: "linking" });
      try {
        result = { ...data, linkage: await requestLinkage(data, signal) };
        linked = true;
      } catch (error) {
        if (error instanceof RequestCanceledError || signal?.aborted) throw new RequestCanceledError();
      }
    }

    onProgress?.({ stage: "rendering" });
    const pages = await record.buildPages(sections, result, signal);
    if (signal?.aborted) throw new RequestCanceledError();
    return { result, pages, linked };
  } finally {
    record.close();
  }
}

/** PDF 를 연다. PDF 읽기 모듈을 불러오지 못하면 연결 실패 문구, PDF 를 읽지 못하면 그 화면 문구를 담아 던진다. */
async function openRecord(file: File, signal: AbortSignal | undefined): Promise<OpenedRecord> {
  let recordPdf: typeof import("./recordPdf.ts");
  try {
    recordPdf = await import("./recordPdf.ts");
  } catch {
    if (signal?.aborted) throw new RequestCanceledError();
    throw new Error(CONNECTION_ERROR);
  }
  try {
    return await recordPdf.openRecordPdf(file);
  } catch (error) {
    if (signal?.aborted) throw new RequestCanceledError();
    throw new Error(error instanceof recordPdf.RecordPdfError ? error.message : PDF_READ_ERROR);
  }
}

/**
 * AI 가 읽어야 하는 쪽을 한 번에 PAGE_CONCURRENCY 쪽씩 읽는다. 쪽마다 그림을 그려 보내고, 다 읽은 쪽 수를 onProgress 로 알린다.
 * 한 쪽이라도 실패하면 나머지 요청을 취소하고 그 오류를 던진다(일부 쪽이 빠진 학생부로 분석하지 않는다).
 */
async function readImagePages(
  record: OpenedRecord,
  signal: AbortSignal | undefined,
  onProgress: ((progress: AnalysisProgress) => void) | undefined,
): Promise<PageReading[]> {
  const pages = record.imagePages;
  if (pages.length === 0) return [];

  // 한 쪽이 실패하면 진행 중인 다른 쪽의 요청도 끊는다. 밖에서 취소하면 같이 끊긴다.
  const controller = new AbortController();
  const abortInner = () => controller.abort();
  signal?.addEventListener("abort", abortInner);
  if (signal?.aborted) controller.abort();

  const readings: PageReading[] = [];
  let next = 0;
  onProgress?.({ stage: "pages", done: 0, total: pages.length });

  const worker = async () => {
    while (!controller.signal.aborted) {
      const target = pages[next];
      if (target === undefined) return;
      next += 1;
      const sections = await readImagePage(record, target, controller.signal);
      readings.push({ page: target.page, sections });
      onProgress?.({ stage: "pages", done: readings.length, total: pages.length });
    }
  };

  try {
    await Promise.all(Array.from({ length: Math.min(PAGE_CONCURRENCY, pages.length) }, worker));
  } catch (error) {
    controller.abort();
    if (signal?.aborted) throw new RequestCanceledError();
    throw error;
  } finally {
    signal?.removeEventListener("abort", abortInner);
  }
  if (signal?.aborted) throw new RequestCanceledError();
  return readings.sort((a, b) => a.page - b.page);
}

/** 쪽 하나를 그림으로 그려 /api/record-page 로 보내고 그 쪽의 항목을 받는다. 연결 실패·서버 오류(5xx)면 한 번 더 한다. */
async function readImagePage(record: OpenedRecord, target: RecordImagePage, signal: AbortSignal): Promise<PageSection[]> {
  let image: string;
  try {
    image = await record.renderPage(target.page);
  } catch (error) {
    throw new Error(error instanceof Error && error.name === "RecordPdfError" ? error.message : PDF_READ_ERROR);
  }
  const body = target.text === null ? { image } : { image, text: target.text };

  let lastError: unknown = new Error(PAGE_FALLBACK_ERROR);
  for (let attempt = 0; attempt < PAGE_ATTEMPTS; attempt += 1) {
    // 다시 할 때는 잠깐 기다린다(호출 한도에 걸린 경우 바로 다시 보내면 또 걸린다).
    if (attempt > 0) await wait(PAGE_RETRY_DELAY_MS, signal);
    if (signal.aborted) throw new RequestCanceledError();
    try {
      const data = await postJson("/api/record-page", body, signal, PAGE_FALLBACK_ERROR);
      const sections =
        typeof data === "object" && data !== null && "sections" in data ? readPageSections(data.sections) : null;
      if (sections === null) throw new RetryableError(PAGE_FALLBACK_ERROR);
      return sections;
    } catch (error) {
      if (!(error instanceof RetryableError)) throw error;
      lastError = error;
    }
  }
  throw lastError;
}

/** ms 만큼 기다린다. 취소되면 바로 끝난다(취소 여부는 부른 쪽이 본다). */
function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener("abort", done);
  });
}

/** 다시 해 볼 만한 실패(연결 실패, 서버 오류 5xx, 읽을 수 없는 응답). message 는 화면 문구다. */
class RetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetryableError";
  }
}

/**
 * JSON 을 POST 하고 응답 JSON 을 돌려준다.
 * - 취소되면 RequestCanceledError.
 * - 서버에 닿지 못하면 RetryableError(연결 실패 문구), 5xx 면 RetryableError(서버가 준 문구 또는 fallback).
 * - 그 밖의 실패(4xx)는 Error(서버가 준 문구, 문구 없는 413 은 PLATFORM_TOO_LARGE_ERROR, 그 밖에는 fallback).
 */
async function postJson(url: string, body: unknown, signal: AbortSignal | undefined, fallback: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch {
    if (signal?.aborted) throw new RequestCanceledError();
    throw new RetryableError(CONNECTION_ERROR);
  }

  const data: unknown = await response.json().catch(() => null);
  if (signal?.aborted) throw new RequestCanceledError();
  if (!response.ok) {
    const message = readErrorMessage(data) ?? (response.status === 413 ? PLATFORM_TOO_LARGE_ERROR : fallback);
    throw response.status >= 500 ? new RetryableError(message) : new Error(message);
  }
  return data;
}
