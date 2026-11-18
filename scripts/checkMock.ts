// 샘플 데이터(lib/mock/sampleResult.ts: 가상 학생부 파싱 결과 + 임시 근거) 검사. 실행: npm run check:mock
// 새 의존성 없이 Node 의 타입 제거 실행으로 돌리므로, 값 import 는 상대 경로에 .ts 확장자를 붙인다.
import { sampleResult } from "../lib/mock/sampleResult.ts";
import { summarizeResult, validateResult } from "../lib/validateResult.ts";

const problems = validateResult(sampleResult);

if (problems.length > 0) {
  console.error(`샘플 데이터 검사 실패: 문제 ${problems.length}건`);
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log(`샘플 데이터 검사 통과: ${summarizeResult(sampleResult)}`);
