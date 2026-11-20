import { useEffect, useMemo, useRef, useState } from "react";
import { useDecisionData } from "@/hooks/useDecisionData";
import {
  WIDE_SPREAD10,
  decisionMemberName,
  standingText,
  tenthsText,
  trimmedTenthsText,
  type RankedApplicant,
} from "@/lib/decision/decision";
import {
  deviationText,
  elementSpreadsOf,
  extremesOf,
  memberNamesText,
  needsAdjustment,
  widestSpreadOf,
  type Extremes,
} from "@/lib/decision/opinions";
import type { PrepElement } from "@/lib/prep/criteria";

/** 걸러 보기: 조정이 필요한 지원자만 또는 전체 */
type OpinionFilter = "adjust" | "all";

const FILTER_LABEL: Record<OpinionFilter, string> = {
  adjust: "조정 필요",
  all: "전체",
};

const FILTERS: readonly OpinionFilter[] = ["adjust", "all"];

/** 점수 옆의 표시: 그 줄에서 가장 높게 준 위원, 가장 낮게 준 위원 (갈리지 않았으면 없다) */
export type ScoreMark = "high" | "low" | null;

function markOf(extremes: Extremes, index: number): ScoreMark {
  if (extremes.high.includes(index)) return "high";
  return extremes.low.includes(index) ? "low" : null;
}

/** 고른 지원자의 위원 의견과 점수 (오른쪽 단) */
function detailView(row: RankedApplicant, elements: readonly PrepElement[]) {
  const { applicant } = row;
  const adjust = needsAdjustment(row);
  const spreads = elementSpreadsOf(row, elements);
  const widest = widestSpreadOf(spreads);
  const totals = extremesOf(row.memberTotal10);
  const memberNames = row.memberTotal10.map((_, index) => decisionMemberName(index));
  return {
    code: applicant.code,
    rankText: `${row.rank}위`,
    standingText: standingText(row),
    adjust,
    summary: applicant.summary,
    stats: [
      { label: "최종 평가", value: tenthsText(row.final10), unit: "점", note: `위원 ${memberNames.length}명의 평균` },
      {
        label: "위원 간 차이",
        value: tenthsText(row.spread10),
        unit: "점",
        note: `조정 기준 ${tenthsText(WIDE_SPREAD10)}점 ${adjust ? "이상" : "미만"}`,
      },
      { label: "인재상 적합도", value: String(row.aiTotal), unit: "", note: "AI 종합 점수" },
    ],
    /** 위원 한 명씩: 종합 점수, 평균에서 떨어진 정도, 가장 높게·낮게 준 위원인지, 종합 의견 */
    members: row.memberTotal10.map((total10, index) => ({
      name: memberNames[index],
      totalText: tenthsText(total10),
      deviationText: deviationText(total10, row.final10),
      mark: markOf(totals, index),
      opinion: applicant.opinions[index] ?? "",
    })),
    /** 어디서 갈렸는지: 가장 크게 갈린 요소와 그 요소를 가장 높게·낮게 준 위원 */
    headline:
      widest === null
        ? "모든 평가 요소에서 위원들의 점수가 같습니다."
        : `가장 크게 갈린 요소는 ${widest.name}입니다 (${memberNamesText(widest.extremes.high)} ${Math.max(...widest.scores)}점 · ${memberNamesText(
            widest.extremes.low,
          )} ${Math.min(...widest.scores)}점, ${widest.spread}점 차).`,
    table: {
      memberNames,
      rows: spreads.map((item) => ({
        id: item.id,
        name: item.name,
        weightText: String(item.weight),
        cells: item.scores.map((score, index) => ({ text: String(score), mark: markOf(item.extremes, index) })),
        meanText: trimmedTenthsText(item.mean10),
        spreadText: String(item.spread),
        aiText: String(item.ai),
        /** 가장 크게 갈린 요소인지 */
        widest: widest !== null && item.id === widest.id,
      })),
      /** 마지막 줄: 위원별 종합 점수, 최종 평가, 위원 간 차이, 인재상 적합도 */
      total: {
        weightText: String(spreads.reduce((sum, item) => sum + item.weight, 0)),
        cells: row.memberTotal10.map((total10, index) => ({ text: tenthsText(total10), mark: markOf(totals, index) })),
        meanText: tenthsText(row.final10),
        spreadText: tenthsText(row.spread10),
        aiText: String(row.aiTotal),
      },
    },
  };
}

