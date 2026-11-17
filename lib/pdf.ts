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
