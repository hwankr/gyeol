import { normalizeWarnings, truncateText } from "../criteria/normalize.ts";
import { MAX_WARNINGS } from "../criteria/limits.ts";
import { MAX_SUMMARY_LENGTH } from "./history.ts";
import {
  MAX_WEIGHT,
  MIN_WEIGHT,
  PREP_LIMITS,
  TOTAL_WEIGHT,
  parsePrepCriteria,
  totalWeight,
  type PrepCriteria,
  type PrepElement,
  type PrepGroup,
} from "./criteria.ts";
import type { GuidelineChange } from "./guidelineChanges.ts";

// 모집요강으로 만든 평가 기준 초안: AI 가 돌려준 값을 정리하는 순수 함수와, 초안을 저장할 때 남기는 기록 내용.
// /api/guideline(서버)이 AI 응답을 정리하고, 화면(lib/guidelineClient.ts)도 받은 값을 같은 함수로 한 번 더 확인한다.
// 브라우저와 Node 어디서나 돌며, 어떤 입력에도 예외를 던지지 않는다.

/** 배점을 글에서 찾지 못해 똑같이 나눴을 때의 경고 */
export const EQUAL_WEIGHT_WARNING = "모집요강에서 요소별 배점을 찾지 못해 똑같이 나눴습니다. 평가·배점 설정에서 조정해 주세요.";

/** 쪽을 골라 읽었을 때의 경고 (읽은 쪽 수 < 전체 쪽 수) */
export function pagesSelectedWarning(pagesRead: number, pagesTotal: number): string {
  return `모집요강이 길어 평가와 관련된 쪽 위주로 ${pagesRead}쪽(전체 ${pagesTotal}쪽)만 읽었습니다.`;
}

