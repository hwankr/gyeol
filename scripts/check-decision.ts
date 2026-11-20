// 선발 결정의 계산과 예시 자료 검사. 실행(저장소 루트에서): npx tsx scripts/check-decision.ts
// lib/decision/decision.ts(최종 평가·순위·비교 기준·비교할 두 사람·요소별 차이·고른 지원자의 저장 값 확인)와
// lib/decision/sampleDecision.ts(합격선 주변 예시 지원자 12명: 시안의 값과 맞는지, 평가하기의 지원자와 겹치지 않는지, 위원의 종합 의견),
// lib/decision/opinions.ts(위원 의견 모아보기: 요소별 위원 점수와 차이, 크게 갈린 요소, 조정이 필요한 지원자),
// lib/decision/adjustments.ts(조정: 점수 입력 읽기, 고치는 중의 계산, 확정한 조정의 저장 값 확인과 지원자 자료에 덮어쓰기),
// lib/decision/confirm.ts(기록 확정: 조정의 진행, 확인 항목의 글, 확정한 기록의 형식과 저장 값 확인)를 확인한다.
// 인자는 받지 않는다. 출력: 사례마다 "통과"/"실패" 한 줄, 마지막에 개수. 하나라도 실패하면 종료 코드 1.
// node scripts/check-decision.ts 로도 돌도록(Node 의 타입 제거 실행) 값 import 는 상대 경로에 .ts 확장자를 붙인다.
import { ADMISSION } from "../lib/admission.ts";
import {
  NO_ADJUSTMENTS,
  adjustEffectText,
  adjustPreviewOf,
  adjustmentOf,
  applyAdjustments,
  draftOf,
  editDraft,
  parseDecisionAdjustments,
  parseScoreText,
  serializeDecisionAdjustments,
  withAdjustment,
  withoutAdjustment,
} from "../lib/decision/adjustments.ts";
import {
  adjustCheckParts,
  adjustProgressOf,
  confirmRowsKey,
  confirmRowsOf,
  confirmStandingOf,
  cutlineCheckParts,
  evaluationCheckParts,
  parseDecisionConfirmation,
  sameConfirmRows,
  serializeDecisionConfirmation,
} from "../lib/decision/confirm.ts";
import {
  CLOSE_MARGIN10,
  MAX_PICKS,
  NO_PICKS,
  WIDE_SPREAD10,
  comparePairOf,
  cutlineOf,
  decisionFlagsOf,
  decisionMemberName,
  decisionSlotOf,
  elementGapsOf,
  parseDecisionPicks,
  rankDecisionApplicants,
  serializeDecisionPicks,
  similarCodesOf,
  standingText,
  tenthsText,
  togglePick,
  trimmedTenthsText,
  weightedTenths,
  widestGapOf,
} from "../lib/decision/decision.ts";
import { WIDE_ELEMENT_SPREAD, elementSpreadsOf, needsAdjustment } from "../lib/decision/opinions.ts";
import { DECISION_APPLICANTS, DECISION_FIRST_RANK } from "../lib/decision/sampleDecision.ts";
import { EVALUATION_APPLICANTS } from "../lib/evaluate/sampleEvaluations.ts";
import type { PrepElement } from "../lib/prep/criteria.ts";
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

const ELEMENTS = DEFAULT_PREP_CRITERIA.elements;
const QUOTA = ADMISSION.quota;
const CODES = DECISION_APPLICANTS.map((applicant) => applicant.code);

/** 배점만 바꾼 평가 요소 (지어낸 값) */
function withWeights(weights: readonly number[]): PrepElement[] {
  return ELEMENTS.map((element, index) => ({ ...element, weight: weights[index] ?? 0 }));
}

const ranked = rankDecisionApplicants(DECISION_APPLICANTS, ELEMENTS, QUOTA, DECISION_FIRST_RANK);
const byCode = (code: string) => ranked.find((row) => row.applicant.code === code);
const cutline = cutlineOf(ranked, QUOTA);

