// 모집요강의 쪽별 글에서 AI 에 보낼 글을 고른다(24,000자 이하). 순수 함수라 브라우저와 Node 어디서나 돈다.
// /api/guideline(서버)이 쓰고, scripts/check-guideline.ts 가 지어낸 입력으로 확인한다.
//
// 규칙
// - 쪽마다 "[<쪽 번호>쪽]" 한 줄을 앞에 붙인 덩어리를 빈 줄 하나("\n\n")로 이어 붙인다. 글자가 없는 쪽(공백뿐인 쪽 포함)은
//   덩어리를 만들지 않고 읽은 쪽으로 센다(읽을 것이 없으므로 다 읽은 것이다. 빈 쪽 때문에 "골라 읽었다"는 경고가 나지 않게).
// - 이어 붙인 전체가 24,000자 이하면 전체를 쪽 순서대로 쓴다.
// - 넘으면 쪽마다 점수(낱말이 나온 횟수의 합. 공백을 모두 뺀 글에서, 한 낱말 안에서는 겹치지 않게 센다)를 매겨 점수가 높은 쪽부터
//   (같으면 앞쪽부터) 24,000자를 넘지 않는 데까지 담고, 담은 쪽을 쪽 순서로 되돌린다. 통째로 들어가지 않는 쪽은 건너뛰고 다음 쪽을 본다.
//   점수 순서로 처음 보는 쪽 하나가 혼자서 24,000자를 넘으면 그 덩어리의 앞 24,000자만 쓴다(그 뒤로는 자리가 없다).
// 글자 수는 JS 문자열 length(UTF-16 단위)로 센다.

/** AI 에 보내는 글의 최대 길이 */
export const MAX_GUIDELINE_TEXT_LENGTH = 24_000;

/** 쪽 점수에 쓰는 낱말 (모집 단위 이름은 따로 더한다) */
export const GUIDELINE_KEYWORDS: readonly string[] = [
  "학생부종합",
  "서류평가",
  "평가요소",
  "평가항목",
  "평가기준",
  "평가내용",
  "인재상",
  "반영비율",
  "배점",
  "변경사항",
];

/** 덩어리 사이 구분 (빈 줄 하나) */
const PAGE_SEPARATOR = "\n\n";

export type GuidelineSelection = {
  /** AI 에 보낼 글 (24,000자 이하) */
  text: string;
  /** 읽은 쪽 수 (보낼 글에 들어간 쪽과 글자가 없는 쪽. 혼자서 한도를 넘어 앞부분만 들어간 쪽도 센다) */
  pagesRead: number;
  /** 전체 쪽 수 */
  pagesTotal: number;
};

/** 공백(줄바꿈 포함)을 모두 뺀 글 */
function squash(text: string): string {
  return text.replace(/\s+/g, "");
}

/** text 안에서 word 가 겹치지 않게 나온 횟수 */
function countOccurrences(text: string, word: string): number {
  if (word === "") return 0;
  return text.split(word).length - 1;
}

/** 쪽 점수: 낱말과 모집 단위 이름(공백을 뺀 값)이 공백을 뺀 쪽 글에 나온 횟수의 합 */
export function scoreGuidelinePage(pageText: string, department: string): number {
  const squashed = squash(pageText);
  const words = [...GUIDELINE_KEYWORDS, squash(department)];
  return words.reduce((sum, word) => sum + countOccurrences(squashed, word), 0);
}

/** 글을 앞에서 max 글자로 자른다. 자른 자리에서 서로게이트 쌍이 반으로 갈리면 남은 반쪽도 버린다. */
function cutText(text: string, max: number): string {
  if (text.length <= max) return text;
  let cut = text.slice(0, max);
  const last = cut.charCodeAt(cut.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) cut = cut.slice(0, -1);
  return cut;
}

/**
 * 쪽별 글(pages[0] 이 1쪽)과 모집 단위 이름으로 AI 에 보낼 글을 고른다. 규칙은 이 파일 맨 위 주석.
 * 모든 쪽에 글자가 없으면 text 는 빈 문자열이다(호출한 쪽이 먼저 걸러 낸다).
 */
export function selectGuidelineText(
  pages: readonly string[],
  department: string,
  maxLength: number = MAX_GUIDELINE_TEXT_LENGTH,
): GuidelineSelection {
  const pagesTotal = pages.length;
  const blocks = pages
    .map((pageText, index) => ({ index, pageText: pageText.trim() }))
    .filter((page) => page.pageText !== "")
    .map((page) => ({ index: page.index, block: `[${page.index + 1}쪽]\n${page.pageText}`, pageText: page.pageText }));
  const emptyPages = pagesTotal - blocks.length;

  const whole = blocks.map((item) => item.block).join(PAGE_SEPARATOR);
  if (whole.length <= maxLength) {
    return { text: whole, pagesRead: pagesTotal, pagesTotal };
  }

  // 점수가 높은 쪽부터, 같으면 앞쪽부터 (sort 는 안정 정렬이라 같은 점수는 쪽 순서 그대로다).
  const ranked = blocks
    .map((item) => ({ ...item, score: scoreGuidelinePage(item.pageText, department) }))
    .sort((a, b) => b.score - a.score);

  const chosen: typeof ranked = [];
  let length = 0;
  for (const item of ranked) {
    const added = (chosen.length === 0 ? 0 : PAGE_SEPARATOR.length) + item.block.length;
    if (length + added <= maxLength) {
      chosen.push(item);
      length += added;
    } else if (chosen.length === 0 && item === ranked[0]) {
      // 점수 순서로 처음 보는 쪽 하나가 혼자서 한도를 넘는다: 그 덩어리의 앞부분만 쓴다(그 쪽은 읽은 쪽으로 센다).
      return { text: cutText(item.block, maxLength), pagesRead: emptyPages + 1, pagesTotal };
    }
  }
  chosen.sort((a, b) => a.index - b.index);
  return {
    text: chosen.map((item) => item.block).join(PAGE_SEPARATOR),
    pagesRead: emptyPages + chosen.length,
    pagesTotal,
  };
}
