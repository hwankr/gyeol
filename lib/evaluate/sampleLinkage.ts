import type { ApplicantLink, ApplicantLinkCard, Passage, SlotLinkage } from "./sampleEvaluations.ts";

// 예시 지원자의 학년별 연계 예시. 두 명(A-0085, A-0118)에게만 있다. 실제 지원자·기록이 아니고 AI 가 만든 것도 아니다.
// 예시 지원자의 원문과 근거 문장(./sampleEvaluations.ts)은 그대로 두고, 그 근거 문장을 가리키는 카드(제목·주제 태그·깊이)와
// 카드 사이의 선(종류·이유)만 손으로 적었다. 이 두 명은 지금 원문만으로 두 평가 요소에서 세 학년에 근거가 다 있다
// (A-0118: 잠재역량 1/1/1 · 학업역량 1/2/2, A-0085: 학업역량 1/2/1 · 공동체역량 1/1/1. 1·2·3학년의 근거가 있는 원문 수).
// 평가가 남은 세 명(A-0133·A-0187·A-0251)은 1학년 근거가 없어 넣지 않았다.
// "기록에 적힌 연속" 은 원문에 그 표현이 글자 그대로 있을 때만 쓴다(A-0118 의 한 곳). scripts/check-linkage.ts 가 확인한다.

/** 예시 지원자의 서류 원문을 가리키는 이름: 원문 id 의 지원자 코드 뒤쪽 ("A-0118-detail-1" 의 "detail-1") */
type PassageKey = "subject-1" | "subject-2" | "subject-3" | "detail-1" | "detail-2" | "activity" | "behavior";

/** 카드 하나를 적는 꼴: 이 파일 안에서 선이 가리키는 이름(key), 원문, 그 원문에서 근거인 조각의 순번들 */
type CardSource = {
  key: string;
  passage: PassageKey;
  segments: readonly number[];
  title: string;
  theme: string;
  depth: 1 | 2 | 3 | null;
};

/** 선 하나를 적는 꼴: 앞 학년 카드 → 뒤 학년 카드. stated 가 있으면 기록에 적힌 연속이고 그 표현이 in 쪽 카드의 원문에 있다. */
type LinkSource = {
  from: string;
  to: string;
  reason: string;
  stated?: { quote: string; in: "from" | "to" };
};

type SlotSource = { cards: readonly CardSource[]; links: readonly LinkSource[] };

