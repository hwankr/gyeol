import { extractText } from "unpdf";

// 모집요강 PDF → 쪽별 글(문자열 배열, [0] 이 1쪽).
// 학생부 파서(./parsePdf.ts)는 학생부 양식에 맞춘 것이라 쓰지 않고, 같은 PDF 라이브러리(unpdf, pdf.js)로 쪽마다 글 조각을
// 이어 붙인다(조각 끝에 줄바꿈 표시가 있으면 줄을 바꾼다). 대상은 글자가 들어 있는 텍스트 PDF 다.
//
// 이 파일은 서버에서만 가져온다(app/api/guideline/route.ts, scripts/check-guideline.ts).
// scripts 가 Node 로 직접(타입 제거 실행) 돌리므로 값 import 는 상대 경로에 .ts 확장자를 붙인다(외부 패키지 제외).

/** 모든 쪽에 글자가 없을 때의 문구 (화면에 그대로 보여 준다) */
export const GUIDELINE_NO_TEXT_ERROR =
  "PDF 에서 글자를 찾지 못했습니다. 스캔본이나 이미지로 된 PDF 는 지원하지 않습니다. 글자가 들어 있는 텍스트 PDF 를 올려 주세요.";

/** 모든 쪽에 글자가 없을 때 던지는 오류. message 는 GUIDELINE_NO_TEXT_ERROR 다. */
export class GuidelineNoTextError extends Error {
  constructor() {
    super(GUIDELINE_NO_TEXT_ERROR);
    this.name = "GuidelineNoTextError";
  }
}

/**
 * 쪽 하나의 글을 정리한다: 줄바꿈을 뺀 연속 공백은 하나로, 줄 앞뒤 공백은 빼고, 빈 줄은 하나까지만 남기고, 앞뒤 공백을 뺀다.
 * 줄 구조는 그대로 둔다(AI 가 표의 행과 항목을 구분할 수 있게).
 */
function tidyPage(text: string): string {
  return text
    .replace(/[^\S\n]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * PDF 를 쪽별 글로 읽는다. 쪽 수만큼의 배열을 돌려주고, 글자가 없는 쪽은 빈 문자열이다.
 * - 모든 쪽에 글자가 없으면 GuidelineNoTextError 를 던진다.
 * - 손상된 PDF·암호가 걸린 PDF 는 PDF 라이브러리의 오류(InvalidPDFException, PasswordException 등)를 그대로 던진다
 *   (호출한 쪽이 문구를 고른다: app/api/guideline/route.ts 의 pdfReadErrorMessage 가 글자 없음·암호·손상·그 밖 넷으로 나눠
 *   lib/pdf.ts 의 문구를 돌려준다. 오류의 문구는 응답에 싣지 않는다).
 * 문서는 읽은 뒤 닫는다(unpdf 의 extractText 가 닫는다).
 */
export async function readGuidelinePages(input: ArrayBuffer | Uint8Array): Promise<string[]> {
  // pdf.js 가 버퍼를 가져가므로 복사본을 넘긴다(./parsePdf.ts 와 같은 이유).
  const data = input instanceof Uint8Array ? new Uint8Array(input) : new Uint8Array(input.slice(0));
  const { text } = await extractText(data, { mergePages: false });
  const pages = text.map(tidyPage);
  if (!pages.some((page) => page !== "")) throw new GuidelineNoTextError();
  return pages;
}
