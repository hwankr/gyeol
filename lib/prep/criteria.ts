// 전형 준비 · 평가·배점 설정의 평가 기준 형식, 저장 값 확인, 화면용 계산.
// 이 화면만 쓰는 형식이라 types/analysis.ts 가 아니라 여기에 둔다. 브라우저와 Node 어디서나 돈다(순수 함수).

/** 묶음 하나: 요소 이름 아래 "#태그" 로 그리는 태그, 패널의 알약 모양 제목(이름), 질문 목록 */
export type PrepGroup = {
  tag: string;
  name: string;
  questions: readonly string[];
};

/** 평가 요소 하나: 배점은 0~100 정수 */
export type PrepElement = {
  id: string;
  name: string;
  weight: number;
  groups: readonly PrepGroup[];
};

/** 모집 단위 하나의 평가 기준. localStorage 에 이 모양 그대로 JSON 으로 저장한다. */
export type PrepCriteria = {
  version: 1;
  department: string;
  elements: readonly PrepElement[];
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
} as const;

/** 배점의 범위와 합계 */
export const MIN_WEIGHT = 0;
export const MAX_WEIGHT = 100;
export const TOTAL_WEIGHT = 100;

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
  return { id, name, weight, groups };
}

/**
 * 저장소에서 읽은 값(JSON.parse 결과)이 평가 기준 모양·한도에 맞는지 확인한다. 맞으면 문자열의 앞뒤 공백을 뺀 값을, 하나라도
 * 벗어나면 null 을 돌려준다(일부만 살리지 않는다). 확인: version 1, department 1~50자, 요소 1~6개, 요소 id 1~64자이고 서로 다름,
 * 이름 1~30자, 배점 0~100 정수이고 합이 100, 요소마다 묶음 1~6개, 태그 1~12자, 묶음 이름 1~20자, 묶음마다 질문 1~8개, 질문 1~200자.
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
  return { version: 1, department, elements };
}

/** 배점 합계 */
export function totalWeight(weights: readonly number[]): number {
  return weights.reduce((sum, weight) => sum + weight, 0);
}

/** 요소 이름 아래 태그 줄: 묶음 태그를 순서대로 "#태그" 로 이어 붙인다(사이 공백 하나). */
export function tagsLine(element: PrepElement): string {
  return element.groups.map((group) => `#${group.tag}`).join(" ");
}

/** 세부 평가 항목의 묶음 하나 (화면용): 이름, 알약 바탕색(번갈아 light·dark), 번호를 붙인 질문 */
export type NumberedGroup = {
  name: string;
  tone: "light" | "dark";
  questions: { number: number; text: string }[];
};

/** 세부 평가 항목 번호는 그 요소 안에서 묶음을 넘어 이어진다(1~4, 5~6 …). 알약 바탕색은 첫째부터 light·dark 를 번갈아 쓴다. */
export function numberedGroups(element: PrepElement): NumberedGroup[] {
  const groups: NumberedGroup[] = [];
  let next = 1;
  element.groups.forEach((group, index) => {
    groups.push({
      name: group.name,
      tone: index % 2 === 0 ? "light" : "dark",
      questions: group.questions.map((text, offset) => ({ number: next + offset, text })),
    });
    next += group.questions.length;
  });
  return groups;
}

/**
 * 배점 막대의 채움 너비·손잡이 위치(%). 눈금의 끝은 2 × 100 ÷ 요소 수다(요소가 넷이면 0~50: 30점 → 60%).
 * 0~100% 로 자른다(요소가 여섯이면 눈금이 0~33.3 이라 34점 이상은 100%).
 */
export function weightBarPercent(weight: number, elementCount: number): number {
  if (elementCount <= 0) return 0;
  // weight ÷ (2 × 100 ÷ 요소 수) × 100 을 곱셈 먼저 계산해 39.00000000000001 같은 소수 오차를 줄인다.
  const percent = (weight * elementCount * 100) / (2 * TOTAL_WEIGHT);
  return Math.min(100, Math.max(0, percent));
}

/**
 * 배점을 저장할 때 남기는 기록 내용. 바뀐 요소만 요소 순서대로 적는다.
 * 예: "배점 변경: 학업성취도 30 → 35, 리더십 20 → 15". 바뀐 요소가 없으면 null.
 */
export function weightChangeSummary(before: PrepCriteria, after: PrepCriteria): string | null {
  const previous = new Map(before.elements.map((element) => [element.id, element.weight]));
  const changes = after.elements
    .filter((element) => previous.has(element.id) && previous.get(element.id) !== element.weight)
    .map((element) => `${element.name} ${previous.get(element.id)} → ${element.weight}`);
  return changes.length === 0 ? null : `배점 변경: ${changes.join(", ")}`;
}
