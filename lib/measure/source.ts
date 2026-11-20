import { readFile } from "node:fs/promises";
import path from "node:path";
import type { AnalysisResult, DepartmentCriteria } from "@/types/analysis";
import { checkDepartmentCriteria } from "../criteria/normalize.ts";
import { blind } from "../pipeline/blind.ts";
import { parsePdf } from "../pipeline/parsePdf.ts";
import { prepAnalysisCriteria } from "../prep/analysisCriteria.ts";
import { DEFAULT_PREP_CRITERIA } from "../prep/defaultCriteria.ts";

// 일치율 재기 스크립트(scripts/make-label-sheet.ts, measure-runs.ts)가 같이 쓰는 것: 잴 학생부와 기준 읽기, 결과를 둘 폴더.
// 파일을 읽으므로 스크립트만 가져온다(화면 코드에서 가져오지 않는다).
// Node 로 직접(타입 제거 실행) 돌도록 값 import 는 상대 경로에 .ts 확장자를 붙인다.

/** 기본으로 재는 학생부 (지어낸 학생부라 저장소에 있다) */
export const DEFAULT_MEASURE_PDF = "samples/virtual-student-record.pdf";

/** 결과를 두는 폴더. 표시 시트와 분석 결과에는 학생부 원문이 들어 있어 .gitignore 에 넣어 둔다 */
export const MEASURE_DIR = "measure";

/** 그 학생부의 시트·분석 결과를 두는 폴더: measure/<PDF 파일 이름(확장자 제외)> */
export function measureDirOf(pdfPath: string): string {
  return path.join(MEASURE_DIR, path.basename(pdfPath, path.extname(pdfPath)));
}

/**
 * 재는 데 쓰는 기준: 화면의 분석(POST /api/analyze)이 처음 쓰는 것과 같은, 전형 준비의 기본 평가 기준으로 만든 분석 기준이다.
 * 서버와 같은 정리(checkDepartmentCriteria)를 거친다.
 */
export function measureCriteria(): DepartmentCriteria {
  const check = checkDepartmentCriteria(prepAnalysisCriteria(DEFAULT_PREP_CRITERIA));
  if (!check.ok) throw new Error("전형 준비의 기본 평가 기준으로 분석 기준을 만들지 못했습니다.");
  return check.value;
}

/**
 * 글자가 들어 있는 학생부 PDF 를 읽어 가려진 항목과 블라인드 처리 내역을 돌려준다(화면의 분석과 같은 parsePdf → blind).
 * 스캔본처럼 글자가 없는 쪽은 읽지 못한다(그 쪽은 화면에서 AI 가 읽는다).
 */
export async function readMeasureRecord(pdfPath: string): Promise<Pick<AnalysisResult, "sections" | "masks">> {
  const data = await readFile(pdfPath);
  return blind(await parsePdf(new Uint8Array(data)));
}
