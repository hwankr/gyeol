import { useSyncExternalStore } from "react";
import { NO_UPLOADED_APPLICANTS, type UploadedApplicant } from "@/lib/applicants/uploaded";
import { loadUploadedApplicants, subscribeUploadedApplicants } from "@/lib/applicants/uploadedStorage";
import { NO_EVALUATIONS, type Evaluations } from "@/lib/evaluate/evaluation";
import { hasUnsavedEvaluations, loadEvaluations, subscribeEvaluations } from "@/lib/evaluate/evaluationStorage";
import { evaluationApplicants } from "@/lib/evaluate/uploadedEvaluation";
import type { PrepCriteria } from "@/lib/prep/criteria";
import { DEFAULT_PREP_CRITERIA } from "@/lib/prep/defaultCriteria";
import { NO_HISTORY, criteriaVersionLabel, currentCriteriaVersion, type PrepHistoryEntry } from "@/lib/prep/history";
import { loadPrepCriteria, loadPrepHistory, subscribePrepStorage } from "@/lib/prep/storage";

// 서버 렌더링과 hydration 중에는 저장한 값이 없는 모습(기본 평가 기준, 처음 평가 상태, 올린 지원자 없음)으로 그린다. 그래서 서버 HTML 과
// 첫 클라이언트 렌더링이 같아 hydration 경고가 나지 않고, 브라우저에서 localStorage 를 읽은 뒤 저장한 값이 반영된다(hooks/useApplicants.ts 와 같은 방식).
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

function getServerUploaded(): readonly UploadedApplicant[] {
  return NO_UPLOADED_APPLICANTS;
}

/**
 * 평가하기 세 화면이 같이 읽는 값: 전형 준비에서 저장한 평가 기준(요소·배점·세부 평가 항목)과 그 기준의 버전("v1": 처음 기준,
 * 저장할 때마다 하나씩 오른다. 기준 변경 기록으로 센다), 저장한 내 평가, 저장소에 쓰지 못해 이 페이지의 메모리에만 있는 평가가 있는지,
 * 평가할 지원자 목록(예시 지원자 24명 + 지금 평가 기준으로 분석한 올린 지원자)과 올린 지원자의 수.
 */
export function useEvaluationData() {
  const criteria = useSyncExternalStore(subscribePrepStorage, loadPrepCriteria, getServerCriteria);
  const history = useSyncExternalStore(subscribePrepStorage, loadPrepHistory, getServerHistory);
  const stored = useSyncExternalStore(subscribeEvaluations, loadEvaluations, getServerEvaluations);
  const unsaved = useSyncExternalStore(subscribeEvaluations, hasUnsavedEvaluations, getServerUnsaved);
  const uploaded = useSyncExternalStore(subscribeUploadedApplicants, loadUploadedApplicants, getServerUploaded);
  // 재료(올린 지원자 목록, 평가 요소 배열)가 같으면 같은 객체가 나온다(lib/evaluate/uploadedEvaluation.ts 가 기억해 둔다).
  const list = evaluationApplicants(uploaded, criteria.elements);
  return {
    elements: criteria.elements,
    criteriaVersion: criteriaVersionLabel(currentCriteriaVersion(history)),
    stored,
    unsaved,
    /** 평가할 지원자 전체 (평가 순서 = 코드 순서) */
    applicants: list.applicants,
    /** 올린 지원자 전체 수 (목록에 넣지 못한 것 포함) */
    uploadedCount: list.uploadedCount,
    /** 지금 평가 기준으로 분석하지 않아 목록에 넣지 못한 올린 지원자 수 */
    skippedUploadCount: list.skippedCount,
  };
}