// ── 가중 평균과 글 ──
check("가중 평균: 기본 배점(50·30·20)에서 78·82·92 는 82.0", weightedTenths([78, 82, 92], ELEMENTS) === 820);
check("가중 평균: 위원 점수의 합을 위원 수로 나눈다", weightedTenths([234, 246, 276], ELEMENTS, 3) === 820);
check("가중 평균: 배점 합이 0 이면 0", weightedTenths([78, 82, 92], withWeights([0, 0, 0])) === 0);
check("가중 평균: 요소가 없으면 0", weightedTenths([80], []) === 0);
check("점수 글: 820 → 82.0, 818 → 81.8", tenthsText(820) === "82.0" && tenthsText(818) === "81.8");
check("요소 점수 글: 800 → 80, 803 → 80.3", trimmedTenthsText(800) === "80" && trimmedTenthsText(803) === "80.3");
check("위원 이름: 위원 1 부터", decisionMemberName(0) === "위원 1" && decisionMemberName(2) === "위원 3");
check(
  "자리: 요소가 셋보다 많으면 돌려 쓴다",
  decisionSlotOf(DECISION_APPLICANTS[0], 2) === 2 && decisionSlotOf(DECISION_APPLICANTS[0], 3) === 0 && decisionSlotOf(DECISION_APPLICANTS[0], 4) === 1,
);

// ── 예시 자료 ──
check("예시 자료: 12명, 코드가 겹치지 않는다", CODES.length === 12 && new Set(CODES).size === 12);
check(
  "예시 자료: 평가하기에 배정된 24명과 겹치지 않는다",
  EVALUATION_APPLICANTS.every((applicant) => !CODES.includes(applicant.code)),
);
check(
  "예시 자료: 점수는 모두 0~100 정수",
  DECISION_APPLICANTS.every((applicant) =>
    [applicant.ai, ...applicant.members].every((scores) => scores.every((score) => Number.isInteger(score) && score >= 0 && score <= 100)),
  ),
);
check(
  "예시 자료: 자리마다 위원 세 명의 평균이 정수다",
  DECISION_APPLICANTS.every((applicant) => [0, 1, 2].every((slot) => applicant.members.reduce((sum, member) => sum + member[slot], 0) % 3 === 0)),
);
check(
  "예시 자료: 지원자마다 위원 세 명의 종합 의견이 있다 (앞뒤 공백 없음, 1~80자)",
  DECISION_APPLICANTS.every(
    (applicant) =>
      applicant.opinions.length === applicant.members.length &&
      applicant.opinions.every((opinion) => opinion.trim() === opinion && opinion.length > 0 && opinion.length <= 80),
  ),
  String(Math.max(...DECISION_APPLICANTS.flatMap((applicant) => applicant.opinions.map((opinion) => opinion.length)))),
);
check(
  "예시 자료: 종합 의견에 평가 요소의 이름을 적지 않았다 (요소 이름을 바꿔도 어긋나지 않게)",
  DECISION_APPLICANTS.every((applicant) => applicant.opinions.every((opinion) => ELEMENTS.every((element) => !opinion.includes(element.name)))),
);
check(
  "예시 자료: 25위부터이고 합격선(30위) 위로 여섯, 아래로 여섯 명",
  DECISION_FIRST_RANK === 25 && QUOTA === 30 && ranked.filter((row) => row.admitted).length === 6 && ranked.filter((row) => !row.admitted).length === 6,
);

