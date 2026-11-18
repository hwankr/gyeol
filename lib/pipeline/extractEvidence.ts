import type { Evidence, Section } from "@/types/analysis";
import { COMPETENCIES } from "../constants.ts";

// 이 파일은 샘플 데이터(lib/mock/sampleResult.ts)를 통해 클라이언트 번들에도 들어간다.
// 그래서 parsePdf.ts 나 unpdf 를 가져오지 않는다.

/** 임시 근거를 만드는 서술형 항목의 항목명 */
const NARRATIVE_CATEGORIES: readonly string[] = [
  "자율활동",
  "동아리활동",
  "진로활동",
  "세부능력 및 특기사항",
  "행동특성 및 종합의견",
];

/** 서술형 항목 중 몇 개마다 하나씩 근거를 만드는지 */
const PICK_EVERY = 5;

/** 인용 문장으로 쓰는 원문 첫 줄의 최대 글자 수 */
const QUOTE_MAX_LENGTH = 40;

const PLACEHOLDER_REASON = "임시 근거 (AI 연결 전)";

/**
 * AI 연결 전에 쓰는 임시 근거를 만든다. extractEvidence 와 샘플 데이터가 함께 쓰는 동기 순수 함수다.
 * - 서술형 항목(NARRATIVE_CATEGORIES)만 입력 순서대로 고르고, 그중 0번째·5번째·10번째 … 항목마다 근거를 하나 만든다.
 * - quote 는 항목 원문 첫 줄의 앞 40글자. 비어 있으면 그 항목은 건너뛴다.
 * - 역량은 만든 순서대로 COMPETENCIES 를 번갈아 배정한다.
 * - id 는 만든 순서대로 e1, e2, …
 */
export function buildPlaceholderEvidences(sections: readonly Section[]): Evidence[] {
  const narrativeSections = sections.filter((section) =>
    NARRATIVE_CATEGORIES.includes(section.category),
  );

  const evidences: Evidence[] = [];
  narrativeSections.forEach((section, index) => {
    if (index % PICK_EVERY !== 0) return;
    const quote = section.text.split("\n")[0].slice(0, QUOTE_MAX_LENGTH);
    if (quote === "") return;
    evidences.push({
      id: `e${evidences.length + 1}`,
      competency: COMPETENCIES[evidences.length % COMPETENCIES.length],
      sectionId: section.id,
      quote,
      reason: PLACEHOLDER_REASON,
    });
  });
  return evidences;
}

/**
 * 항목 원문에서 평가 역량별 근거 문장을 찾는다. 점수나 합격 여부는 판단하지 않는다.
 * 실제로는 항목마다 원문을 AI 에 보내 역량(학업·진로·공동체)별 근거 문장(quote)과 이유(reason)를 받고,
 * quote 가 해당 항목 text 안에 글자 그대로 있는지 확인한 것만 돌려준다.
 * 지금은 AI 를 연결하지 않고 buildPlaceholderEvidences 의 임시 근거를 돌려준다.
 */
// TODO: 실제 AI 호출로 교체
export async function extractEvidence(sections: Section[]): Promise<Evidence[]> {
  return buildPlaceholderEvidences(sections);
}
