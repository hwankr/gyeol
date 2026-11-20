// 일치율 재기(lib/measure/agreement.ts) 검사. AI 와 서버를 부르지 않는다.
// 실행(저장소 루트에서): node scripts/check-agreement.ts (npx tsx 로도 된다)
// 보는 것: 문장 나누기(sentenceRanges), 서술형 항목만 문장으로(recordUnits), AI 인용 구절 → 문장(marksOfEvidences),
// 표시 시트 만들기·읽기(buildLabelSheet, parseCsv, readLabelSheet, marksOfSheet, decodeSheetBytes), 일치율·카파(agreementOf),
// 기준별·전체·기준 구분 없이(compareMarks), 여러 번 돌린 결과의 흔들림(stabilityOf),
// 샘플 결과(lib/mock/sample-result.json)의 근거가 모두 문장으로 옮겨지는지.
// 모두 통과하면 "일치율 검사 통과: N건" 을 출력하고 종료 코드 0, 하나라도 어긋나면 어긋난 것을 출력하고 종료 코드 1.
// Node 로 직접(타입 제거 실행) 돌도록 값 import 는 상대 경로에 .ts 확장자를 붙인다.
import { readFile } from "node:fs/promises";
import type { AnalysisResult, Criterion, Evidence, Section } from "../types/analysis.ts";
import {
  agreementOf,
  buildLabelSheet,
  compareMarks,
  countMarks,
  decodeSheetBytes,
  marksOfEvidences,
  marksOfSheet,
  mean,
  parseCsv,
  percent,
  readLabelSheet,
  recordUnits,
  sentenceRanges,
  stabilityOf,
  unitsOfSheet,
} from "../lib/measure/agreement.ts";

const SAMPLE_RESULT = "lib/mock/sample-result.json";

let checks = 0;
const failures: string[] = [];

