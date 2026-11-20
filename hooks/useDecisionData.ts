import { useMemo, useSyncExternalStore } from "react";
import { ADMISSION } from "@/lib/admission";
import { NO_PICKS, cutlineOf, rankDecisionApplicants, type DecisionPicks } from "@/lib/decision/decision";
import { loadDecisionPicks, subscribeDecisionPicks } from "@/lib/decision/pickStorage";
import { DECISION_APPLICANTS, DECISION_FIRST_RANK } from "@/lib/decision/sampleDecision";
import type { PrepCriteria } from "@/lib/prep/criteria";
import { DEFAULT_PREP_CRITERIA } from "@/lib/prep/defaultCriteria";
import { loadPrepCriteria, subscribePrepStorage } from "@/lib/prep/storage";

// 서버 렌더링과 hydration 중에는 저장한 값이 없는 모습(기본 평가 기준, 고른 사람 없음)으로 그린다. 그래서 서버 HTML 과 첫 클라이언트
// 렌더링이 같아 hydration 경고가 나지 않고, 브라우저에서 localStorage 를 읽은 뒤 저장한 값이 반영된다(hooks/useEvaluationData.ts 와 같은 방식).
function getServerCriteria(): PrepCriteria {
  return DEFAULT_PREP_CRITERIA;
}

/** 고른 지원자는 브라우저 저장소의 값이라 서버에서는 "아직 모름"(null)이다. */
function getServerPicks(): null {
  return null;
}

/**
 * 선발 결정의 머리와 세 탭이 같이 읽는 값: 전형 준비에서 저장한 평가 요소·배점, 그 배점으로 최종 평가를 계산해 순위를 매긴 합격선 주변
 * 지원자(예시 자료 12명), 합격선(합격권의 마지막 지원자와 예비 1번), 비교하려고 고른 지원자(2명까지. localStorage).
 * 최종 평가는 배점으로 가중 평균한 값이라 전형 준비에서 배점을 바꾸면 점수와 순위가 같이 바뀐다.
 * picksReady 는 고른 지원자를 브라우저에서 읽었는지다(서버 렌더링·hydration 중에는 false 이고 picks 는 빈 값이다). 지원자 비교 탭은
 * 읽기 전에 두 사람을 그리지 않는다(기본 두 사람이 잠깐 보였다가 고른 두 사람으로 바뀌지 않게).
 */
export function useDecisionData() {
  const criteria = useSyncExternalStore(subscribePrepStorage, loadPrepCriteria, getServerCriteria);
  const storedPicks = useSyncExternalStore<DecisionPicks | null>(subscribeDecisionPicks, loadDecisionPicks, getServerPicks);
  const ranked = useMemo(
    () => rankDecisionApplicants(DECISION_APPLICANTS, criteria.elements, ADMISSION.quota, DECISION_FIRST_RANK),
    [criteria.elements],
  );
  const cutline = useMemo(() => cutlineOf(ranked, ADMISSION.quota), [ranked]);
  return { elements: criteria.elements, ranked, cutline, picks: storedPicks ?? NO_PICKS, picksReady: storedPicks !== null };
}
