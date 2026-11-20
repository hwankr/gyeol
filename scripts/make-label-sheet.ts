// 사정관이 근거를 표시할 빈 시트(CSV) 만들기. AI 를 부르지 않는다.
// 실행(저장소 루트에서): npm run measure:sheet -- [--pdf <학생부 PDF>] [--out <시트 경로>] [--force]
// (node scripts/make-label-sheet.ts … 로도 돈다.)
//
// 학생부 PDF(기본: samples/virtual-student-record.pdf)를 화면의 분석과 같이 읽고 가린 뒤(parsePdf → blind),
// AI 가 읽는 서술형 항목을 문장으로 나눠 한 줄에 한 문장씩 적은 CSV 를 만든다(기본: measure/<PDF 이름>/sheet.csv).
// 기준은 전형 준비의 기본 평가 기준이다(lib/measure/source.ts 의 measureCriteria). 시트는 엑셀로 열린다.
//
// 재는 순서
// 1. 이 스크립트로 빈 시트를 만든다.
// 2. 사정관마다 시트를 복사해(예: 사정관A.csv) 엑셀로 열고, 문장이 어느 기준의 근거라고 보면 그 기준 칸에 O 를 적어 저장한다.
//    줄을 지우거나 순서를 바꾸지 않는다. AI 결과는 보지 않고 표시한다.
// 3. npm run measure:runs 로 같은 학생부의 AI 결과를 만든다(AI 를 부른다).
// 4. npm run measure:agreement 로 사정관끼리, AI 와 사정관의 일치율을 본다.
//
// 시트에는 학생부 원문(가린 뒤)이 들어 있다. measure/ 는 .gitignore 에 있어 저장소에 올라가지 않는다.
// 이미 있는 파일은 덮어쓰지 않는다(표시해 둔 시트를 지우지 않게). 덮어쓰려면 --force.
// node 로 직접(타입 제거 실행) 돌도록 값 import 는 상대 경로에 .ts 확장자를 붙인다.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { buildLabelSheet, recordUnits } from "../lib/measure/agreement.ts";
import { DEFAULT_MEASURE_PDF, measureCriteria, measureDirOf, readMeasureRecord } from "../lib/measure/source.ts";

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      pdf: { type: "string", default: DEFAULT_MEASURE_PDF },
      out: { type: "string" },
      force: { type: "boolean", default: false },
    },
  });
  const pdfPath = values.pdf;
  const outPath = values.out ?? path.join(measureDirOf(pdfPath), "sheet.csv");

  let sections;
  try {
    ({ sections } = await readMeasureRecord(pdfPath));
  } catch (error) {
    console.error(`PDF 파일을 읽지 못했습니다: ${pdfPath}`);
    console.error(errorMessage(error));
    return 1;
  }

  const criteria = measureCriteria();
  const units = recordUnits(sections);
  if (units.length === 0) {
    console.error("서술형 항목에서 문장을 찾지 못했습니다. 글자가 들어 있는 학생부 PDF 인지 확인해 주세요(스캔본은 읽지 못합니다).");
    return 1;
  }

  await mkdir(path.dirname(outPath), { recursive: true });
  try {
    await writeFile(outPath, buildLabelSheet(sections, criteria.criteria), { encoding: "utf8", flag: values.force ? "w" : "wx" });
  } catch (error) {
    if (isExistsError(error)) {
      console.error(`이미 있는 파일입니다: ${outPath} (표시해 둔 시트일 수 있어 덮어쓰지 않았습니다. 덮어쓰려면 --force)`);
      return 1;
    }
    throw error;
  }

  console.log(`저장: ${outPath} — 문장 ${units.length}개, 기준 ${criteria.criteria.map((criterion) => criterion.name).join(" · ")} (${criteria.department})`);
  console.log("사정관마다 이 파일을 복사해 엑셀로 열고, 근거라고 보는 문장의 기준 칸에 O 를 적어 같은 폴더에 저장합니다(줄을 지우거나 순서를 바꾸지 않습니다).");
  return 0;
}

function isExistsError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "EEXIST";
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
