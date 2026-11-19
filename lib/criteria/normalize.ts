import type { Criterion, DepartmentCriteria } from "@/types/analysis";
import {
  MAX_CRITERIA,
  MAX_CRITERION_DESCRIPTION_LENGTH,
  MAX_CRITERION_NAME_LENGTH,
  MAX_DEPARTMENT_ID_LENGTH,
  MAX_DEPARTMENT_NAME_LENGTH,
  MAX_SOURCE_TEXT_LENGTH,
  MAX_WARNINGS,
  MAX_WARNING_LENGTH,
} from "./limits.ts";

// 밖에서 들어온 학과 기준(AI 응답, API 요청, localStorage 값)을 확인하고 정리하는 순수 함수.
// 화면(브라우저)과 서버가 같이 쓰므로 서버 전용 코드를 가져오지 않는다. 어떤 입력에도 예외를 던지지 않는다.

/**
 * 글을 최대 길이(UTF-16 단위)로 자른다. 자른 자리에서 서로게이트 쌍이 반으로 갈리면 남은 반쪽도 버리고,
 * 자른 경우에는 끝 공백을 뺀다. 최대 길이 이하이면 그대로 돌려준다.
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  let cut = text.slice(0, maxLength);
  const last = cut.charCodeAt(cut.length - 1);
  // 마지막 글자가 서로게이트 쌍의 앞쪽(0xD800–0xDBFF)이면 뒤쪽이 잘려 나간 것이다.
  if (last >= 0xd800 && last <= 0xdbff) cut = cut.slice(0, -1);
  return cut.trimEnd();
}

/**
 * 기준 목록을 정리한다(서버 검증).
 * - 배열이 아니면 빈 배열.
 * - 원소를 순서대로 본다. 객체가 아니거나 name·description 이 문자열이 아니면 버린다. 둘 다 앞뒤 공백을 빼고,
 *   뺀 뒤 비어 있으면 버린다.
 * - name 은 30자, description 은 300자로 자른다(자른 뒤 끝 공백 제거).
 * - 통과한 것 중 앞에서 6개까지만 남기고, 순서대로 "c1", "c2", … id 를 준다. 들어온 id 와 그 밖의 키는 무시한다.
 * 결과가 0개일 수 있다(호출한 쪽이 처리한다).
 */
export function normalizeCriteria(value: unknown): Criterion[] {
  if (!Array.isArray(value)) return [];
  const criteria: Criterion[] = [];
  for (const item of value) {
    if (criteria.length >= MAX_CRITERIA) break;
    if (!isRecord(item)) continue;
    const { name, description } = item;
    if (typeof name !== "string" || typeof description !== "string") continue;
    const trimmedName = truncateText(name.trim(), MAX_CRITERION_NAME_LENGTH);
    const trimmedDescription = truncateText(description.trim(), MAX_CRITERION_DESCRIPTION_LENGTH);
    if (trimmedName === "" || trimmedDescription === "") continue;
    criteria.push({
      id: `c${criteria.length + 1}`,
      name: trimmedName,
      description: trimmedDescription,
    });
  }
  return criteria;
}

/**
 * 기준 생성 경고를 정리한다: 문자열만 남기고 앞뒤 공백을 빼고, 빈 것은 버리고, 한 건 300자·최대 10건으로 자른다.
 * 배열이 아니면 빈 배열.
 */
export function normalizeWarnings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const warnings: string[] = [];
  for (const item of value) {
    if (warnings.length >= MAX_WARNINGS) break;
    if (typeof item !== "string") continue;
    const warning = truncateText(item.trim(), MAX_WARNING_LENGTH);
    if (warning !== "") warnings.push(warning);
  }
  return warnings;
}

/** parseDepartmentCriteria 의 결과. 실패하면 이유를 구분한다(기준이 0개인 경우와 그 밖의 형식 오류). */
export type DepartmentCriteriaCheck =
  | { ok: true; value: DepartmentCriteria }
  | { ok: false; reason: "invalid" | "noCriteria" };

/**
 * 밖에서 들어온 학과 기준(DepartmentCriteria)을 확인하고 정리한다.
 * - 객체가 아니면 실패(invalid).
 * - id: 문자열, 앞뒤 공백을 뺀 길이 1~64. department: 문자열, 앞뒤 공백을 뺀 길이 1~50. sourceText: 문자열, 길이 0~2,000.
 *   criteria: 배열. 하나라도 어긋나면 실패(invalid).
 * - criteria 는 normalizeCriteria 로 정리하고, 결과가 0개면 실패(noCriteria).
 * - 통과하면 { id, department, sourceText, criteria } 네 필드만 가진 새 객체(공백 제거·정리된 값)를 돌려준다.
 */
export function checkDepartmentCriteria(value: unknown): DepartmentCriteriaCheck {
  if (!isRecord(value)) return { ok: false, reason: "invalid" };
  const { id, department, sourceText, criteria } = value;
  if (typeof id !== "string" || typeof department !== "string" || typeof sourceText !== "string") {
    return { ok: false, reason: "invalid" };
  }
  const trimmedId = id.trim();
  const trimmedDepartment = department.trim();
  if (
    trimmedId.length === 0 ||
    trimmedId.length > MAX_DEPARTMENT_ID_LENGTH ||
    trimmedDepartment.length === 0 ||
    trimmedDepartment.length > MAX_DEPARTMENT_NAME_LENGTH ||
    sourceText.length > MAX_SOURCE_TEXT_LENGTH ||
    !Array.isArray(criteria)
  ) {
    return { ok: false, reason: "invalid" };
  }
  const normalized = normalizeCriteria(criteria);
  if (normalized.length === 0) return { ok: false, reason: "noCriteria" };
  return {
    ok: true,
    value: { id: trimmedId, department: trimmedDepartment, sourceText, criteria: normalized },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