// ── 순위 (기본 배점) ──
check(
  "순위: 최종 평가가 시안·설계 값과 같다",
  same(
    ranked.map((row) => tenthsText(row.final10)),
    ["83.7", "83.2", "83.0", "82.4", "82.1", "82.0", "81.8", "81.5", "81.1", "80.8", "80.4", "80.1"],
  ),
  ranked.map((row) => tenthsText(row.final10)).join(" "),
);
check(
  "순위: 25위부터 36위까지 차례로 붙는다",
  same(
    ranked.map((row) => row.rank),
    [25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36],
  ),
);
const a147 = byCode("A-0147");
const a171 = byCode("A-0171");
check(
  "시안의 왼쪽 지원자: A-0147 은 30위 · 합격권 · 82.0점",
  a147 !== undefined && a147.rank === 30 && standingText(a147) === "합격권" && tenthsText(a147.final10) === "82.0",
);
check(
  "시안의 오른쪽 지원자: A-0171 은 31위 · 예비 1 · 81.8점",
  a171 !== undefined && a171.rank === 31 && standingText(a171) === "예비 1" && tenthsText(a171.final10) === "81.8",
);
check(
  "요소 점수: A-0147 은 78·82·92, A-0171 은 82·88·72 (위원 평균)",
  same(a147?.element10, [780, 820, 920]) && same(a171?.element10, [820, 880, 720]),
);
check(
  "위원별 종합 점수와 위원 간 차이: A-0147 은 82.7·82.5·80.8, 차이 1.9",
  same(a147?.memberTotal10, [827, 825, 808]) && a147?.spread10 === 19,
);
check("인재상 적합도: A-0147 은 82 (AI 점수의 가중 평균을 반올림)", a147?.aiTotal === 82);
check("구분: 예비 순번은 합격선 아래부터 1", same(ranked.slice(6).map(standingText), ["예비 1", "예비 2", "예비 3", "예비 4", "예비 5", "예비 6"]));
check(
  "순위: 점수가 같으면 코드 순서",
  same(
    rankDecisionApplicants([DECISION_APPLICANTS[6], DECISION_APPLICANTS[5]], withWeights([0, 0, 0]), 1, 1).map((row) => row.applicant.code),
    ["A-0147", "A-0171"],
  ),
);
// 배점을 바꾸면 최종 평가와 순위가 같이 바뀐다: 공동체역량만 보면 A-0147(92) 이 맨 위다.
const communityOnly = rankDecisionApplicants(DECISION_APPLICANTS, withWeights([0, 0, 100]), QUOTA, DECISION_FIRST_RANK);
check(
  "배점을 바꾸면 순위가 다시 매겨진다 (공동체역량 100)",
  communityOnly[0].applicant.code === "A-0147" && tenthsText(communityOnly[0].final10) === "92.0" && communityOnly[0].rank === DECISION_FIRST_RANK,
);
// 요소가 여섯이면 자리를 돌려 쓴다: 넷째·다섯째·여섯째 요소는 첫째·둘째·셋째 자리의 점수다.
const sixElements: PrepElement[] = [...ELEMENTS, { ...ELEMENTS[0], id: "e4" }, { ...ELEMENTS[1], id: "e5" }, { ...ELEMENTS[2], id: "e6" }];
const sixRanked = rankDecisionApplicants([DECISION_APPLICANTS[5]], sixElements, QUOTA, DECISION_FIRST_RANK);
check("요소가 여섯이면 자리를 돌려 쓴다", same(sixRanked[0].element10, [780, 820, 920, 780, 820, 920]));
check("지원자가 없으면 빈 목록", rankDecisionApplicants([], ELEMENTS, QUOTA, DECISION_FIRST_RANK).length === 0);

// ── 합격선과 비교 기준 ──
check(
  "합격선: 30위(A-0147)와 31위(A-0171) 사이, 0.2점 차",
  cutline !== null && cutline.last.applicant.code === "A-0147" && cutline.first.applicant.code === "A-0171" && cutline.gap10 === 2,
);
check("합격선: 그 구간에 두 사람이 없으면 null", cutlineOf(ranked.slice(0, 6), QUOTA) === null && cutlineOf(ranked, 99) === null);
const flagged = (flag: string) => ranked.filter((row) => decisionFlagsOf(row, ranked, cutline).some((item) => item === flag)).map((row) => row.applicant.code);
check(
  `합격선 접전: 합격선과 ${tenthsText(CLOSE_MARGIN10)}점 이내인 다섯 명`,
  same(flagged("close"), ["A-0090", "A-0118", "A-0147", "A-0171", "A-0196"]),
  flagged("close").join(" "),
);
check(
  `위원 간 차이 큼: 차이가 ${tenthsText(WIDE_SPREAD10)}점 이상인 네 명`,
  same(flagged("spread"), ["A-0090", "A-0118", "A-0196", "A-0240"]),
  flagged("spread").join(" "),
);
check(
  "요약이 비슷함: 갈래가 같은 지원자가 있는 아홉 명",
  same(flagged("similar"), ["A-0064", "A-0090", "A-0118", "A-0147", "A-0171", "A-0196", "A-0222", "A-0240", "A-0263"]),
  flagged("similar").join(" "),
);
check(
  "요약이 비슷한 지원자: A-0147 은 A-0090·A-0222 (순위 순서), 갈래가 없으면 없음",
  a147 !== undefined && same(similarCodesOf(a147, ranked), ["A-0090", "A-0222"]) && similarCodesOf(ranked[0], ranked).length === 0,
);
check("합격선이 없으면 합격선 접전은 붙지 않는다", a147 !== undefined && !decisionFlagsOf(a147, ranked, null).includes("close"));

