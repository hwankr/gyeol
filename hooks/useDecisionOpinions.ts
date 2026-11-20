import { useMemo, useState } from "react";
import { useDecisionData } from "@/hooks/useDecisionData";
import { decisionMemberName, standingText, tenthsText, type RankedApplicant } from "@/lib/decision/decision";
import { WIDE_ELEMENT_SPREAD, elementSpreadsOf, needsAdjustment } from "@/lib/decision/opinions";
import type { PrepElement } from "@/lib/prep/criteria";

/** 걸러 보기: 조정이 필요한 지원자만 또는 전체 */
type OpinionFilter = "adjust" | "all";

const FILTER_LABEL: Record<OpinionFilter, string> = {
  adjust: "조정 필요",
  all: "전체",
};

const FILTERS: readonly OpinionFilter[] = ["adjust", "all"];

/** 지원자 한 명의 카드: 위원 × 평가 요소의 점수 표와 크게 갈린 요소 */
function cardView(row: RankedApplicant, elements: readonly PrepElement[]) {
  const { applicant } = row;
  const spreads = elementSpreadsOf(row, elements);
  const wide = spreads.filter((item) => item.wide);
  return {
    code: applicant.code,
    rankText: `${row.rank}위`,
    standingText: standingText(row),
    adjust: needsAdjustment(spreads),
    /** 크게 갈린 요소와 그 차이: "잠재역량 12점 · 학업역량 14점 차이" (없으면 빈 글) */
    wideText: wide.length === 0 ? "" : `${wide.map((item) => `${item.name} ${item.spread}점`).join(" · ")} 차이`,
    /** 표의 요소 칸 (지금 평가 기준의 요소 순서). wide 면 그 칸을 붉게 칠한다. spreadText 는 마지막 줄의 위원 간 차이 */
    columns: spreads.map((item) => ({ id: item.id, name: item.name, wide: item.wide, spreadText: String(item.spread) })),
    /** 위원 한 명씩: 이름, 종합 의견, 요소별 점수(columns 와 같은 순서), 종합 점수 */
    members: row.memberTotal10.map((total10, index) => ({
      name: decisionMemberName(index),
      opinion: applicant.opinions[index] ?? "",
      scores: spreads.map((item) => String(item.scores[index] ?? 0)),
      totalText: tenthsText(total10),
    })),
    /** 위원별 종합 점수의 차이 */
    totalSpreadText: tenthsText(row.spread10),
  };
}

/**
 * 선발 결정 · 위원 의견 모아보기 탭 상태: 합격선 주변 지원자마다 위원들의 요소별 점수·종합 점수·종합 의견을 표 하나로 모으고,
 * 위원 점수가 크게 갈린 요소(차이 10점 이상)를 가려 표시한다. 카드는 순위 순서다.
 * - 걸러 보기: `조정 필요`(크게 갈린 요소가 하나라도 있는 지원자. 머리의 `조정 N` 과 같은 수)와 `전체`. 처음에는 `조정 필요` 다.
 * - 읽기만 하는 화면이다(점수와 의견은 예시 자료의 값이고 여기서 고치지 않는다). 종합 점수는 전형 준비의 배점을 따른다.
 * 걸러 보기는 이 화면의 상태라 다른 탭에 다녀와도 남는다(cacheComponents). 새로고침하면 처음 상태로 돌아간다.
 */
export function useDecisionOpinions() {
  const { elements, ranked } = useDecisionData();
  const [filter, setFilter] = useState<OpinionFilter>("adjust");

  const cards = useMemo(() => ranked.map((row) => cardView(row, elements)), [ranked, elements]);
  const adjustCards = useMemo(() => cards.filter((card) => card.adjust), [cards]);
  const shown = filter === "adjust" ? adjustCards : cards;

  return {
    filters: FILTERS.map((key) => ({
      key,
      label: FILTER_LABEL[key],
      count: key === "adjust" ? adjustCards.length : cards.length,
      on: key === filter,
      onPick: () => setFilter(key),
    })),
    /** 붉게 칠한 칸의 뜻과 조정이 필요하다고 보는 기준 */
    note: `위원 점수가 ${WIDE_ELEMENT_SPREAD}점 이상 갈린 평가 요소입니다. 하나라도 있으면 조정이 필요한 지원자입니다.`,
    /** 평가 요소의 수 (표의 요소 칸 수. 카드의 가장 좁은 폭을 정하는 데 쓴다) */
    columnCount: elements.length,
    cards: shown,
    /** 카드가 없을 때의 안내 (걸러 본 목록이 비었을 때) */
    empty: {
      title: cards.length === 0 ? "지원자가 없습니다." : "조정이 필요한 지원자가 없습니다.",
      text:
        cards.length === 0
          ? "평가를 마친 지원자가 생기면 위원 의견이 여기에 모입니다."
          : `위원 점수가 ${WIDE_ELEMENT_SPREAD}점 이상 갈린 평가 요소가 없습니다. 전체를 누르면 모든 지원자의 위원 의견을 볼 수 있습니다.`,
    },
  };
}

/** 위원 의견 모아보기 탭이 그리는 값 */
export type DecisionOpinionsView = ReturnType<typeof useDecisionOpinions>;

/** 지원자 한 명의 카드 */
export type DecisionOpinionsCard = DecisionOpinionsView["cards"][number];