function check(name: string, ok: boolean): void {
  checks += 1;
  if (!ok) failures.push(name);
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** 원문을 문장의 글 목록으로 */
function sentences(text: string): string[] {
  return sentenceRanges(text).map((range) => text.slice(range.start, range.end));
}

// ── sentenceRanges: 문장 나누기 ──
check("문장: 마침표와 공백에서 끊는다", same(sentences("탐구함. 발표함."), ["탐구함.", "발표함."]));
check("문장: 끝 글자 없는 마지막 부분도 문장", same(sentences("탐구함. 발표를 맡음"), ["탐구함.", "발표를 맡음"]));
check("문장: 소수점에서는 끊지 않는다", same(sentences("평균 3.5점을 받음. 끝."), ["평균 3.5점을 받음.", "끝."]));
check("문장: 뒤에 글자가 붙으면 끊지 않는다", same(sentences("수정함.(2학기) 발표함."), ["수정함.(2학기) 발표함."]));
check("문장: 닫는 따옴표는 앞 문장에 딸려 간다", same(sentences("“왜 그럴까?” 라고 물음. 답함."), ["“왜 그럴까?”", "라고 물음.", "답함."]));
check("문장: 따옴표 뒤에 글자가 붙으면 끊지 않는다", same(sentences("“왜 그럴까?”라는 질문을 던짐."), ["“왜 그럴까?”라는 질문을 던짐."]));
check("문장: 줄바꿈도 공백으로 본다", same(sentences("탐구함.\n발표함."), ["탐구함.", "발표함."]));
check("문장: 목록 번호에서는 끊지 않는다", same(sentences("1. 자료를 모음. 2. 분석함."), ["1. 자료를 모음.", "2. 분석함."]));
check("문장: 앞뒤 공백은 범위에 들지 않는다", same(sentenceRanges("  가. 나  "), [{ start: 2, end: 4 }, { start: 5, end: 6 }]));
check("문장: 빈 글과 공백뿐인 글은 문장이 없다", same([sentences(""), sentences(" \n ")], [[], []]));
check("문장: 물음표·느낌표", same(sentences("왜일까? 놀라움! 끝"), ["왜일까?", "놀라움!", "끝"]));

// ── 지어낸 학생부 ──
const sections: Section[] = [
  { id: "s1", category: "인적·학적사항", grade: null, page: 1, text: "성명 [이름]. 주소 [블라인드]." },
  { id: "s2", category: "자율활동", grade: 1, page: 2, text: "학급 회의를 이끎. 의견을 조정함. 결과를 정리함." },
  { id: "s3", category: "세부능력 및 특기사항", grade: 2, subject: "사회", page: 3, text: "기업 사례를 조사함. 자료의 한계를 밝힘." },
];
const criteria: Criterion[] = [
  { id: "c1", name: "잠재역량", description: "전공 관심, 후속 탐구" },
  { id: "c2", name: "공동체역량", description: 'the "협업", 의견 조정' },
];
const criterionIds = criteria.map((criterion) => criterion.id);
const units = recordUnits(sections);

// ── recordUnits ──
check("문장 목록: 서술형 항목만 나눈다", same(units.map((unit) => unit.key), ["s2#1", "s2#2", "s2#3", "s3#1", "s3#2"]));
check("문장 목록: 글이 문장 그대로", units[1]?.text === "의견을 조정함." && units[4]?.text === "자료의 한계를 밝힘.");

// ── marksOfEvidences: 인용 구절 → 문장 ──
function evidence(id: string, criterionId: string, sectionId: string, quote: string): Evidence {
  return { id, criterionId, sectionId, quote, reason: "" };
}
const placed = marksOfEvidences(sections, [
  evidence("e1", "c2", "s2", "의견을 조정함"),
  evidence("e2", "c1", "s3", "기업 사례를 조사함. 자료의 한계"),
  evidence("e3", "c2", "s2", "의견을 조정함."),
]);
check("인용: 문장 일부를 인용해도 그 문장", placed.marks.has("c2|s2#2"));
check("인용: 두 문장에 걸치면 둘 다", placed.marks.has("c1|s3#1") && placed.marks.has("c1|s3#2"));
check("인용: 같은 문장을 두 번 골라도 표시는 하나", placed.marks.size === 3 && placed.unplaced === 0);
const unplaced = marksOfEvidences(sections, [
  evidence("e1", "c1", "s9", "없는 항목"),
  evidence("e2", "c1", "s1", "성명 [이름]."),
  evidence("e3", "c1", "s2", "원문에 없는 구절"),
  evidence("e4", "c1", "s2", ""),
]);
check("인용: 옮기지 못한 근거는 센다", unplaced.marks.size === 0 && unplaced.unplaced === 4);

// ── 표시 시트 ──
const blank = buildLabelSheet(sections, criteria);
const blankRows = parseCsv(blank);
check("시트: BOM 으로 시작하고 CRLF 로 끊는다", blank.startsWith("﻿항목 id,") && blank.endsWith("\r\n") && !/[^\r]\n/.test(blank));
check("시트: 머리글 + 설명 줄 + 문장 줄", blankRows.length === 2 + units.length);
check("시트: 머리글의 기준 칸", same(blankRows[0], ["항목 id", "문장 번호", "학년", "항목", "과목", "문장", "c1 잠재역량", "c2 공동체역량"]));
check("시트: 설명 줄의 따옴표·쉼표가 되살아난다", blankRows[1]?.[7] === 'the "협업", 의견 조정' && blankRows[1]?.[0] === "");
check("시트: 문장 줄", same(blankRows[5], ["s3", "1", "2", "세부능력 및 특기사항", "사회", "기업 사례를 조사함.", "", ""]));
check("CSV: 칸 안의 줄바꿈과 마지막 줄", same(parseCsv('a,"b\nc"\r\n"d""e",\nf'), [["a", "b\nc"], ['d"e', ""], ["f"]]));

const blankSheet = readLabelSheet(blank);
check("시트 읽기: 빈 시트", blankSheet.ok && blankSheet.sheet.rows.length === units.length && same(blankSheet.sheet.criterionIds, criterionIds));
check("시트 읽기: 기준 이름", blankSheet.ok && same(blankSheet.sheet.criterionNames, ["잠재역량", "공동체역량"]));
if (blankSheet.ok) {
  const read = marksOfSheet(blankSheet.sheet, units, criterionIds);
  check("시트 읽기: 빈 시트는 표시가 없고 문제도 없다", read.marks.size === 0 && read.problems.length === 0);
  check("시트 읽기: 시트의 줄 → 문장 목록", same(unitsOfSheet(blankSheet.sheet), units));
}

/** 빈 시트의 줄에 표시를 적어 넣은 시트 글 (줄 번호는 머리글이 1) */
function filled(marks: Record<number, string[]>, edit?: (rows: string[][]) => void): string {
  const rows = parseCsv(blank).map((row) => [...row]);
  for (const [line, cells] of Object.entries(marks)) {
    cells.forEach((cell, column) => {
      rows[Number(line) - 1][6 + column] = cell;
    });
  }
  edit?.(rows);
  return rows.map((row) => row.map((cell) => (/[",\r\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell)).join(",")).join("\n");
}

const marked = readLabelSheet(filled({ 3: ["", "O"], 4: ["x", " o "], 6: ["✔", "-"], 7: ["0", ""] }));
check("시트 읽기: 표시한 시트", marked.ok);
if (marked.ok) {
  const read = marksOfSheet(marked.sheet, units, criterionIds);
  check("시트 읽기: 글자가 있으면 고른 것, X·-·0 은 아닌 것", same([...read.marks].sort(), ["c1|s3#1", "c2|s2#1", "c2|s2#2"]) && read.problems.length === 0);
}
check("시트 읽기: 머리글이 다르면 거절", !readLabelSheet("이름,점수\n가,1").ok);
check("시트 읽기: 기준 칸이 없으면 거절", !readLabelSheet("항목 id,문장 번호,학년,항목,과목,문장\ns2,1,1,자율활동,,가.").ok);
check("시트 읽기: 문장 번호가 수가 아니면 거절", !readLabelSheet(filled({}, (rows) => { rows[3][1] = "둘"; })).ok);

function problemsOf(text: string, ids: readonly string[] = criterionIds): string[] {
  const sheet = readLabelSheet(text);
  return sheet.ok ? marksOfSheet(sheet.sheet, units, ids).problems : ["읽지 못함"];
}
check("시트 확인: 줄을 지우면 문제", problemsOf(filled({}, (rows) => { rows.splice(4, 1); })).some((problem) => problem.includes("시트에 없는 문장 1개")));
check("시트 확인: 글이 다르면 문제", problemsOf(filled({}, (rows) => { rows[2][5] = "다른 문장."; })).some((problem) => problem.includes("3번째 줄") && problem.includes("s2#1")));
check("시트 확인: 문제 문장에 원문을 넣지 않는다", !problemsOf(filled({}, (rows) => { rows[2][5] = "다른 문장."; })).join(" ").includes("학급 회의"));
check("시트 확인: 같은 문장이 두 번이면 문제", problemsOf(filled({}, (rows) => { rows.push([...rows[2]]); })).some((problem) => problem.includes("두 번")));
check("시트 확인: 없는 문장이면 문제", problemsOf(filled({}, (rows) => { rows.push(["s9", "1", "", "", "", "없는 문장.", "", ""]); })).some((problem) => problem.includes("없는 문장 (s9#1)")));
check("시트 확인: 공백 차이는 문제가 아니다", problemsOf(filled({}, (rows) => { rows[2][5] = " 학급  회의를 이끎. "; })).length === 0);
check("시트 확인: 기준이 다르면 문제", problemsOf(blank, ["c1", "c3"]).some((problem) => problem.includes("기준 칸이 다름")));

const formulaSheet = buildLabelSheet([{ id: "s1", category: "자율활동", grade: 1, page: 1, text: "-3점에서 시작함. =합계를 냄." }], criteria);
check("시트: 수식처럼 보이는 문장은 앞에 공백", parseCsv(formulaSheet)[2]?.[5] === " -3점에서 시작함." && parseCsv(formulaSheet)[3]?.[5] === " =합계를 냄.");

check("글자 읽기: UTF-8 (BOM 은 떼고 돌려준다)", decodeSheetBytes(new TextEncoder().encode("﻿항목 id")) === "항목 id");
const gapSheet = readLabelSheet("항목 id,문장 번호,학년,항목,과목,문장,c1 잠재역량,,c2 공동체역량\r\ns2,1,1,자율활동,,학급 회의를 이끎.,,메모,O\r\n");
check("시트 읽기: 기준 칸 사이에 빈 칸이 끼어도 제 칸을 읽는다", gapSheet.ok && same(gapSheet.sheet.criterionIds, criterionIds) && same(gapSheet.sheet.rows[0]?.marked, [false, true]));
check("글자 읽기: CP949 (엑셀의 CSV 저장)", decodeSheetBytes(new Uint8Array([0xc7, 0xd7, 0xb8, 0xf1, 0x20, 0x69, 0x64])) === "항목 id");

// ── agreementOf: 일치율·카파 ──
const universe = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
const pair = agreementOf(new Set(["1", "2", "3", "4"]), new Set(["3", "4", "5"]), universe);
check("일치율: 네 칸의 수", same([pair.both, pair.onlyA, pair.onlyB, pair.neither], [2, 2, 1, 5]));
check("일치율: 둘 다 고른 수 × 2 ÷ 고른 수의 합", pair.rate !== null && Math.abs(pair.rate - 4 / 7) < 1e-12);
check("일치율: 한쪽이 고른 것 중 다른 쪽도 고른 비율", pair.aAlsoB === 0.5 && pair.bAlsoA !== null && Math.abs(pair.bAlsoA - 2 / 3) < 1e-12);
// 관찰 0.7, 우연 0.4×0.3 + 0.6×0.7 = 0.54 → (0.7 − 0.54) ÷ 0.46
check("일치율: 카파", pair.kappa !== null && Math.abs(pair.kappa - 0.16 / 0.46) < 1e-12);
const identical = agreementOf(new Set(["1", "2"]), new Set(["1", "2"]), universe);
check("일치율: 똑같으면 100%·카파 1", identical.rate === 1 && identical.kappa === 1);
const disjoint = agreementOf(new Set(["1"]), new Set(["2"]), universe);
check("일치율: 하나도 안 겹치면 0%", disjoint.rate === 0 && disjoint.aAlsoB === 0 && disjoint.kappa !== null && disjoint.kappa < 0);
const empty = agreementOf(new Set(), new Set(), universe);
check("일치율: 둘 다 하나도 고르지 않으면 값이 없다", empty.rate === null && empty.aAlsoB === null && empty.kappa === null);
check("일치율: 대상 밖의 표시는 세지 않는다", agreementOf(new Set(["1", "99"]), new Set(["1"]), universe).rate === 1);
check("일치율: 표기", percent(4 / 7) === "57%" && percent(null) === "–" && mean([]) === null && mean([0.5, 1]) === 0.75);

// ── compareMarks: 기준별·전체·기준 구분 없이 ──
const a = new Set(["c1|s3#1", "c2|s2#1", "c2|s2#2"]);
const b = new Set(["c1|s3#1", "c1|s2#2", "c2|s2#3"]);
const report = compareMarks(a, b, units, criterionIds);
check("짝 견주기: 기준별", same(report.perCriterion.map((item) => [item.criterionId, item.agreement.both, item.agreement.onlyA, item.agreement.onlyB]), [["c1", 1, 0, 1], ["c2", 0, 2, 1]]));
check("짝 견주기: 전체는 모든 (기준, 문장) 쌍", report.total.both === 1 && report.total.onlyA === 2 && report.total.onlyB === 2 && report.total.neither === 5);
// 문장으로만 보면 A {s3#1, s2#1, s2#2}, B {s3#1, s2#2, s2#3} → 둘 다 2, A 만 1, B 만 1
check("짝 견주기: 기준 구분 없이", same([report.anyCriterion.both, report.anyCriterion.onlyA, report.anyCriterion.onlyB, report.anyCriterion.neither], [2, 1, 1, 1]));
check("고른 수: 기준별", same(countMarks(a, criterionIds), [1, 2]) && same(countMarks(b, criterionIds), [2, 1]));

// ── stabilityOf: 흔들림 ──
const stable = stabilityOf([new Set(["x", "y"]), new Set(["x", "y"]), new Set(["x", "z"])]);
check("흔들림: 한 번이라도·매번", stable.ever === 3 && stable.always === 1);
check("흔들림: 짝 일치율", same(stable.pairRates, [1, 0.5, 0.5]));
check("흔들림: 한 번뿐이면 짝이 없다", stabilityOf([new Set(["x"])]).pairRates.length === 0);

// ── 샘플 결과: 근거가 모두 문장으로 옮겨지는가 ──
const sample = JSON.parse(await readFile(SAMPLE_RESULT, "utf8")) as AnalysisResult;
const sampleUnits = recordUnits(sample.sections);
const sampleMarks = marksOfEvidences(sample.sections, sample.evidences);
const sampleIds = sample.criteria.criteria.map((criterion) => criterion.id);
check("샘플: 문장이 있다", sampleUnits.length > 0);
check("샘플: 근거가 모두 문장으로 옮겨진다", sampleMarks.unplaced === 0 && sampleMarks.marks.size > 0);
check("샘플: 자기 자신과는 100%", compareMarks(sampleMarks.marks, sampleMarks.marks, sampleUnits, sampleIds).total.rate === 1);
const sampleSheet = readLabelSheet(buildLabelSheet(sample.sections, sample.criteria.criteria));
check("샘플: 시트를 만들고 다시 읽으면 문제가 없다", sampleSheet.ok && marksOfSheet(sampleSheet.sheet, sampleUnits, sampleIds).problems.length === 0);
check("샘플: 문장이 비거나 겹치지 않는다", sampleUnits.every((unit) => unit.text.trim() === unit.text && unit.text !== "") && new Set(sampleUnits.map((unit) => unit.key)).size === sampleUnits.length);

if (failures.length > 0) {
  console.error(`일치율 검사 실패: ${failures.length}건 (전체 ${checks}건)`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`일치율 검사 통과: ${checks}건 (샘플: 문장 ${sampleUnits.length}개, 근거가 걸친 (기준, 문장) ${sampleMarks.marks.size}개)`);