// ── 고른 지원자 ──
check("고르기: 빈 값에 더한다", same(togglePick(NO_PICKS, "A-0147"), ["A-0147"]));
check("고르기: 고른 순서대로 둘까지", same(togglePick(["A-0147"], "A-0171"), ["A-0147", "A-0171"]));
const full = ["A-0147", "A-0171"];
check("고르기: 둘을 골랐으면 더하지 않는다 (받은 값 그대로)", togglePick(full, "A-0090") === full && MAX_PICKS === 2);
check("고르기: 고른 사람을 다시 누르면 뺀다", same(togglePick(full, "A-0147"), ["A-0171"]));
check("고르기: 마지막 한 명을 빼면 빈 값", togglePick(["A-0147"], "A-0147") === NO_PICKS);
check(
  "저장 값: 쓴 것을 다시 읽으면 같다",
  same(parseDecisionPicks(JSON.parse(serializeDecisionPicks(full)), CODES), full),
);
check(
  "저장 값: 모양이 틀리면 고른 사람 없음",
  [undefined, null, "x", [], {}, { version: 2, codes: full }, { version: 1, codes: "A-0147" }].every((value) => parseDecisionPicks(value, CODES) === NO_PICKS),
);
check(
  "저장 값: 목록에 없는 코드·되풀이·글이 아닌 값은 빼고 둘까지",
  same(parseDecisionPicks({ version: 1, codes: ["A-9999", "A-0147", 3, "A-0147", "A-0171", "A-0090"] }, CODES), full),
);

// ── 비교할 두 사람 ──
const defaultPair = comparePairOf(ranked, NO_PICKS, QUOTA);
check(
  "비교: 고른 사람이 없으면 합격선 바로 위·아래 두 사람",
  defaultPair !== null && !defaultPair.chosen && defaultPair.left.applicant.code === "A-0147" && defaultPair.right.applicant.code === "A-0171",
);
const onePick = comparePairOf(ranked, ["A-0012"], QUOTA);
check("비교: 한 명만 골랐으면 합격선의 두 사람 그대로", onePick !== null && !onePick.chosen && onePick.left.applicant.code === "A-0147");
const chosenPair = comparePairOf(ranked, ["A-0222", "A-0090"], QUOTA);
check(
  "비교: 둘을 골랐으면 그 둘, 순위가 높은 사람이 왼쪽",
  chosenPair !== null && chosenPair.chosen && chosenPair.left.applicant.code === "A-0090" && chosenPair.right.applicant.code === "A-0222",
);
const noCutPair = comparePairOf(ranked.slice(0, 3), NO_PICKS, QUOTA);
check("비교: 합격선의 두 사람이 없으면 맨 위의 두 사람", noCutPair !== null && noCutPair.left.rank === 25 && noCutPair.right.rank === 26);
check("비교: 지원자가 둘보다 적으면 null", comparePairOf(ranked.slice(0, 1), NO_PICKS, QUOTA) === null);

// ── 요소별 차이 ──
const gaps = defaultPair === null ? [] : elementGapsOf(defaultPair, ELEMENTS);
check(
  "요소별 차이: A-0147 − A-0171 은 −4 · −6 · +20",
  same(
    gaps.map((gap) => gap.diff10),
    [-40, -60, 200],
  ) && same(gaps.map((gap) => gap.name), ["잠재역량", "학업역량", "공동체역량"]),
);
check("가장 크게 갈린 요소: 공동체역량", widestGapOf(gaps)?.name === "공동체역량");
check(
  "가장 크게 갈린 요소: 차이가 같으면 앞의 요소, 모두 같으면 null",
  widestGapOf([
    { id: "a", name: "가", weight: 50, left10: 800, right10: 820, diff10: -20 },
    { id: "b", name: "나", weight: 50, left10: 820, right10: 800, diff10: 20 },
  ])?.id === "a" && widestGapOf([{ id: "a", name: "가", weight: 100, left10: 800, right10: 800, diff10: 0 }]) === null,
);

