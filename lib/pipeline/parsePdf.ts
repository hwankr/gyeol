/**
 * 학생부 PDF → Section[]
 *
 * 대상: 글자 정보가 들어 있는 텍스트 PDF (가상 합성 학생부 양식).
 * 스캔본이나 정부24 출력본처럼 쪽 전체가 이미지인 PDF는 글자를 읽을 수 없어 오류를 냅니다.
 *
 * 방식: 글자마다 좌표를 읽어 (1) 같은 높이의 글자를 한 줄로 묶고
 * (2) 표 머리글의 가로 위치로 칸을 나누고 (3) 줄 간격으로 행과 문단을 나눕니다.
 * 항목은 번호가 아니라 제목 글자("창의적 체험활동상황" 등)로 찾습니다.
 */
import { getDocumentProxy } from "unpdf";
import type { Section } from "@/types/analysis";

/* ------------------------------------------------------------------ */
/* 결과 타입                                                           */
/* ------------------------------------------------------------------ */

export type ParsedSection = Section & {
  /** 노션 "생기부 형식" 항목 사전의 ID (예: "S06.CLUB.remarks") */
  fieldId: string;
  /** 창의적 체험활동 영역의 시간. 그 외 항목에는 없음 */
  hours?: number;
};

export type IgnoredLine = {
  page: number;
  reason: "꼬리말" | "안내문" | "문서 제목" | "분류 불가";
  text: string;
};

export type ParseReport = {
  sections: ParsedSection[];
  /** 학생 기록이 아니라서 Section에 넣지 않은 줄 */
  ignored: IgnoredLine[];
  /** 예상과 다른 양식을 만났을 때의 경고 */
  warnings: string[];
  /** 공백을 뺀 글자 수. total = sections + labels + structure + ignored */
  stats: { total: number; sections: number; labels: number; structure: number; ignored: number };
};

/* ------------------------------------------------------------------ */
/* 양식에 맞춘 기준값 (다른 양식이면 여기를 조정)                      */
/* ------------------------------------------------------------------ */

const FOOTER_MARGIN = 45; // 쪽 아래 이 높이 안의 글자는 꼬리말
const HEADING_MIN_FONT = 10.5; // 이 크기 이상이면 제목
const NOTE_MAX_FONT = 7.95; // 표 밖 안내문의 글자 크기 상한
const NOTE_MAX_X = 63; // 안내문은 표 안 글자보다 왼쪽에서 시작
const CELL_GAP = 8; // 글자 사이가 이보다 벌어지면 다른 칸
const BREAK_RATIO = 2.2; // 줄 간격이 글자 크기의 이 배수보다 크면 새 행 또는 새 문단
const NOTE_PREFIX = /^(※|작성 기준|평가요소 연계)/;

/** 대항목: 제목에 keyword가 들어 있으면 해당 항목으로 본다 */
const SECTION_DEFS = [
  { key: "S01", keyword: "인적", name: "인적·학적사항" },
  { key: "S02", keyword: "출결", name: "출결상황" },
  { key: "S03", keyword: "수상", name: "수상경력" },
  { key: "S04", keyword: "자격증", name: "자격증 및 인증 취득상황" },
  { key: "S05", keyword: "학교폭력", name: "학교폭력 조치상황 관리" },
  { key: "S06", keyword: "창의적체험", name: "창의적 체험활동상황" },
  { key: "S07", keyword: "교과학습", name: "교과학습발달상황" },
  { key: "S08", keyword: "독서활동", name: "독서활동상황" },
  { key: "S09", keyword: "행동특성", name: "행동특성 및 종합의견" },
] as const;

const SIMPLE_FIELD: Record<string, string> = { S03: "S03.AWARD", S04: "S04.CERT", S05: "S05.ACTION" };

const ACTIVITY_DEFS = [
  { keyword: "자율", name: "자율활동", fieldId: "S06.AUTO.remarks" },
  { keyword: "동아리", name: "동아리활동", fieldId: "S06.CLUB.remarks" },
  { keyword: "진로", name: "진로활동", fieldId: "S06.CAREER.remarks" },
] as const;

