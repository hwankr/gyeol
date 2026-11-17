import type { Evidence, Section } from "@/types/analysis";
import { sampleResult } from "../mock/sampleResult.ts";

/** 항목 원문에서 평가 역량별 근거 문장을 찾는다. 점수나 합격 여부는 판단하지 않는다. */
export async function extractEvidence(sections: Section[]): Promise<Evidence[]> {
  // TODO: 실제 구현
  // 항목마다 원문을 AI 에 보내 역량(학업·진로·공동체)별 근거 문장(quote)과 이유(reason)를 받고,
  // quote 가 해당 항목 text 안에 글자 그대로 있는지 확인한 것만 돌려준다.
  // 지금은 가짜 근거 중 받은 항목에 속한 것만 돌려준다.
  const sectionIds = new Set(sections.map((section) => section.id));
  return sampleResult.evidences
    .filter((evidence) => sectionIds.has(evidence.sectionId))
    .map((evidence) => ({ ...evidence }));
}