// ── 위원 의견 모아보기 ──
const a090 = byCode("A-0090");
const spreads090 = a090 === undefined ? [] : elementSpreadsOf(a090, ELEMENTS);
check(
  "요소별 위원 점수: A-0090 은 86·83·74 / 86·79·72 / 92·90·91, 차이 12·14·2",
  same(spreads090.map((item) => item.scores), [[86, 83, 74], [86, 79, 72], [92, 90, 91]]) && same(spreads090.map((item) => item.spread), [12, 14, 2]),
);
check(
  "요소별 위원 점수: 지금 평가 기준의 요소 순서와 이름 그대로",
  same(spreads090.map((item) => [item.id, item.name]), ELEMENTS.map((element) => [element.id, element.name])),
);
check(
  `크게 갈린 요소: 차이가 ${WIDE_ELEMENT_SPREAD}점 이상 (A-0090 은 잠재역량·학업역량)`,
  WIDE_ELEMENT_SPREAD === 10 && same(spreads090.map((item) => item.wide), [true, true, false]),
);
// 차이가 꼭 10점인 요소도 크게 갈린 것이다: A-0240 의 학업역량은 94·86·84 다.
const a240 = byCode("A-0240");
const spreads240 = a240 === undefined ? [] : elementSpreadsOf(a240, ELEMENTS);
check(
  "크게 갈린 요소: 차이가 꼭 10점이면 해당한다 (A-0240 의 학업역량)",
  same(spreads240.map((item) => item.spread), [12, 10, 2]) && same(spreads240.map((item) => item.wide), [true, true, false]),
);
const wideNames = (code: string) => {
  const row = byCode(code);
  return row === undefined ? [] : elementSpreadsOf(row, ELEMENTS).flatMap((item) => (item.wide ? [`${item.name} ${item.spread}`] : []));
};
check(
  "크게 갈린 요소: A-0118 은 공동체역량 16점, A-0196 은 학업역량 14점",
  same(wideNames("A-0118"), ["공동체역량 16"]) && same(wideNames("A-0196"), ["학업역량 14"]),
);
const adjustCodes = ranked.filter((row) => needsAdjustment(elementSpreadsOf(row, ELEMENTS))).map((row) => row.applicant.code);
check(
  "조정 필요: 크게 갈린 요소가 있는 네 명 (예시 자료에서는 위원 간 차이 큼과 같은 사람들)",
  same(adjustCodes, ["A-0090", "A-0118", "A-0196", "A-0240"]) && same(adjustCodes, flagged("spread")),
  adjustCodes.join(" "),
);
check(
  "조정 필요: 나머지 여덟 명은 어느 요소에서도 4점 넘게 갈리지 않는다",
  ranked
    .filter((row) => !adjustCodes.includes(row.applicant.code))
    .every((row) => elementSpreadsOf(row, ELEMENTS).every((item) => item.spread <= 4)),
);
check(
  "조정 필요: 크게 갈린 요소가 하나라도 있으면 해당하고, 없거나 요소가 없으면 아니다",
  needsAdjustment([{ wide: false }, { wide: true }]) && !needsAdjustment([{ wide: false }, { wide: false }]) && !needsAdjustment([]),
);
// 종합 점수가 비슷해도 요소에서 엇갈렸으면 조정이 필요하다(시안의 A-0132: 리더십 80·76·68, 전공 80·82·90, 종합 84·84·83).
const crossed = rankDecisionApplicants(
  [{ ...DECISION_APPLICANTS[0], members: [[80, 80, 85], [76, 82, 86], [68, 90, 84]] }],
  withWeights([50, 50, 0]),
  QUOTA,
  DECISION_FIRST_RANK,
)[0];
check(
  "조정 필요: 위원들이 서로 다른 요소에서 엇갈려 종합 점수의 차이는 작아도 해당한다",
  crossed.spread10 < WIDE_SPREAD10 && needsAdjustment(elementSpreadsOf(crossed, ELEMENTS)),
  tenthsText(crossed.spread10),
);
check(
  "요소별 위원 점수: 요소가 여섯이면 자리를 돌려 쓴다",
  same(elementSpreadsOf(sixRanked[0], sixElements).map((item) => item.scores[0]), [78, 83, 94, 78, 83, 94]),
);
check("요소별 위원 점수: 요소가 없으면 빈 목록", a090 !== undefined && elementSpreadsOf(a090, []).length === 0);

