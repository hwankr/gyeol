import type { AnalysisResult, Section } from "@/types/analysis";
import { buildPlaceholderEvidences } from "../pipeline/extractEvidence.ts";
import sampleSections from "./sample-sections.json" with { type: "json" };

// "샘플 데이터로 보기"에 쓰는 샘플 결과.
// - 항목: 가상(합성) 학생부 PDF(samples/virtual-student-record.pdf)를 실제 파서(lib/pipeline/parsePdf.ts)로
//   파싱한 결과 57개(sample-sections.json). 실제 인물·학교가 아니다.
// - 근거: extractEvidence 와 같은 임시 규칙(buildPlaceholderEvidences)으로 만든다. 근거를 파일에 따로 적어 두지 않는다.
// npm run check:mock 으로 검사한다(모든 quote 가 해당 항목 text 안에 글자 그대로 있는지 등).

const sections: Section[] = sampleSections;

export const sampleResult: AnalysisResult = {
  sections,
  evidences: buildPlaceholderEvidences(sections),
};
