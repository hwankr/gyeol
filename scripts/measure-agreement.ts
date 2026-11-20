// 사정관끼리, AI 와 사정관이 고른 근거의 일치율 보기. AI 를 부르지 않는다.
// 실행(저장소 루트에서): npm run measure:agreement -- [<폴더 또는 파일> …]
// (node scripts/measure-agreement.ts … 로도 돈다.)
//
// 받는 것: 같은 학생부·같은 기준에 대한 표시들. 폴더를 주면 그 안의 .csv 와 .json 을 모두 읽는다
// (아무것도 주지 않으면 measure/virtual-student-record).
// - .csv: 사정관이 표시한 시트(scripts/make-label-sheet.ts 가 만든 것). UTF-8 과 엑셀의 CP949 저장을 모두 읽는다.
//   표시가 하나도 없는 시트(빈 시트 원본)는 건너뛴다.
// - .json: AI 분석 결과(AnalysisResult. scripts/measure-runs.ts 가 저장한 ai-N.json).
//
// 견주는 단위는 문장이다(lib/measure/agreement.ts). AI 의 인용 구절은 그 구절이 걸친 문장을 고른 것으로 본다.
// 일치율 = 둘 다 고른 문장 × 2 ÷ 두 쪽이 고른 문장 수의 합 (고르지 않은 문장이 대부분이라, 고른 것만으로 계산한다).
// 출력: 표시한 쪽마다 기준별로 고른 문장 수, 짝마다 일치율(전체·기준별·기준 구분 없이)과 카파, 사람끼리 / AI 와 사람 / AI 끼리의 평균.
// 파일 이름·id·개수만 출력하고 학생부 원문은 출력하지 않는다.
// 시트가 이 학생부의 것이 아니면(줄이 빠짐, 글이 다름, 기준이 다름) 어긋난 점을 출력하고 종료 코드 1.
// node 로 직접(타입 제거 실행) 돌도록 값 import 는 상대 경로에 .ts 확장자를 붙인다.
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import {
  compareMarks,
  countMarks,
  decodeSheetBytes,
  marksOfEvidences,
  marksOfSheet,
  mean,
  percent,
  readLabelSheet,
  recordUnits,
  unitsOfSheet,
  type LabelSheet,
  type PairReport,
  type SentenceUnit,
} from "../lib/measure/agreement.ts";
import { DEFAULT_MEASURE_PDF, measureDirOf } from "../lib/measure/source.ts";
import { isAnalysisResult, validateResult } from "../lib/validateResult.ts";

/** 표시한 쪽 하나 */
type Labeler = { name: string; kind: "사람" | "AI"; marks: Set<string> };