/** 지원자 번호 → 자리(0 잠재역량 · 1 학업역량 · 2 공동체역량)별 카드와 선 */
const SOURCES: Readonly<Record<number, readonly [SlotSource, SlotSource, SlotSource]>> = {
  // A-0085: 경제 개념을 영상으로 설명해 또래 학습을 도운 학생. 원문에 이어짐을 적은 표현이 없어 선은 모두 AI 가 제안한 연관이다.
  85: [
    {
      cards: [
        { key: "exhibit", passage: "activity", segments: [2], title: "전시회 설명 자료 제작", theme: "경제 설명", depth: 2 },
        { key: "attempt", passage: "behavior", segments: [0], title: "스스로 계획해 시도", theme: "자기주도", depth: 2 },
      ],
      links: [],
    },
    {
      cards: [
        { key: "essay", passage: "detail-2", segments: [0], title: "경제 개념 설명문 쓰기", theme: "경제 개념", depth: 2 },
        { key: "grades", passage: "subject-2", segments: [0], title: "2학년 교과 성취", theme: "교과 성취", depth: null },
        { key: "trade", passage: "detail-1", segments: [0], title: "비교 우위 계산 탐구", theme: "경제 개념", depth: 2 },
        { key: "habit", passage: "behavior", segments: [2], title: "질문으로 이해 넓히기", theme: "학습 습관", depth: 2 },
      ],
      links: [
        { from: "essay", to: "trade", reason: "경제 개념을 글로 풀어 쓰던 학습이 사례로 계산해 확인하는 탐구로 깊어짐." },
        { from: "trade", to: "habit", reason: "계산으로 개념을 확인하던 태도가 질문으로 이해를 넓히는 학습 습관으로 이어짐." },
      ],
    },
    {
      cards: [
        { key: "group", passage: "detail-2", segments: [2], title: "모둠 글쓰기 돕기", theme: "또래 학습", depth: 1 },
        { key: "video", passage: "detail-1", segments: [2], title: "설명 영상 공유", theme: "또래 학습", depth: 2 },
        { key: "mentor", passage: "activity", segments: [0], title: "후배 기사 읽기 지도", theme: "또래 학습", depth: 3 },
      ],
      links: [
        { from: "group", to: "video", reason: "모둠원의 글을 돕던 경험이 학급 전체에 설명을 나누는 활동으로 넓어짐." },
        { from: "video", to: "mentor", reason: "또래에게 설명하던 활동이 후배를 한 학기 동안 가르치는 운영으로 이어짐." },
      ],
    },
  ],
  // A-0118: 영어·사회 교과 성취가 높고 탐구 보고서가 충실한 학생.
  118: [
    {
      cards: [
        { key: "career", passage: "activity", segments: [0], title: "경영 분야 진로 조사", theme: "경영 진로", depth: 1 },
        { key: "trade", passage: "detail-1", segments: [1], title: "공정 무역 가격 탐구", theme: "공정 무역", depth: 2 },
        { key: "plan", passage: "detail-2", segments: [2], title: "소비 습관 탐구 계획", theme: "소비", depth: 3 },
      ],
      links: [
        { from: "career", to: "trade", reason: "경영 분야의 진로를 살피던 관심이 공정 무역 제품의 가격을 따져 보는 탐구로 구체화됨." },
        { from: "trade", to: "plan", reason: "기사 자료를 정리하던 탐구가 스스로 계획을 세워 끝까지 이끄는 탐구로 이어짐." },
      ],
    },
    {
      cards: [
        { key: "question", passage: "activity", segments: [2], title: "질문을 탐구 주제로", theme: "탐구 습관", depth: 2 },
        { key: "grades", passage: "subject-2", segments: [0], title: "2학년 교과 성취", theme: "교과 성취", depth: null },
        { key: "source", passage: "detail-1", segments: [3], title: "자료 출처 견주기", theme: "자료 검증", depth: 3 },
        { key: "survey", passage: "detail-2", segments: [0], title: "소비 습관 설문 분석", theme: "자료 검증", depth: 2 },
        { key: "study", passage: "behavior", segments: [2], title: "학습 계획 실천", theme: "교과 성취", depth: 2 },
      ],
      links: [
        {
          from: "question",
          to: "source",
          reason: "1학년 기록이 받은 질문을 다음 탐구 주제로 삼았다고 적었고, 2학년에는 자료의 출처를 따지는 탐구가 이어짐.",
          stated: { quote: "다음 탐구 주제로 삼음", in: "from" },
        },
        { from: "source", to: "survey", reason: "남이 낸 수치를 견주던 탐구가 직접 설문해 비율을 계산하는 탐구로 이어짐." },
        { from: "grades", to: "study", reason: "2학년의 교과 성취가 3학년 기록의 꾸준한 학습 계획 실천과 이어짐." },
      ],
    },
    {
      cards: [{ key: "care", passage: "behavior", segments: [0], title: "규칙 준수와 배려", theme: "배려", depth: 1 }],
      links: [],
    },
  ],
};

/**
 * 그 예시 지원자의 자리별 학년별 연계. 연계 예시가 없는 지원자는 undefined.
 * 카드의 근거 문장 id 는 예시 지원자의 근거 문장 id 와 같은 꼴이다("<원문 id>-<조각 순번>". lib/evaluate/evaluation.ts 의 evidencesOf).
 * 원문을 찾지 못했거나 학년이 없는 원문을 가리키는 카드와, 그런 카드에 닿은 선은 만들지 않는다(정상이라면 없다).
 */
export function sampleLinkageOf(n: number, code: string, passages: readonly Passage[]): readonly SlotLinkage[] | undefined {
  const source = SOURCES[n];
  if (source === undefined) return undefined;
  return source.map((slot, slotIndex): SlotLinkage => {
    const cardByKey = new Map<string, ApplicantLinkCard>();
    slot.cards.forEach((card, index) => {
      const passage = passages.find((item) => item.id === `${code}-${card.passage}`);
      if (passage === undefined || passage.grade === null) return;
      cardByKey.set(card.key, {
        id: `${code}-k${slotIndex}-${index}`,
        passageId: passage.id,
        grade: passage.grade,
        title: card.title,
        theme: card.theme,
        depth: card.depth,
        evidenceIds: card.segments.map((segment) => `${passage.id}-${segment}`),
      });
    });
    const links: ApplicantLink[] = [];
    slot.links.forEach((link, index) => {
      const from = cardByKey.get(link.from);
      const to = cardByKey.get(link.to);
      if (from === undefined || to === undefined) return;
      const statedCard = link.stated === undefined ? null : link.stated.in === "from" ? from : to;
      links.push({
        id: `${code}-n${slotIndex}-${index}`,
        fromCardId: from.id,
        toCardId: to.id,
        kind: statedCard === null ? "suggested" : "stated",
        stated: statedCard === null || link.stated === undefined ? null : { quote: link.stated.quote, passageId: statedCard.passageId },
        reason: link.reason,
      });
    });
    return { cards: [...cardByKey.values()], links };
  });
}
