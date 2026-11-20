import type { GuidelineChange } from "./guidelineChanges.ts";

// 전형 준비 · 평가·배점 설정의 평가 기준 형식, 저장 값 확인, 화면용 계산.
// 이 화면만 쓰는 형식이라 types/analysis.ts 가 아니라 여기에 둔다. 브라우저와 Node 어디서나 돈다(순수 함수).
// /api/guideline(서버)도 응답 형식과 정리 결과 확인에 같이 쓴다.

/** 묶음 하나: 요소 이름 아래 "#태그" 로 그리는 태그, 패널의 알약 모양 제목(이름), 질문 목록 */
export type PrepGroup = {
  tag: string;
  name: string;
  questions: readonly string[];
};

/**
 * 평가 요소 하나: 배점은 0~100 정수.
 * questionRevision 은 이 요소의 질문 목록(번호 순서대로의 질문 글)을 바꿔 저장한 횟수다. 없으면 0(한 번도 바꾸지 않음)이고,
 * 저장할 때 저장소가 매긴다(carryQuestionRevisions. 화면이나 AI 가 준 값은 쓰지 않는다). 세부 항목 평가의 응답은 질문 번호로
 * 저장하므로, 평가하기 화면이 응답을 적은 때의 이 값을 같이 두었다가 지금 값과 다르면 그 응답을 쓰지 않는다
 * (lib/evaluate/evaluation.ts 의 validAnswers. 예전 응답이 다른 질문에 붙지 않게).
 */
export type PrepElement = {
  id: string;
  name: string;
  weight: number;
  groups: readonly PrepGroup[];
  questionRevision?: number;
};

/**
 * 모집요강으로 만든 평가 기준에 딸린 값: 만든 모집요강 파일 이름과 그 모집요강의 전년 대비 변경 사항(0~6건).
 * 모집요강 초안을 저장하면 채워지고, 그 뒤 배점만 고쳐 저장해도 그대로 남는다.
 */
export type PrepGuideline = {
  fileName: string;
  changes: readonly GuidelineChange[];
};

/**
 * 모집 단위 하나의 평가 기준. localStorage 에 이 모양 그대로 JSON 으로 저장한다.
 * guideline 은 선택 필드다(T1 형식의 값에는 없다. version 은 1 그대로).
 */
export type PrepCriteria = {
  version: 1;
  department: string;
  elements: readonly PrepElement[];
  guideline?: PrepGuideline;
};

/** 저장 값의 한도. 길이는 앞뒤 공백을 뺀 글자 수로 잰다. */
export const PREP_LIMITS = {
  departmentLength: 50,
  elements: 6,
  idLength: 64,
  nameLength: 30,
  groups: 6,
  tagLength: 12,
  groupNameLength: 20,
  questions: 8,
  questionLength: 200,
  /** guideline: 파일 이름, 변경 사항 건수, 변경 사항 제목·내용 길이 */
  fileNameLength: 255,
  changes: 6,
  changeTitleLength: 40,
  changeBodyLength: 300,
} as const;

/** 배점의 범위와 합계 */
export const MIN_WEIGHT = 0;
export const MAX_WEIGHT = 100;
export const TOTAL_WEIGHT = 100;

/** 저장 값으로 받아들이는 questionRevision 의 최댓값 */
export const MAX_QUESTION_REVISION = 1_000_000;

/** 앞뒤 공백을 뺀 길이가 1~max 인 문자열이면 공백을 뺀 값, 아니면 null (문자열이 아닌 값도 null) */
function boundedText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length >= 1 && text.length <= max ? text : null;
}

