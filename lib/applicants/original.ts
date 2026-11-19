import type { AnalysisResult } from "@/types/analysis";
import { sampleResult } from "../mock/sampleResult.ts";
import { recordPagesKey } from "../recordPagesStorage.ts";
import { SAMPLE_APPLICANT_COUNT, sampleApplicantCode } from "./sampleApplicants.ts";
import { uploadedCodeNumber, type UploadedApplicant } from "./uploaded.ts";

// 원문보기 화면(지원자 관리·평가하기)에 보여 줄 분석 결과를 지원자 코드로 찾는다. 순수 함수.
// 올린 지원자는 그 학생부의 분석 결과(가려진 원문·근거)이고, 예시 지원자는 학생부 원문이 없어 미리 만든 샘플 결과
// (lib/mock/sample-result.json: 가상 학생부를 경영학과 기준으로 분석한 것)를 모두 같이 쓴다.

/** 예시 지원자의 원문보기에 붙이는 안내 (예시 지원자는 모두 같은 가상 학생부를 보여 준다) */
export const SAMPLE_ORIGINAL_NOTE = "예시 지원자라 실제 학생부 대신 가상 학생부를 분석한 샘플 결과를 보여 줍니다.";

/** 원문보기에 보여 줄 것 */
export type OriginalRecord = {
  code: string;
  result: AnalysisResult;
  /** 예시 지원자라 샘플 결과(가상 학생부)를 보여 주는지 */
  sample: boolean;
  /** 화면을 새로 그릴 열쇠: 지원자나 그 분석이 바뀌면 달라진다(고른 기준·근거·스크롤을 처음 상태로 시작하게 한다) */
  key: string;
  /** 가린 쪽 그림의 열쇠(lib/recordPagesStorage.ts). 예시 지원자는 쪽 그림이 없어 null */
  pagesKey: string | null;
};

/** 예시 지원자의 코드인지: "A-" + 네 자리이고 번호가 1~314 */
function isSampleCode(code: string): boolean {
  const number = uploadedCodeNumber(code);
  return number >= 1 && number <= SAMPLE_APPLICANT_COUNT && sampleApplicantCode(number) === code;
}

/**
 * 그 코드의 지원자에게 보여 줄 분석 결과. 올린 지원자 목록에 있으면 그 결과, 예시 지원자의 코드면 샘플 결과, 그 밖에는 null
 * (코드가 없음, 형식이 아님, 목록에서 빠진 올린 지원자).
 */
export function originalRecordOf(code: string | null, uploaded: readonly UploadedApplicant[]): OriginalRecord | null {
  if (code === null) return null;
  const item = uploaded.find((entry) => entry.code === code);
  if (item !== undefined) {
    return { code, result: item.result, sample: false, key: `${code}@${item.at}`, pagesKey: recordPagesKey(code, item.at) };
  }
  if (isSampleCode(code)) return { code, result: sampleResult, sample: true, key: code, pagesKey: null };
  return null;
}
