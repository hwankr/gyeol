import type { Criterion, Evidence, Section } from "@/types/analysis";
import { NARRATIVE_CATEGORIES } from "../recordSections.ts";

// 일치율 재기: 같은 학생부에서 사람(사정관)과 AI 가 "이 기준의 근거" 로 고른 문장이 얼마나 겹치는지 센다. 순수 함수 모음.
// AI 근거 추출(lib/pipeline/extractEvidence.ts)이 믿을 만한지를 "사정관끼리의 일치율" 과 견주어 보려고 만든다.
//
// 견주는 단위는 문장이다. AI 가 읽는 서술형 항목(NARRATIVE_CATEGORIES)의 원문을 문장으로 나누고(sentenceRanges),
// (기준, 문장) 한 쌍마다 "골랐다/안 골랐다" 를 본다. AI 의 인용 구절은 그 구절이 걸친 문장을 고른 것으로 옮긴다(marksOfEvidences).
// 사람은 문장이 한 줄씩 적힌 표시 시트(CSV, 엑셀로 연다)의 기준 칸에 O 를 적는다(buildLabelSheet → readLabelSheet → marksOfSheet).
//
// 화면 코드, 스크립트(scripts/make-label-sheet.ts, measure-runs.ts, measure-agreement.ts, check-agreement.ts)가 같이 쓸 수 있는
// 순수 모듈이다(파일·AI 를 건드리지 않는다). 문제 문장에는 줄 번호·id·개수만 넣고 학생부 원문은 넣지 않는다.

/** 문장 하나. 사람과 AI 가 고른 것을 견주는 단위 */
export type SentenceUnit = {
  /** `${sectionId}#${number}` */
  key: string;
  sectionId: string;
  /** 항목 안에서의 순번 (1부터) */
  number: number;
  /** 문장의 글 (앞뒤 공백 없음) */
  text: string;
};

/** 문장 끝 글자 */
const TERMINATORS = ".!?。";

/** 문장 끝 글자 바로 뒤에 붙어 문장에 딸려 가는 닫는 글자 */
const CLOSERS = "'\"’”)]」』";

/**
 * 원문을 문장으로 나눈 범위([start, end)) 목록.
 * - 문장은 끝 글자(. ! ?) 와 그 뒤에 붙은 닫는 따옴표·괄호까지이고, 그 뒤가 공백이거나 원문의 끝일 때만 끊는다
 *   ("3.5점", "함.(2학기)" 처럼 뒤에 글자가 붙어 있으면 끊지 않는다).
 * - "1." 처럼 숫자뿐인 목록 번호에서는 끊지 않는다.
 * - 끝 글자 없이 끝나는 마지막 부분도 한 문장이다. 범위에는 앞뒤 공백이 들지 않는다.
 */
export function sentenceRanges(text: string): { start: number; end: number }[] {
  const ranges: { start: number; end: number }[] = [];
  let start = -1; // 지금 문장의 첫 글자 자리 (-1: 아직 시작하지 않음)
  let index = 0;
  while (index < text.length) {
    const ch = text[index];
    if (start === -1) {
      if (/\s/.test(ch)) {
        index += 1;
        continue;
      }
      start = index;
    }
    if (!TERMINATORS.includes(ch)) {
      index += 1;
      continue;
    }
    let end = index + 1;
    while (end < text.length && (TERMINATORS.includes(text[end]) || CLOSERS.includes(text[end]))) end += 1;
    const atBoundary = end === text.length || /\s/.test(text[end]);
    if (atBoundary && !/^\d{1,3}\.$/.test(text.slice(start, end))) {
      ranges.push({ start, end });
      start = -1;
    }
    index = end;
  }
  if (start !== -1) ranges.push({ start, end: text.trimEnd().length });
  return ranges;
}

/** 문장의 열쇠 */
export function unitKey(sectionId: string, number: number): string {
  return `${sectionId}#${number}`;
}

/** (기준, 문장) 표시의 열쇠. 기준 id 에는 "|" 가 없다고 본다(c1, c2 …) */
export function markKey(criterionId: string, key: string): string {
  return `${criterionId}|${key}`;
}

