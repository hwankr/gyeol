// 공통 기준 초안의 요청 확인·받은 값 정리 검사. 실행(저장소 루트에서): npx tsx scripts/check-consensus.ts
// AI 를 부르지 않는다. 지어낸 입력으로 lib/prep/consensusDraft.ts(위원 의견 확인, 의견 정리·초안 정리, 기록 내용)를 확인한다.
// 인자는 받지 않는다. 출력: 사례마다 "통과"/"실패" 한 줄, 마지막에 개수. 하나라도 실패하면 종료 코드 1.
// node scripts/check-consensus.ts 로도 돌도록(Node 의 타입 제거 실행) 값 import 는 상대 경로에 .ts 확장자를 붙인다.
import {
  KEPT_WEIGHT_WARNING,
  consensusSaveSummary,
  keptElementWarning,
  normalizeConsensusDraft,
  normalizeConsensusPoints,
  parseConsensusOpinions,
} from "../lib/prep/consensusDraft.ts";
import { parsePrepCriteria, type PrepCriteria } from "../lib/prep/criteria.ts";
import { DEFAULT_PREP_CRITERIA } from "../lib/prep/defaultCriteria.ts";

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

/** 바탕 평가 기준: 요소 둘(배점 60·40), guideline 있음 */
const BASE: PrepCriteria = {
  version: 1,
  department: "경영학과",
  elements: [
    { id: "e1", name: "학업역량", weight: 60, groups: [{ tag: "성취", name: "학업 성취", questions: ["성취가 우수한가?"] }] },
    { id: "e2", name: "공동체역량", weight: 40, groups: [{ tag: "협업", name: "협업", questions: ["협업했는가?"] }] },
  ],
  guideline: { fileName: "모집요강.pdf", changes: [{ title: "제목", body: "내용" }] },
};

function group(tag: string, name: string, questions: unknown[]) {
  return { tag, name, questions };
}

// ---------------------------------------------------------------- 위원 의견 확인

function checkOpinions() {
  const ok = parseConsensusOpinions([
    { member: 3, role: " 위촉위원 ", text: "  셋째 의견  " },
    { member: 1, role: "사정관", text: "첫째 의견" },
  ]);
  check(
    "의견: 위원 번호순으로 정리하고 앞뒤 공백을 뺀다",
    same(ok, [
      { member: 1, role: "사정관", text: "첫째 의견" },
      { member: 3, role: "위촉위원", text: "셋째 의견" },
    ]),
    JSON.stringify(ok),
  );
  check("의견: 1,000자는 통과", parseConsensusOpinions([{ member: 1, role: "사정관", text: "가".repeat(1000) }]) !== null);
  check(
    "의견: 6건은 통과",
    parseConsensusOpinions(Array.from({ length: 6 }, (_, i) => ({ member: i + 1, role: "사정관", text: "의견" })))?.length === 6,
  );
  const bad: [string, unknown][] = [
    ["배열이 아님", { member: 1, role: "사정관", text: "의견" }],
    ["0건", []],
    ["7건", Array.from({ length: 7 }, (_, i) => ({ member: i + 1, role: "사정관", text: "의견" }))],
    ["1,001자", [{ member: 1, role: "사정관", text: "가".repeat(1001) }]],
    ["공백뿐인 의견", [{ member: 1, role: "사정관", text: "   " }]],
    ["위원 번호 0", [{ member: 0, role: "사정관", text: "의견" }]],
    ["위원 번호 7", [{ member: 7, role: "사정관", text: "의견" }]],
    ["위원 번호가 소수", [{ member: 1.5, role: "사정관", text: "의견" }]],
    ["위원 번호가 문자열", [{ member: "1", role: "사정관", text: "의견" }]],
    ["위원 번호가 겹침", [{ member: 1, role: "사정관", text: "가" }, { member: 1, role: "사정관", text: "나" }]],
    ["역할이 빔", [{ member: 1, role: " ", text: "의견" }]],
    ["역할 21자", [{ member: 1, role: "가".repeat(21), text: "의견" }]],
    ["원소가 객체가 아님", ["의견"]],
  ];
  for (const [label, value] of bad) {
    check(`의견: ${label} → null`, parseConsensusOpinions(value) === null);
  }
}

// ---------------------------------------------------------------- 의견 정리

