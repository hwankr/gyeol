import { truncateText } from "../criteria/normalize.ts";
import { PREP_LIMITS, type PrepGroup } from "./criteria.ts";
import { MAX_SUMMARY_LENGTH } from "./history.ts";

// 전형 준비 · 평가·배점 설정에서 세부 평가 항목(묶음·질문)을 손으로 고칠 때의 계산. 순수 함수만 둔다(브라우저와 Node 어디서나 돈다).
// 고치는 중인 값(DraftGroup)은 화면 상태에만 있고, 저장할 때 평가 기준의 묶음(PrepGroup)으로 바꾼다.
// 고칠 수 있는 것: 묶음의 이름·태그, 질문의 글, 묶음과 질문의 더하기·빼기. 순서는 바꾸지 않는다(더한 것은 맨 뒤에 붙는다).
// 한도는 저장 값의 한도(lib/prep/criteria.ts 의 PREP_LIMITS) 그대로다: 요소마다 묶음 1~6개, 묶음마다 질문 1~8개,
// 묶음 이름 20자, 태그 12자, 질문 200자.

/**
 * 고치는 중인 질문 하나. key 는 화면이 줄을 가리키는 이름이고(고치는 동안 바뀌지 않는다), origin 은 처음 묶음에서의 순번이다
 * (새로 더한 질문은 null). text 는 입력란의 글 그대로다(앞뒤 공백은 저장할 때 뺀다).
 */
export type DraftQuestion = {
  key: string;
  origin: number | null;
  text: string;
};

/** 고치는 중인 묶음 하나. origin 은 처음 요소에서의 묶음 순번이다(새로 더한 묶음은 null). */
export type DraftGroup = {
  key: string;
  origin: number | null;
  tag: string;
  name: string;
  questions: readonly DraftQuestion[];
};

/**
 * 저장된 묶음을 고치는 값으로 바꾼다. key 는 순번으로 만든다(묶음 "g0", 질문 "g0q0"). 같은 묶음 목록이면 늘 같은 key 가 나오므로
 * 아직 고치지 않은 요소도 그릴 때마다 같은 줄로 그려진다. 새로 더하는 묶음·질문의 key 는 부르는 쪽이 겹치지 않게 준다("n1" …).
 */
export function draftGroupsOf(groups: readonly PrepGroup[]): DraftGroup[] {
  return groups.map((group, groupIndex) => ({
    key: `g${groupIndex}`,
    origin: groupIndex,
    tag: group.tag,
    name: group.name,
    questions: group.questions.map((text, questionIndex) => ({
      key: `g${groupIndex}q${questionIndex}`,
      origin: questionIndex,
      text,
    })),
  }));
}

/**
 * 한 줄 글(묶음 이름, 질문) 입력을 다듬는다: 줄바꿈은 공백 하나로 바꾸고 max 글자(UTF-16 단위)까지만 둔다.
 * 입력하는 중이라 앞뒤 공백은 그대로 둔다(저장할 때 뺀다).
 */
export function cleanLineInput(value: string, max: number): string {
  const line = value.replace(/\s*[\r\n]+\s*/g, " ");
  if (line.length <= max) return line;
  const cut = line.slice(0, max);
  const last = cut.charCodeAt(cut.length - 1);
  // 마지막 글자가 서로게이트 쌍의 앞쪽이면 뒤쪽이 잘려 나간 것이라 같이 버린다.
  return last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut;
}

