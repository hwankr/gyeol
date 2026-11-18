/** 올릴 수 있는 PDF 파일의 최대 크기(바이트). 업로드 화면과 /api/analyze 가 같은 값을 쓴다. 정확히 이 크기까지는 허용한다. */
export const MAX_PDF_BYTES = 10 * 1024 * 1024;

/** PDF 파일이 최대 크기를 넘었을 때 보여 주는 문구 */
export const PDF_TOO_LARGE_ERROR = "파일이 너무 큽니다. 10MB 이하의 PDF 만 올릴 수 있습니다.";

/**
 * PDF 파일인지 확인한다. 파일 내용은 읽지 않고 이름과 형식(MIME)만 본다.
 * - 이름이 .pdf 로 끝나야 한다(대소문자 무시).
 * - 형식이 적혀 있으면 application/pdf 여야 한다. (브라우저가 형식을 비워 보내는 경우는 허용)
 */
export function isPdfFile(file: { name: string; type: string }): boolean {
  const hasPdfName = file.name.toLowerCase().endsWith(".pdf");
  const hasPdfType = file.type === "" || file.type === "application/pdf";
  return hasPdfName && hasPdfType;
}

/** 파일이 최대 크기(MAX_PDF_BYTES)를 넘는지 확인한다. */
export function isPdfTooLarge(file: { size: number }): boolean {
  return file.size > MAX_PDF_BYTES;
}
