import type { Section } from "@/types/analysis";
import {
  RECORD_FORM_CATEGORIES,
  RECORD_FORM_LINED_CATEGORIES,
  RECORD_FORM_NARRATIVE_CATEGORIES,
  RECORD_FORM_OTHER_ID,
  recordFormPart,
} from "./recordForm.ts";

// 학생부 항목(Section)을 브라우저와 서버가 주고받을 때 같이 쓰는 것: 개수·길이 제한, 받은 항목 확인, 이미지 쪽을 AI 가 읽은 결과의
// 모양, 글자가 있는 쪽의 항목과 이미지 쪽의 항목을 한 목록으로 합치기.
// 학생부 PDF 는 브라우저에서 읽고(lib/recordPdf.ts) 서버에는 항목만 보낸다(POST /api/analyze). 글자가 없는 쪽은 그 쪽의 그림만
// 서버로 보내 AI 가 읽는다(POST /api/record-page).
// 서버 전용 코드를 가져오지 않는 순수 모듈이다(화면, API 라우트, 스크립트가 같이 쓴다).
// 길이는 JS 문자열 length(UTF-16 단위)로 센다.

/** 학생부 PDF 의 최대 쪽 수. 넘으면 읽지 않는다(이미지 쪽은 쪽마다 AI 를 한 번 부른다) */
export const MAX_RECORD_PAGES = 60;

/** 학생부 하나의 항목 최대 개수 */
export const MAX_RECORD_SECTIONS = 400;

/** 항목 하나의 원문(text) 최대 길이 */
export const MAX_SECTION_TEXT_LENGTH = 20_000;

/** 모든 항목 원문 길이의 합 최대값 */
export const MAX_RECORD_TEXT_LENGTH = 400_000;

/** 항목명(category) 최대 길이 */
export const MAX_SECTION_CATEGORY_LENGTH = 40;

/** 과목(subject) 최대 길이 */
export const MAX_SECTION_SUBJECT_LENGTH = 100;

/** 항목 사전 ID(fieldId) 최대 길이 */
export const MAX_SECTION_FIELD_ID_LENGTH = 40;

/** 학년(grade)의 범위: 1 이상 이 값 이하의 정수 또는 null */
export const MAX_SECTION_GRADE = 9;

/** 창의적 체험활동 시간(hours)의 최대값 */
export const MAX_SECTION_HOURS = 10_000;

/** 이미지 쪽 하나에서 AI 가 읽은 항목의 최대 개수 */
export const MAX_PAGE_SECTIONS = 60;

/**
 * /api/analyze 요청 본문(JSON 문자열)의 최대 길이. 항목 원문 합(MAX_RECORD_TEXT_LENGTH)과 평가 기준, JSON 으로 적을 때
 * 늘어나는 글자(줄바꿈·따옴표가 두 글자가 된다)를 넉넉하게 잡은 값이다. 한글이 3바이트여도 항목 원문 합이 1.2MB 라서
 * 제한 안의 요청은 배포 환경(Vercel)의 본문 한도 4.5MB 에 걸리지 않는다.
 */
export const MAX_ANALYZE_BODY_LENGTH = 2_000_000;

/**
 * /api/record-page 에 보내는 쪽 그림(JPEG 를 base64 로 적은 문자열)의 최대 길이. 약 3MB 의 그림이고, 요청 본문이
 * 배포 환경(Vercel)의 본문 한도 4.5MB 보다 작게 유지된다. 브라우저는 그림이 이보다 크면 화질·크기를 낮춰 다시 만든다.
 */
export const MAX_PAGE_IMAGE_BASE64_LENGTH = 4_000_000;

/** base64 로 적은 JPEG 인지: JPEG 파일 머리(FF D8 FF)는 base64 로 "/9j/" 다. 나머지는 base64 글자와 끝의 "=" 0~2개. */
export function isJpegBase64(value: string): boolean {
  return /^\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(value);
}

/**
 * 학생부 항목의 항목명(category) 전체. 학생부 서식(lib/recordForm.ts: 별지 제8호 서식)의 칸에서 나온다.
 * AI 가 읽은 쪽의 항목은 서식의 칸(fieldId)을 고르고 항목명은 그 칸의 것이다. 글자가 있는 쪽의 파서(lib/pipeline/parsePdf.ts)가 쓰는
 * 항목명과 글자 그대로 같다(근거 추출·AI 제안·블라인드 처리가 항목명으로 항목을 고른다). 서식의 어느 칸에도 맞지 않는 기록은 "기타" 다.
 */
