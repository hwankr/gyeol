import { useSyncExternalStore } from "react";
import { NO_EVALUATIONS, type Evaluations } from "@/lib/evaluate/evaluation";
import { hasUnsavedEvaluations, loadEvaluations, subscribeEvaluations } from "@/lib/evaluate/evaluationStorage";
import type { PrepCriteria } from "@/lib/prep/criteria";
import { DEFAULT_PREP_CRITERIA } from "@/lib/prep/defaultCriteria";
import { NO_HISTORY, criteriaVersionLabel, currentCriteriaVersion, type PrepHistoryEntry } from "@/lib/prep/history";
import { loadPrepCriteria, loadPrepHistory, subscribePrepStorage } from "@/lib/prep/storage";

// 서버 렌더링과 hydration 중에는 저장한 값이 없는 모습(기본 평가 기준, 처음 평가 상태)으로 그린다. 그래서 서버 HTML 과 첫 클라이언트
// 렌더링이 같아 hydration 경고가 나지 않고, 브라우저에서 localStorage 를 읽은 뒤 저장한 값이 반영된다(hooks/useApplicants.ts 와 같은 방식).
function getServerCriteria(): PrepCriteria {
  return DEFAULT_PREP_CRITERIA;
}

function getServerHistory(): readonly PrepHistoryEntry[] {
  return NO_HISTORY;
}

function getServerEvaluations(): Evaluations {
  return NO_EVALUATIONS;
}

function getServerUnsaved(): boolean {
  return false;
}

/**
 * 평가하기 세 화면이 같이 읽는 값: 전형 준비에서 저장한 평가 기준(요소·배점·세부 평가 항목)과 그 기준의 버전("v1": 처음 기준,
 * 저장할 때마다 하나씩 오른다. 기준 변경 기록으로 센다), 저장한 내 평가, 저장소에 쓰지 못해 이 페이지의 메모리에만 있는 평가가 있는지.
 */
export function useEvaluationData() {
  const criteria = useSyncExternalStore(subscribePrepStorage, loadPrepCriteria, getServerCriteria);
  const history = useSyncExternalStore(subscribePrepStorage, loadPrepHistory, getServerHistory);
  const stored = useSyncExternalStore(subscribeEvaluations, loadEvaluations, getServerEvaluations);
  const unsaved = useSyncExternalStore(subscribeEvaluations, hasUnsavedEvaluations, getServerUnsaved);
  return {
    elements: criteria.elements,
    criteriaVersion: criteriaVersionLabel(currentCriteriaVersion(history)),
    stored,
    unsaved,
  };
}
