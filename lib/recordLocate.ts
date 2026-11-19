import type { Evidence, Section } from "@/types/analysis";
import { RECORD_FORM_LINED_CATEGORIES, RECORD_FORM_PARTS } from "./recordForm.ts";

// 학생부 항목과 근거 구절이 실제 PDF 의 어디에 있는지 찾고, 가린 정보가 PDF 쪽의 어디에 있는지 찾는다. 순수 함수 모음.
// 원문보기의 "PDF 에서 보기" 가 쓴다: 올릴 때 브라우저가 PDF 의 글자와 자리를 읽어(lib/recordPages.ts) 여기서 자리를 찾고,
// 가린 정보의 자리를 덮은 쪽 그림을 만들어 남긴다. 평가자가 보는 쪽 그림에는 가리기 전 정보가 남지 않아야 하므로,
// 가릴 자리를 다 찾았다고 확인하지 못한 쪽은 그림을 만들지 않는다(unverified).
//
// 방식
// 1. 글자 줄(RecordStream): PDF 의 쪽마다 글자 조각을 줄로 묶어, 공백을 뺀 글자를 읽는 순서로 한 줄의 글로 잇고 글자마다 자리를 붙인다.
// 2. 항목 맞추기(alignToStream): 항목의 가리기 전 원문(공백을 뺀 글)을 그 글에서 찾는다. 표의 다른 칸이 사이에 끼어 있거나 쪽이 넘어가도
//    이어서 찾고(짧은 토막을 다시 찾아 이어 간다), AI 가 옮겨 적으며 달라진 글자는 건너뛴다.
// 3. 가린 자리: 서버가 돌려준 가려진 원문과 가리기 전 원문을 견주어 가린 구간을 찾고(unmaskSpans), 그 글자의 자리를 덮는다.
//    같은 글(이름·학교명 등)이 항목 밖(쪽 머리말·꼬리말 등)에 또 나오면 그 자리도 모두 덮는다. 인적·학적사항과 머리 부분은 통째로 덮는다:
//    쪽의 맨 위부터 서식의 다음 제목("2. 출결상황") 바로 위까지다(제목은 학생부 서식 lib/recordForm.ts 의 것을 PDF 의 글자에서 찾는다).
// 가리기 전 원문은 이 계산에만 쓰고 결과(자리 목록)에는 글자가 들어가지 않는다.
// Node 로 직접(타입 제거 실행) 돌릴 수 있게 값 import 는 상대 경로에 .ts 확장자를 붙인다.

/** 쪽 위의 네모: [쪽 번호(1부터), 왼쪽, 위, 너비, 높이]. 자리는 쪽 크기에 대한 비율(0~1)이고 왼쪽 위가 원점이다. */
export type PageRect = readonly [page: number, x: number, y: number, w: number, h: number];

/** PDF 한 쪽에서 읽은 글자 조각 */
export type PageItems = {
  /** 쪽 번호(1부터) */
  page: number;
  /** 쪽의 크기(pt) */
  width: number;
  height: number;
  /** 글자 조각: x 는 왼쪽 끝, y 는 글자 밑줄(기준선)의 높이(위에서부터), w 는 너비, size 는 글자 크기. 모두 pt. */
  items: readonly { str: string; x: number; y: number; w: number; size: number }[];
};

/** 문서 전체의 글자 줄: 공백을 뺀 글자를 읽는 순서(쪽 → 위에서 아래 → 왼쪽에서 오른쪽)로 이은 글과 글자마다의 자리 */
export type RecordStream = {
  text: string;
  /** 글자마다: 쪽 번호 */
  page: number[];
  /** 글자마다: 자리(쪽 크기에 대한 비율). y 는 글자 상자의 위쪽 */
  x: number[];
  y: number[];
  w: number[];
  h: number[];
  /** 글자마다: 같은 줄의 같은 토막이면 같은 번호 (네모를 합칠 때 쓴다) */
  run: number[];
  /** 쪽마다: 그 쪽의 글자가 text 에서 차지하는 범위 [start, end) */
  ranges: Map<number, readonly [number, number]>;
};

/** 같은 줄로 보는 기준선 높이 차이(pt)의 하한. 글자 크기의 0.3 배와 견주어 큰 쪽을 쓴다 */
const LINE_TOLERANCE = 2;

/** 글자 조각 사이가 이보다(pt) 벌어지면 다른 토막(표의 다른 칸)으로 본다 */
const RUN_GAP = 8;

/** 글자 상자: 기준선 위로 글자 크기의 이만큼, 아래로 이만큼 */
const ASCENT = 0.88;
const DESCENT = 0.24;

/** 가린 자리를 덮을 때 글자 상자에 더하는 여유(글자 크기의 배수). 글자 조각 안의 글자 자리는 너비를 나눠 어림한 값이라 넉넉히 덮는다 */
const COVER_PAD_X = 0.6;
const COVER_PAD_Y = 0.16;

/** 항목을 맞출 때 처음 찾는 토막의 길이와 이어서 찾는 토막의 길이(글자 수) */
const FIRST_ANCHOR = 10;
const NEXT_ANCHOR = 6;

/** 맞추던 자리에서 다음 토막을 찾는 범위(글자 수): 표의 다른 칸, 쪽 머리말·꼬리말을 건너뛸 만큼 */
const JUMP_WINDOW = 1500;