type TableKind =
  | "keyValue" // 항목 | 기록 (인적·학적사항)
  | "attendance" // 출결상황
  | "simple" // 구분 | 기록 (수상·자격증·학교폭력)
  | "notes" // 구분 | 특기사항, 과목 | 세부능력 및 특기사항
  | "score" // 성적표
  | "volunteer" // 봉사활동실적
  | "reading" // 독서활동상황
  | "review" // 행동특성 및 종합의견
  | "generic"; // 알 수 없는 표

/* ------------------------------------------------------------------ */
/* 내부 자료형                                                         */
/* ------------------------------------------------------------------ */

type Seg = { x: number; end: number; text: string };
type Line = { page: number; y: number; font: number; segs: Seg[] };
type CellLine = { page: number; y: number; font: number; text: string };
type Row = { page: number; cells: CellLine[][]; lastY: number; lastPage: number; lastHadLabel: boolean };
type Table = { kind: TableKind; cols: number[]; header: string[]; page: number; rows: Row[]; open: Row | null };
type Ctx = { keys: string[]; grade: number | null };

const squash = (s: string) => s.replace(/\s+/g, "");
const count = (s: string) => squash(s).length;
const tidy = (s: string) => s.replace(/[ \t]+/g, " ").trim();

/* ------------------------------------------------------------------ */
/* 1단계: 쪽마다 글자를 줄과 칸 조각으로 묶기                          */
/* ------------------------------------------------------------------ */

async function readLines(data: Uint8Array): Promise<{ lines: Line[]; ignored: IgnoredLine[]; pages: number }> {
  const pdf = await getDocumentProxy(data);
  const lines: Line[] = [];
  const ignored: IgnoredLine[] = [];

  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
    const page = await pdf.getPage(pageNo);
    const height = page.getViewport({ scale: 1 }).height;
    const content = await page.getTextContent();

    type Glyph = { x: number; y: number; w: number; font: number; s: string };
    const glyphs: Glyph[] = [];
    for (const item of content.items) {
      if (!("str" in item) || item.str === "") continue;
      const t = item.transform as number[];
      glyphs.push({ x: t[4], y: height - t[5], w: item.width, font: Math.hypot(t[2], t[3]), s: item.str });
    }

    // 같은 높이(2pt 이내)의 글자를 한 줄로
    const buckets: { y: number; glyphs: Glyph[] }[] = [];
    for (const g of glyphs.sort((a, b) => a.y - b.y || a.x - b.x)) {
      const bucket = buckets.find((b) => Math.abs(b.y - g.y) < 2);
      if (bucket) bucket.glyphs.push(g);
      else buckets.push({ y: g.y, glyphs: [g] });
    }

    for (const bucket of buckets) {
      const sorted = bucket.glyphs.sort((a, b) => a.x - b.x);
      const segs: Seg[] = [];
      let cur: Seg | null = null;
      for (const g of sorted) {
        // pdf.js는 칸과 칸 사이를 폭이 넓은 공백 하나로 채워 넣는다. 그 공백은 칸의 경계다
        if (!g.s.trim() && g.w > CELL_GAP) {
          cur = null;
          continue;
        }
        if (cur && g.x - cur.end <= CELL_GAP) {
          cur.text += g.s;
          cur.end = Math.max(cur.end, g.x + g.w);
        } else {
          if (!g.s.trim()) continue; // 칸은 공백으로 시작하지 않는다
          cur = { x: g.x, end: g.x + g.w, text: g.s };
          segs.push(cur);
        }
      }
      for (const seg of segs) seg.text = tidy(seg.text);
      const kept = segs.filter((s) => s.text);
      if (!kept.length) continue;

      const visible = sorted.filter((g) => g.s.trim());
      const font = Math.max(...visible.map((g) => g.font));

      if (bucket.y > height - FOOTER_MARGIN) {
        ignored.push({ page: pageNo, reason: "꼬리말", text: kept.map((s) => s.text).join("  ") });
        continue;
      }
      lines.push({ page: pageNo, y: bucket.y, font, segs: kept });
    }
  }
  return { lines, ignored, pages: pdf.numPages };
}

/* ------------------------------------------------------------------ */
/* 2단계: 표 머리글 판별                                               */
/* ------------------------------------------------------------------ */