/** 원소 수가 1~max 인 배열이면 그 배열, 아니면 null */
function boundedArray(value: unknown, max: number): readonly unknown[] | null {
  return Array.isArray(value) && value.length >= 1 && value.length <= max ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function parseGroup(value: unknown): PrepGroup | null {
  const record = asRecord(value);
  if (record === null) return null;
  const tag = boundedText(record.tag, PREP_LIMITS.tagLength);
  const name = boundedText(record.name, PREP_LIMITS.groupNameLength);
  const rawQuestions = boundedArray(record.questions, PREP_LIMITS.questions);
  if (tag === null || name === null || rawQuestions === null) return null;
  const questions: string[] = [];
  for (const item of rawQuestions) {
    const question = boundedText(item, PREP_LIMITS.questionLength);
    if (question === null) return null;
    questions.push(question);
  }
  return { tag, name, questions };
}

function parseChange(value: unknown): GuidelineChange | null {
  const record = asRecord(value);
  if (record === null) return null;
  const title = boundedText(record.title, PREP_LIMITS.changeTitleLength);
  const body = boundedText(record.body, PREP_LIMITS.changeBodyLength);
  return title === null || body === null ? null : { title, body };
}

/** guideline 필드 확인: 객체이고 fileName 1~255자, changes 는 0~6건의 배열, 제목 1~40자·내용 1~300자. 벗어나면 null. */
function parseGuideline(value: unknown): PrepGuideline | null {
  const record = asRecord(value);
  if (record === null) return null;
  const fileName = boundedText(record.fileName, PREP_LIMITS.fileNameLength);
  const rawChanges = record.changes;
  if (fileName === null || !Array.isArray(rawChanges) || rawChanges.length > PREP_LIMITS.changes) return null;
  const changes: GuidelineChange[] = [];
  for (const item of rawChanges) {
    const change = parseChange(item);
    if (change === null) return null;
    changes.push(change);
  }
  return { fileName, changes };
}

function parseElement(value: unknown): PrepElement | null {
  const record = asRecord(value);
  if (record === null) return null;
  const id = boundedText(record.id, PREP_LIMITS.idLength);
  const name = boundedText(record.name, PREP_LIMITS.nameLength);
  const weight = record.weight;
  const rawGroups = boundedArray(record.groups, PREP_LIMITS.groups);
  if (id === null || name === null || rawGroups === null) return null;
  if (typeof weight !== "number" || !Number.isInteger(weight) || weight < MIN_WEIGHT || weight > MAX_WEIGHT) return null;
  const groups: PrepGroup[] = [];
  for (const item of rawGroups) {
    const group = parseGroup(item);
    if (group === null) return null;
    groups.push(group);
  }
  const questionRevision = record.questionRevision;
  return isQuestionRevision(questionRevision) ? { id, name, weight, groups, questionRevision } : { id, name, weight, groups };
}

/** 저장된 questionRevision 으로 쓸 수 있는 값인지: 1 이상 최댓값 이하의 정수 (0 은 적지 않는다) */
function isQuestionRevision(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= MAX_QUESTION_REVISION;
}

/**
 * 저장소에서 읽은 값(JSON.parse 결과)이 평가 기준 모양·한도에 맞는지 확인한다. 맞으면 문자열의 앞뒤 공백을 뺀 값을, 하나라도
 * 벗어나면 null 을 돌려준다(일부만 살리지 않는다). 확인: version 1, department 1~50자, 요소 1~6개, 요소 id 1~64자이고 서로 다름,
 * 이름 1~30자, 배점 0~100 정수이고 합이 100, 요소마다 묶음 1~6개, 태그 1~12자, 묶음 이름 1~20자, 묶음마다 질문 1~8개, 질문 1~200자.
 * guideline 은 키가 없으면 통과하고, 있으면 파일 이름 1~255자·변경 사항 0~6건(제목 1~40자, 내용 1~300자)이어야 한다.
 * 요소의 questionRevision 만은 예외로, 쓸 수 없는 값(정수가 아님, 1 미만, 1,000,000 초과)이면 평가 기준은 살리고 그 값만 없는 것(0)으로 읽는다.
 */
export function parsePrepCriteria(value: unknown): PrepCriteria | null {
  const record = asRecord(value);
  if (record === null || record.version !== 1) return null;
  const department = boundedText(record.department, PREP_LIMITS.departmentLength);
  const rawElements = boundedArray(record.elements, PREP_LIMITS.elements);
  if (department === null || rawElements === null) return null;
  const elements: PrepElement[] = [];
  const ids = new Set<string>();
  for (const item of rawElements) {
    const element = parseElement(item);
    if (element === null || ids.has(element.id)) return null;
    ids.add(element.id);
    elements.push(element);
  }
  if (totalWeight(elements.map((element) => element.weight)) !== TOTAL_WEIGHT) return null;
  if (record.guideline === undefined) return { version: 1, department, elements };
  const guideline = parseGuideline(record.guideline);
  if (guideline === null) return null;
  return { version: 1, department, elements, guideline };
}

/** 배점 합계 */
export function totalWeight(weights: readonly number[]): number {
  return weights.reduce((sum, weight) => sum + weight, 0);
}

/** 요소 이름 아래 태그 줄: 묶음 태그를 순서대로 "#태그" 로 이어 붙인다(사이 공백 하나). */
export function tagsLine(element: PrepElement): string {
  return element.groups.map((group) => `#${group.tag}`).join(" ");
}

/** 세부 평가 항목의 묶음 하나 (화면용): 이름, 번호를 붙인 질문 */
export type NumberedGroup = {
  name: string;
  questions: { number: number; text: string }[];
};

/** 세부 평가 항목 번호는 그 요소 안에서 묶음을 넘어 이어진다(1~4, 5~6 …). */
export function numberedGroups(element: PrepElement): NumberedGroup[] {
  const groups: NumberedGroup[] = [];
  let next = 1;
  for (const group of element.groups) {
    groups.push({
      name: group.name,
      questions: group.questions.map((text, offset) => ({ number: next + offset, text })),
    });
    next += group.questions.length;
  }
  return groups;
}

/** 그 요소의 질문 목록을 바꿔 저장한 횟수 (적혀 있지 않으면 0) */
export function questionRevisionOf(element: PrepElement): number {
  return element.questionRevision ?? 0;
}

/** 그 요소의 질문 글을 번호 순서대로(묶음을 넘어 이어서) */
function questionList(element: PrepElement): string[] {
  return element.groups.flatMap((group) => group.questions);
}

/** 두 요소의 질문 목록이 같은지: 번호마다 질문 글이 같다(묶음의 이름·태그·나뉜 자리는 보지 않는다) */
export function sameQuestionList(a: PrepElement, b: PrepElement): boolean {
  const left = questionList(a);
  const right = questionList(b);
  return left.length === right.length && left.every((text, index) => text === right[index]);
}

/**
 * 저장할 평가 기준(after)의 요소마다 questionRevision 을 매긴 새 평가 기준. before 는 지금 쓰이는(바로 앞에 저장한) 평가 기준이다.
 * - 같은 id 의 요소가 before 에 있으면 그 값을 잇고, 질문 목록이 달라졌으면(sameQuestionList) 1 을 더한다.
 * - before 에 없는 id 면(모집요강 초안으로 요소가 늘어난 경우) before 의 가장 큰 값 + 1 이다. 예전에 같은 id 를 쓰던 요소의 응답과
 *   값이 우연히 같아지지 않게 한다.
 * after 에 적혀 있던 questionRevision 은 쓰지 않는다. 값이 0 이면 필드를 두지 않는다(한 번도 바꾸지 않은 기준은 예전 모양 그대로다).
 * 배점·묶음 이름·태그만 바꾼 저장에서는 값이 그대로다.
 */
export function carryQuestionRevisions(before: PrepCriteria, after: PrepCriteria): PrepCriteria {
  const previous = new Map(before.elements.map((element) => [element.id, element]));
  const highest = before.elements.reduce((max, element) => Math.max(max, questionRevisionOf(element)), 0);
  const elements = after.elements.map((element): PrepElement => {
    const old = previous.get(element.id);
    const next =
      old === undefined ? highest + 1 : questionRevisionOf(old) + (sameQuestionList(old, element) ? 0 : 1);
    const questionRevision = Math.min(MAX_QUESTION_REVISION, next);
    const { id, name, weight, groups } = element;
    return questionRevision === 0 ? { id, name, weight, groups } : { id, name, weight, groups, questionRevision };
  });
  return { ...after, elements };
}

/**
 * 배점을 저장할 때 남기는 기록 내용. 바뀐 요소만 요소 순서대로 적는다.
 * 예: "배점 변경: 잠재역량 50 → 45, 학업역량 30 → 35". 바뀐 요소가 없으면 null.
 */
export function weightChangeSummary(before: PrepCriteria, after: PrepCriteria): string | null {
  const previous = new Map(before.elements.map((element) => [element.id, element.weight]));
  const changes = after.elements
    .filter((element) => previous.has(element.id) && previous.get(element.id) !== element.weight)
    .map((element) => `${element.name} ${previous.get(element.id)} → ${element.weight}`);
  return changes.length === 0 ? null : `배점 변경: ${changes.join(", ")}`;
}
