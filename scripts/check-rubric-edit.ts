// 세부 평가 항목을 손으로 고칠 때의 계산 검사. 실행(저장소 루트에서): npx tsx scripts/check-rubric-edit.ts
// 지어낸 입력으로 lib/prep/rubricEdit.ts(고치는 값 만들기·고치기·한도·저장할 값·기록 내용), lib/prep/criteria.ts 의 질문 목록 번호
// (questionRevision: 읽기, 저장할 때 매기기), lib/evaluate/evaluation.ts 의 응답 가리기(validAnswers, answersWith)를 확인한다.
// 인자는 받지 않는다. 출력: 사례마다 "통과"/"실패" 한 줄, 마지막에 개수. 하나라도 실패하면 종료 코드 1.
// node scripts/check-rubric-edit.ts 로도 돌도록(Node 의 타입 제거 실행) 값 import 는 상대 경로에 .ts 확장자를 붙인다.
import {
  EMPTY_EVALUATION,
  answersWith,
  parseEvaluations,
  validAnswers,
  type EvaluationRecord,
} from "../lib/evaluate/evaluation.ts";
import { rubricFingerprint } from "../lib/prep/analysisCriteria.ts";
import {
  PREP_LIMITS,
  carryQuestionRevisions,
  parsePrepCriteria,
  questionRevisionOf,
  sameQuestionList,
  tagsLine,
  type PrepCriteria,
  type PrepElement,
  type PrepGroup,
} from "../lib/prep/criteria.ts";
import { DEFAULT_PREP_CRITERIA } from "../lib/prep/defaultCriteria.ts";
import { MAX_SUMMARY_LENGTH } from "../lib/prep/history.ts";
import {
  cleanLineInput,
  cleanTagInput,
  draftGroupsOf,
  draftTagsLine,
  groupsOfDraft,
  isDraftComplete,
  joinSaveSummary,
  rubricChangeSummary,
  rubricEditStats,
  sameGroups,
  withGroupAdded,
  withGroupName,
  withGroupRemoved,
  withGroupTag,
  withQuestionAdded,
  withQuestionRemoved,
  withQuestionText,
  type DraftGroup,
} from "../lib/prep/rubricEdit.ts";

let passed = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    passed += 1;
    console.log(`통과: ${name}`);
  } else {
    failures.push(name);
    console.error(`실패: ${name}${detail === "" ? "" : ` (${detail})`}`);
  }
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** 묶음 둘: 질문 셋, 질문 하나 */
const GROUPS: readonly PrepGroup[] = [
  { tag: "탐구", name: "탐구력", questions: ["질문 하나", "질문 둘", "질문 셋"] },
  { tag: "태도", name: "학습 태도", questions: ["질문 넷"] },
];

/** 바탕 평가 기준: 요소 둘(배점 60·40) */
const BASE: PrepCriteria = {
  version: 1,
  department: "경영학과",
  elements: [
    { id: "e1", name: "학업역량", weight: 60, groups: GROUPS },
    { id: "e2", name: "공동체역량", weight: 40, groups: [{ tag: "협업", name: "협업", questions: ["협업했는가?"] }] },
  ],
};

const draft = () => draftGroupsOf(GROUPS);

// ---------------------------------------------------------------- 고치는 값 만들기·입력 다듬기