/** 학생부의 서술형 항목(AI 가 읽는 항목)을 문장으로 나눈 목록. 항목 순서, 항목 안에서는 글 순서 */
export function recordUnits(sections: readonly Section[]): SentenceUnit[] {
  const units: SentenceUnit[] = [];
  for (const section of sections) {
    if (!NARRATIVE_CATEGORIES.includes(section.category)) continue;
    sentenceRanges(section.text).forEach((range, index) => {
      units.push({
        key: unitKey(section.id, index + 1),
        sectionId: section.id,
        number: index + 1,
        text: section.text.slice(range.start, range.end),
      });
    });
  }
  return units;
}

/**
 * AI 가 고른 근거를 (기준, 문장) 표시로 옮긴다. 인용 구절이 걸친 문장을 모두 고른 것으로 본다(공백만 걸친 것은 빼고).
 * 구절이 원문에 여러 번 나오면 화면(lib/resultView.ts 의 segmentText)과 같이 처음 나온 곳으로 본다.
 * unplaced 는 문장으로 옮기지 못한 근거 수다(없는 항목, 서술형이 아닌 항목, 원문에 없는 구절). 검사를 통과한 결과에서는 0 이다.
 */
export function marksOfEvidences(
  sections: readonly Section[],
  evidences: readonly Evidence[],
): { marks: Set<string>; unplaced: number } {
  const sectionById = new Map(sections.map((section) => [section.id, section]));
  const rangesById = new Map<string, { start: number; end: number }[]>();
  const marks = new Set<string>();
  let unplaced = 0;

  for (const evidence of evidences) {
    const section = sectionById.get(evidence.sectionId);
    if (section === undefined || !NARRATIVE_CATEGORIES.includes(section.category) || evidence.quote.length === 0) {
      unplaced += 1;
      continue;
    }
    const at = section.text.indexOf(evidence.quote);
    if (at === -1) {
      unplaced += 1;
      continue;
    }
    const end = at + evidence.quote.length;
    let ranges = rangesById.get(section.id);
    if (ranges === undefined) {
      ranges = sentenceRanges(section.text);
      rangesById.set(section.id, ranges);
    }
    let placed = false;
    ranges.forEach((range, index) => {
      const from = Math.max(at, range.start);
      const to = Math.min(end, range.end);
      if (from < to && section.text.slice(from, to).trim() !== "") {
        marks.add(markKey(evidence.criterionId, unitKey(section.id, index + 1)));
        placed = true;
      }
    });
    if (!placed) unplaced += 1;
  }
  return { marks, unplaced };
}

// ── 표시 시트 (CSV) ──

/** 시트의 앞쪽 고정 칸. 그 뒤로 기준마다 한 칸("<기준 id> <기준 이름>")이 온다 */
export const SHEET_FIXED_HEADERS = ["항목 id", "문장 번호", "학년", "항목", "과목", "문장"] as const;

/** 시트 둘째 줄(설명 줄)의 "문장" 칸에 적는 안내. 설명 줄은 "항목 id" 칸이 비어 있어 읽을 때 건너뛴다 */
const SHEET_GUIDE = "↓ 그 기준의 근거라고 보는 문장의 칸에 O 를 적습니다. 아니면 비워 둡니다. (이 줄은 기준 설명입니다)";

/** 칸에 적혀 있어도 "고르지 않음" 으로 보는 값 (소문자로 견준다) */
const NO_MARKS: readonly string[] = ["x", "×", "✕", "-", "0", "n", "no"];

/**
 * 사정관이 표시할 빈 시트(CSV 글)를 만든다. 엑셀이 한글을 바로 읽도록 맨 앞에 BOM 을 붙이고 줄은 CRLF 로 끊는다.
 * 첫 줄은 머리글, 둘째 줄은 기준 설명, 그 아래는 문장마다 한 줄(recordUnits 순서)이고 기준 칸은 비어 있다.
 * "=", "+", "-", "@" 로 시작하는 문장은 엑셀이 수식으로 읽지 않게 앞에 공백을 하나 붙인다(읽을 때 공백은 무시한다).
 */
