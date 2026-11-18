const CHAR_MAP: Record<string, string> = { "‘": "'", "’": "'", "“": '"', "”": '"', "ㆍ": "·", "・": "·", "‧": "·" };
const norm = (ch: string) => CHAR_MAP[ch] ?? ch;

/**
 * AI가 인용한 문장을 원문에서 찾아, 원문에 적힌 그대로의 구절을 돌려준다.
 * 공백·줄바꿈·따옴표 모양의 차이는 무시한다. 원문에 없으면 null.
 */
export function locateQuote(text: string, quote: string): string | null {
  const q = quote.trim();
  if (!q) return null;
  if (text.includes(q)) return q;

  const positions: number[] = []; // 공백을 뺀 글자가 원문의 몇 번째 글자인지
  let squashed = "";
  for (let i = 0; i < text.length; i++) {
    if (/\s/.test(text[i])) continue;
    positions.push(i);
    squashed += norm(text[i]);
  }
  const target = [...q].filter((ch) => !/\s/.test(ch)).map(norm).join("");
  if (!target) return null;

  const at = squashed.indexOf(target);
  if (at === -1) return null;
  return text.slice(positions[at], positions[at + target.length - 1] + 1);
}