// ── 조정 (위원 의견 모아보기에서 점수를 고쳐 확정) ──
check(
  "점수 입력: 0~100 정수만 읽는다 (앞뒤 공백과 앞의 0 은 받는다)",
  same(["86", " 7 ", "007", "0", "100"].map(parseScoreText), [86, 7, 7, 0, 100]) &&
    ["", " ", "101", "1000", "8.5", "-3", "8a", "팔십"].every((text) => parseScoreText(text) === null),
);
const source090 = DECISION_APPLICANTS.find((applicant) => applicant.code === "A-0090");
if (source090 === undefined) throw new Error("예시 자료에 A-0090 이 없다");
const draft090 = draftOf(source090.members);
check("고치는 입력: 처음에는 위원 점수 그대로의 글", same(draft090, [["86", "86", "92"], ["83", "79", "90"], ["74", "72", "91"]]));
const edited090 = editDraft(editDraft(draft090, 2, 0, "78"), 2, 1, "77");
check(
  "고치는 입력: 한 칸만 바뀌고 받은 값은 그대로 둔다",
  same(edited090, [["86", "86", "92"], ["83", "79", "90"], ["78", "77", "91"]]) && draft090[2][0] === "74",
);
const before090 = adjustPreviewOf(source090, draft090, ELEMENTS);
check(
  "고치는 중 계산: 고치기 전에는 저장된 점수와 같고(차이 12·14·2, 종합 87.2·83.2·76.8, 차이 10.4) 확정할 수 없다",
  same(before090.columns.map((column) => column.spread), [12, 14, 2]) &&
    same(before090.columns.map((column) => column.wide), [true, true, false]) &&
    same(before090.memberTotal10, [872, 832, 768]) &&
    before090.spread10 === 104 &&
    before090.members === null,
);
const after090 = adjustPreviewOf(source090, edited090, ELEMENTS);
check(
  "고치는 중 계산: 위원 3 의 점수를 78·77 로 고치면 차이 8·9·2, 위원 3 의 종합 80.3, 확정할 수 있다",
  same(after090.columns.map((column) => column.spread), [8, 9, 2]) &&
    after090.columns.every((column) => !column.wide) &&
    same(after090.memberTotal10, [872, 832, 803]) &&
    after090.spread10 === 69 &&
    same(after090.members, [[86, 86, 92], [83, 79, 90], [78, 77, 91]]),
);
const half090 = adjustPreviewOf(source090, editDraft(draft090, 2, 0, "78"), ELEMENTS);
check(
  "고치는 중 계산: 크게 갈린 요소가 하나라도 남으면 확정할 수 없다",
  same(half090.columns.map((column) => column.wide), [false, true, false]) && half090.members === null,
);
for (const [label, text] of [["빈 칸", ""], ["100 을 넘는 값", "120"]] as const) {
  const broken = adjustPreviewOf(source090, editDraft(edited090, 0, 1, text), ELEMENTS);
  check(
    `고치는 중 계산: 읽지 못하는 입력(${label})이 있으면 그 요소의 차이와 그 위원의 종합을 모르고 확정할 수 없다`,
    same(broken.columns.map((column) => column.spread), [8, null, 2]) &&
      same(broken.columns.map((column) => column.wide), [false, true, false]) &&
      same(broken.columns[1].scores, [null, 79, 77]) &&
      same(broken.memberTotal10, [null, 832, 803]) &&
      broken.spread10 === null &&
      broken.members === null,
  );
}
check(
  "고치는 중 계산: 요소가 여섯이면 자리를 돌려 써서 넷째 요소도 같이 바뀐다",
  same(adjustPreviewOf(source090, edited090, sixElements).columns.map((column) => column.spread), [8, 9, 2, 8, 9, 2]),
);
check(
  "고치는 중 계산: 입력의 모양이 지원자와 다르면 확정할 수 없다",
  adjustPreviewOf(source090, edited090.slice(0, 2), ELEMENTS).members === null && adjustPreviewOf(source090, [], ELEMENTS).members === null,
);

