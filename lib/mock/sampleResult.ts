import type { AnalysisResult } from "@/types/analysis";
import sampleResultJson from "./sample-result.json" with { type: "json" };

// 예시 지원자의 원문보기에 쓰는 샘플 결과(lib/applicants/original.ts). sample-result.json 을 가공하지 않고 그대로 내보낸다.
// - sample-result.json 은 가상(합성) 학생부 PDF(samples/virtual-student-record.pdf)를 경영학과 기준으로
//   실제 파이프라인(parsePdf → blind → extractEvidence, Claude API. 그때 blind 는 아직 아무것도 가리지 않았다)에
//   한 번 돌린 결과에, AI 를 다시 부르지 않고
//   scripts/blind-sample.ts 로 블라인드 처리(lib/pipeline/blind.ts)를 적용한 것이다. 실제 인물·학교가 아니다.
//   그래서 sections 는 가려진 원문이고(인적·학적사항은 [블라인드], 학교명은 [학교명]), masks 에 블라인드 처리 내역이 있다.
//   근거(evidences)는 그대로이며, 모든 quote 는 가려진 원문에도 글자 그대로 있다.
// - 다시 만들려면 npm run make:sample (scripts/make-sample.ts, parsePdf → blind → extractEvidence). 손으로 고치지 않는다.
// npm run check:mock 으로 검사한다(모든 quote 가 해당 항목 text 안에 글자 그대로 있는지 등).

export const sampleResult: AnalysisResult = sampleResultJson;
