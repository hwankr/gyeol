import { usePathname } from "next/navigation";
import { useDecisionData } from "@/hooks/useDecisionData";
import { ADMISSION } from "@/lib/admission";
import { DECISION_PATH, DECISION_TABS, HOME_CRUMB, type DecisionTab } from "@/lib/consoleMenu";
import { elementSpreadsOf, needsAdjustment } from "@/lib/decision/opinions";
import { DECISION_EVALUATED_COUNT } from "@/lib/decision/sampleDecision";

/** 탭 이름 옆의 작은 표시. alert 면 빨간 글자다(조정이 필요한 건수). label 은 화면 낭독기가 읽는 글이다. */
type TabBadge = { text: string; label: string; alert: boolean };

/**
 * 선발 결정 화면의 공통 머리 상태: 현재 위치 줄, 제목 옆의 글(전형 · 모집 단위 · 모집 인원 · 평가 완료 수), 탭 줄(지금 탭은 주소로 정한다).
 * - `지원자 비교` 옆의 수는 비교하려고 고른 지원자 수다(고른 사람이 없으면 적지 않는다).
 * - `위원 의견 모아보기` 옆의 `조정 N` 은 위원 점수가 크게 갈린 평가 요소가 있어 조정이 필요한 지원자 수다(없으면 적지 않는다. 그 탭의 `조정 필요` 와 같은 수다).
 * - `최종 확정` 은 화면이 없어 눌리지 않는다.
 */
export function useDecisionHeader() {
  const pathname = usePathname();
  const { elements, ranked, picks } = useDecisionData();
  const current = DECISION_TABS.find((tab) => tab.href === pathname) ?? DECISION_TABS[0];
  const wideCount = ranked.filter((row) => needsAdjustment(elementSpreadsOf(row, elements))).length;
  const badges: Partial<Record<DecisionTab["key"], TabBadge>> = {};
  if (picks.length > 0) badges.compare = { text: String(picks.length), label: `${picks.length}명 고름`, alert: false };
  if (wideCount > 0) badges.opinions = { text: `조정 ${wideCount}`, label: `조정 필요 ${wideCount}명`, alert: true };
  return {
    crumbs: [HOME_CRUMB, { label: "선발 결정", href: DECISION_PATH }, { label: current.label }],
    note: `${ADMISSION.trackFull} · ${ADMISSION.unit} · 모집 ${ADMISSION.quota}명 · 평가 완료 ${DECISION_EVALUATED_COUNT}명`,
    tabs: DECISION_TABS.map((tab) => ({
      key: tab.key,
      href: tab.href,
      label: tab.label,
      current: tab.key === current.key,
      badge: badges[tab.key] ?? null,
    })),
  };
}