/** 정리한 초안 */
export type GuidelineDraftResult = {
  /** 평가 기준 초안. 남은 요소가 0개면 null. */
  criteria: PrepCriteria | null;
  /** 전년 대비 변경 사항 (0~6건) */
  changes: GuidelineChange[];
  /** 경고 (0~10건, 한 건 300자) */
  warnings: string[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/** 문자열이면 앞뒤 공백을 빼고 max 글자로 자른 값(자른 뒤 끝 공백 제거), 아니면 "" */
function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? truncateText(value.trim(), max) : "";
}

/** 태그: 공백을 모두 빼고 12자로 자른다 */
function cleanTag(value: unknown): string {
  return typeof value === "string" ? truncateText(value.replace(/\s+/g, ""), PREP_LIMITS.tagLength) : "";
}

function normalizeGroup(value: unknown): PrepGroup | null {
  const record = asRecord(value);
  if (record === null) return null;
  const name = cleanText(record.name, PREP_LIMITS.groupNameLength);
  const tag = cleanTag(record.tag);
  const questions: string[] = [];
  if (Array.isArray(record.questions)) {
    for (const item of record.questions) {
      if (questions.length >= PREP_LIMITS.questions) break;
      const question = cleanText(item, PREP_LIMITS.questionLength);
      if (question !== "") questions.push(question);
    }
  }
  if (name === "" || tag === "" || questions.length === 0) return null;
  return { tag, name, questions };
}

/**
 * 묶음 목록을 정리한다: 묶음 이름 20자, 태그 12자(공백을 뺀다), 질문 200자로 자르고, 이름·태그가 비거나 남은 질문이 0개인 묶음은 버리고
 * 묶음 6개·질문 8개까지만 남긴다. 배열이 아니면 빈 배열. 위원 의견으로 만든 공통 기준 초안(lib/prep/consensusDraft.ts)도 같이 쓴다.
 */
export function normalizeDraftGroups(value: unknown): PrepGroup[] {
  const groups: PrepGroup[] = [];
  if (!Array.isArray(value)) return groups;
  for (const item of value) {
    if (groups.length >= PREP_LIMITS.groups) break;
    const group = normalizeGroup(item);
    if (group !== null) groups.push(group);
  }
  return groups;
}

/** 요소 하나: 이름(30자)과 묶음(6개까지). 이름이 비거나 남은 묶음이 0개면 null. 배점은 받은 값 그대로(나중에 정한다). */
function normalizeElement(value: unknown): { name: string; weight: unknown; groups: PrepGroup[] } | null {
  const record = asRecord(value);
  if (record === null) return null;
  const name = cleanText(record.name, PREP_LIMITS.nameLength);
  if (name === "") return null;
  const groups = normalizeDraftGroups(record.groups);
  return groups.length === 0 ? null : { name, weight: record.weight, groups };
}

function isValidWeight(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= MIN_WEIGHT && value <= MAX_WEIGHT;
}

/** 100 을 count 개로 똑같이 나눈다. 나머지는 앞 요소부터 1씩 더한다(셋이면 34·33·33). */
export function equalWeights(count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(TOTAL_WEIGHT / count);
  const remainder = TOTAL_WEIGHT - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

/**
 * 전년 대비 변경 사항을 정리한다: 객체이고 제목·내용이 문자열이며 앞뒤 공백을 뺀 뒤 비지 않은 것만, 제목 40자·내용 300자로 자르고
 * 앞에서 6건까지. 배열이 아니면 빈 배열.
 */
export function normalizeGuidelineChanges(value: unknown): GuidelineChange[] {
  if (!Array.isArray(value)) return [];
  const changes: GuidelineChange[] = [];
  for (const item of value) {
    if (changes.length >= PREP_LIMITS.changes) break;
    const record = asRecord(item);
    if (record === null) continue;
    const title = cleanText(record.title, PREP_LIMITS.changeTitleLength);
    const body = cleanText(record.body, PREP_LIMITS.changeBodyLength);
    if (title !== "" && body !== "") changes.push({ title, body });
  }
  return changes;
}

/**
 * AI 가 돌려준 초안 { elements, changes, warnings } 를 정리한다.
 * - 요소: 이름이 문자열이 아니거나 비면 버린다. 이름 30자, 묶음 이름 20자, 태그 12자(공백을 뺀다), 질문 200자로 자르고(앞뒤 공백 제거 뒤),
 *   요소 6개·묶음 6개·질문 8개까지만 남긴다. 이름·태그가 비거나 남은 질문이 0개인 묶음, 남은 묶음이 0개인 요소는 버린다. id 는 e1, e2 …
 * - 배점: 남은 요소 모두의 weight 가 0~100 정수이고 합이 100 이면 그대로, 아니면 100 을 똑같이 나누고 배점 경고를 더한다.
 * - 변경 사항: normalizeGuidelineChanges.
 * - 경고: 쪽을 골라 읽었으면(pagesRead < pagesTotal) 쪽 경고를 맨 앞에, 배점을 나눴으면 배점 경고를 맨 끝에 둔다. AI 의 경고는 그 사이에
 *   normalizeWarnings 와 같은 규칙(문자열만, 한 건 300자)으로 넣되, 전체가 10건을 넘지 않게 AI 의 경고를 앞에서부터 자른다
 *   (코드가 붙이는 경고는 빠지지 않는다).
 * - 남은 요소가 0개면 criteria 는 null(배점 경고도 붙이지 않는다). 결과는 parsePrepCriteria 를 통과한다.
 */
export function normalizeGuidelineDraft(
  value: unknown,
  context: { department: string; pagesRead: number; pagesTotal: number },
): GuidelineDraftResult {
  const record = asRecord(value) ?? {};
  const elements: { name: string; weight: unknown; groups: PrepGroup[] }[] = [];
  if (Array.isArray(record.elements)) {
    for (const item of record.elements) {
      if (elements.length >= PREP_LIMITS.elements) break;
      const element = normalizeElement(item);
      if (element !== null) elements.push(element);
    }
  }

  const leading: string[] = [];
  const trailing: string[] = [];
  if (context.pagesRead < context.pagesTotal) leading.push(pagesSelectedWarning(context.pagesRead, context.pagesTotal));

  let criteria: PrepCriteria | null = null;
  if (elements.length > 0) {
    const given = elements.map((element) => element.weight);
    const keep = given.every(isValidWeight) && totalWeight(given as number[]) === TOTAL_WEIGHT;
    const weights = keep ? (given as number[]) : equalWeights(elements.length);
    if (!keep) trailing.push(EQUAL_WEIGHT_WARNING);
    const built: PrepElement[] = elements.map((element, index) => ({
      id: `e${index + 1}`,
      name: element.name,
      weight: weights[index],
      groups: element.groups,
    }));
    // 정리한 값은 저장 값 확인(parsePrepCriteria)을 늘 통과한다. 그래도 한 번 거쳐 저장할 때와 같은 모양을 보장한다.
    criteria = parsePrepCriteria({ version: 1, department: context.department, elements: built });
  }

  const room = Math.max(0, MAX_WARNINGS - leading.length - trailing.length);
  const warnings = [...leading, ...normalizeWarnings(record.warnings).slice(0, room), ...trailing];

  return { criteria, changes: normalizeGuidelineChanges(record.changes), warnings };
}

/**
 * 초안을 저장할 때 남기는 기록 내용: "모집요강으로 평가 기준을 새로 만듦: <파일 이름> (평가 요소 <N>개, 배점 <a>·<b>·…)".
 * 500자를 넘으면 파일 이름을 줄이고 "…" 를 붙인다.
 */
export function guidelineSaveSummary(fileName: string, elements: readonly PrepElement[]): string {
  const prefix = "모집요강으로 평가 기준을 새로 만듦: ";
  const suffix = ` (평가 요소 ${elements.length}개, 배점 ${elements.map((element) => element.weight).join("·")})`;
  const full = `${prefix}${fileName}${suffix}`;
  if (full.length <= MAX_SUMMARY_LENGTH) return full;
  const room = Math.max(0, MAX_SUMMARY_LENGTH - prefix.length - suffix.length - 1);
  return `${prefix}${truncateText(fileName, room)}…${suffix}`;
}