export function buildLabelSheet(sections: readonly Section[], criteria: readonly Criterion[]): string {
  const sectionById = new Map(sections.map((section) => [section.id, section]));
  const rows: string[][] = [
    [...SHEET_FIXED_HEADERS, ...criteria.map((criterion) => `${criterion.id} ${criterion.name}`)],
    ["", "", "", "", "", SHEET_GUIDE, ...criteria.map((criterion) => criterion.description)],
  ];
  for (const unit of recordUnits(sections)) {
    const section = sectionById.get(unit.sectionId);
    rows.push([
      unit.sectionId,
      String(unit.number),
      section?.grade == null ? "" : String(section.grade),
      section?.category ?? "",
      section?.subject ?? "",
      /^[=+\-@]/.test(unit.text) ? ` ${unit.text}` : unit.text,
      ...criteria.map(() => ""),
    ]);
  }
  return `﻿${rows.map((row) => row.map(csvField).join(",")).join("\r\n")}\r\n`;
}

function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/**
 * 시트 파일의 바이트를 글로 바꾼다. UTF-8 로 읽히면 UTF-8 로, 아니면 EUC-KR(CP949)로 읽는다
 * (한글 엑셀에서 "CSV (쉼표로 분리)" 로 저장하면 CP949 가 된다).
 */
export function decodeSheetBytes(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("euc-kr").decode(bytes);
  }
}

