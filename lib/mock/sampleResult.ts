import type { AnalysisResult } from "@/types/analysis";
import sampleResultJson from "./sample-result.json" with { type: "json" };

// "샘플 데이터로 보기"에 쓰는 샘플 결과. sample-result.json 을 가공하지 않고 그대로 내보낸다.
// - sample-result.json 은 가상(합성) 학생부 PDF(samples/virtual-student-record.pdf)를 경영학과 기준으로
//   실제 파이프라인(parsePdf → blind → extractEvidence, Claude API)에 한 번 돌린 결과다. 실제 인물·학교가 아니다.
// - 다시 만들려면 npm run make:sample (scripts/make-sample.ts). 손으로 고치지 않는다.
// npm run check:mock 으로 검사한다(모든 quote 가 해당 항목 text 안에 글자 그대로 있는지 등).

export const sampleResult: AnalysisResult = sampleResultJson;