function checkPoints() {
  const points = normalizeConsensusPoints([
    { kind: "agreed", title: " 모인 것 ", body: " 내용 " },
    { kind: "other", title: "종류가 다름", body: "내용" },
    { kind: "open", title: "", body: "내용" },
    { kind: "open", title: "제목", body: 3 },
    "문자열",
    { kind: "open", title: "제".repeat(45), body: "내".repeat(320) },
    ...Array.from({ length: 8 }, (_, i) => ({ kind: "open", title: `제목${i}`, body: `내용${i}` })),
  ]);
  check("의견 정리: 종류가 다르거나 빈 것은 버리고 6건까지", points.length === 6, `${points.length}건`);
  check("의견 정리: 앞뒤 공백을 뺀다", same(points[0], { kind: "agreed", title: "모인 것", body: "내용" }));
  check("의견 정리: 제목 40자·내용 300자로 자른다", points[1].title.length === 40 && points[1].body.length === 300);
  check("의견 정리: 배열이 아니면 빈 배열", normalizeConsensusPoints({}).length === 0);
}

// ---------------------------------------------------------------- 초안 정리

function checkDraft() {
  // 정상 값
  {
    const result = normalizeConsensusDraft(
      {
        elements: [
          { name: "학업역량", weight: 50, groups: [group("성취", "학업 성취", ["성취가 우수한가?", "성적이 오르는가?"])] },
          { name: "공동체역량", weight: 50, groups: [group("협업", "협업", ["맡은 역할이 드러나는가?"])] },
        ],
        points: [{ kind: "open", title: "배점", body: "위원 1은 …" }],
        warnings: ["AI 경고"],
      },
      BASE,
    );
    check(
      "정리: 받은 묶음·질문과 배점을 쓰고 요소의 id·이름은 바탕 그대로",
      same(result.criteria.elements.map((e) => [e.id, e.name, e.weight, e.groups[0].questions.length]), [
        ["e1", "학업역량", 50, 2],
        ["e2", "공동체역량", 50, 1],
      ]),
      JSON.stringify(result.criteria.elements),
    );
    check("정리: 바탕의 guideline 이 그대로 남는다", same(result.criteria.guideline, BASE.guideline));
    check("정리: 결과가 parsePrepCriteria 를 통과한다", same(parsePrepCriteria(result.criteria), result.criteria));
    check("정리: 의견 정리와 AI 경고", result.points.length === 1 && same(result.warnings, ["AI 경고"]));
  }

  // 순서가 바뀌고 요소가 더 있는 응답
  {
    const result = normalizeConsensusDraft(
      {
        elements: [
          { name: "새 요소", weight: 10, groups: [group("t", "n", ["q"])] },
          { name: " 공동체역량 ", weight: 30, groups: [group("소통", "소통", ["소통했는가?"])] },
          { name: "학업역량", weight: 70, groups: [group("탐구", "탐구", ["탐구했는가?"])] },
        ],
        points: [],
        warnings: [],
      },
      BASE,
    );
    check(
      "정리: 이름으로 짝을 찾고 순서는 바탕 그대로, 바탕에 없는 요소는 쓰지 않는다",
      same(result.criteria.elements.map((e) => [e.id, e.name, e.weight, e.groups[0].name]), [
        ["e1", "학업역량", 70, "탐구"],
        ["e2", "공동체역량", 30, "소통"],
      ]) && result.warnings.length === 0,
      JSON.stringify([result.criteria.elements, result.warnings]),
    );
  }

  // 한 요소가 빠진 응답
  {
    const result = normalizeConsensusDraft(
      { elements: [{ name: "학업역량", weight: 100, groups: [group("탐구", "탐구", ["탐구했는가?"])] }], points: [], warnings: [] },
      BASE,
    );
    check(
      "정리: 짝이 없는 요소는 바탕의 묶음을 두고 경고, 배점도 바탕 그대로",
      same(result.criteria.elements.map((e) => [e.weight, e.groups[0].name]), [
        [60, "탐구"],
        [40, "협업"],
      ]) && same(result.warnings, [keptElementWarning("공동체역량"), KEPT_WEIGHT_WARNING]),
      JSON.stringify([result.criteria.elements, result.warnings]),
    );
  }

  // 묶음을 쓸 수 없는 요소
  {
    const result = normalizeConsensusDraft(
      {
        elements: [
          { name: "학업역량", weight: 55, groups: [group("", "태그 없음", ["q"]), group("t", "질문 없음", [])] },
          { name: "공동체역량", weight: 45, groups: [group("협업", "협업", ["협업했는가?"])] },
        ],
        points: [],
        warnings: [],
      },
      BASE,
    );
    check(
      "정리: 남은 묶음이 0개인 요소는 바탕의 묶음을 두고 경고, 배점은 받은 값(합 100)",
      same(result.criteria.elements.map((e) => [e.weight, e.groups[0].name]), [
        [55, "학업 성취"],
        [45, "협업"],
      ]) && same(result.warnings, [keptElementWarning("학업역량")]),
      JSON.stringify([result.criteria.elements, result.warnings]),
    );
  }

  // 배점 규칙
  {
    const withWeights = (weights: unknown[]) => ({
      elements: BASE.elements.map((element, index) => ({
        name: element.name,
        weight: weights[index],
        groups: [group("t", "n", ["q"])],
      })),
      points: [],
      warnings: [],
    });
    const cases: [string, unknown[]][] = [
      ["합이 99", [59, 40]],
      ["소수(합은 100)", [59.5, 40.5]],
      ["음수(합은 100)", [-10, 110]],
      ["문자열", ["60", 40]],
      ["null", [null, 100]],
    ];
    for (const [label, weights] of cases) {
      const result = normalizeConsensusDraft(withWeights(weights), BASE);
      check(
        `정리(배점): ${label} → 바탕의 배점(60·40)을 두고 배점 경고`,
        same(result.criteria.elements.map((e) => e.weight), [60, 40]) && same(result.warnings, [KEPT_WEIGHT_WARNING]),
        JSON.stringify([result.criteria.elements.map((e) => e.weight), result.warnings]),
      );
    }
    const kept = normalizeConsensusDraft(withWeights([0, 100]), BASE);
    check("정리(배점): 0·100 (정수이고 합 100) → 그대로", same(kept.criteria.elements.map((e) => e.weight), [0, 100]) && kept.warnings.length === 0);
  }

  // 깨진 값, 경고 한도
  {
    const broken = normalizeConsensusDraft("깨진 값", BASE);
    check(
      "정리: 객체가 아닌 값도 예외 없이 바탕 그대로(요소마다 경고와 배점 경고)",
      same(broken.criteria, BASE) &&
        same(broken.warnings, [keptElementWarning("학업역량"), keptElementWarning("공동체역량"), KEPT_WEIGHT_WARNING]) &&
        broken.points.length === 0,
      JSON.stringify(broken.warnings),
    );
    const full = normalizeConsensusDraft(
      { elements: [], points: [], warnings: Array.from({ length: 12 }, (_, i) => `AI 경고 ${i}`) },
      BASE,
    );
    check(
      "정리(경고): 모두 10건까지이고 코드가 붙이는 경고는 빠지지 않는다",
      full.warnings.length === 10 && full.warnings[6] === "AI 경고 6" && full.warnings[9] === KEPT_WEIGHT_WARNING,
      JSON.stringify(full.warnings),
    );
    const noGuideline = normalizeConsensusDraft({}, DEFAULT_PREP_CRITERIA);
    check("정리: guideline 이 없는 바탕이면 결과에도 없다", !("guideline" in noGuideline.criteria));
  }

  // 한도를 넘는 묶음·질문
  {
    const result = normalizeConsensusDraft(
      {
        elements: [
          {
            name: "학업역량",
            weight: 60,
            groups: Array.from({ length: 8 }, (_, i) =>
              group(` 긴 태그 ${"가".repeat(20)}`, `${i}${"나".repeat(25)}`, Array.from({ length: 10 }, () => "다".repeat(250))),
            ),
          },
          { name: "공동체역량", weight: 40, groups: [group("협업", "협업", ["협업했는가?"])] },
        ],
        points: [],
        warnings: [],
      },
      BASE,
    );
    const first = result.criteria.elements[0];
    check(
      "정리: 묶음 6개·질문 8개까지, 태그 12자·묶음 이름 20자·질문 200자로 자른다",
      first.groups.length === 6 &&
        first.groups[0].questions.length === 8 &&
        first.groups[0].tag.length === 12 &&
        first.groups[0].name.length === 20 &&
        first.groups[0].questions[0].length === 200 &&
        parsePrepCriteria(result.criteria) !== null,
    );
  }
}

// ---------------------------------------------------------------- 기록 내용

function checkSummary() {
  check(
    "기록 내용: 위원 의견으로 공통 기준을 만듦",
    consensusSaveSummary(3, [
      { id: "e1", name: "가", weight: 30, groups: [] },
      { id: "e2", name: "나", weight: 70, groups: [] },
    ]) === "위원 의견으로 공통 기준을 만듦: 위원 3명 (평가 요소 2개, 배점 30·70)",
  );
}

checkOpinions();
checkPoints();
checkDraft();
checkSummary();
console.log("");
if (failures.length > 0) {
  console.error(`공통 기준 초안 검사 실패: ${failures.length}개 실패, ${passed}개 통과`);
  process.exitCode = 1;
} else {
  console.log(`공통 기준 초안 검사 통과: ${passed}개 사례`);
}