/** 태그 입력을 다듬는다: 공백과 "#" 을 모두 빼고 12자까지 (화면이 "#" 을 붙여 그리므로 사람이 적은 "#" 은 뺀다) */
export function cleanTagInput(value: string): string {
  return truncateText(value.replace(/[\s#]+/g, ""), PREP_LIMITS.tagLength);
}

/** 그 묶음만 바꾼 새 목록. 그 key 의 묶음이 없거나 바뀐 것이 없으면 받은 목록 그대로(같은 참조)다. */
function changeGroup(
  draft: readonly DraftGroup[],
  groupKey: string,
  change: (group: DraftGroup) => DraftGroup,
): readonly DraftGroup[] {
  const index = draft.findIndex((group) => group.key === groupKey);
  if (index < 0) return draft;
  const next = change(draft[index]);
  if (next === draft[index]) return draft;
  return draft.map((group, position) => (position === index ? next : group));
}

/** 묶음 이름을 바꾼다 */
export function withGroupName(draft: readonly DraftGroup[], groupKey: string, name: string): readonly DraftGroup[] {
  const value = cleanLineInput(name, PREP_LIMITS.groupNameLength);
  return changeGroup(draft, groupKey, (group) => (group.name === value ? group : { ...group, name: value }));
}

/** 묶음 태그를 바꾼다 */
export function withGroupTag(draft: readonly DraftGroup[], groupKey: string, tag: string): readonly DraftGroup[] {
  const value = cleanTagInput(tag);
  return changeGroup(draft, groupKey, (group) => (group.tag === value ? group : { ...group, tag: value }));
}

/** 질문 글을 바꾼다 */
export function withQuestionText(
  draft: readonly DraftGroup[],
  groupKey: string,
  questionKey: string,
  text: string,
): readonly DraftGroup[] {
  const value = cleanLineInput(text, PREP_LIMITS.questionLength);
  return changeGroup(draft, groupKey, (group) => {
    const index = group.questions.findIndex((question) => question.key === questionKey);
    if (index < 0 || group.questions[index].text === value) return group;
    return {
      ...group,
      questions: group.questions.map((question, position) => (position === index ? { ...question, text: value } : question)),
    };
  });
}

/** 그 묶음의 맨 뒤에 빈 질문을 더한다. 질문이 이미 8개면 그대로다. */
export function withQuestionAdded(draft: readonly DraftGroup[], groupKey: string, questionKey: string): readonly DraftGroup[] {
  return changeGroup(draft, groupKey, (group) =>
    group.questions.length >= PREP_LIMITS.questions
      ? group
      : { ...group, questions: [...group.questions, { key: questionKey, origin: null, text: "" }] },
  );
}

/** 질문을 뺀다. 그 묶음의 마지막 한 개면 그대로다(묶음에는 질문이 하나 이상 있어야 한다). */
export function withQuestionRemoved(draft: readonly DraftGroup[], groupKey: string, questionKey: string): readonly DraftGroup[] {
  return changeGroup(draft, groupKey, (group) => {
    if (group.questions.length <= 1 || !group.questions.some((question) => question.key === questionKey)) return group;
    return { ...group, questions: group.questions.filter((question) => question.key !== questionKey) };
  });
}

/** 맨 뒤에 새 묶음(이름·태그가 비어 있고 빈 질문 하나)을 더한다. 묶음이 이미 6개면 그대로다. */
export function withGroupAdded(draft: readonly DraftGroup[], groupKey: string, questionKey: string): readonly DraftGroup[] {
  if (draft.length >= PREP_LIMITS.groups) return draft;
  return [...draft, { key: groupKey, origin: null, tag: "", name: "", questions: [{ key: questionKey, origin: null, text: "" }] }];
}

/** 묶음을 (그 질문과 함께) 뺀다. 마지막 한 개면 그대로다(요소에는 묶음이 하나 이상 있어야 한다). */
export function withGroupRemoved(draft: readonly DraftGroup[], groupKey: string): readonly DraftGroup[] {
  if (draft.length <= 1 || !draft.some((group) => group.key === groupKey)) return draft;
  return draft.filter((group) => group.key !== groupKey);
}

/** 앞뒤 공백을 뺀 길이가 1~max 인지 */
function isFilled(text: string, max: number): boolean {
  const length = text.trim().length;
  return length >= 1 && length <= max;
}

/**
 * 고치는 값이 저장할 수 있는 모양인지: 묶음 1~6개, 묶음마다 이름 1~20자·태그 1~12자·질문 1~8개, 질문 1~200자(길이는 앞뒤 공백을 뺀 값).
 * 통과한 값을 groupsOfDraft 로 바꾸면 저장 값 확인(parsePrepCriteria)의 묶음 규칙을 통과한다.
 */
export function isDraftComplete(draft: readonly DraftGroup[]): boolean {
  if (draft.length < 1 || draft.length > PREP_LIMITS.groups) return false;
  return draft.every(
    (group) =>
      isFilled(group.name, PREP_LIMITS.groupNameLength) &&
      isFilled(group.tag, PREP_LIMITS.tagLength) &&
      group.questions.length >= 1 &&
      group.questions.length <= PREP_LIMITS.questions &&
      group.questions.every((question) => isFilled(question.text, PREP_LIMITS.questionLength)),
  );
}

/** 고치는 값을 저장할 묶음으로 바꾼다(문자열의 앞뒤 공백을 뺀다). 모양은 확인하지 않는다(isDraftComplete 가 본다). */
export function groupsOfDraft(draft: readonly DraftGroup[]): PrepGroup[] {
  return draft.map((group) => ({
    tag: group.tag.trim(),
    name: group.name.trim(),
    questions: group.questions.map((question) => question.text.trim()),
  }));
}

/** 두 묶음 목록의 내용(순서대로의 태그·이름·질문)이 같은지 */
export function sameGroups(a: readonly PrepGroup[], b: readonly PrepGroup[]): boolean {
  return (
    a.length === b.length &&
    a.every((group, index) => {
      const other = b[index];
      return (
        group.tag === other.tag &&
        group.name === other.name &&
        group.questions.length === other.questions.length &&
        group.questions.every((question, position) => question === other.questions[position])
      );
    })
  );
}

/** 고치는 중인 요소의 태그 줄: 비어 있지 않은 태그를 순서대로 "#태그" 로 잇는다(lib/prep/criteria.ts 의 tagsLine 과 같은 모양) */
export function draftTagsLine(draft: readonly DraftGroup[]): string {
  return draft
    .map((group) => group.tag.trim())
    .filter((tag) => tag !== "")
    .map((tag) => `#${tag}`)
    .join(" ");
}

/** 요소 하나에서 고친 것의 수 (처음 묶음과 견준 값) */
export type RubricEditStats = {
  /** 새로 더한 묶음 */
  groupsAdded: number;
  /** 뺀 묶음 */
  groupsRemoved: number;
  /** 이름이나 태그를 고친 묶음 (처음부터 있던 것만) */
  groupsEdited: number;
  /** 새로 더한 질문 (새 묶음의 질문 포함) */
  questionsAdded: number;
  /** 뺀 질문 (뺀 묶음의 질문 포함) */
  questionsRemoved: number;
  /** 글을 고친 질문 (처음부터 있던 것만) */
  questionsEdited: number;
};

/**
 * 처음 묶음(original)과 고친 값(draft)을 견주어 고친 것을 센다. draft 는 original 로 만든 것(draftGroupsOf)에서 시작해야 한다
 * (origin 으로 짝을 짓는다). 글은 앞뒤 공백을 뺀 값으로 견주므로, 고쳤다가 처음 글로 되돌린 것은 세지 않는다.
 * 뺐다가 같은 글로 다시 더한 것은 뺀 것 하나·더한 것 하나로 센다(그때 내용이 처음과 같은지는 sameGroups 로 따로 본다).
 */
export function rubricEditStats(original: readonly PrepGroup[], draft: readonly DraftGroup[]): RubricEditStats {
  const stats: RubricEditStats = {
    groupsAdded: 0,
    groupsRemoved: 0,
    groupsEdited: 0,
    questionsAdded: 0,
    questionsRemoved: 0,
    questionsEdited: 0,
  };
  const keptGroups = new Set<number>();
  for (const group of draft) {
    const source = group.origin === null ? undefined : original[group.origin];
    if (source === undefined || group.origin === null || keptGroups.has(group.origin)) {
      stats.groupsAdded += 1;
      stats.questionsAdded += group.questions.length;
      continue;
    }
    keptGroups.add(group.origin);
    if (group.name.trim() !== source.name || group.tag.trim() !== source.tag) stats.groupsEdited += 1;
    const keptQuestions = new Set<number>();
    for (const question of group.questions) {
      const text = question.origin === null ? undefined : source.questions[question.origin];
      if (text === undefined || question.origin === null || keptQuestions.has(question.origin)) {
        stats.questionsAdded += 1;
        continue;
      }
      keptQuestions.add(question.origin);
      if (question.text.trim() !== text) stats.questionsEdited += 1;
    }
    stats.questionsRemoved += source.questions.length - keptQuestions.size;
  }
  original.forEach((group, index) => {
    if (keptGroups.has(index)) return;
    stats.groupsRemoved += 1;
    stats.questionsRemoved += group.questions.length;
  });
  return stats;
}

/** 고친 것의 수를 적은 글: "묶음 추가 1건, 질문 수정 2건". 고친 것이 없으면 "내용 수정". */
function statsText(stats: RubricEditStats): string {
  const parts = [
    ["묶음 추가", stats.groupsAdded],
    ["묶음 삭제", stats.groupsRemoved],
    ["묶음 수정", stats.groupsEdited],
    ["질문 추가", stats.questionsAdded],
    ["질문 삭제", stats.questionsRemoved],
    ["질문 수정", stats.questionsEdited],
  ] as const;
  const text = parts
    .filter(([, count]) => count > 0)
    .map(([label, count]) => `${label} ${count}건`)
    .join(", ");
  return text === "" ? "내용 수정" : text;
}

/**
 * 세부 평가 항목을 고쳐 저장할 때 남기는 기록 내용. 내용이 바뀐 요소만 요소 순서대로 받는다.
 * 예: "세부 평가 항목 변경: 잠재역량(질문 추가 1건, 질문 수정 2건), 학업역량(묶음 추가 1건, 질문 추가 1건)". 받은 요소가 없으면 null.
 */
export function rubricChangeSummary(changes: readonly { name: string; stats: RubricEditStats }[]): string | null {
  if (changes.length === 0) return null;
  return `세부 평가 항목 변경: ${changes.map((change) => `${change.name}(${statsText(change.stats)})`).join(", ")}`;
}

/**
 * 한 번의 저장에 남기는 기록 내용: 있는 것만(배점 변경, 세부 평가 항목 변경) " / " 로 잇는다. 둘 다 없으면 null.
 * 기록 내용의 한도(500자)를 넘으면 한도 안에서 자르고 끝에 "…" 를 붙인다(한도를 넘는 기록은 읽을 때 버려지기 때문이다).
 */
export function joinSaveSummary(parts: readonly (string | null)[]): string | null {
  const text = parts.filter((part): part is string => part !== null && part !== "").join(" / ");
  if (text === "") return null;
  return text.length <= MAX_SUMMARY_LENGTH ? text : `${truncateText(text, MAX_SUMMARY_LENGTH - 1)}…`;
}
