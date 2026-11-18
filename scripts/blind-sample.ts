// 샘플 결과 블라인드 처리 (한 번 실행하는 스크립트). 실행(저장소 루트에서): npx tsx scripts/blind-sample.ts
// (node scripts/blind-sample.ts 로도 돈다.)
//
// 커밋된 lib/mock/sample-result.json 의 sections 에 blind 를 적용하고 masks(블라인드 처리 내역)를 더해 그 자리에 저장한다.
// AI 를 다시 부르지 않는다. criteria 와 evidences 는 글자 하나 바꾸지 않는다.
// - 파일에 이미 masks 가 있으면 이미 블라인드 처리된 파일로 보고 가리지도 저장하지도 않는다
//   (가린 항목에 blind 를 다시 적용하면 masks 가 빈 배열이 되어 처리 내역이 지워지기 때문이다). 아래 검사만 한다.
// - 저장하기 전에 isAnalysisResult·validateResult(모든 근거의 quote 가 해당 항목 text 에 글자 그대로 있는지 등)로 검사하고,
//   문제가 있으면 저장하지 않고 종료 코드 1.
// - 저장한 뒤 파일을 다시 읽어 같은 검사를 한 번 더 한다. 어긋나면 종료 코드 1.
// 저장 형식은 make-sample.ts 와 같다: JSON.stringify(result, null, 2) + 줄바꿈 하나, UTF-8, LF.
//
// 처리 전 파일의 sections·evidences 는 가리기 전 원문(이름·학교명 등)이다. 실패해도 그 내용이 터미널·로그에 남지 않게,
// 실패 출력에는 경로, 오류 종류·코드, 고정 문구, 검사 문제 문장(기준·항목·근거 id, 블라인드 처리 내역의 종류 이름·순번·개수)만 쓴다
// (JSON 해석 오류의 message, 항목 원문·인용·이유는 출력하지 않는다).
// node 로 직접(타입 제거 실행) 돌도록 값 import 는 상대 경로에 .ts 확장자를 붙인다.
import { readFile, writeFile } from "node:fs/promises";
import type { AnalysisResult, DepartmentCriteria, Evidence, Section } from "@/types/analysis";
import { blind } from "../lib/pipeline/blind.ts";
import { isAnalysisResult, summarizeResult, validateResult } from "../lib/validateResult.ts";

const SAMPLE_PATH = "lib/mock/sample-result.json";

async function main(): Promise<number> {
  const input = await readJson(SAMPLE_PATH);
  if (!input.ok) return 1;

  // 처리 전 파일에는 masks 가 없어 isAnalysisResult 로는 통과하지 않으므로, 입력은 세 필드의 타입만 느슨하게 본다.
  const value = input.value;
  if (!isRecord(value) || !isRecord(value.criteria) || !Array.isArray(value.sections) || !Array.isArray(value.evidences)) {
    console.error(
      `샘플 결과 형식이 올바르지 않습니다: criteria 는 객체, sections·evidences 는 배열이어야 합니다 (${SAMPLE_PATH})`,
    );
    return 1;
  }

  if ("masks" in value) {
    console.log(`이미 블라인드 처리된 파일입니다(masks 가 있음). 가리지도 저장하지도 않고 검사만 합니다: ${SAMPLE_PATH}`);
    return checkSaved();
  }

  const criteria = value.criteria as DepartmentCriteria;
  const evidences = value.evidences as Evidence[];
  const { sections, masks } = blind(value.sections as Section[]);
  const result = { criteria, sections, evidences, masks };

  const problems = checkResult(result);
  if (problems.length > 0) {
    console.error(`블라인드 처리 결과 검사 실패: 문제 ${problems.length}건. ${SAMPLE_PATH} 에 저장하지 않았습니다.`);
    for (const problem of problems) {
      console.error(`- ${problem}`);
    }
    return 1;
  }

  try {
    await writeFile(SAMPLE_PATH, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  } catch (error) {
    console.error(`샘플 결과를 저장하지 못했습니다: ${SAMPLE_PATH} (${describeError(error)})`);
    return 1;
  }
  console.log(`저장: ${SAMPLE_PATH}`);
  return checkSaved();
}

/** 저장된 파일을 다시 읽어 검사하고, 통과하면 masks 와 요약을 출력한다. */
async function checkSaved(): Promise<number> {
  const saved = await readJson(SAMPLE_PATH);
  if (!saved.ok) return 1;

  const problems = checkResult(saved.value);
  if (problems.length > 0) {
    console.error(`저장된 샘플 결과 검사 실패: 문제 ${problems.length}건 (${SAMPLE_PATH})`);
    for (const problem of problems) {
      console.error(`- ${problem}`);
    }
    return 1;
  }

  const result = saved.value as AnalysisResult;
  console.log(
    `다시 읽어 검사: 근거 ${result.evidences.length}개 모두 quote 가 해당 항목 text 에 글자 그대로 있음 (${SAMPLE_PATH})`,
  );
  console.log("");
  console.log(`masks ${result.masks.length}종${result.masks.length > 0 ? ":" : ""}`);
  for (const mask of result.masks) {
    console.log(`- ${mask.type} ${mask.count}`);
  }
  console.log("");
  console.log(`요약: ${summarizeResult(result)}`);
  return 0;
}

/**
 * 파일을 읽어 JSON 으로 해석한다. 실패하면 이유를 한 줄 출력하고 { ok: false }.
 * 읽기 실패는 경로와 오류 종류·코드(예: Error, ENOENT)만, JSON 해석 실패는 고정 문구와 경로만 출력한다.
 * (JSON 해석 오류의 message 에는 파일 내용 조각이 들어가므로 출력하지 않는다.)
 */
async function readJson(path: string): Promise<{ ok: true; value: unknown } | { ok: false }> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    console.error(`샘플 결과를 읽지 못했습니다: ${path} (${describeError(error)})`);
    return { ok: false };
  }
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    console.error(`샘플 결과가 올바른 JSON 이 아닙니다: ${path}`);
    return { ok: false };
  }
}

/**
 * 형식(isAnalysisResult)과 내용(validateResult)을 검사해 문제 문장 목록을 돌려준다. 빈 배열이면 통과.
 * 문장에는 기준·항목·근거 id 와 블라인드 처리 내역의 종류 이름·순번·개수만 들어간다(항목 원문·인용·이유는 들어가지 않는다).
 */
function checkResult(value: unknown): string[] {
  if (!isAnalysisResult(value)) {
    return ["필드 형식이 AnalysisResult 와 맞지 않음 (기준·항목·근거·블라인드 처리 내역(masks)에 빠졌거나 타입이 다른 필드가 있음)"];
  }
  return validateResult(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 오류를 출력할 때 쓰는 설명: 오류 종류(name)와, 있으면 code 만. message 는 내용 조각이 들어갈 수 있어 쓰지 않는다. */
function describeError(error: unknown): string {
  if (!(error instanceof Error)) return typeof error;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" || typeof code === "number" ? `${error.name}, ${code}` : error.name;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(`예상하지 못한 오류로 끝났습니다 (${describeError(error)})`);
    process.exitCode = 1;
  },
);