const confirmed090 = { code: "A-0090", members: after090.members ?? source090.members };
const oneAdjustment = withAdjustment(NO_ADJUSTMENTS, confirmed090);
check("조정 더하기: 빈 값에 더한다", same(oneAdjustment, [confirmed090]) && adjustmentOf(oneAdjustment, "A-0090") === confirmed090);
const replaced090 = { code: "A-0090", members: source090.members };
check(
  "조정 더하기: 이미 있는 지원자는 그 자리에서 바꾼다",
  same(withAdjustment(withAdjustment(oneAdjustment, { code: "A-0118", members: DECISION_APPLICANTS[4].members }), replaced090).map((item) => item.code), ["A-0090", "A-0118"]) &&
    adjustmentOf(withAdjustment(oneAdjustment, replaced090), "A-0090") === replaced090,
);
check(
  "조정 빼기: 마지막 하나를 빼면 빈 값, 없는 지원자는 받은 값 그대로",
  withoutAdjustment(oneAdjustment, "A-0090") === NO_ADJUSTMENTS && withoutAdjustment(oneAdjustment, "A-0118") === oneAdjustment,
);
check(
  "조정 저장 값: 쓴 것을 다시 읽으면 같다",
  same(parseDecisionAdjustments(JSON.parse(serializeDecisionAdjustments(oneAdjustment)), DECISION_APPLICANTS), oneAdjustment),
);
check(
  "조정 저장 값: 모양이 틀리면 확정한 조정 없음",
  [undefined, null, "x", [], {}, { version: 2, items: [confirmed090] }, { version: 1, items: "A-0090" }].every(
    (value) => parseDecisionAdjustments(value, DECISION_APPLICANTS) === NO_ADJUSTMENTS,
  ),
);
const goodMembers = confirmed090.members;
check(
  "조정 저장 값: 목록에 없는 코드·되풀이·모양이나 범위가 틀린 점수는 빼고 나머지는 살린다",
  same(
    parseDecisionAdjustments(
      {
        version: 1,
        items: [
          { code: "A-9999", members: goodMembers },
          { code: "A-0118", members: [[82, 89, 62], [85, 92, 78]] },
          { code: "A-0196", members: [[88, 80, 81, 1], [82, 66, 78], [88, 79, 81]] },
          { code: "A-0240", members: [[83, 94, 78], [80, 86.5, 77], [71, 84, 76]] },
          { code: "A-0263", members: [[85, 75, 82], [84, 74, 101], [83, 73, 80]] },
          { code: "A-0289", members: "x" },
          3,
          confirmed090,
          { code: "A-0090", members: source090.members },
        ],
      },
      DECISION_APPLICANTS,
    ),
    [confirmed090],
  ),
);
check("조정 덮어쓰기: 조정이 없으면 받은 목록 그대로", applyAdjustments(DECISION_APPLICANTS, NO_ADJUSTMENTS) === DECISION_APPLICANTS);
const adjustedApplicants = applyAdjustments(DECISION_APPLICANTS, oneAdjustment);
check(
  "조정 덮어쓰기: 조정한 지원자는 위원 점수만 바뀌고 나머지 지원자는 그대로다",
  adjustedApplicants.every((applicant, index) =>
    applicant.code === "A-0090"
      ? applicant.members === confirmed090.members && applicant.summary === source090.summary && applicant.opinions === source090.opinions
      : applicant === DECISION_APPLICANTS[index],
  ),
);
const adjustedRanked = rankDecisionApplicants(adjustedApplicants, ELEMENTS, QUOTA, DECISION_FIRST_RANK);
const adjusted090 = adjustedRanked.find((row) => row.applicant.code === "A-0090");
check(
  "조정을 확정하면 최종 평가와 순위가 다시 계산된다: A-0090 은 82.4점 28위 → 83.6점 26위",
  a090 !== undefined && tenthsText(a090.final10) === "82.4" && a090.rank === 28 && adjusted090 !== undefined && tenthsText(adjusted090.final10) === "83.6" && adjusted090.rank === 26,
  adjusted090 === undefined ? "" : `${tenthsText(adjusted090.final10)} ${adjusted090.rank}`,
);
check(
  "조정을 확정하면 조정이 필요한 지원자에서 빠진다 (넷 → 셋)",
  same(
    adjustedRanked.filter((row) => needsAdjustment(elementSpreadsOf(row, ELEMENTS))).map((row) => row.applicant.code),
    ["A-0118", "A-0196", "A-0240"],
  ),
);
check(
  "조정으로 달라진 것: 최종 평가와 순위, 달라지지 않은 것은 그대로라고 적는다",
  a090 !== undefined &&
    adjusted090 !== undefined &&
    adjustEffectText(a090, adjusted090) === "최종 평가 82.4 → 83.6점 · 28위 → 26위" &&
    adjustEffectText(adjusted090, a090) === "최종 평가 83.6 → 82.4점 · 26위 → 28위" &&
    adjustEffectText(a090, a090) === "최종 평가 82.4점 그대로 · 28위 그대로" &&
    adjustEffectText({ final10: 824, rank: 28 }, { final10: 826, rank: 28 }) === "최종 평가 82.4 → 82.6점 · 28위 그대로",
);

