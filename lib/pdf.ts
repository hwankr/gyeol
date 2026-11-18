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

/** PDF 가 손상되었거나 PDF 형식이 아닐 때 보여 주는 문구 */
export const PDF_DAMAGED_ERROR = "PDF 파일이 손상되었거나 올바른 PDF 형식이 아닙니다. 파일을 확인한 뒤 다시 올려 주세요.";

/** 암호가 걸린 PDF 일 때 보여 주는 문구 */
export const PDF_PASSWORD_ERROR = "암호가 걸린 PDF 는 읽을 수 없습니다. 암호를 해제한 PDF 를 올려 주세요.";

/** PDF 를 읽지 못했는데 원인을 한국어로 설명할 수 없을 때 보여 주는 문구 */
export const PDF_PARSE_ERROR = "PDF 를 읽지 못했습니다.";

/**
 * PDF 파싱 오류를 업로드 화면에 보여 줄 한국어 문구로 바꾼다.
 * - 파서(lib/pipeline/parsePdf.ts)가 직접 쓴 한국어 안내(예: 글자가 없는 이미지 PDF)는 그대로 돌려준다.
 * - PDF 라이브러리(pdf.js)가 던지는 오류는 문구가 영어라서(예: "Invalid PDF structure.") 오류 종류(name)로 구분해 한국어 문구로 바꾼다.
 * - 그 밖에 한글이 없는 문구는 화면에 내보내지 않고 일반 문구로 바꾼다.
 */
export function describePdfParseError(error: unknown): string {
  if (!(error instanceof Error)) return PDF_PARSE_ERROR;
  if (error.name === "PasswordException") return PDF_PASSWORD_ERROR;
  if (error.name === "InvalidPDFException") return PDF_DAMAGED_ERROR;
  return /[가-힣]/.test(error.message) ? error.message : PDF_PARSE_ERROR;
}