export const PAGE_CATEGORIES: readonly string[] = RECORD_FORM_CATEGORIES;

/**
 * 서술형 항목의 항목명. 근거 추출과 AI 제안이 항목명이 글자 그대로 같은 항목만 AI 에 보낸다(lib/pipeline/extractEvidence.ts 가
 * 다시 내보낸다). 브라우저는 파서가 학생부 양식을 알아보았는지 볼 때 쓴다(lib/recordPdf.ts).
 */
export const NARRATIVE_CATEGORIES: readonly string[] = RECORD_FORM_NARRATIVE_CATEGORIES;

/** /api/record-page 에 그림과 함께 보내는 쪽의 글(PDF 에서 뽑은 글자)의 최대 길이. 넘으면 글 없이 그림만 보낸다 */
export const MAX_PAGE_TEXT_LENGTH = 20_000;

/** 이미지 쪽 하나에서 AI 가 읽은 항목 하나 */
export type PageSection = {
  /** 서식의 칸 ID (lib/recordForm.ts 의 RECORD_FORM_PARTS 가운데 하나. 어느 칸에도 맞지 않으면 "ETC") */
  fieldId: string;
  /** 항목명: 그 칸의 category (PAGE_CATEGORIES 가운데 하나) */
  category: string;
  /** 학년. 이 쪽에서 알 수 없거나 해당 없으면 null */
  grade: number | null;
  /** 과목명(세부능력 및 특기사항) 또는 과목·영역(독서활동상황). 없으면 null */
  subject: string | null;
  /** 창의적 체험활동 영역의 시간. 시간을 적는 칸이 아니거나 적혀 있지 않으면 null */
  hours: number | null;
  /** 옮겨 적은 원문 */
  text: string;
  /** 앞쪽에서 시작한 글이 이 쪽으로 넘어와 이어지는 것인지 (그 쪽의 첫 항목만 true 일 수 있다) */
  continued: boolean;
};

/**
 * 표·칸 모양 항목: 원문이 줄마다 한 행이다. 앞쪽에서 이어지는 내용을 붙일 때 줄을 바꿔 붙인다(나머지는 공백 하나로 잇는다).
 */
const TABLE_CATEGORIES: readonly string[] = RECORD_FORM_LINED_CATEGORIES;

/**
 * 학년을 이어받는 묶음. 이미지 쪽의 항목에 학년이 없고(그 쪽에 학년 표시가 없음) 바로 앞 항목이 같은 묶음이면 앞 항목의 학년을 쓴다.
 * 학생부는 학년별로 성적표와 세부능력 및 특기사항이 이어지고, 창의적 체험활동도 학년 칸이 영역 여러 줄에 걸쳐 한 번만 적힌다.
 */
