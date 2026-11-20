import type { PdfMarkLevel } from "@/lib/recordPdfMarks";

// 평가 요소(역량)별 형광펜 색. 원문의 근거 구절을 요소마다 다른 색으로 칠해 어느 요소의 근거인지 한눈에 구분한다.
// 서류 원문(글·PDF), 원문보기, 평가 요소 목록의 색 점이 같은 색을 쓴다. 색은 평가 요소의 순번으로 정한다(요소는 여섯까지다. lib/prep/criteria.ts).
// 디자인 시안에는 없는 색이라 형광펜의 색(노랑·초록·분홍·파랑·주황·보라)을 화면의 밝기에 맞춰 정했다.
// 색마다 네 단계다: 옅은 색(다른 요소의 근거) < 제 색(지금 고른 요소의 근거) < 짙은 색(지금 고른 근거) < 반짝 색(나타나는 순간).
// 글자는 어느 단계 위에서도 검은색(#111111) 그대로 읽힌다. 색만으로 구분하지 않도록 지금 요소의 근거는 실선 밑줄, 다른 요소는 점선 밑줄이다.

type Tone = {
  /** 평가 요소 목록의 색 점 */
  swatch: string;
  /** 글: 다른 요소의 근거 */
  textSoft: string;
  /** 글: 지금 고른 요소의 근거 */
  textStrong: string;
  /** 글: 지금 고른 근거 */
  textFocus: string;
  /** PDF: 다른 요소의 근거 */
  pdfSoft: string;
  /** PDF: 지금 고른 요소의 근거 */
  pdfStrong: string;
  /** PDF: 지금 고른 근거 */
  pdfFocus: string;
};

// Tailwind 가 클래스를 찾을 수 있게 색마다 클래스를 글자 그대로 적는다(조립하지 않는다).
const TONES: readonly Tone[] = [
  {
    swatch: "bg-[#F2C200]",
    textSoft: "bg-[#FFF6CC] decoration-[#7A5C00]",
    textStrong: "bg-[#FFE873] decoration-[#7A5C00]",
    textFocus: "bg-[#FFD83D] decoration-[#7A5C00] [--mark-flash:#FFC400]",
    pdfSoft: "bg-[#FFE873]/[0.4]",
    pdfStrong: "bg-[#FFDD4D]/[0.75]",
    pdfFocus: "bg-[#FFD21F]/[0.85] shadow-[0_0_0_1.5px_#7A5C00] [--mark-flash:#FFB800]",
  },
  {
    swatch: "bg-[#3DBE6B]",
    textSoft: "bg-[#E0F6DD] decoration-[#1B6E45]",
    textStrong: "bg-[#B4EBAE] decoration-[#1B6E45]",
    textFocus: "bg-[#8ADF82] decoration-[#1B6E45] [--mark-flash:#5FCC58]",
    pdfSoft: "bg-[#B4EBAE]/[0.4]",
    pdfStrong: "bg-[#9BE493]/[0.75]",
    pdfFocus: "bg-[#7ADA71]/[0.85] shadow-[0_0_0_1.5px_#1B6E45] [--mark-flash:#4FC247]",
  },
  {
    swatch: "bg-[#F0609F]",
    textSoft: "bg-[#FFE3F0] decoration-[#A3195B]",
    textStrong: "bg-[#FFBBD9] decoration-[#A3195B]",
    textFocus: "bg-[#FF94C4] decoration-[#A3195B] [--mark-flash:#FF6BAE]",
    pdfSoft: "bg-[#FFBBD9]/[0.4]",
    pdfStrong: "bg-[#FFA6CE]/[0.75]",
    pdfFocus: "bg-[#FF85BC]/[0.85] shadow-[0_0_0_1.5px_#A3195B] [--mark-flash:#FF5CA6]",
  },
  {
    swatch: "bg-[#3D8BFF]",
    textSoft: "bg-[#DFECFF] decoration-[#0B4FB3]",
    textStrong: "bg-[#B3D2FF] decoration-[#0B4FB3]",
    textFocus: "bg-[#86B6FF] decoration-[#0B4FB3] [--mark-flash:#5C9BFF]",
    pdfSoft: "bg-[#B3D2FF]/[0.4]",
    pdfStrong: "bg-[#9CC4FF]/[0.75]",
    pdfFocus: "bg-[#7AAFFF]/[0.85] shadow-[0_0_0_1.5px_#0B4FB3] [--mark-flash:#4D92FF]",
  },
  {
    swatch: "bg-[#F5922B]",
    textSoft: "bg-[#FFEAD6] decoration-[#8A4B00]",
    textStrong: "bg-[#FFCF9E] decoration-[#8A4B00]",
    textFocus: "bg-[#FFB56B] decoration-[#8A4B00] [--mark-flash:#FF9A3D]",
    pdfSoft: "bg-[#FFCF9E]/[0.4]",
    pdfStrong: "bg-[#FFC085]/[0.75]",
    pdfFocus: "bg-[#FFAB5C]/[0.85] shadow-[0_0_0_1.5px_#8A4B00] [--mark-flash:#FF8F2E]",
  },
  {
    swatch: "bg-[#9A6BFF]",
    textSoft: "bg-[#EEE5FF] decoration-[#5B2DB3]",
    textStrong: "bg-[#D6C2FF] decoration-[#5B2DB3]",
    textFocus: "bg-[#BC9CFF] decoration-[#5B2DB3] [--mark-flash:#A07AFF]",
    pdfSoft: "bg-[#D6C2FF]/[0.4]",
    pdfStrong: "bg-[#C9B0FF]/[0.75]",
    pdfFocus: "bg-[#B594FF]/[0.85] shadow-[0_0_0_1.5px_#5B2DB3] [--mark-flash:#9670FF]",
  },
];

