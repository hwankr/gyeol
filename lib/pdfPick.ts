import {
  MAX_RECORD_PDF_BYTES,
  PDF_TOO_LARGE_ERROR,
  RECORD_PDF_TOO_LARGE_ERROR,
  isPdfFile,
  isPdfTooLarge,
} from "./pdf.ts";

// 화면에서 PDF 를 고를 때 같이 쓰는 것: 고른 파일 확인, 크기 글, 파일 입력란에서 파일 꺼내기.
// 전형 준비의 모집요강 올리기(hooks/useGuidelineUpload.ts)와 지원자 관리의 학생부 올리기(hooks/useRecordUpload.ts)가 쓴다. 브라우저에서만 쓴다.

/** PDF 가 아닌 파일을 골랐을 때의 문구 */
export const NOT_PDF_ERROR = "PDF 파일만 선택할 수 있습니다.";

/** 고른 파일의 확인: 통과하면 그 파일, 걸리면 오류 문구. 서버와 같은 함수(lib/pdf.ts)로 본다(PDF 인지, 10MB 이하인지). */
export function checkPdfFile(file: File): { file: File | null; fileError: string | null } {
  if (!isPdfFile(file)) return { file: null, fileError: NOT_PDF_ERROR };
  if (isPdfTooLarge(file)) return { file: null, fileError: PDF_TOO_LARGE_ERROR };
  return { file, fileError: null };
}

/**
 * 고른 학생부 파일의 확인: PDF 인지, 50MB 이하인지(MAX_RECORD_PDF_BYTES). 학생부는 브라우저에서 읽고 파일을 서버로 보내지 않아
 * 모집요강(checkPdfFile, 10MB)보다 크게 받는다. 쪽 수(60쪽 이하)는 분석을 시작해 PDF 를 열 때 확인한다(lib/recordPdf.ts).
 */
export function checkRecordPdfFile(file: File): { file: File | null; fileError: string | null } {
  if (!isPdfFile(file)) return { file: null, fileError: NOT_PDF_ERROR };
  if (file.size > MAX_RECORD_PDF_BYTES) return { file: null, fileError: RECORD_PDF_TOO_LARGE_ERROR };
  return { file, fileError: null };
}

/** 고른 파일의 크기 글: 1MB 이상이면 "2.4 MB"(소수 한 자리), 아니면 "380 KB"(반올림, 1 보다 작으면 1). 디자인의 표기 그대로다. */
export function formatFileSize(bytes: number): string {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * 파일 입력란에 들어 있는 첫 파일을 꺼내고 입력란을 비운다. 비워 두어야 같은 파일을 다시 골라도 change 가 일어난다.
 * (입력란을 새로 만들지 않고 값만 비우므로 키보드 초점은 그대로다.)
 */
export function takeInputFile(input: HTMLInputElement | null): File | null {
  const file = input?.files?.[0];
  if (input === null || file === undefined) return null;
  input.value = "";
  return file;
}