function checkDraft() {
  const made = draft();
  check(
    "고치는 값: key 와 origin 은 순번으로 만든다",
    same(
      made.map((group) => [group.key, group.origin, group.questions.map((question) => [question.key, question.origin])]),
      [
        ["g0", 0, [["g0q0", 0], ["g0q1", 1], ["g0q2", 2]]],
        ["g1", 1, [["g1q0", 0]]],
      ],
    ),
    JSON.stringify(made),
  );
  check("고치는 값: 같은 묶음이면 늘 같은 값", same(draft(), draft()));
  check("고치는 값: 고치지 않고 되돌리면 처음 묶음과 같다", sameGroups(groupsOfDraft(made), GROUPS));
  check("고치는 값: 태그 줄은 저장된 것의 태그 줄과 같다", draftTagsLine(made) === tagsLine(BASE.elements[0]), draftTagsLine(made));

  check("입력: 줄바꿈은 공백 하나로", cleanLineInput("가\n나 \r\n 다", 200) === "가 나 다", cleanLineInput("가\n나 \r\n 다", 200));
  check("입력: 앞뒤 공백은 그대로 둔다(입력하는 중)", cleanLineInput(" 가 ", 200) === " 가 ");
  check("입력: 한도까지만", cleanLineInput("가".repeat(201), 200).length === 200);
  check("입력: 서로게이트 쌍이 반으로 잘리면 남은 반쪽도 버린다", cleanLineInput("가😀", 2) === "가", JSON.stringify(cleanLineInput("가😀", 2)));
  check("태그 입력: 공백과 # 을 뺀다", cleanTagInput(" #전공 활동\t탐색 ") === "전공활동탐색", cleanTagInput(" #전공 활동\t탐색 "));
  check("태그 입력: 12자까지", cleanTagInput("가".repeat(13)).length === PREP_LIMITS.tagLength);
}

// ---------------------------------------------------------------- 고치기와 한도

function checkEdits() {
  const base = draft();

  const renamed = withGroupName(base, "g1", "학습 태도와 성실성");
  check("묶음 이름: 그 묶음만 바뀐다", renamed[1].name === "학습 태도와 성실성" && renamed[0] === base[0]);
  check("묶음 이름: 같은 값이면 받은 목록 그대로", withGroupName(base, "g1", "학습 태도") === base);
  check("묶음 이름: 없는 key 면 받은 목록 그대로", withGroupName(base, "없음", "가") === base);
  check("묶음 이름: 20자까지", withGroupName(base, "g0", "가".repeat(30))[0].name.length === PREP_LIMITS.groupNameLength);
  check("묶음 태그: 공백을 빼고 바꾼다", withGroupTag(base, "g0", "탐 구 력")[0].tag === "탐구력");

  const edited = withQuestionText(base, "g0", "g0q1", "고친 질문");
  check("질문 글: 그 질문만 바뀐다", same(groupsOfDraft(edited)[0].questions, ["질문 하나", "고친 질문", "질문 셋"]));
  check("질문 글: key 와 origin 은 그대로", edited[0].questions[1].key === "g0q1" && edited[0].questions[1].origin === 1);
  check("질문 글: 다른 묶음의 key 로는 바뀌지 않는다", withQuestionText(base, "g1", "g0q1", "고친 질문") === base);
  check("질문 글: 200자까지", withQuestionText(base, "g0", "g0q0", "가".repeat(250))[0].questions[0].text.length === PREP_LIMITS.questionLength);

  const added = withQuestionAdded(base, "g1", "n1");
  check(
    "질문 추가: 그 묶음의 맨 뒤에 빈 질문",
    same(added[1].questions.map((question) => [question.key, question.origin, question.text]), [["g1q0", 0, "질문 넷"], ["n1", null, ""]]),
  );
  let full: readonly DraftGroup[] = base;
  for (let index = 0; index < 10; index += 1) full = withQuestionAdded(full, "g0", `n${index}`);
  check("질문 추가: 8개까지만", full[0].questions.length === PREP_LIMITS.questions, String(full[0].questions.length));
  check("질문 추가: 한도면 받은 목록 그대로", withQuestionAdded(full, "g0", "n99") === full);

  const removed = withQuestionRemoved(base, "g0", "g0q0");
  check("질문 삭제: 그 질문만 빠진다", same(groupsOfDraft(removed)[0].questions, ["질문 둘", "질문 셋"]));
  check("질문 삭제: 남은 질문의 key 는 그대로", same(removed[0].questions.map((question) => question.key), ["g0q1", "g0q2"]));
  check("질문 삭제: 마지막 한 개는 뺄 수 없다", withQuestionRemoved(base, "g1", "g1q0") === base);

  const grouped = withGroupAdded(base, "n1", "n2");
  check(
    "묶음 추가: 맨 뒤에 이름·태그가 비고 빈 질문 하나인 묶음",
    same(grouped[2], { key: "n1", origin: null, tag: "", name: "", questions: [{ key: "n2", origin: null, text: "" }] }),
  );
  let many: readonly DraftGroup[] = base;
  for (let index = 0; index < 10; index += 1) many = withGroupAdded(many, `n${index}`, `m${index}`);
  check("묶음 추가: 6개까지만", many.length === PREP_LIMITS.groups, String(many.length));
  check("묶음 추가: 한도면 받은 목록 그대로", withGroupAdded(many, "n99", "m99") === many);

  const dropped = withGroupRemoved(base, "g0");
  check("묶음 삭제: 그 묶음이 질문과 함께 빠진다", same(groupsOfDraft(dropped), [GROUPS[1]]));
  check("묶음 삭제: 마지막 한 개는 뺄 수 없다", withGroupRemoved(dropped, "g1") === dropped);
  check("묶음 삭제: 없는 key 면 받은 목록 그대로", withGroupRemoved(base, "없음") === base);
}