/** CSV 글을 줄·칸으로 나눈다(따옴표로 감싼 칸, 칸 안의 쉼표·줄바꿈·"" 처리). 맨 앞 BOM 은 버린다 */
export function parseCsv(text: string): string[][] {
  const source = text.startsWith("﻿") ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let index = 0;
  while (index < source.length) {
    const ch = source[index];
    if (quoted) {
      if (ch === '"' && source[index + 1] === '"') {
        field += '"';
        index += 2;
      } else if (ch === '"') {
        quoted = false;
        index += 1;
      } else {
        field += ch;
        index += 1;
      }
      continue;
    }
    if (ch === '"' && field === "") {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && source[index + 1] === "\n") index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
    index += 1;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** 시트에서 읽은 문장 한 줄 */
export type SheetRow = {
  /** 파일에서의 줄 순번 (1부터. 머리글이 1) */
  line: number;
  sectionId: string;
  number: number;
  text: string;
  /** 기준 칸마다 골랐는지 (시트의 기준 순서) */
  marked: boolean[];
};

export type LabelSheet = {
  criterionIds: string[];
  criterionNames: string[];
  rows: SheetRow[];
};

/**
 * 표시 시트(CSV 글)를 읽는다. 머리글이 시트의 것이 아니거나 줄의 모양이 맞지 않으면 problem 을 돌려준다.
 * "항목 id" 칸이 빈 줄(설명 줄, 빈 줄)은 건너뛴다. 기준 칸은 글자가 있으면 고른 것이고, 비었거나 X·-·0 이면 고르지 않은 것이다.
 */
export function readLabelSheet(text: string): { ok: true; sheet: LabelSheet } | { ok: false; problem: string } {
  const rows = parseCsv(text);
  const header = (rows[0] ?? []).map((cell) => cell.trim());
  const fixed = SHEET_FIXED_HEADERS.length;
  if (!SHEET_FIXED_HEADERS.every((name, index) => header[index] === name)) {
    return { ok: false, problem: `첫 줄이 표시 시트의 머리글(${SHEET_FIXED_HEADERS.join(", ")}, 기준 …)이 아님` };
  }
  // 기준 칸은 머리글이 적힌 칸의 자리로 읽는다(엑셀에서 사이에 빈 칸이 끼어도 옆 칸의 표시를 읽지 않게).
  const criterionColumns = header
    .map((cell, column) => ({ cell, column }))
    .filter(({ cell, column }) => column >= fixed && cell !== "");
  if (criterionColumns.length === 0) return { ok: false, problem: "머리글에 기준 칸이 없음" };
  const criterionIds = criterionColumns.map(({ cell }) => cell.split(/\s+/)[0]);
  const criterionNames = criterionColumns.map(({ cell }) => cell.replace(/^\S+\s*/, ""));

  const sheetRows: SheetRow[] = [];
  for (let index = 1; index < rows.length; index += 1) {
    const cells = rows[index];
    const sectionId = (cells[0] ?? "").trim();
    if (sectionId === "") continue;
    const number = Number((cells[1] ?? "").trim());
    if (!Number.isInteger(number) || number < 1) {
      return { ok: false, problem: `${index + 1}번째 줄: 문장 번호가 1 이상의 정수가 아님` };
    }
    sheetRows.push({
      line: index + 1,
      sectionId,
      number,
      text: cells[fixed - 1] ?? "",
      marked: criterionColumns.map(({ column }) => isMarked(cells[column] ?? "")),
    });
  }
  return { ok: true, sheet: { criterionIds, criterionNames, rows: sheetRows } };
}

function isMarked(cell: string): boolean {
  const value = cell.trim().toLowerCase();
  return value !== "" && !NO_MARKS.includes(value);
}

/** 공백을 뺀 글 (엑셀을 거치며 달라질 수 있는 공백을 무시하고 견주려고) */
function squash(text: string): string {
  return text.replace(/\s+/g, "");
}

/**
 * 시트의 표시를 (기준, 문장) 표시로 옮긴다. 시트가 이 학생부·이 기준의 것인지 먼저 확인한다:
 * 기준 id 가 같은 순서로 같아야 하고, 문장이 하나도 빠지거나 더해지거나 겹치지 않아야 하며, 문장의 글(공백 제외)이 같아야 한다.
 * 어긋난 점이 있으면 problems 에 담고(줄 번호·id·개수만. 원문은 넣지 않는다) marks 는 쓰지 않는다.
 */
export function marksOfSheet(
  sheet: LabelSheet,
  units: readonly SentenceUnit[],
  criterionIds: readonly string[],
): { marks: Set<string>; problems: string[] } {
  const problems: string[] = [];
  const marks = new Set<string>();
  if (sheet.criterionIds.join(",") !== criterionIds.join(",")) {
    problems.push(`기준 칸이 다름: 시트 [${sheet.criterionIds.join(", ")}], 견줄 기준 [${criterionIds.join(", ")}]`);
    return { marks, problems };
  }

  const unitByKey = new Map(units.map((unit) => [unit.key, unit]));
  const seen = new Set<string>();
  for (const row of sheet.rows) {
    const key = unitKey(row.sectionId, row.number);
    const unit = unitByKey.get(key);
    if (unit === undefined) {
      problems.push(`${row.line}번째 줄: 이 학생부에 없는 문장 (${key})`);
      continue;
    }
    if (seen.has(key)) {
      problems.push(`${row.line}번째 줄: 같은 문장이 두 번 나옴 (${key})`);
      continue;
    }
    seen.add(key);
    if (squash(row.text) !== squash(unit.text)) {
      problems.push(`${row.line}번째 줄: 문장의 글이 이 학생부의 것과 다름 (${key})`);
      continue;
    }
    row.marked.forEach((marked, column) => {
      if (marked) marks.add(markKey(criterionIds[column], key));
    });
  }
  const missing = units.filter((unit) => !seen.has(unit.key)).length;
  if (missing > 0) problems.push(`시트에 없는 문장 ${missing}개 (줄을 지우면 고르지 않은 것인지 알 수 없음)`);
  return { marks, problems };
}

/** 시트의 줄을 문장 목록으로 (AI 결과 없이 시트끼리만 견줄 때의 기준 목록). 글은 앞뒤 공백을 뗀다 */
export function unitsOfSheet(sheet: LabelSheet): SentenceUnit[] {
  return sheet.rows.map((row) => ({
    key: unitKey(row.sectionId, row.number),
    sectionId: row.sectionId,
    number: row.number,
    text: row.text.trim(),
  }));
}

// ── 일치율 ──

/** 두 사람(또는 AI) A·B 의 표시를 견준 값 */
export type Agreement = {
  /** 둘 다 고른 수 */
  both: number;
  /** A 만 고른 수 */
  onlyA: number;
  /** B 만 고른 수 */
  onlyB: number;
  /** 둘 다 고르지 않은 수 */
  neither: number;
  /** 일치율: 둘 다 고른 수 × 2 ÷ (A 가 고른 수 + B 가 고른 수). 둘 다 하나도 고르지 않았으면 null */
  rate: number | null;
  /** A 가 고른 것 가운데 B 도 고른 비율. A 가 하나도 고르지 않았으면 null */
  aAlsoB: number | null;
  /** B 가 고른 것 가운데 A 도 고른 비율. B 가 하나도 고르지 않았으면 null */
  bAlsoA: number | null;
  /** 코헨의 카파(우연히 맞을 몫을 뺀 일치도, -1~1). 계산할 수 없으면 null */
  kappa: number | null;
};

/**
 * 견줄 대상 전체(universe)에서 A·B 의 표시를 견준다. universe 밖의 표시는 세지 않는다.
 * 고르지 않은 문장이 대부분이라 "같은 답을 한 비율" 은 늘 높게 나온다. 그래서 일치율(rate)은 고른 것만으로 계산하고,
 * 고르지 않은 것까지 넣은 값은 우연의 몫을 뺀 카파로만 본다.
 */
export function agreementOf(a: ReadonlySet<string>, b: ReadonlySet<string>, universe: readonly string[]): Agreement {
  let both = 0;
  let onlyA = 0;
  let onlyB = 0;
  let neither = 0;
  for (const key of universe) {
    const inA = a.has(key);
    const inB = b.has(key);
    if (inA && inB) both += 1;
    else if (inA) onlyA += 1;
    else if (inB) onlyB += 1;
    else neither += 1;
  }
  const countA = both + onlyA;
  const countB = both + onlyB;
  const total = universe.length;

  let kappa: number | null = null;
  if (total > 0) {
    const observed = (both + neither) / total;
    const expected = (countA / total) * (countB / total) + ((total - countA) / total) * ((total - countB) / total);
    if (expected < 1) kappa = (observed - expected) / (1 - expected);
  }
  return {
    both,
    onlyA,
    onlyB,
    neither,
    rate: countA + countB === 0 ? null : (2 * both) / (countA + countB),
    aAlsoB: countA === 0 ? null : both / countA,
    bAlsoA: countB === 0 ? null : both / countB,
    kappa,
  };
}

/** 한 쌍(A·B)을 견준 결과 */
export type PairReport = {
  /** 기준마다 */
  perCriterion: { criterionId: string; agreement: Agreement }[];
  /** 모든 (기준, 문장) 쌍을 한데 모아 */
  total: Agreement;
  /** 기준을 가리지 않고 "어느 기준으로든 고른 문장" 끼리 (같은 문장을 다른 기준의 근거로 고른 것도 맞은 것으로 본다) */
  anyCriterion: Agreement;
};

export function compareMarks(
  a: ReadonlySet<string>,
  b: ReadonlySet<string>,
  units: readonly SentenceUnit[],
  criterionIds: readonly string[],
): PairReport {
  const keysOf = (criterionId: string) => units.map((unit) => markKey(criterionId, unit.key));
  return {
    perCriterion: criterionIds.map((criterionId) => ({ criterionId, agreement: agreementOf(a, b, keysOf(criterionId)) })),
    total: agreementOf(a, b, criterionIds.flatMap(keysOf)),
    anyCriterion: agreementOf(pickedUnits(a), pickedUnits(b), units.map((unit) => unit.key)),
  };
}

/** 어느 기준으로든 고른 문장의 열쇠 */
function pickedUnits(marks: ReadonlySet<string>): Set<string> {
  return new Set([...marks].map((key) => key.slice(key.indexOf("|") + 1)));
}

/** 기준마다 고른 문장 수 (criterionIds 순서) */
export function countMarks(marks: ReadonlySet<string>, criterionIds: readonly string[]): number[] {
  return criterionIds.map((criterionId) => [...marks].filter((key) => key.startsWith(`${criterionId}|`)).length);
}

/**
 * 같은 학생부를 여러 번 분석한 결과가 얼마나 흔들리는지.
 * ever: 한 번이라도 고른 (기준, 문장) 수, always: 매번 고른 수, pairRates: 두 번씩 짝지은 일치율(둘 다 빈 짝은 뺀다).
 */
export function stabilityOf(runs: readonly ReadonlySet<string>[]): { ever: number; always: number; pairRates: number[] } {
  const ever = new Set<string>();
  for (const run of runs) for (const key of run) ever.add(key);
  const always = [...ever].filter((key) => runs.every((run) => run.has(key))).length;
  const pairRates: number[] = [];
  for (let i = 0; i < runs.length; i += 1) {
    for (let j = i + 1; j < runs.length; j += 1) {
      const rate = agreementOf(runs[i], runs[j], [...ever]).rate;
      if (rate !== null) pairRates.push(rate);
    }
  }
  return { ever: ever.size, always, pairRates };
}

/** 평균. 값이 없으면 null */
export function mean(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** 비율을 "78%" 로. null 이면 "–" */
export function percent(value: number | null): string {
  return value === null ? "–" : `${Math.round(value * 100)}%`;
}