/** 이보다 짧은 토막은 맞추던 자리 가까이(NEAR_WINDOW 글자 안)에서 찾았을 때만 받는다. MIN_ANCHOR 글자보다 짧은 토막은 찾지 않는다 */
const SHORT_ANCHOR = 6;
const MIN_ANCHOR = 3;
const NEAR_WINDOW = 120;

/** 온 세상 찾기(같은 글이 항목 밖에 또 나오는 곳)에 쓰는 글의 가장 짧은 길이 */
const MIN_GLOBAL_LENGTH = 2;

/** 쪽 머리말·꼬리말로 보는 띠(쪽 높이에 대한 비율): 이 안의 줄 가운데 어느 항목에도 속하지 않는 줄은 덮는다 */
const MARGIN_BAND = 0.045;

/**
 * 쪽마다 되풀이되는 줄(머리말·꼬리말)로 보는 기준: 어느 항목에도 속하지 않는 같은 글(숫자는 빼고 견준다. 쪽 번호가 달라도 같은 줄이다)이
 * 문서의 쪽 절반 이상(적어도 2쪽)에서 같은 높이(쪽 높이의 REPEAT_Y_STEP 단위로 견주어 이웃한 칸까지)에 나오면 그 글이 나오는 모든 곳을 덮는다.
 * 높이가 다른 곳(마지막 쪽의 꼬리말 등)도 함께 덮인다. 글이 MIN_REPEAT_LENGTH 글자보다 짧으면 보지 않는다.
 */
const REPEAT_Y_STEP = 0.01;
const MIN_REPEAT_LENGTH = 4;

/** 쪽에서 시작하는 서술형 항목의 원문 가운데 자리를 찾은 글자가 이 비율보다 적으면, 그 쪽의 글자를 믿을 수 없다고 보고 그림을 만들지 않는다 */
const MIN_MATCHED_RATIO = 0.7;

/** 인적·학적사항의 원문 가운데 자리를 찾은 글자가 이 비율보다 적으면 자리를 다 찾지 못한 것으로 본다 */
const MIN_IDENTITY_RATIO = 0.9;

/** 인적·학적사항을 덮는 범위에 위아래로 더하는 여유와, 다음 항목의 첫 글자 위로 남기는 틈(쪽 높이에 대한 비율) */
const IDENTITY_PAD = 0.01;
const IDENTITY_GAP = 0.02;

/** 서식의 다음 제목 위로 남기는 틈(쪽 높이에 대한 비율): 제목 줄은 덮지 않는다 */
const HEADING_GAP = 0.004;

/**
 * 인적·학적사항의 자리를 다 찾았을 때, 찾은 범위의 아래쪽 끝에서 이 높이(쪽 높이에 대한 비율) 안에 서식의 다음 제목이 있으면 거기까지 덮는다
 * (찾지 못한 마지막 줄이 남지 않게). 더 멀리 있으면 찾은 범위까지만 덮는다.
 */
const HEADING_REACH = 0.12;

/** 서식의 번호 붙은 제목 가운데 인적·학적사항 다음에 오는 것들: "2.출결상황", "3.수상경력" … (접은 글) */
const NEXT_HEADINGS: readonly string[] = [
  ...new Set(RECORD_FORM_PARTS.filter((part) => part.no >= 2).map((part) => `${part.no}.${part.heading.replace(/\s/g, "")}`)),
];

/** 가린 자리 표시: lib/pipeline/blind.ts 가 넣는 여섯 가지 */
const MASK_LABEL = /\[(?:블라인드|주민등록번호|전화번호|학교명|대학명|이름)\]/g;

/** 인적·학적사항으로 보는 항목(값 전체를 가린다): blind.ts 의 isIdentity 와 같다 */
function isIdentity(section: Pick<Section, "category" | "fieldId">): boolean {
  return section.fieldId === "S01" || section.category === "인적·학적사항";
}

const round = (value: number) => Math.round(value * 10000) / 10000;

/* ------------------------------------------------------------------ */
/* 글자 접기: 맞출 때 같은 글자로 보는 것을 하나로                      */
/* ------------------------------------------------------------------ */

type Segmenter = { segment(input: string): Iterable<{ segment: string; index: number }> };

const graphemeSegmenter: Segmenter | null =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? (new (Intl as unknown as { Segmenter: new (locale?: string, options?: object) => Segmenter }).Segmenter(undefined, {
        granularity: "grapheme",
      }) as Segmenter)
    : null;

/** 글을 글자(자소 묶음) 단위로 나눈다. 묶음마다 원래 글에서의 시작 자리가 붙는다 */
function* graphemes(text: string): Generator<{ segment: string; index: number }> {
  if (graphemeSegmenter !== null) {
    yield* graphemeSegmenter.segment(text);
    return;
  }
  let index = 0;
  for (const segment of text) {
    yield { segment, index };
    index += segment.length;
  }
}

/**
 * 글자 하나를 접는다: 호환 글자를 풀고(NFKC: 전각 → 반각, ㎝ → cm, Ⅰ → I 등), 따옴표·줄표·가운뎃점(서식에 쓰이는 아래아 "ㆍ" 포함)을
 * 한 가지로 맞추고, 공백과 보이지 않는 글자를 뺀다. 결과는 0글자 이상이다. PDF 의 글자와 AI 가 옮겨 적은 글자가 모양만 다른 경우를 같게 본다.
 */