// ---------------------------------------------------------------- 저장할 수 있는 모양과 저장할 값

function checkComplete() {
  const base = draft();
  check("모양: 고치지 않은 값은 저장할 수 있다", isDraftComplete(base));
  check("모양: 빈 질문이 있으면 저장할 수 없다", !isDraftComplete(withQuestionAdded(base, "g0", "n1")));
  check("모양: 공백만 있는 질문도 빈 칸이다", !isDraftComplete(withQuestionText(base, "g0", "g0q0", "   ")));
  check("모양: 묶음 이름이 비면 저장할 수 없다", !isDraftComplete(withGroupName(base, "g0", "")));
  check("모양: 태그가 비면 저장할 수 없다", !isDraftComplete(withGroupTag(base, "g0", "")));
  check("모양: 새 묶음은 채우기 전에는 저장할 수 없다", !isDraftComplete(withGroupAdded(base, "n1", "n2")));

  let filled = withGroupAdded(base, "n1", "n2");
  filled = withGroupName(filled, "n1", " 기초학업역량 ");
  filled = withGroupTag(filled, "n1", "기초학업");
  filled = withQuestionText(filled, "n1", "n2", " 교과 성취가 고른가? ");
  check("모양: 새 묶음을 다 채우면 저장할 수 있다", isDraftComplete(filled));
  const groups = groupsOfDraft(filled);
  check(
    "저장할 값: 앞뒤 공백을 뺀다",
    same(groups[2], { tag: "기초학업", name: "기초학업역량", questions: ["교과 성취가 고른가?"] }),
    JSON.stringify(groups[2]),
  );
  const saved = parsePrepCriteria({ ...BASE, elements: [{ ...BASE.elements[0], groups }, BASE.elements[1]] });
  check("저장할 값: 저장 값 확인(parsePrepCriteria)을 통과한다", saved !== null && same(saved.elements[0].groups, groups));
  check("저장할 값: 태그 줄에 새 태그가 붙는다", draftTagsLine(filled) === "#탐구 #태도 #기초학업", draftTagsLine(filled));
  check("저장할 값: 비어 있는 태그는 태그 줄에서 뺀다", draftTagsLine(withGroupTag(base, "g0", "")) === "#태도");

  // 한도를 꽉 채운 값(묶음 6개 × 질문 8개, 글자 수 한도)도 저장 값 확인을 통과한다.
  const maxGroups: PrepGroup[] = Array.from({ length: PREP_LIMITS.groups }, (_, index) => ({
    tag: `${index}`.padEnd(PREP_LIMITS.tagLength, "가"),
    name: `${index}`.padEnd(PREP_LIMITS.groupNameLength, "나"),
    questions: Array.from({ length: PREP_LIMITS.questions }, (__, position) => `${position}`.padEnd(PREP_LIMITS.questionLength, "다")),
  }));
  const maxDraft = draftGroupsOf(maxGroups);
  check("모양: 한도를 꽉 채운 값은 저장할 수 있다", isDraftComplete(maxDraft));
  check(
    "저장할 값: 한도를 꽉 채운 값도 저장 값 확인을 통과한다",
    parsePrepCriteria({ ...BASE, elements: [{ ...BASE.elements[0], groups: groupsOfDraft(maxDraft) }, BASE.elements[1]] }) !== null,
  );

  check("내용: 순서대로의 태그·이름·질문이 같으면 같다", sameGroups(GROUPS, JSON.parse(JSON.stringify(GROUPS)) as PrepGroup[]));
  check("내용: 질문 하나가 다르면 다르다", !sameGroups(GROUPS, groupsOfDraft(withQuestionText(base, "g0", "g0q0", "다른 질문"))));
  check("내용: 묶음 수가 다르면 다르다", !sameGroups(GROUPS, [GROUPS[0]]));
}

