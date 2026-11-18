// 샘플 결과 만들기. 실행(저장소 루트에서): npm run make:sample
// (node scripts/make-sample.ts, npx tsx scripts/make-sample.ts 로도 돈다.)
//
// 가상 학생부 PDF(samples/virtual-student-record.pdf)를 경영학과 기준으로 실제 파이프라인
// (parsePdf → blind → extractEvidence)에 한 번 돌려 lib/mock/sample-result.json 에 AnalysisResult 로 저장한다.
// Claude API 를 한 번 부르므로 비용이 든다. 저장 전에 validateResult 로 검사하고, 문제가 있으면 저장하지 않는다.
//
// AI_API_KEY 가 프로세스 환경에 없으면 저장소 루트의 .env.local 을 읽어 온다(이미 있는 환경 변수는 덮어쓰지 않는다).
// 키 값은 출력하지 않는다.
// node 로 직접(타입 제거 실행) 돌도록 값 import 는 상대 경로에 .ts 확장자를 붙인다.
import { readFile, writeFile } from "node:fs/promises";
import type { AnalysisResult, Evidence } from "@/types/analysis";
import { findDepartmentCriteria } from "../lib/criteria/index.ts";
import { blind } from "../lib/pipeline/blind.ts";
import { AiCallError } from "../lib/pipeline/claude.ts";
import { extractEvidence } from "../lib/pipeline/extractEvidence.ts";
import { parsePdf } from "../lib/pipeline/parsePdf.ts";
import { summarizeResult, validateResult } from "../lib/validateResult.ts";

const PDF_PATH = "samples/virtual-student-record.pdf";
const OUTPUT_PATH = "lib/mock/sample-result.json";
const ENV_FILE_PATH = ".env.local";
const CRITERIA_ID = "business";

async function main(): Promise<number> {
  const startedAt = performance.now();

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

  const criteria = findDepartmentCriteria(CRITERIA_ID);
  if (criteria === undefined) {
    console.error(`학과 기준을 찾지 못했습니다: ${CRITERIA_ID}`);
    return 1;
  }

  let data: Uint8Array;
  try {
    data = await readFile(PDF_PATH);
  } catch (error) {
    console.error(`PDF 파일을 읽지 못했습니다: ${PDF_PATH}`);
    console.error(errorMessage(error));
    return 1;
  }

  const sections = await blind(await parsePdf(data));
  console.log(`파싱: 항목 ${sections.length}개 (${PDF_PATH}), 기준: ${criteria.department}`);

  let evidences: Evidence[];
  try {
    // 통과·버림 개수와 AI 호출 시간은 extractEvidence 가 한 줄로 출력한다.
    evidences = await extractEvidence(sections, criteria);
  } catch (error) {
    if (error instanceof AiCallError) {
      console.error(`근거 추출 실패: ${error.message}`);
      return 1;
    }
    throw error;
  }

  const result: AnalysisResult = { criteria, sections, evidences };
  const problems = validateResult(result);
  if (problems.length > 0) {
    console.error(`결과 검사 실패: 문제 ${problems.length}건. ${OUTPUT_PATH} 에 저장하지 않았습니다.`);
    for (const problem of problems) {
      console.error(`- ${problem}`);
    }
    return 1;
  }

  await writeFile(OUTPUT_PATH, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(`저장: ${OUTPUT_PATH} — ${summarizeResult(result)}`);
  console.log(`걸린 시간: ${((performance.now() - startedAt) / 1000).toFixed(1)}초`);
  return 0;
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