const GRADE_GROUPS: readonly (readonly string[])[] = [
  ["자율활동", "동아리활동", "진로활동", "봉사활동실적"],
  ["교과 성적", "세부능력 및 특기사항"],
  ["독서활동상황"],
  ["행동특성 및 종합의견"],
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIntegerIn(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

/**
 * 밖에서 받은 값(브라우저가 보낸 항목 목록)을 확인해 학생부 항목 목록으로 만든다. 맞지 않으면 null.
 * - 배열이고 1개 이상 MAX_RECORD_SECTIONS 개 이하.
 * - 항목마다: category 는 공백을 뺀 길이가 1 이상이고 MAX_SECTION_CATEGORY_LENGTH 이하의 문자열, grade 는 null 또는
 *   1~MAX_SECTION_GRADE 의 정수, page 는 1~MAX_RECORD_PAGES 의 정수, text 는 공백을 뺀 길이가 1 이상이고
 *   MAX_SECTION_TEXT_LENGTH 이하의 문자열. subject·fieldId 는 없거나 길이 제한 안의 문자열, hours 는 없거나 0~MAX_SECTION_HOURS 의 수.
 * - 모든 text 길이의 합이 MAX_RECORD_TEXT_LENGTH 이하.
 * 받은 id 는 쓰지 않고 순서대로 s1, s2, … 를 새로 준다(근거가 항목을 id 로 가리키므로 겹치면 안 된다).
 * 위 필드만 꺼내 새 객체로 만들므로 다른 키는 결과에 섞이지 않는다.
 */
export function readRecordSections(value: unknown): Section[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_RECORD_SECTIONS) return null;
  const sections: Section[] = [];
  let totalLength = 0;
  for (const item of value) {
    if (!isRecord(item)) return null;
    const { category, grade, subject, page, text, fieldId, hours } = item;
    if (typeof category !== "string" || category.trim() === "" || category.length > MAX_SECTION_CATEGORY_LENGTH) return null;
    if (grade !== null && !isIntegerIn(grade, 1, MAX_SECTION_GRADE)) return null;
    if (subject !== undefined && (typeof subject !== "string" || subject.length > MAX_SECTION_SUBJECT_LENGTH)) return null;
    if (!isIntegerIn(page, 1, MAX_RECORD_PAGES)) return null;
    if (typeof text !== "string" || text.trim() === "" || text.length > MAX_SECTION_TEXT_LENGTH) return null;
    if (fieldId !== undefined && (typeof fieldId !== "string" || fieldId.length > MAX_SECTION_FIELD_ID_LENGTH)) return null;
    if (hours !== undefined && (typeof hours !== "number" || !(hours >= 0 && hours <= MAX_SECTION_HOURS))) return null;
    totalLength += text.length;
    if (totalLength > MAX_RECORD_TEXT_LENGTH) return null;
    sections.push({
      id: `s${sections.length + 1}`,
      category,
      grade,
      ...(subject !== undefined && subject !== "" ? { subject } : {}),
      page,
      text,
      ...(fieldId !== undefined ? { fieldId } : {}),
      ...(hours !== undefined ? { hours } : {}),
    });
  }
  return sections;
}

/**
 * 이미지 쪽을 AI 가 읽은 결과(항목 목록)를 확인해 정리한다. 모양이 다르면 null.
 * AI 응답(서버)과 /api/record-page 응답(브라우저) 양쪽에서 쓴다.
 * - 배열이고 MAX_PAGE_SECTIONS 개 이하(0개도 된다. 빈 쪽).
 * - 항목마다 fieldId·text 는 문자열, continued 는 boolean, grade 는 정수 또는 null, subject 는 문자열 또는 null,
 *   hours 는 수 또는 null(없어도 된다).
 * 정리: fieldId 가 서식의 칸(lib/recordForm.ts)이 아니면 "ETC", category 는 그 칸의 항목명(받은 category 는 쓰지 않는다),
 * grade 가 1~MAX_SECTION_GRADE 밖이면 null(AI 는 학년을 모를 때 0 을 적는다),
 * subject 는 앞뒤 공백을 빼고 비었으면 null·길면 MAX_SECTION_SUBJECT_LENGTH 까지,
 * hours 는 시간을 적는 칸(창의적 체험활동의 영역)에서 0 보다 크고 MAX_SECTION_HOURS 이하일 때만 남기고 그 밖에는 null(AI 는 시간이 없을 때 0 을 적는다),
 * text 는 앞뒤 공백을 빼고 비었으면 그 항목을 버리고 길면 MAX_SECTION_TEXT_LENGTH 까지. continued 는 첫 항목에서만 남긴다.
 */
export function readPageSections(value: unknown): PageSection[] | null {
  if (!Array.isArray(value) || value.length > MAX_PAGE_SECTIONS) return null;
  const sections: PageSection[] = [];
  for (const [index, item] of value.entries()) {
    if (!isRecord(item)) return null;
    const { fieldId, grade, subject, text, continued } = item;
    const hours = item.hours ?? null;
    if (typeof fieldId !== "string" || typeof text !== "string" || typeof continued !== "boolean") return null;
    if (grade !== null && !(typeof grade === "number" && Number.isInteger(grade))) return null;
    if (subject !== null && typeof subject !== "string") return null;
    if (hours !== null && typeof hours !== "number") return null;
    const trimmedText = text.trim().slice(0, MAX_SECTION_TEXT_LENGTH);
    if (trimmedText === "") continue;
    const trimmedSubject = subject === null ? "" : subject.trim().slice(0, MAX_SECTION_SUBJECT_LENGTH);
    const part = recordFormPart(fieldId) ?? recordFormPart(RECORD_FORM_OTHER_ID);
    if (part === undefined) return null;
    sections.push({
      fieldId: part.id,
      category: part.category,
      grade: isIntegerIn(grade, 1, MAX_SECTION_GRADE) ? grade : null,
      subject: trimmedSubject === "" ? null : trimmedSubject,
      hours: part.hours && hours !== null && hours > 0 && hours <= MAX_SECTION_HOURS ? hours : null,
      text: trimmedText,
      // 첫 항목이 빈 글이라 버려졌으면 그다음 항목은 쪽의 첫 항목이 아니다(원래 순번으로 본다).
      continued: continued && index === 0,
    });
  }
  return sections;
}

/** 이미지 쪽 하나와 그 쪽에서 AI 가 읽은 항목 */
export type PageReading = { page: number; sections: readonly PageSection[] };

/** id 를 주기 전의 항목 */
type DraftSection = Omit<Section, "id">;

/**
 * 글자가 있는 쪽에서 파서가 읽은 항목과 이미지 쪽에서 AI 가 읽은 항목을 쪽 순서로 합쳐 s1, s2, … id 를 준다.
 * - 쪽 번호 순서로 놓는다. 같은 쪽 안에서는 받은 순서 그대로다(한 쪽은 파서나 AI 어느 한쪽만 읽는다).
 * - 이미지 쪽의 첫 항목이 앞쪽에서 이어지는 글(continued)이고 앞에 항목이 있으면, 새 항목을 만들지 않고 앞 항목의 원문 뒤에 붙인다
 *   (표 모양 항목은 줄을 바꿔, 나머지는 공백 하나로). 붙인 결과가 MAX_SECTION_TEXT_LENGTH 를 넘으면 붙이지 않고 새 항목으로 둔다.
 * - 이미지 쪽의 항목에 학년이 없고 바로 앞 항목이 같은 묶음(GRADE_GROUPS)이면 앞 항목의 학년을 쓴다.
 * - 이미지 쪽의 항목은 서식의 칸(fieldId)과, 있으면 시간(hours)을 그대로 가진다.
 * 받은 값은 바꾸지 않는다.
 */
export function mergeRecordSections(textSections: readonly Section[], readings: readonly PageReading[]): Section[] {
  type Entry = { page: number; draft: DraftSection; fromImage: false } | { page: number; draft: PageSection; fromImage: true };
  const entries: Entry[] = [];
  for (const section of textSections) {
    const { id: _id, ...draft } = section;
    void _id;
    entries.push({ page: section.page, draft, fromImage: false });
  }
  for (const reading of readings) {
    for (const section of reading.sections) entries.push({ page: reading.page, draft: section, fromImage: true });
  }
  // Array.prototype.sort 는 안정 정렬이라 같은 쪽 안의 순서는 그대로다.
  entries.sort((a, b) => a.page - b.page);

  const merged: DraftSection[] = [];
  for (const entry of entries) {
    if (!entry.fromImage) {
      merged.push({ ...entry.draft });
      continue;
    }
    const { fieldId, category, grade, subject, hours, text, continued } = entry.draft;
    const previous = merged[merged.length - 1];
    if (continued && previous !== undefined && previous.page < entry.page) {
      const joined = `${previous.text}${TABLE_CATEGORIES.includes(previous.category) ? "\n" : " "}${text}`;
      if (joined.length <= MAX_SECTION_TEXT_LENGTH) {
        previous.text = joined;
        continue;
      }
    }
    const inherited =
      grade === null && previous !== undefined && previous.grade !== null && sameGradeGroup(previous.category, category)
        ? previous.grade
        : grade;
    merged.push({
      category,
      grade: inherited,
      ...(subject !== null ? { subject } : {}),
      page: entry.page,
      text,
      fieldId,
      ...(hours !== null ? { hours } : {}),
    });
  }
  return merged.map((draft, index) => ({ id: `s${index + 1}`, ...draft }));
}

function sameGradeGroup(a: string, b: string): boolean {
  return GRADE_GROUPS.some((group) => group.includes(a) && group.includes(b));
}
