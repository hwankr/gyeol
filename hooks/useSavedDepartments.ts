import { useSyncExternalStore } from "react";
import {
  NO_SAVED_DEPARTMENTS,
  loadSavedDepartments,
  subscribeSavedDepartments,
} from "@/lib/criteriaStorage";
import type { DepartmentCriteria } from "@/types/analysis";

// 서버 렌더링과 hydration 중에는 "저장한 학과 없음"으로 그린다.
// 그래서 서버 HTML(코드에 적힌 학과만 있음)과 첫 클라이언트 렌더링이 같아 hydration 경고가 나지 않고,
// 브라우저에서 localStorage 를 읽은 뒤 저장한 학과가 나타난다.
function getServerSnapshot(): readonly DepartmentCriteria[] {
  return NO_SAVED_DEPARTMENTS;
}

/** localStorage 에 저장한 학과 목록(저장한 순서). 학과를 더하거나 지우면(lib/criteriaStorage) 새 목록으로 다시 그려진다. */
export function useSavedDepartments(): readonly DepartmentCriteria[] {
  return useSyncExternalStore(subscribeSavedDepartments, loadSavedDepartments, getServerSnapshot);
}
