/** 올릴 수 있는 PDF 파일의 최대 크기(바이트). 화면(학생부 올리기, 모집요강 올리기)과 서버가 같은 값을 쓴다. 정확히 이 크기까지는 허용한다. */
export const MAX_PDF_BYTES = 10 * 1024 * 1024;

/** PDF 파일이 최대 크기를 넘었을 때 보여 주는 문구 */
export const PDF_TOO_LARGE_ERROR = "파일이 너무 큽니다. 10MB 이하의 PDF 만 올릴 수 있습니다.";

/**
 * 학생부 PDF 의 최대 크기(바이트). 정확히 이 크기까지는 허용한다. 학생부는 브라우저에서 읽고 파일을 서버로 보내지 않으므로
 * (lib/recordPdf.ts) 서버로 보내는 모집요강(MAX_PDF_BYTES)보다 크게 받는다. 스캔한 학생부는 수십 MB 가 될 수 있다.
 */
export const MAX_RECORD_PDF_BYTES = 50 * 1024 * 1024;

/** 학생부 PDF 가 최대 크기를 넘었을 때 보여 주는 문구 */
export const RECORD_PDF_TOO_LARGE_ERROR = "파일이 너무 큽니다. 50MB 이하의 PDF 만 올릴 수 있습니다.";

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
 * 파서(lib/pipeline/parsePdf.ts)가 글자가 없는 PDF(스캔본, 이미지 PDF)에 직접 쓰는 안내 문구. 쪽 수만 달라지고 나머지는 글자 그대로 맞춘다.
 * 파서의 문구가 바뀌면 이것도 같이 고친다(고치지 않으면 일반 문구 PDF_PARSE_ERROR 로 바뀐다).
 * 학생부 올리기는 글자가 없는 쪽을 AI 가 읽게 하므로(lib/recordPdf.ts) 이 문구가 나오지 않는다. 파서를 바로 부르는 스크립트에서 나온다.
 */
const PARSER_NO_TEXT_MESSAGE =
  /^PDF \d+쪽에서 글자를 찾지 못했습니다\. 스캔본이나 이미지로 된 PDF는 지원하지 않습니다\. 글자가 들어 있는 텍스트 PDF를 올려주세요\.$/;

/**
 * PDF 파싱 오류를 학생부 올리기 화면에 보여 줄 한국어 문구로 바꾼다. 브라우저에서 PDF 를 읽는 lib/recordPdf.ts 가 쓴다.
 * - 파서(lib/pipeline/parsePdf.ts)가 직접 쓴 안내 문구로 확인된 것(PARSER_NO_TEXT_MESSAGE)만 그대로 돌려준다.
 * - PDF 라이브러리(pdf.js)가 던지는 오류는 문구가 영어라서(예: "Invalid PDF structure.") 오류 종류(name)로 구분해 한국어 고정 문구로 바꾼다.
 * - 그 밖의 오류는 한글이 들어 있어도 일반 문구로 바꾼다. 오류 문구에는 가리기 전 학생부 내용(이름·학교명 등)이 섞일 수 있어서
 *   응답에 그대로 싣지 않는다.
 * - 어떤 값에도 예외를 던지지 않는다. name·message 는 한 번씩만 읽고 확인한 그 값만 쓰며, 읽다가 예외가 나면(getter, Proxy 등)
 *   일반 문구(PDF_PARSE_ERROR)를 돌려준다.
 */
export function describePdfParseError(error: unknown): string {
  try {
    if (!(error instanceof Error)) return PDF_PARSE_ERROR;
    const name: unknown = error.name;
    if (name === "PasswordException") return PDF_PASSWORD_ERROR;
    if (name === "InvalidPDFException") return PDF_DAMAGED_ERROR;
    const message: unknown = error.message;
    return typeof message === "string" && PARSER_NO_TEXT_MESSAGE.test(message) ? message : PDF_PARSE_ERROR;
  } catch {
    return PDF_PARSE_ERROR;
  }
}