function detectKind(header: string[]): TableKind | null {
  const h = header.map(squash);
  const has = (w: string) => h.some((c) => c.includes(w));
  if (h[0] === "항목" && has("기록")) return "keyValue";
  if (h[0] === "학년" && has("수업일수")) return "attendance";
  if (h[0] === "구분" && h[1] === "기록") return "simple";
  if ((h[0] === "구분" || h[0] === "과목") && has("특기사항")) return "notes";
  if (h[0] === "학기" && (has("학점수") || has("단위수"))) return "score";
  if (h[0] === "학년" && (has("일자") || has("누계"))) return "volunteer";
  if (h[0] === "학년" && has("독서")) return "reading";
  if (h[0] === "학년" && has("행동특성")) return "review";
  return null;
}

/* ------------------------------------------------------------------ */
/* 3단계: 줄을 항목으로 조립                                           */
/* ------------------------------------------------------------------ */

export async function parsePdfWithReport(input: ArrayBuffer | Uint8Array): Promise<ParseReport> {
  // pdf.js가 버퍼를 가져가므로 복사본을 넘긴다
  const data = input instanceof Uint8Array ? new Uint8Array(input) : new Uint8Array(input.slice(0));
  const { lines, ignored, pages } = await readLines(data);

  const stats = { total: 0, sections: 0, labels: 0, structure: 0, ignored: 0 };
  for (const line of ignored) stats.ignored += count(line.text);

  if (!lines.length) {
    throw new Error(
      `PDF ${pages}쪽에서 글자를 찾지 못했습니다. 스캔본이나 이미지로 된 PDF는 지원하지 않습니다. 글자가 들어 있는 텍스트 PDF를 올려주세요.`,
    );
  }

  const sections: ParsedSection[] = [];
  const warnings: string[] = [];
  const ctx: Ctx = { keys: [], grade: null };
  let table: Table | null = null;
  let expectHeader = false;

  const sectionName = (key: string) => SECTION_DEFS.find((d) => d.key === key)?.name ?? key;

  const add = (s: Omit<ParsedSection, "id">) => {
    if (!s.text) return;
    sections.push({ id: `s${sections.length + 1}`, ...s });
  };

  /** 한 칸에 쌓인 줄을 글로 합친다. 줄 간격이 넓으면 문단을 나눈다 */
  const cellText = (cellLines: CellLine[] | undefined, paragraphs = true) => {
    if (!cellLines?.length) return "";
    let out = cellLines[0].text;
    for (let i = 1; i < cellLines.length; i++) {
      const prev = cellLines[i - 1];
      const cur = cellLines[i];
      const wide = paragraphs && cur.page === prev.page && cur.y - prev.y > BREAK_RATIO * cur.font;
      out += (wide ? "\n" : " ") + cur.text;
    }
    return tidy(out.replace(/ *\n */g, "\n"));
  };

  const rowCells = (row: Row, t: Table) => t.cols.map((_, i) => cellText(row.cells[i]));

  const toGrade = (s: string) => {
    const m = s.match(/^\s*(\d)\s*(학년)?\s*$/);
    return m ? Number(m[1]) : null;
  };

  /** 행 하나가 끝났을 때: 행마다 항목이 되는 표는 여기서 Section을 만든다 */
  const emitRow = (row: Row, t: Table) => {
    const cells = rowCells(row, t);
    const label = cellText(row.cells[0], false);
    const rest = cells.slice(1).filter(Boolean).join(" ");
    const key = ctx.keys[0] ?? "UNKNOWN";

    switch (t.kind) {
      case "simple": {
        const def = SECTION_DEFS.find((d) => squash(label).includes(d.keyword));
        if (!def) warnings.push(`${row.page}쪽: "${label}" 행이 어느 항목인지 알 수 없어 표 제목 기준으로 넣었습니다.`);
        stats.labels += count(label);
        stats.sections += count(rest);
        add({
          category: def?.name ?? label,
          grade: null,
          page: row.page,
          text: rest,
          fieldId: def ? (SIMPLE_FIELD[def.key] ?? def.key) : key,
        });
        return;
      }
      case "notes": {
        stats.labels += count(label);
        stats.sections += count(rest);
        if (key === "S06") {
          const hours = label.match(/\((\d+)\s*시간\)/);
          const area = tidy(label.replace(/\(.*?\)/g, ""));
          const def = ACTIVITY_DEFS.find((d) => squash(area).includes(d.keyword));
          if (!def) warnings.push(`${row.page}쪽: 창의적 체험활동 영역 "${area}"을(를) 알 수 없습니다.`);
          add({
            category: def?.name ?? area,
            grade: ctx.grade,
            page: row.page,
            text: rest,
            fieldId: def?.fieldId ?? "S06",
            ...(hours ? { hours: Number(hours[1]) } : {}),
          });
        } else {
          // 세특. 라벨이 "2학년 경제"처럼 학년을 포함하면 그 학년을 쓴다
          const m = label.match(/^(\d)학년\s+(.+)$/);
          const subject = tidy(m ? m[2] : label);
          const grade = m ? Number(m[1]) : ctx.grade;
          const isArt = /체육|예술/.test(subject);
          add({
            category: "세부능력 및 특기사항",
            grade,
            subject,
            page: row.page,
            text: rest,
            fieldId: isArt ? "S07.ART.NOTE.text" : "S07.BASE.NOTE.text",
          });
        }
        return;
      }
      case "reading": {
        stats.labels += count(label) + count(cells[1] ?? "");
        const text = cells.slice(2).filter(Boolean).join(" ");
        stats.sections += count(text);
        add({
          category: "독서활동상황",
          grade: toGrade(label) ?? ctx.grade,
          subject: cells[1] || undefined,
          page: row.page,
          text,
          fieldId: "S08.READING.text",
        });
        return;
      }
      case "review": {
        stats.labels += count(label);
        stats.sections += count(rest);
        add({
          category: "행동특성 및 종합의견",
          grade: toGrade(label) ?? ctx.grade,
          page: row.page,
          text: rest,
          fieldId: "S09.REVIEW.text",
        });
        return;
      }
      default:
        // 표 전체가 항목 하나가 되는 종류는 표가 끝날 때 처리
        t.rows.push(row);
    }
  };

  const closeRow = () => {
    if (table?.open) {
      emitRow(table.open, table);
      table.open = null;
    }
  };

  /** 표가 끝났을 때: 표 전체가 항목 하나(또는 학년별 하나)가 되는 종류를 처리 */
  const closeTable = () => {
    if (!table) return;
    closeRow();
    const t = table;
    table = null;
    if (!t.rows.length) return;

    const key = ctx.keys[0] ?? "UNKNOWN";
    const headerLine = t.header.join(" | ");
    const asLine = (row: Row) => rowCells(row, t).join(" | ");
    for (const row of t.rows) stats.sections += count(rowCells(row, t).join(""));

    switch (t.kind) {
      case "keyValue":
        add({
          category: sectionName(key),
          grade: null,
          page: t.page,
          text: t.rows.map((r) => `${cellText(r.cells[0], false)}: ${rowCells(r, t).slice(1).join(" ")}`).join("\n"),
          fieldId: key,
        });
        return;
      case "attendance":
        add({
          category: "출결상황",
          grade: null,
          page: t.page,
          text: [headerLine, ...t.rows.map(asLine)].join("\n"),
          fieldId: "S02.ATTENDANCE",
        });
        return;
      case "score":
        add({
          category: "교과 성적",
          grade: ctx.grade,
          page: t.page,
          text: [headerLine, ...t.rows.map(asLine)].join("\n"),
          fieldId: "S07.BASE.SCORE",
        });
        return;
      case "volunteer": {
        // 학년별로 묶는다
        const byGrade = new Map<number | null, Row[]>();
        for (const row of t.rows) {
          const g = toGrade(cellText(row.cells[0], false));
          byGrade.set(g, [...(byGrade.get(g) ?? []), row]);
        }
        for (const [grade, rows] of byGrade) {
          add({
            category: "봉사활동실적",
            grade,
            page: rows[0].page,
            text: [headerLine, ...rows.map(asLine)].join("\n"),
            fieldId: "S06.VOLUNTEER",
          });
        }
        return;
      }
      default:
        add({
          category: sectionName(key),
          grade: ctx.grade,
          page: t.page,
          text: [headerLine, ...t.rows.map(asLine)].join("\n"),
          fieldId: key,
        });
    }
  };

  for (const line of lines) {
    const text = line.segs.map((s) => s.text).join("  ");
    const first = line.segs[0];

    /* 제목 */
    if (line.font >= HEADING_MIN_FONT) {
      const flat = squash(text);
      const keys = SECTION_DEFS.filter((d) => flat.includes(d.keyword)).map((d) => d.key);
      const gradeMatch = text.match(/[[(](\d)학년[\])]/);

      if (!keys.length && !ctx.keys.length) {
        ignored.push({ page: line.page, reason: "문서 제목", text });
        stats.ignored += count(text);
        continue;
      }
      stats.structure += count(text);

      const nextKeys = keys.length ? keys : ctx.keys;
      const nextGrade = gradeMatch ? Number(gradeMatch[1]) : keys.length ? null : ctx.grade;
      const same = nextKeys.join() === ctx.keys.join() && nextGrade === ctx.grade;
      // 같은 항목이 다음 쪽으로 이어지는 제목("… 계속")이면 열려 있는 행을 닫지 않는다
      if (!same) closeTable();
      ctx.keys = nextKeys;
      ctx.grade = nextGrade;
      expectHeader = true;
      continue;
    }

    /* 표 밖 안내문 (예: "※ …", "작성 기준: …") */
    const looksLikeNote =
      NOTE_PREFIX.test(text) || (line.segs.length === 1 && first.x < NOTE_MAX_X && line.font < NOTE_MAX_FONT);
    if (looksLikeNote) {
      ignored.push({ page: line.page, reason: "안내문", text });
      stats.ignored += count(text);
      continue;
    }

    /* 표 머리글 */
    const header = line.segs.map((s) => s.text);
    const kind = detectKind(header);
    if (kind || (expectHeader && line.segs.length >= 2)) {
      stats.structure += count(text);
      expectHeader = false;
      const nextKind: TableKind = kind ?? "generic";
      const continues: boolean =
        table !== null && table.kind === nextKind && table.cols.length === line.segs.length && table.open !== null;
      if (continues && table) {
        table.cols = line.segs.map((s) => s.x); // 쪽마다 칸 위치가 조금 달라도 따라간다
        continue;
      }
      closeTable();
      if (!kind) warnings.push(`${line.page}쪽: 처음 보는 표 머리글 "${header.join(" | ")}"입니다. 표 전체를 항목 하나로 넣었습니다.`);
      table = { kind: nextKind, cols: line.segs.map((s) => s.x), header, page: line.page, rows: [], open: null };
      continue;
    }
    expectHeader = false;

    /* 표 본문 */
    if (!table) {
      ignored.push({ page: line.page, reason: "분류 불가", text });
      stats.ignored += count(text);
      warnings.push(`${line.page}쪽: 표 밖에 있는 줄 "${text.slice(0, 30)}…"을(를) 분류하지 못했습니다.`);
      continue;
    }

    const t: Table = table;
    const colOf = (x: number) => {
      let idx = 0;
      for (let i = 0; i < t.cols.length; i++) if (t.cols[i] <= x + 4) idx = i;
      return idx;
    };
    const hasLabel = colOf(first.x) === 0;
    const open: Row | null = t.open;
    const gap = open && open.lastPage === line.page ? line.y - open.lastY : Infinity;
    const startsRow = hasLabel && (!open || !open.lastHadLabel || gap > BREAK_RATIO * line.font);

    if (startsRow) {
      closeRow();
      t.open = { page: line.page, cells: [], lastY: line.y, lastPage: line.page, lastHadLabel: true };
    } else if (!open) {
      // 라벨 없이 시작하는 줄: 앞 쪽에서 이어진 내용으로 보고 직전 항목에 붙인다
      const prev = sections[sections.length - 1];
      if (prev) {
        prev.text = tidy(`${prev.text} ${text}`);
        stats.sections += count(text);
        warnings.push(`${line.page}쪽: 라벨 없는 줄을 직전 항목(${prev.id})에 이어 붙였습니다.`);
      } else {
        ignored.push({ page: line.page, reason: "분류 불가", text });
        stats.ignored += count(text);
      }
      continue;
    }

    const row = t.open as Row;
    for (const seg of line.segs) {
      const col = colOf(seg.x);
      (row.cells[col] ??= []).push({ page: line.page, y: line.y, font: line.font, text: seg.text });
    }
    row.lastY = line.y;
    row.lastPage = line.page;
    row.lastHadLabel = hasLabel;
  }
  closeTable();

  stats.total = stats.sections + stats.labels + stats.structure + stats.ignored;
  return { sections, ignored, warnings, stats };
}

/** 학생부 PDF를 항목(Section) 목록으로 바꾼다 */
export async function parsePdf(input: ArrayBuffer | Uint8Array): Promise<ParsedSection[]> {
  return (await parsePdfWithReport(input)).sections;
}