/**
 * 선발 결정 · 위원 의견 모아보기 탭 상태: 합격선 주변 지원자 한 명을 골라, 그 지원자를 평가한 위원들의 종합 점수·종합 의견과
 * 평가 요소별 점수를 한곳에 모아 본다. 위원들의 평가가 어디서 갈렸는지(가장 높게·낮게 준 위원, 가장 크게 갈린 요소)를 같이 적는다.
 * - 걸러 보기: `조정 필요`(위원별 종합 점수의 차이가 5.0점 이상인 지원자. 머리의 `조정 N` 과 같은 수)와 `전체`. 처음에는 `조정 필요` 다.
 * - 목록은 순위 순서다. 줄을 누르면 그 지원자를 고른다. 고르지 않았거나 고른 사람이 걸러 본 목록에 없으면 목록의 첫 지원자를 보여 준다.
 *   걸러 보기를 바꿀 때 지금 보고 있는 지원자가 새 목록에도 있으면 그대로 둔다.
 * - 읽기만 하는 화면이다(점수와 의견은 예시 자료의 값이고 여기서 고치지 않는다). 최종 평가는 전형 준비의 배점을 따른다.
 * - listRef 는 지원자 목록(ul)에 건다. 좁은 화면에서 고른 줄이 목록의 보이는 범위 밖에 있으면 목록을 밀어 보이게 한다.
 * 걸러 보기와 고른 지원자는 이 화면의 상태라 다른 탭에 다녀와도 남는다(cacheComponents). 새로고침하면 처음 상태로 돌아간다.
 */
export function useDecisionOpinions() {
  const { elements, ranked } = useDecisionData();
  const [filter, setFilter] = useState<OpinionFilter>("adjust");
  const [pickedCode, setPickedCode] = useState<string | null>(null);

  const adjustRows = useMemo(() => ranked.filter(needsAdjustment), [ranked]);
  const shown = filter === "adjust" ? adjustRows : ranked;
  const selected = shown.find((row) => row.applicant.code === pickedCode) ?? shown[0] ?? null;
  const selectedCode = selected === null ? null : selected.applicant.code;
  const detail = useMemo(() => (selected === null ? null : detailView(selected, elements)), [selected, elements]);

  // 좁은 화면에서는 목록이 네 줄 높이 안에서 스크롤된다. 걸러 보기를 바꾸거나 다른 지원자를 골랐을 때 고른 줄이 그 밖에 있으면
  // 보이는 데까지만 목록을 민다(목록 안에서만 움직이고 화면 전체는 밀지 않는다). 목록이 다 보이는 넓은 화면에서는 아무 일도 없다.
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const list = listRef.current;
    if (list === null) return;
    const current = list.querySelector<HTMLElement>('[aria-current="true"]');
    if (current === null) return;
    const listBox = list.getBoundingClientRect();
    const rowBox = current.getBoundingClientRect();
    if (rowBox.top < listBox.top) list.scrollTop -= listBox.top - rowBox.top;
    else if (rowBox.bottom > listBox.bottom) list.scrollTop += rowBox.bottom - listBox.bottom;
  }, [filter, selectedCode]);

  return {
    listRef,
    filters: FILTERS.map((key) => ({
      key,
      label: FILTER_LABEL[key],
      count: key === "adjust" ? adjustRows.length : ranked.length,
      on: key === filter,
      // 지금 보고 있는 지원자를 고른 사람으로 남긴다: 새 목록에도 있으면 그대로 보이고, 없으면 그 목록의 첫 지원자가 보인다.
      onPick: () => {
        setFilter(key);
        setPickedCode(selectedCode);
      },
    })),
    /** 조정이 필요하다고 보는 기준 */
    note: `위원별 종합 점수의 차이가 ${tenthsText(WIDE_SPREAD10)}점 이상이면 조정이 필요한 지원자입니다.`,
    countText: `${shown.length}명`,
    rows: shown.map((row) => {
      const { code } = row.applicant;
      return {
        code,
        rankText: `${row.rank}위`,
        standingText: standingText(row),
        spreadText: tenthsText(row.spread10),
        adjust: needsAdjustment(row),
        selected: code === selectedCode,
        onPick: () => setPickedCode(code),
      };
    }),
    /** 고른 지원자의 위원 의견과 점수. 목록이 비었으면(조정이 필요한 지원자가 없음) null 이다. */
    detail,
    /** 목록이 비었을 때의 안내 */
    empty: {
      title: ranked.length === 0 ? "지원자가 없습니다." : "조정이 필요한 지원자가 없습니다.",
      text:
        ranked.length === 0
          ? "평가를 마친 지원자가 생기면 위원 의견이 여기에 모입니다."
          : `위원별 종합 점수의 차이가 모두 ${tenthsText(WIDE_SPREAD10)}점 미만입니다. 전체를 누르면 모든 지원자의 위원 의견을 볼 수 있습니다.`,
    },
  };
}

/** 위원 의견 모아보기 탭이 그리는 값 */
export type DecisionOpinionsView = ReturnType<typeof useDecisionOpinions>;

/** 고른 지원자 한 명의 값 (오른쪽 단) */
export type DecisionOpinionsDetail = NonNullable<DecisionOpinionsView["detail"]>;