// ---------------------------------------------------------------- 고친 것 세기와 기록 내용

function checkSummary() {
  const base = draft();
  const none = rubricEditStats(GROUPS, base);
  check("세기: 고치지 않으면 모두 0", Object.values(none).every((count) => count === 0), JSON.stringify(none));

  let edited: readonly DraftGroup[] = withQuestionText(base, "g0", "g0q0", "고친 질문");
  edited = withQuestionRemoved(edited, "g0", "g0q2");
  edited = withQuestionAdded(edited, "g0", "n1");
  edited = withQuestionText(edited, "g0", "n1", "새 질문");
  edited = withGroupName(edited, "g1", "학습 태도와 성실성");
  const stats = rubricEditStats(GROUPS, edited);
  check(
    "세기: 질문 수정 1·삭제 1·추가 1, 묶음 수정 1",
    same(stats, { groupsAdded: 0, groupsRemoved: 0, groupsEdited: 1, questionsAdded: 1, questionsRemoved: 1, questionsEdited: 1 }),
    JSON.stringify(stats),
  );

  let regrouped: readonly DraftGroup[] = withGroupRemoved(base, "g0");
  regrouped = withGroupAdded(regrouped, "n1", "n2");
  regrouped = withQuestionAdded(regrouped, "n1", "n3");
  const regroupedStats = rubricEditStats(GROUPS, regrouped);
  check(
    "세기: 뺀 묶음의 질문은 삭제로, 새 묶음의 질문은 추가로 센다",
    same(regroupedStats, { groupsAdded: 1, groupsRemoved: 1, groupsEdited: 0, questionsAdded: 2, questionsRemoved: 3, questionsEdited: 0 }),
    JSON.stringify(regroupedStats),
  );

  const reverted = withQuestionText(withQuestionText(base, "g0", "g0q0", "고친 질문"), "g0", "g0q0", " 질문 하나 ");
  check("세기: 처음 글로 되돌린 질문은 세지 않는다(앞뒤 공백은 보지 않는다)", rubricEditStats(GROUPS, reverted).questionsEdited === 0);

  check("기록 내용: 바뀐 요소가 없으면 null", rubricChangeSummary([]) === null);
  check(
    "기록 내용: 요소마다 고친 것을 적는다",
    rubricChangeSummary([
      { name: "학업역량", stats },
      { name: "공동체역량", stats: regroupedStats },
    ]) ===
      "세부 평가 항목 변경: 학업역량(묶음 수정 1건, 질문 추가 1건, 질문 삭제 1건, 질문 수정 1건), 공동체역량(묶음 추가 1건, 묶음 삭제 1건, 질문 추가 2건, 질문 삭제 3건)",
    String(rubricChangeSummary([{ name: "학업역량", stats }, { name: "공동체역량", stats: regroupedStats }])),
  );
  check("기록 내용: 센 것이 없으면 내용 수정", rubricChangeSummary([{ name: "학업역량", stats: none }]) === "세부 평가 항목 변경: 학업역량(내용 수정)");

  check("저장 기록: 둘 다 없으면 null", joinSaveSummary([null, null]) === null);
  check("저장 기록: 하나만 있으면 그것", joinSaveSummary(["배점 변경: 가 50 → 45", null]) === "배점 변경: 가 50 → 45");
  check(
    "저장 기록: 둘 다 있으면 / 로 잇는다",
    joinSaveSummary(["배점 변경: 가 50 → 45", "세부 평가 항목 변경: 가(질문 수정 1건)"]) ===
      "배점 변경: 가 50 → 45 / 세부 평가 항목 변경: 가(질문 수정 1건)",
  );
  const long = joinSaveSummary(["가".repeat(400), "나".repeat(400)]);
  check("저장 기록: 500자를 넘으면 자르고 … 를 붙인다", long !== null && long.length === MAX_SUMMARY_LENGTH && long.endsWith("…"), String(long?.length));
  const exact = joinSaveSummary(["가".repeat(MAX_SUMMARY_LENGTH)]);
  check("저장 기록: 정확히 500자면 그대로", exact === "가".repeat(MAX_SUMMARY_LENGTH));
}

