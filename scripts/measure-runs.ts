// 같은 학생부를 여러 번 분석해 AI 가 고르는 근거가 얼마나 흔들리는지 재기.
// 실행(저장소 루트에서): npm run measure:runs -- [--pdf <학생부 PDF>] [--runs <횟수>] [--out <폴더>] [--force]
// (node scripts/measure-runs.ts … 로도 돈다.)
//
// 학생부 PDF(기본: samples/virtual-student-record.pdf)를 화면의 분석과 같이 읽고 가린 뒤(parsePdf → blind),
// 근거 추출(extractEvidence)을 runs 번(기본 5) 부르고 결과를 <폴더>/ai-1.json … 에 AnalysisResult 로 저장한다
// (기본 폴더: measure/<PDF 이름>). 기준은 전형 준비의 기본 평가 기준이다(lib/measure/source.ts 의 measureCriteria).
// Claude API 를 runs 번 부르므로 비용이 든다. 저장 전에 validateResult 로 검사하고, 문제가 있는 결과는 저장하지 않는다.
//
// 출력: 실행마다 기준별로 고른 문장 수, 한 번이라도 고른 문장과 매번 고른 문장의 수, 두 번씩 짝지은 일치율의 평균·최저.
// 견주는 단위는 문장이다(lib/measure/agreement.ts). 학생부 원문·인용 구절은 출력하지 않는다.
// 저장한 결과는 npm run measure:agreement 가 사정관의 표시 시트와 견줄 때 쓴다.
//
// 조건을 바꿔 재기(흔들림의 원인을 볼 때): --effort <low|medium|high|xhigh|max> 는 생각 깊이, --max <개수|none> 은 기준마다 고르는
// 근거의 최대 개수(none 이면 개수를 정하지 않고 모두 고르게 한다), --timeout <초> 는 호출 하나의 제한 시간이다.
// 주지 않으면 화면의 분석과 같은 조건(lib/pipeline/extractEvidence.ts 의 EXTRACT_DEFAULTS, 60초)이다. 하나라도 바꾸면 기본 폴더가 measure/<PDF 이름>-<effort>-<개수|all> 이 되고,
// 제한 시간을 주었으면 끝에 -t<초> 가 붙는다(화면의 조건으로 잰 결과와 섞이지 않게).
//
// 폴더에 ai-*.json 이 이미 있으면 멈춘다. --force 를 주면 그 파일들을 지우고 새로 만든다.
// AI_API_KEY 가 프로세스 환경에 없으면 저장소 루트의 .env.local 을 읽어 온다(이미 있는 환경 변수는 덮어쓰지 않는다). 키 값은 출력하지 않는다.
// node 로 직접(타입 제거 실행) 돌도록 값 import 는 상대 경로에 .ts 확장자를 붙인다.
import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import type { AnalysisResult } from "@/types/analysis";
import {
  compareMarks,
  countMarks,
  marksOfEvidences,
  mean,
  percent,
  recordUnits,
  stabilityOf,
  type PairReport,
} from "../lib/measure/agreement.ts";
import { DEFAULT_MEASURE_PDF, measureCriteria, measureDirOf, readMeasureRecord } from "../lib/measure/source.ts";
import { AiCallError, type Effort } from "../lib/pipeline/claude.ts";
import { EXTRACT_DEFAULTS, extractEvidence, type ExtractOptions } from "../lib/pipeline/extractEvidence.ts";
import { validateResult } from "../lib/validateResult.ts";

const ENV_FILE_PATH = ".env.local";

/** 한 번에 같이 보내는 호출 수 */
const CONCURRENCY = 5;

/** 한 번에 잴 수 있는 최대 횟수 (실수로 큰 수를 넣어 비용이 커지지 않게) */
const MAX_RUNS = 20;

/** 저장하는 결과 파일 이름의 모양 */
const RUN_FILE = /^ai-\d+\.json$/;

/** --effort 로 받는 값 */
const EFFORTS: readonly Effort[] = ["low", "medium", "high", "xhigh", "max"];

/** 화면의 분석이 쓰는 조건 (폴더 이름과 출력에만 쓴다) */
const DEFAULT_EFFORT = EXTRACT_DEFAULTS.effort;
const DEFAULT_MAX = EXTRACT_DEFAULTS.maxPerCriterion;

