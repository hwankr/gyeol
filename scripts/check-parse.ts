// 학생부 PDF 파싱 검사. 실행(저장소 루트에서): npx tsx scripts/check-parse.ts [PDF 경로]
// 인자가 없으면 samples/virtual-student-record.pdf(가상 학생부)를 읽는다.
// 파싱에 성공하면 항목 수, 항목별 개수(처음 나온 순서), 경고를 출력하고 종료 코드 0, 파싱 오류면 종료 코드 1.
// node scripts/check-parse.ts 로도 돌도록(Node 의 타입 제거 실행) 값 import 는 상대 경로에 .ts 확장자를 붙인다.
import { readFile } from "node:fs/promises";
import { parsePdfWithReport } from "../lib/pipeline/parsePdf.ts";

const DEFAULT_PDF_PATH = "samples/virtual-student-record.pdf";

async function main(): Promise<number> {
  const pdfPath = process.argv[2] ?? DEFAULT_PDF_PATH;

  let data: Uint8Array;
  try {
    data = await readFile(pdfPath);
  } catch (error) {
    console.error(`PDF 파일을 읽지 못했습니다: ${pdfPath}`);
    console.error(errorMessage(error));
    return 1;
  }

  let report: Awaited<ReturnType<typeof parsePdfWithReport>>;
  try {
    report = await parsePdfWithReport(data);
  } catch (error) {
    console.error(`파싱 실패: ${pdfPath}`);
    console.error(errorMessage(error));
    return 1;
  }

  const { sections, warnings } = report;

  // 항목명별 개수 (처음 나온 순서)
  const countByCategory = new Map<string, number>();
  for (const section of sections) {
    countByCategory.set(section.category, (countByCategory.get(section.category) ?? 0) + 1);
  }

  console.log(`파싱 성공: 항목 ${sections.length}개, 경고 ${warnings.length}개 (${pdfPath})`);
  console.log("");
  console.log(`항목별 개수 (${countByCategory.size}종):`);
  for (const [category, count] of countByCategory) {
    console.log(`- ${category} ${count}`);
  }
  console.log("");
  console.log(`경고 ${warnings.length}개${warnings.length > 0 ? ":" : ""}`);
  for (const warning of warnings) {
    console.log(`- ${warning}`);
  }
  return 0;
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