async function main(): Promise<number> {
  const { positionals } = parseArgs({ allowPositionals: true });
  const targets = positionals.length > 0 ? positionals : [measureDirOf(DEFAULT_MEASURE_PDF)];

  const files: string[] = [];
  for (const target of targets) {
    let isDirectory: boolean;
    try {
      isDirectory = (await stat(target)).isDirectory();
    } catch {
      console.error(`찾지 못했습니다: ${target}`);
      return 1;
    }
    if (!isDirectory) {
      files.push(target);
      continue;
    }
    const names = (await readdir(target)).filter((name) => /\.(csv|json)$/i.test(name));
    files.push(...names.sort((a, b) => a.localeCompare(b, "ko", { numeric: true })).map((name) => path.join(target, name)));
  }

  // 파일을 읽는다. AI 결과는 문장 목록과 기준을 함께 주므로 먼저 읽고, 시트는 그 목록에 맞춰 확인한다.
  const problems: string[] = [];
  const sheets: { name: string; sheet: LabelSheet }[] = [];
  const labelers: Labeler[] = [];
  let units: SentenceUnit[] | null = null;
  let criterionIds: string[] = [];
  let criterionNames: string[] = [];

  for (const file of files.filter((name) => /\.json$/i.test(name))) {
    const name = path.basename(file, path.extname(file));
    let value: unknown;
    try {
      value = JSON.parse(await readFile(file, "utf8"));
    } catch {
      problems.push(`${file}: JSON 으로 읽지 못함`);
      continue;
    }
    if (!isAnalysisResult(value)) {
      problems.push(`${file}: AI 분석 결과(AnalysisResult)의 모양이 아님`);
      continue;
    }
    const invalid = validateResult(value);
    if (invalid.length > 0) {
      problems.push(`${file}: 결과 검사 실패 ${invalid.length}건 (${invalid[0]})`);
      continue;
    }
    const resultUnits = recordUnits(value.sections);
    const resultIds = value.criteria.criteria.map((criterion) => criterion.id);
    if (units === null) {
      units = resultUnits;
      criterionIds = resultIds;
      criterionNames = value.criteria.criteria.map((criterion) => criterion.name);
    } else if (!sameUnits(units, resultUnits) || resultIds.join(",") !== criterionIds.join(",")) {
      problems.push(`${file}: 다른 AI 결과와 학생부(문장) 또는 기준이 다름`);
      continue;
    }
    const placed = marksOfEvidences(value.sections, value.evidences);
    if (placed.unplaced > 0) console.log(`${name}: 문장으로 옮기지 못한 근거 ${placed.unplaced}개는 세지 않았습니다.`);
    labelers.push({ name, kind: "AI", marks: placed.marks });
  }

  for (const file of files.filter((name) => /\.csv$/i.test(name))) {
    const read = readLabelSheet(decodeSheetBytes(await readFile(file)));
    if (!read.ok) {
      problems.push(`${file}: ${read.problem}`);
      continue;
    }
    sheets.push({ name: path.basename(file, path.extname(file)), sheet: read.sheet });
  }
  if (units === null && sheets.length > 0) {
    // AI 결과가 없으면 첫 시트의 줄을 문장 목록으로 삼는다.
    units = unitsOfSheet(sheets[0].sheet);
    criterionIds = sheets[0].sheet.criterionIds;
    criterionNames = sheets[0].sheet.criterionNames;
  }
  for (const { name, sheet } of sheets) {
    const read = marksOfSheet(sheet, units ?? [], criterionIds);
    if (read.problems.length > 0) {
      problems.push(...read.problems.slice(0, 5).map((problem) => `${name}.csv: ${problem}`));
      if (read.problems.length > 5) problems.push(`${name}.csv: … 그 밖에 ${read.problems.length - 5}건`);
      continue;
    }
    if (read.marks.size === 0) {
      console.log(`${name}.csv: 표시가 하나도 없어 건너뜁니다(빈 시트).`);
      continue;
    }
    labelers.push({ name, kind: "사람", marks: read.marks });
  }

  if (problems.length > 0) {
    console.error(`읽지 못한 파일이 있습니다: 문제 ${problems.length}건`);
    for (const problem of problems) console.error(`- ${problem}`);
    return 1;
  }
  if (units === null || labelers.length < 2) {
    console.error(`견줄 표시가 둘 이상 있어야 합니다(지금 ${labelers.length}개). 받은 것: ${targets.join(", ")}`);
    console.error("사정관이 표시한 시트(.csv)나 AI 결과(.json)를 더해 주세요. 시트는 npm run measure:sheet, AI 결과는 npm run measure:runs 로 만듭니다.");
    return 1;
  }

  // 사람을 앞에 둔다.
  labelers.sort((a, b) => Number(a.kind === "AI") - Number(b.kind === "AI"));
  console.log(`대상: 서술형 문장 ${units.length}개 × 기준 ${criterionIds.length}개 (${criterionNames.join(" · ")})`);
  console.log("");
  console.log("고른 문장 수 (기준별 / 합)");
  for (const labeler of labelers) {
    const counts = countMarks(labeler.marks, criterionIds);
    console.log(`  [${labeler.kind}] ${labeler.name} — ${criterionNames.map((name, column) => `${name} ${counts[column]}`).join(", ")} / ${labeler.marks.size}`);
  }

  type Pair = { a: Labeler; b: Labeler; report: PairReport };
  const pairs: Pair[] = [];
  for (let i = 0; i < labelers.length; i += 1) {
    for (let j = i + 1; j < labelers.length; j += 1) {
      pairs.push({ a: labelers[i], b: labelers[j], report: compareMarks(labelers[i].marks, labelers[j].marks, units, criterionIds) });
    }
  }
  const kindOf = (pair: Pair) => (pair.a.kind === pair.b.kind ? `${pair.a.kind}끼리` : "AI 와 사람");
  const humanPairs = pairs.filter((pair) => kindOf(pair) === "사람끼리");
  const mixedPairs = pairs.filter((pair) => kindOf(pair) === "AI 와 사람");
  const aiPairs = pairs.filter((pair) => kindOf(pair) === "AI끼리");

  console.log("");
  console.log("짝별 일치율 (둘 다 고른 문장 × 2 ÷ 두 쪽이 고른 문장 수의 합)");
  // AI 끼리의 짝은 수가 많아 평균만 보여 준다(자세한 값은 npm run measure:runs 가 보여 준다).
  for (const pair of [...humanPairs, ...mixedPairs]) {
    const { report } = pair;
    const perCriterion = report.perCriterion.map((item, column) => `${criterionNames[column]} ${percent(item.agreement.rate)}`).join(", ");
    console.log(
      `  [${kindOf(pair)}] ${pair.a.name} ↔ ${pair.b.name} — 전체 ${percent(report.total.rate)} (${perCriterion}), ` +
        `기준 구분 없이 ${percent(report.anyCriterion.rate)}, 카파 ${report.total.kappa === null ? "–" : report.total.kappa.toFixed(2)}`,
    );
    console.log(
      `      ${pair.a.name} 가 고른 문장 중 ${pair.b.name} 도 고름 ${percent(report.total.aAlsoB)} · ` +
        `${pair.b.name} 가 고른 문장 중 ${pair.a.name} 도 고름 ${percent(report.total.bAlsoA)} (둘 다 ${report.total.both}, ${pair.a.name} 만 ${report.total.onlyA}, ${pair.b.name} 만 ${report.total.onlyB})`,
    );
  }
  if (humanPairs.length + mixedPairs.length === 0) console.log("  (사람이 표시한 시트가 없어 AI 끼리만 견줍니다.)");

  const average = (list: Pair[], pick: (report: PairReport) => number | null) =>
    percent(mean(list.map((pair) => pick(pair.report)).filter((value): value is number => value !== null)));
  console.log("");
  console.log("요약 (짝마다 잰 값의 평균)");
  if (humanPairs.length > 0) {
    console.log(`  사람끼리: 전체 ${average(humanPairs, (report) => report.total.rate)}, 기준 구분 없이 ${average(humanPairs, (report) => report.anyCriterion.rate)} (${humanPairs.length}쌍)`);
  }
  if (mixedPairs.length > 0) {
    console.log(`  AI 와 사람: 전체 ${average(mixedPairs, (report) => report.total.rate)}, 기준 구분 없이 ${average(mixedPairs, (report) => report.anyCriterion.rate)} (${mixedPairs.length}쌍)`);
    // 사람을 앞에 두었으므로 이 짝에서 a 는 사람, b 는 AI 다.
    console.log(`      사람이 고른 문장 중 AI 도 고른 비율 ${average(mixedPairs, (report) => report.total.aAlsoB)} (낮으면 AI 가 빠뜨린 것이 많다)`);
    console.log(`      AI 가 고른 문장 중 사람도 고른 비율 ${average(mixedPairs, (report) => report.total.bAlsoA)} (낮으면 AI 가 사람이 고르지 않은 것을 많이 골랐다)`);
  }
  if (aiPairs.length > 0) {
    console.log(`  AI 끼리: 전체 ${average(aiPairs, (report) => report.total.rate)}, 기준 구분 없이 ${average(aiPairs, (report) => report.anyCriterion.rate)} (${aiPairs.length}쌍)`);
  }
  console.log("");
  console.log("읽는 법: 사정관끼리도 100% 가 나오지 않습니다. \"AI 와 사람\" 이 \"사람끼리\" 에 가까울수록 AI 가 사정관 한 명만큼 고른다는 뜻입니다.");
  if (humanPairs.length === 0) console.log("사람끼리의 값이 없습니다. 견주려면 사정관 두 명 이상의 시트가 필요합니다.");
  return 0;
}

/** 두 문장 목록이 같은 학생부의 것인지 (열쇠와 공백을 뺀 글이 순서대로 같다) */
function sameUnits(a: readonly SentenceUnit[], b: readonly SentenceUnit[]): boolean {
  const flat = (units: readonly SentenceUnit[]) => units.map((unit) => `${unit.key} ${unit.text.replace(/\s+/g, "")}`).join("\n");
  return flat(a) === flat(b);
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  },
);
