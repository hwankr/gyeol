// 샘플 데이터(lib/mock/sampleResult.ts → sample-result.json: 가상 학생부를 경영학과 기준으로 실제 파이프라인에 돌린 결과) 검사.
// 실행: npm run check:mock
// 새 의존성 없이 Node 의 타입 제거 실행으로 돌리므로, 값 import 는 상대 경로에 .ts 확장자를 붙인다.
import { sampleResult } from "../lib/mock/sampleResult.ts";
import { isAnalysisResult, summarizeResult, validateResult } from "../lib/validateResult.ts";

// 1) 필드 형식 검사: 앱이 결과를 받을 때 쓰는 것과 같은 검사(isAnalysisResult)다.
//    형식이 틀린 데이터는 앱이 받아들이지 않으므로 내용 검사보다 먼저 본다.
const sample: unknown = sampleResult;
if (!isAnalysisResult(sample)) {
  console.error("샘플 데이터 검사 실패: 필드 형식이 AnalysisResult 와 맞지 않음 (기준·항목·근거·블라인드 처리 내역(masks)에 빠졌거나 타입이 다른 필드가 있음)");
  process.exit(1);
}

// 2) 내용 검사: id 중복(기준·항목·근거), 없는 기준·항목, quote 가 원문에 글자 그대로 있는지 등
const problems = validateResult(sample);

if (problems.length > 0) {
  console.error(`샘플 데이터 검사 실패: 문제 ${problems.length}건`);
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log(`샘플 데이터 검사 통과: ${summarizeResult(sample)}`);