/** 순번의 색 (요소가 색보다 많으면 돌려 쓴다) */
function toneOf(index: number): Tone {
  return TONES[((index % TONES.length) + TONES.length) % TONES.length];
}

/** 평가 요소 목록의 색 점에 줄 바탕색 클래스 */
export function toneSwatchClass(index: number): string {
  return toneOf(index).swatch;
}

/** 글의 근거 구절이 보이는 세기: 지금 고른 근거 / 지금 고른 요소의 근거 / 다른 요소의 근거 */
export type TextMarkLevel = "focus" | "strong" | "soft";

const TEXT_LEVEL_CLASS: Record<TextMarkLevel, string> = {
  // 고른 근거는 굵은 실선 밑줄이고, 나타날 때 잠깐 더 짙어진다(app/globals.css 의 mark-in).
  focus: "animate-mark-in underline decoration-solid decoration-2 underline-offset-[4px]",
  strong: "motion-colors underline decoration-solid underline-offset-[4px]",
  soft: "motion-colors underline decoration-dotted underline-offset-[4px]",
};

/** 글의 근거 구절에 줄 클래스 (형광펜 색 면과 밑줄). 글자색은 그대로다. */
export function toneTextClass(index: number, level: TextMarkLevel): string {
  const tone = toneOf(index);
  const color = level === "focus" ? tone.textFocus : level === "strong" ? tone.textStrong : tone.textSoft;
  return `${TEXT_LEVEL_CLASS[level]} ${color} text-[#111111]`;
}

/** 요소 색이 아닌 PDF 표시(고른 항목의 원문): 옅은 남색 면 */
const PDF_SECTION_CLASS = "bg-[#DCE0FF]/[0.55]";

/**
 * PDF 쪽 위의 표시에 줄 클래스. 색 면은 곱하기로 얹어 아래의 글자가 그대로 보인다(형광펜을 그은 모습).
 * 고른 근거는 테두리가 있고 나타날 때 잠깐 더 짙어진다.
 */
export function tonePdfClass(index: number | null, level: PdfMarkLevel): string {
  const base = "rounded-[2px] mix-blend-multiply";
  if (index === null || level === "section") return `${base} ${PDF_SECTION_CLASS}`;
  const tone = toneOf(index);
  if (level === "focus") return `${base} animate-mark-in ${tone.pdfFocus}`;
  return `${base} motion-colors ${level === "strong" ? tone.pdfStrong : tone.pdfSoft}`;
}