async function main(): Promise<number> {
  const startedAt = performance.now();
  const { values } = parseArgs({
    options: {
      pdf: { type: "string", default: DEFAULT_MEASURE_PDF },
      runs: { type: "string", default: "5" },
      out: { type: "string" },
      force: { type: "boolean", default: false },
      effort: { type: "string" },
      max: { type: "string" },
      timeout: { type: "string" },
    },
  });
  const pdfPath = values.pdf;
  const runs = Number(values.runs);
  if (!Number.isInteger(runs) || runs < 2 || runs > MAX_RUNS) {
    console.error(`--runs 는 2 이상 ${MAX_RUNS} 이하의 정수여야 합니다(견주려면 두 번은 돌려야 합니다).`);
    return 1;
  }

  // 조건: 주지 않은 값은 options 에 넣지 않는다(근거 추출이 화면의 분석과 같은 기본값을 쓴다).
  const options: ExtractOptions = {};
  if (values.effort !== undefined) {
    const effort = EFFORTS.find((item) => item === values.effort);
    if (effort === undefined) {
      console.error(`--effort 는 ${EFFORTS.join(", ")} 가운데 하나여야 합니다.`);
      return 1;
    }
    options.effort = effort;
  }
  if (values.max !== undefined) {
    const max = values.max === "none" ? null : Number(values.max);
    if (max !== null && (!Number.isInteger(max) || max < 1 || max > 50)) {
      console.error("--max 는 1 이상 50 이하의 정수이거나 none 이어야 합니다.");
      return 1;
    }
    options.maxPerCriterion = max;
  }
  if (values.timeout !== undefined) {
    const seconds = Number(values.timeout);
    if (!Number.isInteger(seconds) || seconds < 10 || seconds > 600) {
      console.error("--timeout 은 10 이상 600 이하의 정수(초)여야 합니다.");
      return 1;
    }
    options.timeoutMs = seconds * 1000;
  }
  const effortLabel = options.effort ?? DEFAULT_EFFORT;
  const maxLabel = options.maxPerCriterion === undefined ? DEFAULT_MAX : options.maxPerCriterion;
  // 제한 시간도 조건이다: 60초를 넘겨 화면에서는 실패했을 호출이 성공으로 잡히므로, 준 경우에는 화면의 분석과 같은 조건으로 보지 않는다.
  const timeoutSeconds = options.timeoutMs === undefined ? null : options.timeoutMs / 1000;
  const isDefaultCondition = effortLabel === DEFAULT_EFFORT && maxLabel === DEFAULT_MAX && timeoutSeconds === null;
  const outDir =
    values.out ??
    (isDefaultCondition
      ? measureDirOf(pdfPath)
      : `${measureDirOf(pdfPath)}-${effortLabel}-${maxLabel ?? "all"}${timeoutSeconds === null ? "" : `-t${timeoutSeconds}`}`);

  if (!hasApiKey()) {
    try {
      process.loadEnvFile(ENV_FILE_PATH);
    } catch {
      // .env.local 이 없으면 아래에서 안내한다.
    }
  }
  if (!hasApiKey()) {
    console.error(
      `AI_API_KEY 가 없습니다. 환경 변수로 주거나 저장소 루트의 ${ENV_FILE_PATH} 에 AI_API_KEY=… 를 적은 뒤 저장소 루트에서 다시 실행해 주세요.`,
    );
    return 1;
  }

  await mkdir(outDir, { recursive: true });
  const oldFiles = (await readdir(outDir)).filter((name) => RUN_FILE.test(name));
  if (oldFiles.length > 0 && !values.force) {
    console.error(`${outDir} 에 이미 AI 결과가 ${oldFiles.length}개 있습니다. 지우고 새로 만들려면 --force 를 붙여 주세요.`);
    return 1;
  }

  let record: Pick<AnalysisResult, "sections" | "masks">;
  try {
    record = await readMeasureRecord(pdfPath);
  } catch (error) {
    console.error(`PDF 파일을 읽지 못했습니다: ${pdfPath}`);
    console.error(errorMessage(error));
    return 1;
  }
  const { sections, masks } = record;
  const criteria = measureCriteria();
  const criterionIds = criteria.criteria.map((criterion) => criterion.id);
  const units = recordUnits(sections);
  if (units.length === 0) {
    console.error("서술형 항목에서 문장을 찾지 못했습니다. 글자가 들어 있는 학생부 PDF 인지 확인해 주세요(스캔본은 읽지 못합니다).");
    return 1;
  }
  console.log(`학생부: ${pdfPath} — 서술형 문장 ${units.length}개, 기준 ${criteria.criteria.map((criterion) => criterion.name).join(" · ")} (${criteria.department})`);
  console.log(
    `조건: 생각 깊이 ${effortLabel}, 기준마다 ${maxLabel === null ? "개수 제한 없이 모두" : `최대 ${maxLabel}개`}` +
      `${timeoutSeconds === null ? "" : `, 제한 시간 ${timeoutSeconds}초`}` +
      `${isDefaultCondition ? " (화면의 분석과 같은 조건)" : ""}. 근거 추출을 ${runs}번 부릅니다.`,
  );

  // 실행 하나: 근거 추출 → 검사. 실패하면 이유(문구)를 돌려준다.
  const runOnce = async (): Promise<{ ok: true; result: AnalysisResult } | { ok: false; reason: string }> => {
    try {
      const evidences = await extractEvidence(sections, criteria, options);
      const result: AnalysisResult = { criteria, sections, evidences, masks };
      const problems = validateResult(result);
      if (problems.length > 0) return { ok: false, reason: `결과 검사 실패 ${problems.length}건 (${problems[0]})` };
      return { ok: true, result };
    } catch (error) {
      if (error instanceof AiCallError) return { ok: false, reason: error.message };
      throw error;
    }
  };

  const outcomes: Awaited<ReturnType<typeof runOnce>>[] = [];
  for (let done = 0; done < runs; done += CONCURRENCY) {
    const batch = Array.from({ length: Math.min(CONCURRENCY, runs - done) }, () => runOnce());
    outcomes.push(...(await Promise.all(batch)));
  }

  const results: AnalysisResult[] = [];
  let failed = 0;
  for (const outcome of outcomes) {
    if (outcome.ok) {
      results.push(outcome.result);
    } else {
      failed += 1;
      console.error(`실행 실패: ${outcome.reason}`);
    }
  }
  // 견줄 수 있을 만큼 성공했을 때만 예전 결과를 지우고 새 결과를 저장한다(모두 실패했는데 예전 결과까지 잃지 않게).
  if (results.length < 2) {
    console.error(
      `성공한 실행이 두 번이 안 되어 견줄 수 없습니다. 저장하지 않았습니다${oldFiles.length > 0 ? `(예전 결과 ${oldFiles.length}개는 그대로 있습니다)` : ""}.`,
    );
    return 1;
  }
  for (const name of oldFiles) await unlink(path.join(outDir, name));
  for (const [index, result] of results.entries()) {
    await writeFile(path.join(outDir, `ai-${index + 1}.json`), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  }
  console.log(`저장: ${outDir}/ai-1.json … ai-${results.length}.json (${results.length}개${failed > 0 ? `, 실패 ${failed}개` : ""})`);

  const placed = results.map((result) => marksOfEvidences(result.sections, result.evidences));
  const marks = placed.map((item) => item.marks);
  const unplaced = placed.reduce((sum, item) => sum + item.unplaced, 0);

  console.log("");
  console.log("실행마다 고른 문장 수 (기준별 / 합, 괄호는 AI 가 낸 근거 수)");
  results.forEach((result, index) => {
    const counts = countMarks(marks[index], criterionIds);
    const parts = criteria.criteria.map((criterion, column) => `${criterion.name} ${counts[column]}`).join(", ");
    console.log(`  ai-${index + 1} — ${parts} / ${marks[index].size} (근거 ${result.evidences.length}개)`);
  });
  if (unplaced > 0) console.log(`  문장으로 옮기지 못한 근거 ${unplaced}개는 세지 않았습니다.`);

  const stability = stabilityOf(marks);
  console.log("");
  console.log(`흔들림 (${results.length}번 실행)`);
  console.log(`  한 번이라도 고른 (기준, 문장): ${stability.ever}개`);
  console.log(`  매번 고른 (기준, 문장): ${stability.always}개 (${percent(stability.ever === 0 ? null : stability.always / stability.ever)})`);
  console.log(`  두 번씩 짝지은 일치율: 평균 ${percent(mean(stability.pairRates))}, 최저 ${percent(stability.pairRates.length === 0 ? null : Math.min(...stability.pairRates))} (${stability.pairRates.length}쌍)`);

  // 기준별, 기준 구분 없이: 짝마다 견준 값의 평균
  const reports: PairReport[] = [];
  for (let i = 0; i < marks.length; i += 1) {
    for (let j = i + 1; j < marks.length; j += 1) reports.push(compareMarks(marks[i], marks[j], units, criterionIds));
  }
  const rates = (values: (number | null)[]) => percent(mean(values.filter((value): value is number => value !== null)));
  const perCriterion = criteria.criteria
    .map((criterion, column) => `${criterion.name} ${rates(reports.map((report) => report.perCriterion[column].agreement.rate))}`)
    .join(", ");
  console.log(`  기준별 평균: ${perCriterion}`);
  console.log(`  기준 구분 없이(어느 기준으로든 고른 문장) 평균: ${rates(reports.map((report) => report.anyCriterion.rate))}`);
  console.log("");
  console.log("일치율 = 둘 다 고른 문장 × 2 ÷ 두 쪽이 고른 문장 수의 합. 100% 면 두 실행이 같은 문장을 고른 것입니다.");
  console.log(`걸린 시간: ${((performance.now() - startedAt) / 1000).toFixed(1)}초`);
  return failed > 0 ? 1 : 0;
}

function hasApiKey(): boolean {
  return (process.env.AI_API_KEY ?? "").trim() !== "";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(errorMessage(error));
    process.exitCode = 1;
  },
);