// ---------------------------------------------------------------- 질문 목록 번호 (questionRevision)

function element(id: string, questions: string[], questionRevision?: number): PrepElement {
  const base = { id, name: `요소 ${id}`, weight: 50, groups: [{ tag: "태그", name: "묶음", questions }] };
  return questionRevision === undefined ? base : { ...base, questionRevision };
}

function criteria(elements: PrepElement[]): PrepCriteria {
  return { version: 1, department: "경영학과", elements };
}

function checkRevision() {
  const before = criteria([element("e1", ["가", "나"]), element("e2", ["다"], 3)]);

  const weightsOnly = carryQuestionRevisions(before, criteria([{ ...before.elements[0], weight: 70 }, { ...before.elements[1], weight: 30 }]));
  check("번호: 배점만 바꾸면 그대로다", same(weightsOnly.elements.map(questionRevisionOf), [0, 3]));
  check("번호: 0 이면 필드를 두지 않는다", !("questionRevision" in weightsOnly.elements[0]));

  const renamedGroup: PrepElement = { ...before.elements[0], groups: [{ tag: "새태그", name: "새 묶음", questions: ["가", "나"] }] };
  check("번호: 묶음 이름·태그만 바꾸면 그대로다", questionRevisionOf(carryQuestionRevisions(before, criteria([renamedGroup, before.elements[1]])).elements[0]) === 0);

  const split: PrepElement = {
    ...before.elements[0],
    groups: [
      { tag: "하나", name: "하나", questions: ["가"] },
      { tag: "둘", name: "둘", questions: ["나"] },
    ],
  };
  check("번호: 질문 글과 순서가 같으면 묶음이 나뉘어도 그대로다", sameQuestionList(before.elements[0], split));

  const edited = carryQuestionRevisions(before, criteria([element("e1", ["가", "고친 나"]), element("e2", ["다", "라"], 3)]));
  check("번호: 질문을 고치거나 더하면 1 을 더한다", same(edited.elements.map(questionRevisionOf), [1, 4]), JSON.stringify(edited.elements.map(questionRevisionOf)));

  const reordered = carryQuestionRevisions(before, criteria([element("e1", ["나", "가"]), before.elements[1]]));
  check("번호: 질문 순서가 바뀌어도 1 을 더한다", questionRevisionOf(reordered.elements[0]) === 1);

  const claimed = carryQuestionRevisions(before, criteria([element("e1", ["가", "나"], 99), before.elements[1]]));
  check("번호: 저장할 값에 적혀 있던 번호는 쓰지 않는다", questionRevisionOf(claimed.elements[0]) === 0);

  const grown = carryQuestionRevisions(before, criteria([before.elements[0], before.elements[1], element("e3", ["마"])]));
  check("번호: 새로 생긴 id 는 앞 기준의 가장 큰 번호 + 1", questionRevisionOf(grown.elements[2]) === 4, String(questionRevisionOf(grown.elements[2])));

  const kept = carryQuestionRevisions(before, { ...criteria([...before.elements]), guideline: { fileName: "a.pdf", changes: [] } });
  check("번호: 다른 필드(guideline)는 그대로 둔다", same(kept.guideline, { fileName: "a.pdf", changes: [] }));

  const stored = parsePrepCriteria(criteria([element("e1", ["가"], 2), element("e2", ["나"])]));
  check("읽기: 번호가 있으면 그대로 읽는다", stored !== null && same(stored.elements.map(questionRevisionOf), [2, 0]));
  for (const [label, value] of [["0", 0], ["음수", -1], ["소수", 1.5], ["문자열", "2"], ["너무 큰 값", 1_000_001]] as const) {
    const parsed = parsePrepCriteria(criteria([{ ...element("e1", ["가"]), questionRevision: value as number }, element("e2", ["나"])]));
    check(`읽기: 번호가 ${label} 이면 평가 기준은 살리고 번호만 없는 것으로 읽는다`, parsed !== null && !("questionRevision" in parsed.elements[0]));
  }
  check("읽기: 기본 평가 기준에는 번호가 없다", DEFAULT_PREP_CRITERIA.elements.every((item) => questionRevisionOf(item) === 0));

  const fingerprint = rubricFingerprint(before.elements);
  check("지문: 번호는 세부 평가 항목의 지문에 들어가지 않는다", fingerprint === rubricFingerprint([element("e1", ["가", "나"], 7), element("e2", ["다"])]));
}