// 기록 확정
const partsText = (parts: readonly { text: string }[]) => parts.map((part) => part.text).join(" · ");
check(
  "조정의 진행: 처음에는 넷이 모두 남아 있다",
  same(adjustProgressOf(ranked, ELEMENTS, NO_ADJUSTMENTS), { total: 4, done: 0, left: 4 }),
);
check(
  "조정의 진행: 하나를 확정하면 1건 완료, 3건 남음 (조정이 필요했던 지원자는 그대로 넷)",
  same(adjustProgressOf(adjustedRanked, ELEMENTS, oneAdjustment), { total: 4, done: 1, left: 3 }),
);
check(
  "조정의 진행: 확정한 조정이 있어도 크게 갈린 요소가 남았으면 남은 쪽에 센다",
  same(adjustProgressOf(ranked, ELEMENTS, [{ code: "A-0090", members: source090.members }]), { total: 4, done: 0, left: 4 }),
);
check(
  "확인 항목의 글: 서류평가",
  partsText(evaluationCheckParts(312, 3)) === "총 312명 · 위원 3인 제출 완료",
);
check(
  "확인 항목의 글: 위원 간 점수 조정 (모두 완료, 남음, 조정할 것이 없음)",
  partsText(adjustCheckParts({ total: 4, done: 4, left: 0 })) === "4건 조정 필요 · 4건 모두 완료" &&
    partsText(adjustCheckParts({ total: 4, done: 1, left: 3 })) === "4건 조정 필요 · 1건 완료, 3건 남음" &&
    partsText(adjustCheckParts({ total: 0, done: 0, left: 0 })) === "조정이 필요한 지원자 없음",
);
check(
  "확인 항목의 글: 합격선 확인 (시안의 82.0점 · 0.2점 차이, 동점, 합격선의 두 사람이 없을 때)",
  partsText(cutlineCheckParts(cutline)) === "30위 82.0점 · 예비 1번과 0.2점 차이" &&
    (cutline === null || partsText(cutlineCheckParts({ ...cutline, gap10: 0 })) === "30위 82.0점 · 예비 1번과 동점") &&
    partsText(cutlineCheckParts(null)) === "합격선 주변의 지원자가 없음",
);
const confirmRows = confirmRowsOf(ranked);
check(
  "확정할 명단: 순위 순서의 지원자·순위·최종 평가 (12명, 25위부터, 30위 A-0147 820 · 31위 A-0171 818)",
  confirmRows.length === 12 &&
    confirmRows[0].rank === DECISION_FIRST_RANK &&
    same(confirmRows[5], { code: "A-0147", rank: 30, final10: 820 }) &&
    same(confirmRows[6], { code: "A-0171", rank: 31, final10: 818 }),
);
check(
  "명단 견주기: 같은 순위는 같고, 조정으로 점수와 순위가 달라지면 다르다",
  sameConfirmRows(confirmRows, confirmRowsOf(ranked)) &&
    confirmRowsKey(confirmRows) === confirmRowsKey(confirmRowsOf(ranked)) &&
    !sameConfirmRows(confirmRows, confirmRowsOf(adjustedRanked)) &&
    confirmRowsKey(confirmRows) !== confirmRowsKey(confirmRowsOf(adjustedRanked)) &&
    !sameConfirmRows(confirmRows, confirmRows.slice(1)),
);
check(
  "기록의 구분: 모집 인원 안이면 합격권, 그 아래는 예비 순번",
  same(confirmStandingOf({ rank: 30 }, 30), { text: "합격권", admitted: true }) &&
    same(confirmStandingOf({ rank: 31 }, 30), { text: "예비 1", admitted: false }) &&
    same(confirmStandingOf({ rank: 36 }, 30), { text: "예비 6", admitted: false }),
);
const confirmation = { at: "2026-11-21T05:05:00.000Z", actor: "홍길동 사정관", quota: QUOTA, rows: confirmRows };
check(
  "확정한 기록의 저장 값: 쓴 것을 다시 읽으면 같다",
  same(parseDecisionConfirmation(JSON.parse(serializeDecisionConfirmation(confirmation)), CODES), confirmation),
);
check(
  "확정한 기록의 저장 값: 모양이 틀리면 확정한 기록 없음",
  [
    undefined,
    null,
    "x",
    [],
    {},
    { ...confirmation, version: 2 },
    { version: 1, ...confirmation, at: "어제" },
    { version: 1, ...confirmation, actor: " " },
    { version: 1, ...confirmation, quota: 0 },
    { version: 1, ...confirmation, quota: 30.5 },
    { version: 1, ...confirmation, rows: [] },
    { version: 1, ...confirmation, rows: "A-0147" },
  ].every((value) => parseDecisionConfirmation(value, CODES) === null),
);
check(
  "확정한 기록의 저장 값: 줄 하나라도 틀리면(목록에 없는 코드, 되풀이, 순위가 앞 줄보다 크지 않음, 범위 밖의 점수) 통째로 버린다",
  [
    [{ code: "A-9999", rank: 25, final10: 837 }],
    [confirmRows[0], confirmRows[0]],
    [confirmRows[0], { ...confirmRows[1], rank: confirmRows[0].rank }],
    [confirmRows[1], confirmRows[0]],
    [{ ...confirmRows[0], final10: 1001 }],
    [{ ...confirmRows[0], final10: 83.7 }],
    [{ ...confirmRows[0], rank: 0 }],
    [confirmRows[0], 3],
  ].every((rows) => parseDecisionConfirmation({ version: 1, ...confirmation, rows }, CODES) === null),
);

if (failures.length > 0) {
  console.error(`\n선발 결정 검사 ${passed + failures.length}개 사례 중 ${failures.length}개 실패`);
  process.exit(1);
}
console.log(`\n선발 결정 검사 통과: ${passed}개 사례`);
