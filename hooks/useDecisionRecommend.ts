import { useMemo, useState } from "react";
import { useDecisionData } from "@/hooks/useDecisionData";
import { ADMISSION } from "@/lib/admission";
import { DECISION_COMPARE_PATH } from "@/lib/consoleMenu";
import {
  DECISION_FLAGS,
  MAX_PICKS,
  NO_PICKS,
  WIDE_SPREAD10,
  decisionFlagsOf,
  similarCodesOf,
  standingText,
  tenthsText,
  togglePick,
  type DecisionFlag,
} from "@/lib/decision/decision";
import { loadDecisionPicks, saveDecisionPicks } from "@/lib/decision/pickStorage";

/** 걸러 보기: 전체 또는 비교 기준 하나 */
type DecisionFilter = "all" | DecisionFlag;

const FILTER_LABEL: Record<DecisionFilter, string> = {
  all: "전체",
  close: "합격선 접전",
  spread: "위원 간 차이 큼",
  similar: "요약이 비슷함",
};

const FILTERS: readonly DecisionFilter[] = ["all", ...DECISION_FLAGS];

/** 줄에 붙이는 비교 기준 표시의 글. 요약이 비슷한 지원자는 누구와 비슷한지 적는다("요약 유사 · A-0090 외 1명"). */
function flagLabel(flag: DecisionFlag, similar: readonly string[]): string {
  if (flag === "close") return "합격선 접전";
  if (flag === "spread") return "위원 간 차이 큼";
  return similar.length <= 1 ? `요약 유사 · ${similar[0] ?? ""}` : `요약 유사 · ${similar[0]} 외 ${similar.length - 1}명`;
}

/** 목록의 줄: 지원자 한 명 또는 합격선 */
export type RecommendRow =
  | {
      kind: "applicant";
      code: string;
      rankText: string;
      standing: { text: string; admitted: boolean };
      summary: string;
      aiText: string;
      finalText: string;
      spreadText: string;
      /** 위원 간 차이가 큰지 (글자를 짙게 한다) */
      spreadWide: boolean;
      flags: { key: DecisionFlag; label: string }[];
      /** 비교하려고 고른 사람인지 */
      picked: boolean;
      /** 이미 두 명을 골라 더 고를 수 없는 줄인지 */
      blocked: boolean;
      onToggle: () => void;
    }
  | { kind: "cutline"; text: string };

/**
 * 선발 결정 · 인재상 적합 추천 탭 상태: 합격선 주변 지원자의 목록(순위 순서), 비교 기준으로 걸러 보기, 비교할 두 사람 고르기.
 * - 줄을 누르면 그 지원자를 고르고 다시 누르면 뺀다. 두 명을 골랐으면 다른 줄은 눌리지 않는다(한 명을 빼야 다른 사람을 고를 수 있다).
 * - 고른 사람은 localStorage 에 저장해 지원자 비교 탭이 읽는다(lib/decision/pickStorage.ts). 걸러 보기는 고른 사람을 바꾸지 않는다.
 * - 목록에 합격권과 예비가 모두 보이면 그 사이에 합격선 줄을 넣는다.
 * 걸러 보기는 이 화면의 상태라 다른 화면에 다녀와도 남는다(cacheComponents). 지원자 비교 탭과 오가며 고르는 동안 다시 맞추지 않아도 된다.
 */
export function useDecisionRecommend() {
  const { ranked, cutline, picks } = useDecisionData();
  const [filter, setFilter] = useState<DecisionFilter>("all");

  const items = useMemo(
    () =>
      ranked.map((row) => ({
        row,
        flags: decisionFlagsOf(row, ranked, cutline),
        similar: similarCodesOf(row, ranked),
      })),
    [ranked, cutline],
  );
  const shown = filter === "all" ? items : items.filter((item) => item.flags.includes(filter));
  const full = picks.length >= MAX_PICKS;

  const rows: RecommendRow[] = [];
  // 합격선 줄: 보이는 목록에 합격권과 예비가 모두 있을 때, 첫 예비 지원자 앞에 넣는다.
  const showCutline = cutline !== null && shown.some((item) => item.row.admitted) && shown.some((item) => !item.row.admitted);
  let cutlinePlaced = false;
  for (const { row, flags, similar } of shown) {
    if (showCutline && cutline !== null && !cutlinePlaced && !row.admitted) {
      cutlinePlaced = true;
      rows.push({
        kind: "cutline",
        text: `합격선 · 모집 ${ADMISSION.quota}명 · ${cutline.last.rank}위 ${tenthsText(cutline.last.final10)}점과 ${cutline.first.rank}위 ${tenthsText(cutline.first.final10)}점 사이 (${tenthsText(cutline.gap10)}점 차)`,
      });
    }
    const { code } = row.applicant;
    const picked = picks.includes(code);
    rows.push({
      kind: "applicant",
      code,
      rankText: `${row.rank}위`,
      standing: { text: standingText(row), admitted: row.admitted },
      summary: row.applicant.summary,
      aiText: String(row.aiTotal),
      finalText: tenthsText(row.final10),
      spreadText: tenthsText(row.spread10),
      spreadWide: row.spread10 >= WIDE_SPREAD10,
      flags: flags.map((flag) => ({ key: flag, label: flagLabel(flag, similar) })),
      picked,
      blocked: full && !picked,
      // 누르는 순간의 저장 값에서 고친다(이 화면을 그릴 때의 값이 아니라). 두 줄을 잇달아 눌러도 앞의 고름이 지워지지 않는다.
      onToggle: () => {
        const current = loadDecisionPicks();
        const next = togglePick(current, code);
        if (next !== current) saveDecisionPicks(next);
      },
    });
  }

  return {
    filters: FILTERS.map((key) => ({
      key,
      label: FILTER_LABEL[key],
      count: key === "all" ? items.length : items.filter((item) => item.flags.includes(key)).length,
      on: key === filter,
      onPick: () => setFilter(key),
    })),
    selection: {
      /** 고른 상태의 안내 (바뀌면 화면 낭독기가 읽는다) */
      text:
        picks.length === 0
          ? "줄을 눌러 비교할 지원자를 2명 골라 주세요."
          : picks.length < MAX_PICKS
            ? `1명 고름 (${picks[0]}) · 한 명 더 골라 주세요.`
            : `2명 고름 (${picks.join(", ")}) · 다른 지원자를 고르려면 먼저 한 명을 빼 주세요.`,
      canClear: picks.length > 0,
      onClear: () => saveDecisionPicks(NO_PICKS),
      /** 두 명을 골랐을 때만 지원자 비교 탭으로 가는 버튼이 켜진다 */
      canCompare: full,
      compareHref: DECISION_COMPARE_PATH,
    },
    rows,
  };
}
