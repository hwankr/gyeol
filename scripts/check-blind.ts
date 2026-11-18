// 블라인드 처리 검사. 실행(저장소 루트에서): npx tsx scripts/check-blind.ts
// 가상 학생부(samples/virtual-student-record.pdf)를 parsePdf → blind 로 돌려, 결과 전체(가린 항목 + masks 를
// JSON 문자열로 만든 것)에 이 가상 학생부의 이름("김민준")과 학교명("가상고등학교")이 남아 있지 않은지 확인한다.
// 확인할 문자열이 이 가상 학생부의 것이므로 인자는 받지 않는다.
// 출력: 항목 수, 가리기 전·후에 두 문자열이 각각 몇 곳 있는지(가리기 전 개수는 검사가 헛돌지 않았음을 보여 준다), masks.
// 남아 있지 않으면 종료 코드 0, 하나라도 남았거나 PDF 를 읽지·파싱하지 못하면 종료 코드 1.
// masks 의 값은 출력만 하고 판정하지 않는다.
// node scripts/check-blind.ts 로도 돌도록(Node 의 타입 제거 실행) 값 import 는 상대 경로에 .ts 확장자를 붙인다.
import { readFile } from "node:fs/promises";
import type { Section } from "@/types/analysis";
import { blind } from "../lib/pipeline/blind.ts";
import { parsePdf } from "../lib/pipeline/parsePdf.ts";

const PDF_PATH = "samples/virtual-student-record.pdf";

/** 가린 뒤에 남아 있으면 안 되는 문자열 (가상 학생부의 이름과 학교명) */
const MUST_NOT_REMAIN = ["김민준", "가상고등학교"];

async function main(): Promise<number> {
  let data: Uint8Array;
  try {
    data = await readFile(PDF_PATH);
  } catch (error) {
    console.error(`PDF 파일을 읽지 못했습니다: ${PDF_PATH}`);
    console.error(errorMessage(error));
    return 1;
  }

  let unmaskedSections: Section[];
  try {
    unmaskedSections = await parsePdf(data);
  } catch (error) {
    console.error(`파싱 실패: ${PDF_PATH}`);
    console.error(errorMessage(error));
    return 1;
  }

  const { sections, masks } = blind(unmaskedSections);
  const before = JSON.stringify(unmaskedSections);
  const after = JSON.stringify({ sections, masks });

  console.log(`항목 ${sections.length}개 (${PDF_PATH})`);
  console.log("");
  console.log("가리기 전 → 가린 뒤 (결과 전체에서 찾은 곳 수):");
  for (const word of MUST_NOT_REMAIN) {
    console.log(`- ${word}: ${countOccurrences(before, word)}곳 → ${countOccurrences(after, word)}곳`);
  }
  console.log("");
  console.log(`masks ${masks.length}종${masks.length > 0 ? ":" : ""}`);
  for (const mask of masks) {
    console.log(`- ${mask.type} ${mask.count}`);
  }
  console.log("");

  const remaining: string[] = [];
  for (const word of MUST_NOT_REMAIN) {
    if (!after.includes(word)) continue;
    const where = sections.filter((section) => JSON.stringify(section).includes(word)).map((section) => section.id);
    const inMasks = JSON.stringify(masks).includes(word);
    remaining.push(`- ${word}: ${[...where, ...(inMasks ? ["masks"] : [])].join(", ")}`);
  }

  if (remaining.length > 0) {
    console.error(`블라인드 검사 실패: 가린 뒤에도 남아 있는 문자열 ${remaining.length}개`);
    for (const line of remaining) {
      console.error(line);
    }
    return 1;
  }

  console.log(`블라인드 검사 통과: 가린 뒤 결과에 ${MUST_NOT_REMAIN.map((word) => `"${word}"`).join(", ")} 이(가) 없음`);
  return 0;
}

function countOccurrences(text: string, word: string): number {
  return text.split(word).length - 1;
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