function foldGrapheme(segment: string): string {
  return segment
    .normalize("NFKC")
    .replace(/[\s\u200B-\u200D\uFEFF\u00AD]/g, "")
    .replace(/[\u2018\u2019\u201A\u201B\u2032`\u00B4]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
    .replace(/[\u2010-\u2015\u2212\u2500\u30FC]/g, "-")
    .replace(/[\u00B7\u318D\u119E\u30FB\u2022\u2219\u22C5\u0387]/g, "\u00B7");
}

/** 접은 글과, 접은 글의 글자마다 원래 글에서의 자리 */
export type FoldedText = { folded: string; map: number[] };

/** 글을 접는다(foldGrapheme). drop 에 든 글자는 뺀다(표 모양 원문의 칸 구분 "|" 등) */
export function foldText(text: string, drop = ""): FoldedText {
  let folded = "";
  const map: number[] = [];
  for (const { segment, index } of graphemes(text)) {
    for (const char of foldGrapheme(segment)) {
      if (drop.includes(char)) continue;
      folded += char;
      for (let unit = 0; unit < char.length; unit += 1) map.push(index);
    }
  }
  return { folded, map };
}

/* ------------------------------------------------------------------ */
/* 1. 글자 줄 만들기                                                    */
/* ------------------------------------------------------------------ */

/** 글자의 너비 어림: 한글·한자·전각은 1, 그 밖(영문·숫자·문장 부호)은 0.55, 공백은 0.3 */
function glyphWeight(segment: string): number {
  if (/^\s+$/.test(segment)) return 0.3;
  const code = segment.codePointAt(0) ?? 0;
  const wide =
    (code >= 0x1100 && code <= 0x11ff) ||
    (code >= 0x2e80 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0x20000 && code <= 0x3ffff);
  return wide ? 1 : 0.55;
}

/**
 * 쪽마다 읽은 글자 조각으로 문서 전체의 글자 줄을 만든다. 쪽은 쪽 번호 순서로 놓는다.
 * 같은 높이의 조각을 한 줄로 묶어 위에서 아래로, 줄 안에서는 왼쪽에서 오른쪽으로 읽는다. 조각 안의 글자 자리는 조각의 너비를
 * 글자의 너비 어림(glyphWeight)으로 나눈 값이다.
 */
export function buildRecordStream(pages: readonly PageItems[]): RecordStream {
  const stream: RecordStream = { text: "", page: [], x: [], y: [], w: [], h: [], run: [], ranges: new Map() };
  let run = 0;
  for (const page of [...pages].sort((a, b) => a.page - b.page)) {
    const start = stream.text.length;
    if (page.width > 0 && page.height > 0) {
      type Item = PageItems["items"][number];
      const lines: { y: number; items: Item[] }[] = [];
      const sorted = page.items.filter((item) => item.str !== "" && item.size > 0).sort((a, b) => a.y - b.y || a.x - b.x);
      for (const item of sorted) {
        const line = lines.find((candidate) => Math.abs(candidate.y - item.y) < Math.max(LINE_TOLERANCE, item.size * 0.3));
        if (line) line.items.push(item);
        else lines.push({ y: item.y, items: [item] });
      }
      for (const line of lines) {
        run += 1;
        let end: number | null = null;
        for (const item of line.items.sort((a, b) => a.x - b.x)) {
          const parts = [...graphemes(item.str.normalize("NFC"))].map(({ segment }) => ({ segment, weight: glyphWeight(segment) }));
          const total = parts.reduce((sum, part) => sum + part.weight, 0);
          if (total === 0) continue;
          const width = item.w > 0 ? item.w : item.size * total;
          // 폭이 넓은 공백 조각이나 떨어진 조각은 표의 다른 칸이다.
          if (end !== null && item.x - end > RUN_GAP) run += 1;
          let offset = 0;
          for (const part of parts) {
            const partWidth = (width * part.weight) / total;
            const folded = foldGrapheme(part.segment);
            for (const char of folded) {
              for (let unit = 0; unit < char.length; unit += 1) {
                stream.text += char[unit];
                stream.page.push(page.page);
                stream.x.push((item.x + offset) / page.width);
                stream.y.push((item.y - item.size * ASCENT) / page.height);
                stream.w.push(partWidth / page.width);
                stream.h.push((item.size * (ASCENT + DESCENT)) / page.height);
                stream.run.push(run);
              }
            }
            offset += partWidth;
          }
          if (item.str.trim() !== "") end = item.x + width;
          else if (width > RUN_GAP) run += 1;
        }
      }
    }
    stream.ranges.set(page.page, [start, stream.text.length]);
  }
  return stream;
}

/* ------------------------------------------------------------------ */
/* 2. 항목 맞추기                                                       */
/* ------------------------------------------------------------------ */

/**
 * 범위의 글(hay)에서 토막이 시작하는 자리를 찾는다(within 글자 안에서 시작하는 것만). 다른 항목이 이미 맞춘 자리(claimed)에서 시작하는 것은
 * 건너뛰고, 그 밖에 없으면 처음 찾은 것을 쓴다. 없으면 -1. offset 은 hay 가 글자 줄에서 시작하는 자리다.
 */
function findAnchor(hay: string, anchor: string, offset: number, within: number, claimed?: readonly boolean[]): number {
  let first = -1;
  let at = hay.indexOf(anchor);
  while (at >= 0 && at <= within) {
    if (first < 0) first = at;
    if (claimed === undefined || !claimed[offset + at]) return at;
    at = hay.indexOf(anchor, at + 1);
  }
  return first;
}

/**
 * 접은 글(needle)을 글자 줄의 [from, to) 에서 찾아, needle 의 글자마다 글자 줄에서의 자리를 돌려준다(찾지 못한 글자는 -1).
 * - 처음에는 FIRST_ANCHOR 글자 토막을 [from, to) 에서 찾는다. 찾으면 글자가 같은 동안 이어 맞춘다.
 * - 맞춤이 끊기면(표의 다른 칸, 쪽 넘김, 달라진 글자) 그 자리에서 JUMP_WINDOW 글자 안에서 다음 NEXT_ANCHOR 글자 토막을 찾아 이어 간다.
 *   찾지 못하면 토막을 MIN_ANCHOR 글자까지 줄여 가며 가까이(NEAR_WINDOW 글자 안)에서 찾는다(토막 안의 한 글자가 달라 그 앞의 글자들까지
 *   놓치지 않게). 그래도 없으면 needle 의 글자를 하나 건너뛰고 다시 찾는다.
 * - 글의 맨 끝이라 토막이 SHORT_ANCHOR 글자보다 짧으면 가까이에서 찾았을 때만 받는다. 맞춤을 시작하기 전에는 짧은 토막을 받지 않는다.
 * - 다른 항목이 이미 맞춘 자리(claimed)는 되도록 피한다(같은 글이 여러 번 나오는 문서에서 항목마다 제자리를 찾게).
 * 건너뛴 글자가 글 길이의 30%(적어도 24글자)를 넘으면 나머지는 찾지 않는다.
 */
export function alignToStream(
  text: string,
  needle: string,
  from: number,
  to: number,
  claimed?: readonly boolean[],
): number[] {
  const map = new Array<number>(needle.length).fill(-1);
  if (needle.length === 0 || from >= to) return map;
  const maxMisses = Math.max(24, Math.floor(needle.length * 0.3));
  let pos = 0;
  let cursor = from;
  let started = false;
  let misses = 0;
  /** 지금 찾는 범위의 글 (cursor 가 바뀔 때만 다시 자른다) */
  let hay = "";
  let hayStart = -1;
  while (pos < needle.length && misses <= maxMisses) {
    const size = Math.min(started ? NEXT_ANCHOR : FIRST_ANCHOR, needle.length - pos);
    if (hayStart !== cursor) {
      hay = text.slice(cursor, started ? Math.min(text.length, cursor + JUMP_WINDOW) : to);
      hayStart = cursor;
    }
    let found = -1;
    if (size >= SHORT_ANCHOR) found = findAnchor(hay, needle.slice(pos, pos + size), cursor, hay.length, claimed);
    if (found < 0 && started) {
      for (let shorter = Math.min(size, NEXT_ANCHOR - 1); shorter >= MIN_ANCHOR && found < 0; shorter -= 1) {
        found = findAnchor(hay, needle.slice(pos, pos + shorter), cursor, NEAR_WINDOW, claimed);
      }
    }
    if (found < 0) {
      pos += 1;
      misses += 1;
      continue;
    }
    let at = cursor + found;
    while (pos < needle.length && at < text.length && needle[pos] === text[at]) {
      map[pos] = at;
      pos += 1;
      at += 1;
    }
    cursor = at;
    started = true;
  }
  return map;
}

/* ------------------------------------------------------------------ */
/* 3. 가린 구간 찾기                                                    */
/* ------------------------------------------------------------------ */

/** 가린 구간 하나: 가리기 전 원문에서의 범위 [start, end) 와 그 자리에 들어간 표시(여러 표시가 붙어 있으면 이어 적은 글) */
export type MaskSpan = { start: number; end: number; label: string };

/**
 * 가리기 전 원문과 가려진 원문을 견주어 가린 구간을 찾는다. 가려진 원문은 가리기 전 원문의 구간들을 표시("[이름]" 등)로 바꾼 글이다.
 * 표시 사이의 글(그대로 남은 부분)을 가리기 전 원문에서 차례로 찾아 그 사이를 가린 구간으로 본다.
 * 견줄 수 없으면(남은 부분이 가리기 전 원문에 차례로 없음) null. 가린 것이 없으면 빈 배열.
 */
export function unmaskSpans(original: string, blinded: string): MaskSpan[] | null {
  if (original === blinded) return [];
  const literals: string[] = [];
  const labels: string[] = [];
  let last = 0;
  for (const match of blinded.matchAll(MASK_LABEL)) {
    const index = match.index ?? 0;
    const literal = blinded.slice(last, index);
    // 표시가 붙어 있으면(사이에 남은 글이 없음) 한 구간으로 묶는다.
    if (literal === "" && labels.length > 0) {
      labels[labels.length - 1] += match[0];
    } else {
      literals.push(literal);
      labels.push(match[0]);
    }
    last = index + match[0].length;
  }
  const tail = blinded.slice(last);
  if (labels.length === 0) return null;
  if (!original.startsWith(literals[0])) return null;

  const spans: MaskSpan[] = [];
  let pos = literals[0].length;
  for (let index = 0; index < labels.length; index += 1) {
    const next = index + 1 < labels.length ? literals[index + 1] : tail;
    const isLast = index + 1 === labels.length;
    let end: number;
    if (isLast) {
      end = original.length - next.length;
      if (end <= pos || !original.endsWith(next)) return null;
    } else {
      end = original.indexOf(next, pos + 1);
      if (end < 0) return null;
    }
    spans.push({ start: pos, end, label: labels[index] });
    pos = end + next.length;
  }
  return spans;
}

/* ------------------------------------------------------------------ */
/* 4. 자리 모으기                                                       */
/* ------------------------------------------------------------------ */

/** 글자 줄의 글자들을 줄 토막마다 네모 하나로 합친다. pad 는 글자 높이의 배수로 더하는 여유(가로, 세로) */
export function rectsOfIndexes(stream: RecordStream, indexes: readonly number[], padX = 0, padY = 0): PageRect[] {
  const rects: PageRect[] = [];
  const sorted = [...new Set(indexes.filter((index) => index >= 0 && index < stream.text.length))].sort((a, b) => a - b);
  let open: { page: number; run: number; left: number; top: number; right: number; bottom: number } | null = null;
  const close = () => {
    if (open === null) return;
    const left = Math.max(0, open.left);
    const top = Math.max(0, open.top);
    rects.push([open.page, round(left), round(top), round(Math.min(1, open.right) - left), round(Math.min(1, open.bottom) - top)]);
    open = null;
  };
  let previous = -2;
  for (const index of sorted) {
    // 글자 높이를 가로 여유의 기준으로 쓰려면 쪽의 가로세로 비율이 필요하지만, 여유는 어림값이라 세로 비율 그대로 쓴다.
    const left = stream.x[index] - stream.h[index] * padX;
    const right = stream.x[index] + stream.w[index] + stream.h[index] * padX;
    const top = stream.y[index] - stream.h[index] * padY;
    const bottom = stream.y[index] + stream.h[index] * (1 + padY);
    if (open !== null && open.run === stream.run[index] && index === previous + 1) {
      open.left = Math.min(open.left, left);
      open.right = Math.max(open.right, right);
      open.top = Math.min(open.top, top);
      open.bottom = Math.max(open.bottom, bottom);
    } else {
      close();
      open = { page: stream.page[index], run: stream.run[index], left, top, right, bottom };
    }
    previous = index;
  }
  close();
  return rects;
}

/** 글자 줄 전체에서 그 글(접은 글)이 나오는 모든 자리의 글자 번호 */
function occurrencesOf(stream: RecordStream, folded: string): number[] {
  const indexes: number[] = [];
  if (folded.length < MIN_GLOBAL_LENGTH) return indexes;
  let at = stream.text.indexOf(folded);
  while (at >= 0) {
    for (let offset = 0; offset < folded.length; offset += 1) indexes.push(at + offset);
    at = stream.text.indexOf(folded, at + 1);
  }
  return indexes;
}

/**
 * 인적·학적사항의 가리기 전 원문에서, 항목 밖(쪽 머리말·꼬리말 등)에 또 나올 수 있는 이름과 학교 이름을 뽑는다.
 * - "성명"·"이름" 이 든 칸 이름의 값과, 값 안의 "담임성명 ○○○" 꼴에서 한글 2~5자·영문 이름.
 * - "…고등학교", "…중학교", "…초등학교", "…대학교" 로 끝나는 낱말.
 * 성별 낱말과 "가명" 은 뺀다. 블라인드 처리의 이름 규칙(blind.ts)을 대신하는 것이 아니라, 그 규칙이 보지 않는 항목 밖의 글을 덮기 위한 것이다.
 */
function identityTokens(text: string): string[] {
  const tokens = new Set<string>();
  const skip = new Set(["남", "여", "남자", "여자", "남성", "여성", "가명", "성명", "이름", "담임", "담임성명"]);
  const addNames = (value: string) => {
    for (const match of value.matchAll(/[가-힣]{2,5}|[A-Za-z][A-Za-z .'-]{2,40}[A-Za-z]/g)) {
      const name = match[0].trim();
      if (!skip.has(name)) tokens.add(name);
    }
  };
  for (const line of text.split("\n")) {
    const colon = line.indexOf(":");
    const key = colon < 0 ? "" : line.slice(0, colon);
    const value = colon < 0 ? line : line.slice(colon + 1);
    if (/성명|이름/.test(key)) addNames(value.replace(/\(.*?\)/g, " "));
    for (const match of value.matchAll(/(?:담임\s*성명|담임|성명|이름)\s*[:：]?\s*([가-힣]{2,5})/g)) {
      if (!skip.has(match[1])) tokens.add(match[1]);
    }
    for (const match of line.matchAll(/[가-힣A-Za-z0-9]+(?:고등학교|중학교|초등학교|대학교)/g)) tokens.add(match[0]);
  }
  return [...tokens];
}

/** 자리를 찾은 결과 */
export type RecordLocation = {
  /** 항목 id → 그 항목의 원문이 있는 자리(줄 토막마다 네모). 찾지 못한 항목은 없다 */
  sections: Record<string, PageRect[]>;
  /** 근거 id → 그 인용 구절이 있는 자리. 찾지 못한 근거는 없다 */
  evidences: Record<string, PageRect[]>;
  /** 가린 정보의 자리(쪽 그림에서 덮을 네모) */
  covers: PageRect[];
  /** 가릴 자리를 다 찾았다고 확인하지 못한 쪽(쪽 그림을 만들지 않는다). 글자가 없는 쪽(스캔본)도 여기에 든다 */
  unverified: number[];
};

export type LocateInput = {
  stream: RecordStream;
  /** 문서의 쪽 수 */
  pageCount: number;
  /** 가리기 전 항목 (브라우저가 PDF 에서 읽은 것) */
  originals: readonly Section[];
  /** 가려진 항목 (서버가 돌려준 것). originals 와 같은 순서·같은 개수 */
  blinded: readonly Section[];
  evidences: readonly Evidence[];
};

/**
 * 항목·근거의 자리와 가린 정보의 자리를 찾는다.
 * originals 와 blinded 의 개수가 다르면(짝을 지을 수 없음) 자리 없이 모든 쪽을 unverified 로 돌려준다.
 */
export function locateRecord({ stream, pageCount, originals, blinded, evidences }: LocateInput): RecordLocation {
  const allPages = Array.from({ length: pageCount }, (_, index) => index + 1);
  if (originals.length !== blinded.length) return { sections: {}, evidences: {}, covers: [], unverified: allPages };

  const claimed = new Array<boolean>(stream.text.length).fill(false);
  const unverified = new Set<number>();
  const covers: PageRect[] = [];
  const sectionRects: Record<string, PageRect[]> = {};
  const evidenceRects: Record<string, PageRect[]> = {};
  /** 항목 밖에서도 찾아 덮을 글(접은 글) */
  const globals = new Set<string>();
  const addGlobal = (text: string) => {
    const folded = foldText(text).folded;
    if (folded.length >= MIN_GLOBAL_LENGTH) globals.add(folded);
  };
  /**
   * 쪽마다: 인적·학적사항이 차지한 세로 범위(band. 자리를 찾은 것만)와 자리를 다 찾지 못한 인적·학적사항이 있는지(missing),
   * 그 밖의 항목이 시작하는 가장 위(otherTop).
   */
  const identityBand = new Map<number, { band: { top: number; bottom: number } | null; missing: boolean }>();
  const otherTop = new Map<number, number>();

  /** 글자가 없는 쪽(스캔본 등)은 가릴 자리를 찾을 수 없다 */
  for (const page of allPages) {
    const range = stream.ranges.get(page);
    if (range === undefined || range[1] - range[0] === 0) unverified.add(page);
  }

  type Located = { original: Section; blinded: Section; folded: FoldedText; map: number[] };
  const located: Located[] = [];
  for (const [index, original] of originals.entries()) {
    const lined = RECORD_FORM_LINED_CATEGORIES.includes(original.category);
    const folded = foldText(original.text, lined ? "|" : "");
    const start = stream.ranges.get(original.page);
    const next = stream.ranges.get(original.page + 1);
    let map: number[];
    if (start === undefined) {
      map = new Array<number>(folded.folded.length).fill(-1);
    } else if (lined) {
      map = alignLines(stream.text, original.text, start[0], next === undefined ? start[1] : next[1], claimed);
    } else {
      map = alignToStream(stream.text, folded.folded, start[0], next === undefined ? start[1] : next[1], claimed);
    }
    for (const at of map) if (at >= 0) claimed[at] = true;
    located.push({ original, blinded: blinded[index], folded, map });
  }

  for (const { original, blinded: masked, folded, map } of located) {
    const rects = rectsOfIndexes(stream, map);
    if (rects.length > 0) sectionRects[masked.id] = rects;
    const touched = new Set<number>([original.page, ...rects.map((rect) => rect[0])]);

    if (isIdentity(original)) {
      // 인적·학적사항과 머리 부분은 값 전체를 가린다: 그 항목이 차지한 세로 범위를 통째로 덮는다.
      for (const token of identityTokens(original.text)) addGlobal(token);
      const matched = map.filter((at) => at >= 0).length;
      const partly = matched < map.length * MIN_IDENTITY_RATIO;
      for (const page of touched) {
        const onPage = rects.filter((rect) => rect[0] === page);
        const entry = identityBand.get(page) ?? { band: null, missing: false };
        if (onPage.length === 0 || partly) entry.missing = true;
        if (onPage.length > 0) {
          const top = Math.min(...onPage.map((rect) => rect[2]));
          const bottom = Math.max(...onPage.map((rect) => rect[2] + rect[4]));
          entry.band = entry.band
            ? { top: Math.min(entry.band.top, top), bottom: Math.max(entry.band.bottom, bottom) }
            : { top, bottom };
        }
        identityBand.set(page, entry);
      }
    } else {
      for (const rect of rects) otherTop.set(rect[0], Math.min(otherTop.get(rect[0]) ?? 1, rect[2]));
      // 가린 구간: 그 글자의 자리를 덮고, 같은 글이 다른 곳에 또 나오면 거기도 덮는다.
      const spans = unmaskSpans(original.text, masked.text);
      if (spans === null) {
        // 어디를 가렸는지 알 수 없으면 그 항목이 있는 쪽은 그림을 만들지 않는다.
        for (const page of touched) unverified.add(page);
      } else {
        for (const span of spans) {
          const indexes: number[] = [];
          let whole = true;
          for (let at = 0; at < folded.map.length; at += 1) {
            if (folded.map[at] < span.start || folded.map[at] >= span.end) continue;
            if (map[at] >= 0) indexes.push(map[at]);
            else whole = false;
          }
          covers.push(...rectsOfIndexes(stream, indexes, COVER_PAD_X, COVER_PAD_Y));
          const spanText = foldText(original.text.slice(span.start, span.end)).folded;
          if (spanText.length >= MIN_GLOBAL_LENGTH) globals.add(spanText);
          if (!whole || indexes.length === 0) {
            // 자리를 다 찾지 못한 구간: 그 글이 그 항목의 쪽에 글자로 있으면 아래 온 세상 찾기가 덮는다. 없으면 그 쪽은 그림을 만들지 않는다.
            const found = spanText.length >= MIN_GLOBAL_LENGTH && occurrencesOf(stream, spanText).some((at) => touched.has(stream.page[at]));
            if (!found) for (const page of touched) unverified.add(page);
          }
        }
      }
    }
    // 과목(subject)의 가린 구간은 표의 과목 칸에 있다(원문 맞춤에 들지 않는다). 온 세상 찾기로 덮는다.
    if (original.subject !== undefined && masked.subject !== undefined && original.subject !== masked.subject) {
      const subjectSpans = unmaskSpans(original.subject, masked.subject);
      if (subjectSpans === null) addGlobal(original.subject);
      else for (const span of subjectSpans) addGlobal(original.subject.slice(span.start, span.end));
    }
  }

  // 근거 구절의 자리: 가려진 원문에서의 자리를 가리기 전 원문의 자리로 옮겨 찾는다.
  const locatedById = new Map(located.map((item) => [item.blinded.id, item]));
  for (const evidence of evidences) {
    const item = locatedById.get(evidence.sectionId);
    if (item === undefined || evidence.quote === "") continue;
    const range = originalRangeOf(item.original.text, item.blinded.text, evidence.quote);
    if (range === null) continue;
    const indexes: number[] = [];
    for (let at = 0; at < item.folded.map.length; at += 1) {
      if (item.folded.map[at] >= range[0] && item.folded.map[at] < range[1] && item.map[at] >= 0) indexes.push(item.map[at]);
    }
    const rects = rectsOfIndexes(stream, indexes);
    if (rects.length > 0) evidenceRects[evidence.id] = rects;
  }

  // 같은 글이 항목 밖(쪽 머리말·꼬리말, 표의 이름 칸 등)에 또 나오는 자리.
  for (const text of globals) covers.push(...rectsOfIndexes(stream, occurrencesOf(stream, text), COVER_PAD_X, COVER_PAD_Y));

  // 인적·학적사항이 있는 쪽: 그 항목이 차지한 세로 범위를 쪽 너비 전체로 덮는다. 그 위에 다른 항목이 없으면 쪽의 맨 위부터 덮는다
  // (서식의 머리 부분: 학교·반·번호·담임성명과 사진).
  // 아래쪽 끝은 서식의 다음 제목("2. 출결상황" 등) 바로 위다. 자리를 다 찾지 못한 인적·학적사항이 있으면 쪽의 맨 위부터 그 제목 위까지
  // (제목이 없으면 첫 다른 항목 위까지) 덮고, 그것도 없으면 그 쪽은 그림을 만들지 않는다.
  for (const [page, { band, missing }] of identityBand) {
    const firstOther = otherTop.get(page);
    const heading = nextHeadingTop(stream, page, band === null ? 0 : band.top);
    if (missing) {
      const limit = heading !== null ? heading - HEADING_GAP : firstOther !== undefined ? firstOther - IDENTITY_GAP : null;
      if (limit === null || limit <= 0) {
        unverified.add(page);
        continue;
      }
      const bottom = Math.max(limit, band === null ? 0 : band.bottom + IDENTITY_PAD);
      covers.push([page, 0, 0, 1, round(Math.min(1, bottom))]);
      continue;
    }
    if (band === null) continue;
    const top = firstOther !== undefined && firstOther < band.top ? Math.max(0, band.top - IDENTITY_PAD) : 0;
    const reach = heading !== null && heading - band.bottom <= HEADING_REACH ? heading - HEADING_GAP : 0;
    covers.push([page, 0, round(top), 1, round(Math.min(1, Math.max(band.bottom + IDENTITY_PAD, reach)) - top)]);
  }

  // 쪽 머리말·꼬리말: 위아래 띠 안에서 어느 항목에도 속하지 않는 줄은 덮는다(발급 번호, 기관 이름, 반·번호·성명 줄 등).
  for (const page of allPages) {
    const range = stream.ranges.get(page);
    if (range === undefined) continue;
    const margin: number[] = [];
    for (let at = range[0]; at < range[1]; at += 1) {
      if (claimed[at]) continue;
      const middle = stream.y[at] + stream.h[at] / 2;
      if (middle < MARGIN_BAND || middle > 1 - MARGIN_BAND) margin.push(at);
    }
    covers.push(...rectsOfIndexes(stream, margin, COVER_PAD_X, COVER_PAD_Y));
    // 그 쪽에서 시작하는 서술형 항목의 원문 가운데 자리를 찾은 글자가 너무 적으면, 그 쪽의 글자(와 그것으로 찾은 가린 자리)를 믿을 수 없다
    // (글자 정보가 깨진 PDF, AI 가 그림에서 읽은 글과 PDF 의 글자가 다른 쪽).
    let total = 0;
    let matched = 0;
    for (const item of located) {
      if (item.original.page !== page || RECORD_FORM_LINED_CATEGORIES.includes(item.original.category)) continue;
      total += item.map.length;
      matched += item.map.filter((at) => at >= 0).length;
    }
    if (total > 0 && matched < total * MIN_MATCHED_RATIO) unverified.add(page);
  }

  // 쪽마다 되풀이되는 줄: 띠 밖에 있어도(머리말·꼬리말이 본문 쪽으로 들어온 문서, 마지막 쪽에서 위로 올라온 꼬리말) 덮는다.
  covers.push(...rectsOfIndexes(stream, repeatedLineIndexes(stream, claimed, pageCount), COVER_PAD_X, COVER_PAD_Y));

  return {
    sections: sectionRects,
    evidences: evidenceRects,
    covers,
    unverified: [...unverified].sort((a, b) => a - b),
  };
}

/**
 * 쪽마다 되풀이되는 줄(머리말·꼬리말)의 글자 번호. 어느 항목에도 속하지 않는 글자를 줄 토막마다 모아, 숫자를 뺀 글이 같은 토막이
 * 문서의 쪽 절반 이상(적어도 2쪽)에서 같은 높이에 나오면 그 글의 모든 토막을 고른다(REPEAT_Y_STEP, MIN_REPEAT_LENGTH).
 */
function repeatedLineIndexes(stream: RecordStream, claimed: readonly boolean[], pageCount: number): number[] {
  type Piece = { page: number; y: number; indexes: number[] };
  const byText = new Map<string, Piece[]>();
  let open: { run: number; text: string; piece: Piece } | null = null;
  const close = () => {
    if (open === null) return;
    const key = open.text.replace(/\d/g, "");
    if (key.length >= MIN_REPEAT_LENGTH) byText.set(key, [...(byText.get(key) ?? []), open.piece]);
    open = null;
  };
  for (let at = 0; at < stream.text.length; at += 1) {
    if (claimed[at]) {
      close();
      continue;
    }
    if (open === null || open.run !== stream.run[at]) {
      close();
      open = { run: stream.run[at], text: "", piece: { page: stream.page[at], y: stream.y[at], indexes: [] } };
    }
    open.text += stream.text[at];
    open.piece.indexes.push(at);
  }
  close();

  const threshold = Math.max(2, Math.ceil(pageCount / 2));
  const indexes: number[] = [];
  for (const pieces of byText.values()) {
    // 높이 칸마다 그 글이 나온 쪽을 모으고, 이웃한 칸까지 합쳐 쪽 수를 센다.
    const pagesBySlot = new Map<number, Set<number>>();
    for (const piece of pieces) {
      const slot = Math.round(piece.y / REPEAT_Y_STEP);
      pagesBySlot.set(slot, (pagesBySlot.get(slot) ?? new Set<number>()).add(piece.page));
    }
    const repeated = [...pagesBySlot.keys()].some((slot) => {
      const pages = new Set([...(pagesBySlot.get(slot) ?? []), ...(pagesBySlot.get(slot + 1) ?? [])]);
      return pages.size >= threshold;
    });
    if (repeated) for (const piece of pieces) indexes.push(...piece.indexes);
  }
  return indexes;
}

/**
 * 표·칸 모양 항목의 원문을 줄마다 따로 맞춘다. 돌려주는 값은 원문 전체를 접은 글(칸 구분 "|" 제외)의 글자마다의 자리다.
 * 표는 머리글을 AI 가 서식에 맞춰 풀어 적어 PDF 의 글자와 다를 수 있다. 한 덩어리로 맞추면 머리글에서 건너뛴 글자가 한도를 넘어
 * 뒤의 행까지 찾지 못하므로, 줄(행)마다 맞추고 찾은 줄의 다음 자리부터 다음 줄을 찾는다. 그 자리 뒤에서 찾지 못한 줄은 범위의 처음부터 다시 찾는다.
 */
function alignLines(text: string, original: string, from: number, to: number, claimed: readonly boolean[]): number[] {
  const map: number[] = [];
  let cursor = from;
  for (const line of original.split("\n")) {
    const needle = foldText(line, "|").folded;
    let lineMap = alignToStream(text, needle, cursor, to, claimed);
    if (cursor > from && lineMap.every((at) => at < 0)) lineMap = alignToStream(text, needle, from, to, claimed);
    let last = -1;
    for (const at of lineMap) last = Math.max(last, at);
    if (last >= 0) cursor = last + 1;
    map.push(...lineMap);
  }
  return map;
}

/**
 * 그 쪽에서 서식의 번호 붙은 제목("2. 출결상황" 등) 가운데 from(쪽 높이에 대한 비율) 아래에서 가장 먼저 나오는 것의 위쪽 높이. 없으면 null.
 * 제목은 학생부 서식의 것을 번호와 함께 찾는다(공백은 보지 않는다).
 */
function nextHeadingTop(stream: RecordStream, page: number, from: number): number | null {
  const range = stream.ranges.get(page);
  if (range === undefined) return null;
  const pageText = stream.text.slice(range[0], range[1]);
  let top: number | null = null;
  for (const heading of NEXT_HEADINGS) {
    let at = pageText.indexOf(heading);
    while (at >= 0) {
      const y = stream.y[range[0] + at];
      if (y > from && (top === null || y < top)) top = y;
      at = pageText.indexOf(heading, at + 1);
    }
  }
  return top;
}

/**
 * 가려진 원문 안의 구절(quote)이 가리기 전 원문에서 차지하는 범위 [start, end). 찾지 못하면 null.
 * 가린 구간이 구절 안에 들어 있으면 그 구간까지 포함한다.
 */
export function originalRangeOf(original: string, blinded: string, quote: string): readonly [number, number] | null {
  const at = blinded.indexOf(quote);
  if (at < 0) return null;
  const spans = unmaskSpans(original, blinded);
  if (spans === null) return null;
  // 가려진 원문의 자리 → 가리기 전 원문의 자리: 앞에 있는 가린 구간마다 (원래 길이 − 표시 길이)만큼 밀린다.
  const toOriginal = (position: number, atEnd: boolean): number => {
    let shift = 0;
    for (const span of spans) {
      const maskedStart = span.start - shift;
      const maskedEnd = maskedStart + span.label.length;
      if (position <= maskedStart) break;
      if (position < maskedEnd) return atEnd ? span.end : span.start;
      shift += span.end - span.start - span.label.length;
    }
    return position + shift;
  };
  return [toOriginal(at, false), toOriginal(at + quote.length, true)];
}