// ---------------------------------------------------------------- 응답 가리기

function checkAnswers() {
  const now = element("e1", ["가", "나", "다"]);
  const legacy: EvaluationRecord = { ...EMPTY_EVALUATION, answers: { e1: { q1: 5, q2: 4, q3: 3 } } };
  check("응답: 번호가 없는 예전 평가는 질문을 고친 적 없는 기준에서 그대로 보인다", same(validAnswers(legacy, now), { q1: 5, q2: 4, q3: 3 }));

  const revised = element("e1", ["가", "다"], 1);
  check("응답: 질문 목록을 바꿔 저장한 뒤에는 예전 응답을 쓰지 않는다", same(validAnswers(legacy, revised), {}));
  check("응답: 평가가 없으면 빈 값", same(validAnswers(null, now), {}));

  const next = answersWith(legacy, revised, "q1", 2);
  check("응답: 다시 응답하면 예전 응답은 버리고 새 응답만 남는다", same(next.answers, { e1: { q1: 2 } }), JSON.stringify(next.answers));
  check("응답: 응답한 때의 번호를 적는다", same(next.answerRevisions, { e1: 1 }));
  const record: EvaluationRecord = { ...legacy, ...next };
  check("응답: 같은 번호의 기준에서는 그 응답이 보인다", same(validAnswers(record, revised), { q1: 2 }));
  check("응답: 질문을 또 바꾸면 다시 가려진다", same(validAnswers(record, element("e1", ["가"], 2)), {}));

  const other = element("e2", ["라"]);
  const both: EvaluationRecord = { ...record, answers: { ...record.answers, e2: { q1: 4 } } };
  check("응답: 다른 요소의 응답은 그 요소의 번호만 본다", same(validAnswers(both, other), { q1: 4 }));
  const added = answersWith(both, other, "q1", 5);
  check("응답: 한 요소에 응답해도 다른 요소의 응답과 번호는 그대로다", same(added.answers.e1, { q1: 2 }) && same(added.answerRevisions, { e1: 1, e2: 0 }));

  const parsed = parseEvaluations({
    version: 1,
    records: {
      "A-0187": { status: "draft", answers: { e1: { q1: 3 } }, answerRevisions: { e1: 2, e2: -1, e3: "1", e4: 1.5, e5: 0 } },
      "A-0004": { status: "draft", answers: { e1: { q1: 3 } } },
    },
  });
  check("저장 값: 번호는 0 이상의 정수만 읽는다(쓸 수 없는 값은 뺀다)", same(parsed["A-0187"]?.answerRevisions, { e1: 2, e5: 0 }), JSON.stringify(parsed["A-0187"]));
  check("저장 값: 번호가 없는 예전 평가는 빈 값으로 읽고 응답은 그대로다", same(parsed["A-0004"]?.answerRevisions, {}) && same(parsed["A-0004"]?.answers, { e1: { q1: 3 } }));
}

checkDraft();
checkEdits();
checkComplete();
checkSummary();
checkRevision();
checkAnswers();
console.log("");
if (failures.length > 0) {
  console.error(`세부 평가 항목 고치기 검사 실패: ${failures.length}개 실패, ${passed}개 통과`);
  process.exitCode = 1;
} else {
  console.log(`세부 평가 항목 고치기 검사 통과: ${passed}개 사례`);
}
