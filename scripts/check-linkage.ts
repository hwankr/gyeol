// 학년별 연계 검사. 실행(저장소 루트에서): npx tsx scripts/check-linkage.ts
// AI 를 부르지 않는다. 지어낸 입력으로 lib/evaluate/linkage.ts(연결 찾기 요청 만들기·확인, AI 응답 정리), lib/validateResult.ts(연계가 든
// 결과의 형식·내용 확인), lib/applicants/uploaded.ts(올린 지원자에 연계 붙이기, 모양이 틀린 연계 버리기),
// lib/evaluate/uploadedEvaluation.ts·evaluation.ts(분석 결과의 연계 → 평가할 지원자의 자리별 연계, 학년 줄),
// lib/evaluate/sampleLinkage.ts(예시 두 명의 연계가 지금 예시 원문·근거와 맞는지), lib/evaluate/linkagePaths.ts(선의 길)를 확인한다.
// 인자는 받지 않는다.
// 출력: 사례마다 "통과"/"실패" 한 줄, 마지막에 개수. 하나라도 실패하면 종료 코드 1.
// node scripts/check-linkage.ts 로도 돌도록(Node 의 타입 제거 실행) 값 import 는 상대 경로에 .ts 확장자를 붙인다.
import type { AnalysisResult, Linkage } from "../types/analysis.ts";
import { parseUploadedApplicants, withUploadedLinkage, type UploadedApplicant } from "../lib/applicants/uploaded.ts";
import { normalizeAssessment } from "../lib/evaluate/assessment.ts";
import {
  LINKAGE_COLUMN_GRADES,
  evidencesOf,
  findEvaluationApplicant,
  linkCardSource,
  linkageColumns,
  linkageOf,
} from "../lib/evaluate/evaluation.ts";
import {
  LINKAGE_LIMITS,
  buildLinkageRequest,
  normalizeLinkage,
  readLinkageRequest,
  type LinkageRequest,
} from "../lib/evaluate/linkage.ts";
import { gapY, linkShapes, type LinkRect } from "../lib/evaluate/linkagePaths.ts";
import { EVALUATION_APPLICANTS } from "../lib/evaluate/sampleEvaluations.ts";
import { uploadedEvaluationApplicant } from "../lib/evaluate/uploadedEvaluation.ts";
import { EXTRACT_DEFAULTS } from "../lib/pipeline/extractEvidence.ts";
import { prepAnalysisCriteria } from "../lib/prep/analysisCriteria.ts";
import { numberedGroups } from "../lib/prep/criteria.ts";
import { DEFAULT_PREP_CRITERIA } from "../lib/prep/defaultCriteria.ts";
import { isAnalysisResult, isLinkage, linkageProblems, validateResult } from "../lib/validateResult.ts";

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
const CRITERIA = prepAnalysisCriteria(DEFAULT_PREP_CRITERIA);

/** 지어낸 AI 제안 (모든 질문에 4 로 응답). 평가할 지원자로 바꾸려면 AI 제안이 있어야 한다. */
function assessment(): NonNullable<AnalysisResult["assessment"]> {
  const raw = {
    summary: "소비자 선택 탐구를 가격 분석으로 넓힌 학생",
    elements: ELEMENTS.map((element, index) => ({
      id: CRITERIA.criteria[index].id,
      ratings: numberedGroups(element).flatMap((group) => group.questions.map((question) => ({ key: `q${question.number}`, rating: 4 }))),
      confidence: 3,
    })),
    growth: [
      { grade: 1, label: "기초 탐구", index: 40 },
      { grade: 2, label: "심화 탐구", index: 70 },
      { grade: 3, label: "확장", index: 80 },
    ],
  };
  const value = normalizeAssessment(raw, ELEMENTS, CRITERIA.criteria);
  if (value === null) throw new Error("지어낸 AI 제안을 정리하지 못함");
  return value;
}

/** 지어낸 분석 결과: 1·2·3학년 기록과 학년이 없는 기록, 세 기준의 근거 일곱 개 */
function result(): AnalysisResult {
  return {
    criteria: CRITERIA,
    sections: [
      { id: "s1", category: "인적·학적사항", grade: null, page: 1, text: "[이름] [학교명]" },
      { id: "s2", category: "세부능력 및 특기사항", grade: 1, subject: "통합사회", page: 2, text: "소비자 선택을 탐구함. 가격과 접근성을 견줌." },
      {
        id: "s3",
        category: "세부능력 및 특기사항",
        grade: 2,
        subject: "경제",
        page: 3,
        text: "기존 소비자 선택 탐구의 후속 활동으로 가격 인상의 영향을 계산함. 모둠원과 계산표를 고침.",
      },
      { id: "s4", category: "진로활동", grade: 3, page: 4, text: "1학년 소비자 선택, 2학년 가격 탐구로 관심이 넓어진 과정을 정리함." },
      { id: "s5", category: "행동특성 및 종합의견", grade: 3, page: 5, text: "맡은 일을 끝까지 해냄." },
      { id: "s6", category: "자율활동", grade: null, page: 5, text: "학급 회의를 진행함." },
    ],
    evidences: [
      { id: "e1", criterionId: "c1", sectionId: "s2", quote: "소비자 선택을 탐구함.", reason: "관심이 드러남" },
      { id: "e2", criterionId: "c1", sectionId: "s2", quote: "가격과 접근성을 견줌.", reason: "자료를 견줌" },
      { id: "e3", criterionId: "c1", sectionId: "s3", quote: "기존 소비자 선택 탐구의 후속 활동으로 가격 인상의 영향을 계산함.", reason: "후속 탐구" },
      { id: "e4", criterionId: "c1", sectionId: "s4", quote: "1학년 소비자 선택, 2학년 가격 탐구로 관심이 넓어진 과정을 정리함.", reason: "흐름을 정리함" },
      { id: "e5", criterionId: "c2", sectionId: "s3", quote: "모둠원과 계산표를 고침.", reason: "스스로 고침" },
      { id: "e6", criterionId: "c3", sectionId: "s5", quote: "맡은 일을 끝까지 해냄.", reason: "책임감" },
      { id: "e7", criterionId: "c3", sectionId: "s6", quote: "학급 회의를 진행함.", reason: "회의 진행" },
    ],
    masks: [],
    assessment: assessment(),
  };
}

/** AI 가 준 값의 꼴로 적은 지어낸 응답: 묶기, 빠진 근거, 거꾸로·겹친·같은 카드·다른 기준의 연결, 원문에 없는 구절 */
function rawLinkage(): unknown {
  return {
    criteria: [
      {
        id: "c1",
        cards: [
          { evidenceIds: ["e2", "e1"], title: "소비자 선택 탐구", theme: "#소비자", depth: 2 },
          { evidenceIds: ["e3"], title: " 가격 영향\n계산 ", theme: "가격", depth: 3 },
          { evidenceIds: ["e4"], title: "", theme: "진로", depth: 9 },
        ],
        links: [
          { fromEvidenceId: "e1", toEvidenceId: "e3", kind: "stated", statedQuote: "기존  소비자 선택 탐구의\n후속 활동으로", reason: "후속 활동이라고 적음" },
          { fromEvidenceId: "e4", toEvidenceId: "e3", kind: "suggested", statedQuote: "", reason: "거꾸로 준 연결" },
          { fromEvidenceId: "e2", toEvidenceId: "e3", kind: "suggested", statedQuote: "", reason: "겹친 연결" },
          { fromEvidenceId: "e1", toEvidenceId: "e2", kind: "suggested", statedQuote: "", reason: "같은 카드" },
          { fromEvidenceId: "e1", toEvidenceId: "e4", kind: "stated", statedQuote: "원문에 없는 구절", reason: "구절이 없음" },
          { fromEvidenceId: "e1", toEvidenceId: "e5", kind: "suggested", statedQuote: "", reason: "다른 기준의 근거" },
          { fromEvidenceId: "e1", toEvidenceId: "e9", kind: "suggested", statedQuote: "", reason: "없는 근거" },
        ],
      },
      { id: "c2", cards: [], links: [] },
    ],
  };
}

function checkRequest() {
  const source = result();
  const request = buildLinkageRequest(source);
  check(
    "요청 만들기: 기준은 id·이름만, 근거는 id·기준·항목·구절만, 항목은 근거가 든 것만(결과의 순서)",
    same(request.criteria, CRITERIA.criteria.map(({ id, name }) => ({ id, name }))) &&
      same(request.sections.map((section) => section.id), ["s2", "s3", "s4", "s5", "s6"]) &&
      same(request.evidences[0], { id: "e1", criterionId: "c1", sectionId: "s2", quote: "소비자 선택을 탐구함." }) &&
      request.evidences.length === 7 &&
      same(Object.keys(request.sections[0]), ["id", "category", "grade", "subject", "text"]),
  );
  check(
    "요청 만들기: 기준이나 항목이 없는 근거는 넣지 않는다",
    buildLinkageRequest({
      ...source,
      evidences: [...source.evidences, { id: "e8", criterionId: "c9", sectionId: "s2", quote: "소비자 선택을 탐구함.", reason: "" }, { id: "e9", criterionId: "c1", sectionId: "s9", quote: "x", reason: "" }],
    }).evidences.length === 7,
  );
  check("요청 확인: 만든 요청은 그대로 통과한다", same(readLinkageRequest(JSON.parse(JSON.stringify(request))), request));
  check(
    "요청 확인: 다른 키는 결과에 섞이지 않는다",
    same(
      readLinkageRequest({
        criteria: request.criteria.map((criterion) => ({ ...criterion, description: "설명" })),
        sections: request.sections.map((section) => ({ ...section, page: 3 })),
        evidences: request.evidences.map((evidence) => ({ ...evidence, reason: "이유" })),
        extra: true,
      }),
      request,
    ),
  );
  check("요청 확인: 근거가 없어도 기준이 있으면 통과한다", same(readLinkageRequest({ criteria: request.criteria, sections: [], evidences: [] }), { criteria: request.criteria, sections: [], evidences: [] }));

  const bad: [string, unknown][] = [
    ["객체가 아님", [request]],
    ["기준이 없음", { ...request, criteria: [] }],
    ["기준이 일곱", { ...request, criteria: Array.from({ length: 7 }, (_, index) => ({ id: `c${index + 1}`, name: "기준" })) }],
    ["기준 id 가 겹침", { ...request, criteria: [request.criteria[0], request.criteria[0], request.criteria[2]] }],
    ["기준 이름이 빔", { ...request, criteria: request.criteria.map((criterion, index) => (index === 0 ? { ...criterion, name: " " } : criterion)) }],
    ["기준 이름이 31자", { ...request, criteria: request.criteria.map((criterion, index) => (index === 0 ? { ...criterion, name: "가".repeat(31) } : criterion)) }],
    ["항목 id 가 겹침", { ...request, sections: [...request.sections, request.sections[0]] }],
    ["항목 원문이 빔", { ...request, sections: request.sections.map((section, index) => (index === 0 ? { ...section, text: " " } : section)) }],
    ["항목 학년이 0", { ...request, sections: request.sections.map((section, index) => (index === 0 ? { ...section, grade: 0 } : section)) }],
    ["항목 학년이 10", { ...request, sections: request.sections.map((section, index) => (index === 0 ? { ...section, grade: 10 } : section)) }],
    ["근거가 없는 항목이 섞임", { ...request, sections: [...request.sections, { id: "s9", category: "자율활동", grade: 1, text: "근거가 없는 항목" }] }],
    ["근거 id 가 겹침", { ...request, evidences: [...request.evidences, request.evidences[0]] }],
    ["근거의 기준이 없음", { ...request, evidences: request.evidences.map((evidence, index) => (index === 0 ? { ...evidence, criterionId: "c9" } : evidence)) }],
    ["근거의 항목이 없음", { ...request, evidences: request.evidences.map((evidence, index) => (index === 0 ? { ...evidence, sectionId: "s1" } : evidence)) }],
    ["구절이 원문에 없음", { ...request, evidences: request.evidences.map((evidence, index) => (index === 0 ? { ...evidence, quote: "소비자 선택을 탐구했음." } : evidence)) }],
    ["구절이 공백뿐", { ...request, evidences: request.evidences.map((evidence, index) => (index === 0 ? { ...evidence, quote: " " } : evidence)) }],
    [
      "근거가 기준 수 × 12 를 넘음",
      {
        criteria: [request.criteria[0]],
        sections: [request.sections[0]],
        evidences: Array.from({ length: 13 }, (_, index) => ({ id: `x${index}`, criterionId: "c1", sectionId: "s2", quote: "소비자 선택을 탐구함." })),
      },
    ],
  ];
  for (const [name, value] of bad) check(`요청 확인: ${name} → 받지 않는다`, readLinkageRequest(value) === null);
  check("요청 확인: 근거 수 한도는 근거 추출의 상한과 같다", LINKAGE_LIMITS.evidencesPerCriterion === EXTRACT_DEFAULTS.maxPerCriterion);
}

function checkNormalize(): Linkage {
  const source = result();
  const request = buildLinkageRequest(source);
  const linkage = normalizeLinkage(rawLinkage(), request);
  check("정리: 쓸 수 없는 응답은 null", normalizeLinkage(null, request) === null && normalizeLinkage({}, request) === null && normalizeLinkage({ criteria: "c1" }, request) === null);
  if (linkage === null) {
    check("정리: 지어낸 응답을 정리한다", false);
    return { cards: [], links: [] };
  }
  check(
    "정리: 카드는 기준·항목·원문 순서로 k1…, 묶은 근거는 원문 순서, 빠진 근거는 하나짜리 카드, 학년이 없는 항목의 근거는 카드가 아니다",
    same(
      linkage.cards.map((card) => [card.id, card.criterionId, card.sectionId, card.evidenceIds]),
      [
        ["k1", "c1", "s2", ["e1", "e2"]],
        ["k2", "c1", "s3", ["e3"]],
        ["k3", "c1", "s4", ["e4"]],
        ["k4", "c2", "s3", ["e5"]],
        ["k5", "c3", "s5", ["e6"]],
      ],
    ),
    JSON.stringify(linkage.cards.map((card) => [card.id, card.sectionId, card.evidenceIds])),
  );
  check(
    "정리: 제목은 한 줄(비면 과목, 과목이 없으면 항목명), 태그는 # 을 떼고, 깊이는 1~3 이 아니면 null",
    same(
      linkage.cards.map((card) => [card.title, card.theme, card.depth]),
      [
        ["소비자 선택 탐구", "소비자", 2],
        ["가격 영향 계산", "가격", 3],
        ["진로활동", "진로", null],
        ["경제", "", null],
        ["행동특성 및 종합의견", "", null],
      ],
    ),
    JSON.stringify(linkage.cards.map((card) => [card.title, card.theme, card.depth])),
  );
  check(
    "정리: 연결은 카드로 바꾸고, 거꾸로면 앞뒤를 바꾸고, 겹친·같은 카드·다른 기준·없는 근거의 연결은 버린다",
    same(
      linkage.links.map((link) => [link.id, link.criterionId, link.fromCardId, link.toCardId, link.kind, link.reason]),
      [
        ["n1", "c1", "k1", "k2", "stated", "후속 활동이라고 적음"],
        ["n2", "c1", "k2", "k3", "suggested", "거꾸로 준 연결"],
        ["n3", "c1", "k1", "k3", "suggested", "구절이 없음"],
      ],
    ),
    JSON.stringify(linkage.links),
  );
  check(
    "정리: 기록에 적힌 표현은 원문에 적힌 그대로의 구절로 바꾸고 그 항목을 적는다. 원문에 없으면 AI 가 제안한 연관으로 내린다",
    linkage.links[0].statedQuote === "기존 소비자 선택 탐구의 후속 활동으로" &&
      linkage.links[0].statedSectionId === "s3" &&
      !("statedQuote" in linkage.links[2]) &&
      !("statedSectionId" in linkage.links[2]),
  );
  check("정리: 정리한 연계는 결과와 맞는다", linkageProblems(source, linkage).length === 0, linkageProblems(source, linkage).join(" / "));

  const fromSide = normalizeLinkage(
    { criteria: [{ id: "c1", cards: [], links: [{ fromEvidenceId: "e1", toEvidenceId: "e4", kind: "stated", statedQuote: "소비자 선택을 탐구함", reason: "앞 기록의 표현" }] }] },
    request,
  );
  check(
    "정리: 기록에 적힌 표현이 앞 카드의 항목에만 있으면 그 항목을 적는다",
    fromSide !== null && fromSide.links.length === 1 && fromSide.links[0].kind === "stated" && fromSide.links[0].statedSectionId === "s2",
  );

  const split = normalizeLinkage(
    { criteria: [{ id: "c1", cards: [{ evidenceIds: ["e1", "e3", "e5"], title: "묶음", theme: "", depth: 1 }, { evidenceIds: ["e1", "e2"], title: "둘째", theme: "", depth: 1 }], links: [] }] },
    request,
  );
  check(
    "정리: 다른 항목·다른 기준의 근거는 카드에서 빼고, 한 근거는 먼저 나온 카드에만 든다",
    split !== null &&
      same(
        split.cards.filter((card) => card.criterionId === "c1").map((card) => [card.sectionId, card.evidenceIds, card.title]),
        [
          ["s2", ["e1"], "묶음"],
          ["s2", ["e2"], "둘째"],
          ["s3", ["e3"], "경제"],
          ["s4", ["e4"], "진로활동"],
        ],
      ),
    JSON.stringify(split?.cards),
  );

  const empty = normalizeLinkage({ criteria: [] }, request);
  check("정리: 응답에 기준이 없으면 근거 하나짜리 카드만 있고 연결은 없다", empty !== null && empty.cards.length === 6 && empty.links.length === 0);

  // 1학년 항목 셋 × 2학년 항목 셋의 근거 여섯 개로 서로 다른 연결 아홉 개를 준다.
  const many: LinkageRequest = {
    criteria: [{ id: "c1", name: "잠재역량" }],
    sections: [1, 1, 1, 2, 2, 2].map((grade, index) => ({ id: `m${index}`, category: "세부능력 및 특기사항", grade, text: `기록 ${index}` })),
    evidences: Array.from({ length: 6 }, (_, index) => ({ id: `v${index}`, criterionId: "c1", sectionId: `m${index}`, quote: `기록 ${index}` })),
  };
  const nine = normalizeLinkage(
    {
      criteria: [
        {
          id: "c1",
          cards: [],
          links: [0, 1, 2].flatMap((from) => [3, 4, 5].map((to) => ({ fromEvidenceId: `v${from}`, toEvidenceId: `v${to}`, kind: "suggested", statedQuote: "", reason: `${from}→${to}` }))),
        },
      ],
    },
    many,
  );
  check(
    "정리: 기준마다 연결은 여덟 개까지(앞의 것만), 이유가 빈 연결은 버린다",
    nine !== null &&
      nine.links.length === LINKAGE_LIMITS.linksPerCriterion &&
      nine.links[7].reason === "2→4" &&
      normalizeLinkage({ criteria: [{ id: "c1", cards: [], links: [{ fromEvidenceId: "v0", toEvidenceId: "v3", kind: "suggested", statedQuote: "", reason: " " }] }] }, many)?.links.length === 0,
  );
  check(
    "정리: 긴 제목·태그·이유는 한도까지 자른다",
    (() => {
      const long = normalizeLinkage(
        {
          criteria: [
            {
              id: "c1",
              cards: [{ evidenceIds: ["v0"], title: "가".repeat(40), theme: "나".repeat(40), depth: 1 }],
              links: [{ fromEvidenceId: "v0", toEvidenceId: "v3", kind: "suggested", statedQuote: "", reason: "다".repeat(200) }],
            },
          ],
        },
        many,
      );
      return long !== null && long.cards[0].title.length === 24 && long.cards[0].theme.length === 12 && long.links[0].reason.length === 120;
    })(),
  );
  return linkage;
}

function checkValidate(linkage: Linkage) {
  const source = result();
  const withLinkage: AnalysisResult = { ...source, linkage };
  check("결과 확인: 연계가 없어도, 맞는 연계가 있어도 결과 모양이다", isAnalysisResult(source) && isAnalysisResult(withLinkage) && isLinkage(linkage));
  check(
    "결과 확인: 모양이 틀린 연계가 든 값은 결과 모양이 아니다",
    !isAnalysisResult({ ...source, linkage: { cards: "k1", links: [] } }) &&
      !isAnalysisResult({ ...source, linkage: { cards: [], links: [{ ...linkage.links[0], kind: "maybe" }] } }) &&
      !isLinkage({ cards: [{ ...linkage.cards[0], depth: "2" }], links: [] }) &&
      !isLinkage({ cards: [{ ...linkage.cards[0], depth: 5 }], links: [] }) &&
      !isLinkage({ cards: [{ ...linkage.cards[0], depth: 1.5 }], links: [] }) &&
      isLinkage({ cards: [{ ...linkage.cards[0], depth: null }], links: [] }) &&
      !isLinkage(null),
  );
  check("결과 확인: 맞는 연계는 문제가 없다", validateResult(withLinkage).length === 0, validateResult(withLinkage).join(" / "));

  const card = (index: number, changes: Record<string, unknown>): Linkage => ({
    cards: linkage.cards.map((item, position) => (position === index ? ({ ...item, ...changes } as Linkage["cards"][number]) : item)),
    links: linkage.links,
  });
  const link = (index: number, changes: Record<string, unknown>): Linkage => ({
    cards: linkage.cards,
    links: linkage.links.map((item, position) => (position === index ? ({ ...item, ...changes } as Linkage["links"][number]) : item)),
  });
  const broken: [string, Linkage, string][] = [
    ["카드 id 가 겹침", card(1, { id: "k1" }), "연계 카드 id 중복: k1"],
    ["카드의 기준이 없음", card(0, { criterionId: "c9" }), "연계 카드 k1"],
    ["카드의 항목이 없음", card(0, { sectionId: "s9" }), "연계 카드 k1"],
    ["카드의 항목에 학년이 없음", card(4, { sectionId: "s6", evidenceIds: ["e7"] }), "연계 카드 k5"],
    ["카드의 제목이 빔", card(0, { title: " " }), "연계 카드 k1"],
    ["카드의 깊이가 5", card(0, { depth: 5 }), "연계 카드 k1"],
    ["카드에 근거가 없음", card(0, { evidenceIds: [] }), "연계 카드 k1"],
    ["카드에 없는 근거", card(0, { evidenceIds: ["e1", "e9"] }), "연계 카드 k1"],
    ["카드에 다른 기준의 근거", card(1, { evidenceIds: ["e3", "e5"] }), "연계 카드 k2"],
    ["근거가 두 카드에 듦", card(1, { sectionId: "s2", evidenceIds: ["e1"] }), "연계 카드 k2"],
    ["연결 id 가 겹침", link(1, { id: "n1" }), "연계 연결 id 중복: n1"],
    ["연결의 카드가 없음", link(0, { toCardId: "k9" }), "연계 연결 n1"],
    ["연결의 앞뒤 카드가 같음", link(1, { toCardId: "k2" }), "연계 연결 n2"],
    ["연결의 기준이 카드와 다름", link(1, { criterionId: "c2" }), "연계 연결 n2"],
    ["연결의 학년이 거꾸로", link(1, { fromCardId: "k3", toCardId: "k2" }), "연계 연결 n2"],
    ["연결의 이유가 빔", link(1, { reason: " " }), "연계 연결 n2"],
    ["기록에 적힌 연속인데 구절이 없음", link(0, { statedQuote: undefined }), "연계 연결 n1"],
    ["기록에 적힌 표현이 원문에 없음", link(0, { statedQuote: "원문에 없는 구절" }), "연계 연결 n1"],
    ["기록에 적힌 표현의 항목이 두 카드의 것이 아님", link(0, { statedSectionId: "s4" }), "연계 연결 n1"],
    ["AI 가 제안한 연관인데 구절이 있음", link(1, { statedQuote: "가격", statedSectionId: "s3" }), "연계 연결 n2"],
  ];
  for (const [name, value, prefix] of broken) {
    const problems = linkageProblems(source, value);
    check(`결과 확인: ${name} → 문제로 적는다`, problems.some((problem) => problem.startsWith(prefix)), problems.join(" / "));
  }
  check(
    "결과 확인: 문제 문장에는 제목·태그·구절·이유의 글이 들어가지 않는다",
    broken.every(([, value]) =>
      linkageProblems(source, value).every((problem) => !problem.includes("소비자 선택 탐구") && !problem.includes("후속 활동") && !problem.includes("거꾸로 준")),
    ),
  );
}

function checkUploaded(linkage: Linkage) {
  const item = (code: string, at: string, value: AnalysisResult): UploadedApplicant => ({ code, at, result: value });
  const first = item("A-0315", "2026-11-21T01:00:00.000Z", result());
  const second = item("A-0316", "2026-11-21T02:00:00.000Z", result());
  const items = [first, second];
  const changed = withUploadedLinkage(items, "A-0316", second.at, linkage);
  check(
    "붙이기: 코드와 남긴 때가 같은 지원자의 결과에만 연계를 붙이고 나머지와 받은 목록은 그대로다",
    changed !== null &&
      changed[0] === first &&
      changed[1].code === "A-0316" &&
      changed[1].at === second.at &&
      same(changed[1].result.linkage, linkage) &&
      same({ ...changed[1].result, linkage: undefined }, second.result) &&
      second.result.linkage === undefined &&
      items[1] === second,
  );
  check(
    "붙이기: 코드나 남긴 때가 다르면 붙이지 않는다",
    withUploadedLinkage(items, "A-0317", second.at, linkage) === null && withUploadedLinkage(items, "A-0316", first.at, linkage) === null,
  );
  const stored = { version: 1, items: [item("A-0315", first.at, { ...result(), linkage }), { code: "A-0316", at: second.at, result: { ...result(), linkage: { cards: "k1" } } }] };
  const parsed = parseUploadedApplicants(JSON.parse(JSON.stringify(stored)));
  check(
    "저장소 읽기: 연계가 든 지원자는 그대로, 연계의 모양만 틀린 지원자는 연계를 빼고 남긴다",
    parsed.length === 2 && same(parsed[0].result.linkage, linkage) && parsed[1].code === "A-0316" && parsed[1].result.linkage === undefined && parsed[1].result.evidences.length === 7,
  );

  const applicant = uploadedEvaluationApplicant(item("A-0315", first.at, { ...result(), linkage }), ELEMENTS);
  const plain = uploadedEvaluationApplicant(first, ELEMENTS);
  if (applicant === null || plain === null) {
    check("연결: 분석 결과를 평가할 지원자로 바꾼다", false);
    return;
  }
  check("연결: 연계가 없는 분석의 지원자에는 연계가 없다", plain.linkage === undefined && linkageOf(plain, 0, ELEMENTS.length) === null);
  const slot = linkageOf(applicant, 0, ELEMENTS.length);
  check(
    "연결: 카드는 자리별로, 근거는 그 자리의 근거 문장 id 로, 항목은 서류 원문으로 옮긴다",
    slot !== null &&
      applicant.linkage?.length === ELEMENTS.length &&
      same(
        slot.cards.map((card) => [card.id, card.passageId, card.grade, card.title, card.theme, card.depth, card.evidenceIds]),
        [
          ["k1", "A-0315-p1", 1, "소비자 선택 탐구", "소비자", 2, ["A-0315-e0-0", "A-0315-e0-1"]],
          ["k2", "A-0315-p2", 2, "가격 영향 계산", "가격", 3, ["A-0315-e0-2"]],
          ["k3", "A-0315-p3", 3, "진로활동", "진로", null, ["A-0315-e0-3"]],
        ],
      ),
    JSON.stringify(slot?.cards),
  );
  check(
    "연결: 카드의 근거는 모두 그 자리의 근거 문장이다",
    ELEMENTS.every((_, index) => {
      const ids = new Set(evidencesOf(applicant, index, ELEMENTS.length).map((evidence) => evidence.id));
      return (linkageOf(applicant, index, ELEMENTS.length)?.cards ?? []).every((card) => card.evidenceIds.every((id) => ids.has(id)));
    }),
  );
  check(
    "연결: 연결은 같은 자리의 카드끼리, 기록에 적힌 표현은 그 구절이 든 서류 원문과 함께",
    slot !== null &&
      same(
        slot.links.map((link) => [link.id, link.fromCardId, link.toCardId, link.kind, link.stated, link.reason]),
        [
          ["n1", "k1", "k2", "stated", { quote: "기존 소비자 선택 탐구의 후속 활동으로", passageId: "A-0315-p2" }, "후속 활동이라고 적음"],
          ["n2", "k2", "k3", "suggested", null, "거꾸로 준 연결"],
          ["n3", "k1", "k3", "suggested", null, "구절이 없음"],
        ],
      ),
    JSON.stringify(slot?.links),
  );
  check(
    "연결: 다른 자리에는 그 자리의 카드만 있고, 요소가 자리보다 적으면 뒤 자리는 빈 연계다",
    same(linkageOf(applicant, 1, ELEMENTS.length)?.cards.map((card) => card.id), ["k4"]) &&
      same(linkageOf(applicant, 2, ELEMENTS.length)?.cards.map((card) => card.id), ["k5"]) &&
      linkageOf(applicant, 2, ELEMENTS.length)?.links.length === 0,
  );
  const column = slot === null ? [] : linkageColumns(applicant, slot);
  check(
    "연결: 학년 줄은 1·2·3학년 셋이고 그 학년의 카드가 서류 원문 순서로 놓인다",
    same(LINKAGE_COLUMN_GRADES, [1, 2, 3]) && same(column.map((cards) => cards.map((card) => card.id)), [["k1"], ["k2"], ["k3"]]),
  );
  // 서류 원문에는 인적·학적사항(s1)이 없어 원문 목록은 s2 부터다.
  check("연결: 카드의 출처는 서류 구분 · 과목이다", linkCardSource(applicant.passages[1]) === "세특 · 경제" && linkCardSource(applicant.passages[2]) === "창체 · 진로활동");

  const loose: Linkage = {
    cards: [...linkage.cards, { id: "k9", criterionId: "c1", sectionId: "s1", evidenceIds: ["e1"], title: "원문에 없는 항목", theme: "", depth: 1 }, { id: "k8", criterionId: "c1", sectionId: "s3", evidenceIds: ["e99"], title: "없는 근거", theme: "", depth: 1 }],
    links: [...linkage.links, { id: "n8", criterionId: "c1", fromCardId: "k3", toCardId: "k1", kind: "suggested", reason: "학년이 거꾸로" }, { id: "n9", criterionId: "c1", fromCardId: "k1", toCardId: "k4", kind: "suggested", reason: "다른 자리" }],
  };
  const guarded = uploadedEvaluationApplicant(item("A-0315", first.at, { ...result(), linkage: loose }), ELEMENTS);
  check(
    "연결: 내용이 어긋난 카드·연결(원문에 없는 항목, 없는 근거, 거꾸로인 학년, 다른 자리)은 옮기지 않는다",
    guarded !== null && same(guarded.linkage?.[0].cards.map((card) => card.id), ["k1", "k2", "k3"]) && same(guarded.linkage?.[0].links.map((link) => link.id), ["n1", "n2", "n3"]),
  );
}

function checkSample() {
  const withLinkage = EVALUATION_APPLICANTS.filter((applicant) => applicant.linkage !== undefined).map((applicant) => applicant.code);
  check("예시: 연계 예시는 A-0085 와 A-0118 두 명에게만 있다", same(withLinkage, ["A-0085", "A-0118"]), withLinkage.join(", "));
  check(
    "예시: 평가가 남은 세 명에게는 연계가 없다",
    ["A-0133", "A-0187", "A-0251"].every((code) => {
      const applicant = findEvaluationApplicant(EVALUATION_APPLICANTS, code);
      return applicant !== undefined && linkageOf(applicant, 0, 3) === null;
    }),
  );

  /** 지원자마다: 자리별 학년 줄의 카드 수, 세 학년이 이어져야 하는 자리 */
  const expected: [string, number[][], number[]][] = [
    ["A-0085", [[0, 0, 2], [1, 2, 1], [1, 1, 1]], [1, 2]],
    ["A-0118", [[1, 1, 1], [1, 2, 2], [0, 0, 1]], [0, 1]],
  ];
  for (const [code, counts, fullSlots] of expected) {
    const applicant = findEvaluationApplicant(EVALUATION_APPLICANTS, code);
    if (applicant === undefined || applicant.linkage === undefined) {
      check(`예시 ${code}: 연계가 있다`, false);
      continue;
    }
    const slots = [0, 1, 2].map((index) => linkageOf(applicant, index, 3));
    check(
      `예시 ${code}: 자리마다 학년 줄의 카드 수`,
      same(slots.map((slot) => (slot === null ? [] : linkageColumns(applicant, slot).map((cards) => cards.length))), counts),
      JSON.stringify(slots.map((slot) => (slot === null ? [] : linkageColumns(applicant, slot).map((cards) => cards.length)))),
    );
    check(
      `예시 ${code}: 카드의 근거는 그 자리의 근거 문장이고, 그 자리의 근거 문장은 모두 한 카드에 들어 있다`,
      slots.every((slot, index) => {
        if (slot === null) return false;
        const evidences = evidencesOf(applicant, index, 3);
        const inCards = slot.cards.flatMap((card) => card.evidenceIds);
        const passageOf = new Map(evidences.map((evidence) => [evidence.id, evidence.place?.passageId]));
        return (
          new Set(inCards).size === inCards.length &&
          same([...inCards].sort(), evidences.map((evidence) => evidence.id).sort()) &&
          slot.cards.every((card) => card.evidenceIds.length > 0 && card.evidenceIds.every((id) => passageOf.get(id) === card.passageId))
        );
      }),
    );
    check(
      `예시 ${code}: 카드의 학년은 그 원문의 학년이고 제목·태그는 한도 안이다`,
      slots.every(
        (slot) =>
          slot !== null &&
          slot.cards.every((card) => {
            const passage = applicant.passages.find((item) => item.id === card.passageId);
            return passage?.grade === card.grade && card.title.trim() !== "" && card.title.length <= LINKAGE_LIMITS.titleLength && card.theme.length <= LINKAGE_LIMITS.themeLength;
          }),
      ),
    );
    check(
      `예시 ${code}: 선은 같은 자리의 앞 학년 카드에서 뒤 학년 카드로 가고 이유가 있다`,
      slots.every(
        (slot) =>
          slot !== null &&
          slot.links.every((link) => {
            const from = slot.cards.find((card) => card.id === link.fromCardId);
            const to = slot.cards.find((card) => card.id === link.toCardId);
            return from !== undefined && to !== undefined && from.grade < to.grade && link.reason.trim() !== "" && link.reason.length <= LINKAGE_LIMITS.reasonLength;
          }),
      ),
    );
    check(
      `예시 ${code}: 기록에 적힌 연속은 그 표현이 앞이나 뒤 카드의 원문에 글자 그대로 있을 때만이다`,
      slots.every(
        (slot) =>
          slot !== null &&
          slot.links.every((link) => {
            if (link.kind === "suggested") return link.stated === null;
            const stated = link.stated;
            const from = slot.cards.find((card) => card.id === link.fromCardId);
            const to = slot.cards.find((card) => card.id === link.toCardId);
            const passage = applicant.passages.find((item) => item.id === stated?.passageId);
            const text = passage?.segments.map((segment) => segment.text).join("") ?? "";
            return stated !== null && stated.quote.trim() !== "" && text.includes(stated.quote) && (stated.passageId === from?.passageId || stated.passageId === to?.passageId);
          }),
      ),
    );
    check(
      `예시 ${code}: 세 학년이 다 있는 두 자리에서 선이 1학년 → 2학년 → 3학년으로 이어진다`,
      fullSlots.every((index) => {
        const slot = slots[index];
        if (slot === null || slot.links.length < 2) return false;
        const gradeOf = new Map(slot.cards.map((card) => [card.id, card.grade]));
        // 1학년 카드에서 나간 선이 닿은 2학년 카드에서 다시 3학년 카드로 나가는 선이 있는지
        return slot.links.some(
          (first) =>
            gradeOf.get(first.fromCardId) === 1 &&
            gradeOf.get(first.toCardId) === 2 &&
            slot.links.some((second) => second.fromCardId === first.toCardId && gradeOf.get(second.toCardId) === 3),
        );
      }),
    );
  }
  const stated = EVALUATION_APPLICANTS.flatMap((applicant) => (applicant.linkage ?? []).flatMap((slot) => slot.links.filter((link) => link.kind === "stated").map((link) => `${applicant.code}:${link.stated?.quote}`)));
  check("예시: 기록에 적힌 연속은 A-0118 의 한 곳이다", same(stated, ["A-0118:다음 탐구 주제로 삼음"]), stated.join(", "));

  const sample = findEvaluationApplicant(EVALUATION_APPLICANTS, "A-0187");
  check(
    "예시: 원문과 근거는 그대로다 (A-0187 의 근거 수 2·3·1, 지원자마다 원문 7건)",
    sample !== undefined &&
      same([0, 1, 2].map((index) => evidencesOf(sample, index, 3).length), [2, 3, 1]) &&
      EVALUATION_APPLICANTS.every((applicant) => applicant.passages.length === 7),
  );
}

/** 선의 길(path 의 d)에서 숫자만 꺼낸다 */
function numbersOf(path: string): number[] {
  return (path.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
}

function checkPaths() {
  // 세 줄: 1학년 a(위)·b(아래), 2학년 m1(위)·m2(아래), 3학년 z. 카드는 너비 100, 높이 60, 줄 사이 40, 위아래 틈 12.
  const rects: Record<string, LinkRect> = {
    a: { left: 0, top: 20, right: 100, bottom: 80 },
    b: { left: 0, top: 92, right: 100, bottom: 152 },
    m1: { left: 140, top: 20, right: 240, bottom: 80 },
    m2: { left: 140, top: 92, right: 240, bottom: 152 },
    z: { left: 280, top: 20, right: 380, bottom: 80 },
  };
  const none = () => [] as LinkRect[];
  const [near] = linkShapes([{ id: "n1", fromId: "a", toId: "m1" }], rects, none);
  const nearNumbers = numbersOf(near.path);
  check(
    "선: 이웃한 줄 사이의 선은 앞 카드의 오른쪽 변 가운데에서 나가 화살표 머리의 밑변에서 끝나고, 머리의 끝은 뒤 카드의 왼쪽 변 바로 앞이다",
    same(nearNumbers.slice(0, 2), [100, 50]) && same(nearNumbers.slice(-2), [131, 50]) && near.arrow === "138,50 131,46 131,54" && !near.path.includes("L"),
    `${near.path} / ${near.arrow}`,
  );

  const fan = linkShapes(
    [
      { id: "n1", fromId: "a", toId: "m2" },
      { id: "n2", fromId: "a", toId: "m1" },
      { id: "n3", fromId: "b", toId: "m1" },
    ],
    rects,
    none,
  );
  const startY = (id: string) => numbersOf(fan.find((shape) => shape.id === id)?.path ?? "")[1];
  const endY = (id: string) => numbersOf(fan.find((shape) => shape.id === id)?.path ?? "").slice(-1)[0];
  check(
    "선: 한 카드에서 여러 선이 나가거나 들어오면 그 변을 고르게 나누고, 상대 카드가 위에 있는 선이 위쪽에 닿는다",
    startY("n2") === 40 && startY("n1") === 60 && endY("n2") === 40 && endY("n3") === 60 && startY("n3") === 122 && endY("n1") === 122,
    fan.map((shape) => shape.path).join(" / "),
  );

  const between = [rects.m1, rects.m2];
  const [skip] = linkShapes([{ id: "n1", fromId: "a", toId: "z" }], rects, () => between);
  const horizontal = /L(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/.exec(skip.path);
  const y = horizontal === null ? Number.NaN : Number(horizontal[2]);
  check(
    "선: 줄을 건너뛰는 선은 가운데 줄의 카드 위를 지나지 않고 카드 밖의 높이로 그 줄을 가로지른다",
    horizontal !== null && Number(horizontal[1]) === 240 && between.every((rect) => y < rect.top || y > rect.bottom),
    skip.path,
  );
  check(
    "선: 가로지르는 높이는 카드 사이의 틈·맨 위·맨 아래 가운데 바라는 높이에 가장 가까운 것이다",
    gapY(between, 50) === 14 && gapY(between, 90) === 86 && gapY(between, 200) === 158 && gapY([], 77) === 77 && gapY([rects.m1], 60) === 86,
    [gapY(between, 50), gapY(between, 90), gapY(between, 200), gapY([rects.m1], 60)].join(", "),
  );
  check(
    "선: 자리를 모르는 카드에 닿은 선은 그리지 않는다",
    linkShapes([{ id: "n1", fromId: "a", toId: "x" }, { id: "n2", fromId: "a", toId: "m1" }], rects, none).map((shape) => shape.id).join() === "n2",
  );
}

checkRequest();
checkPaths();
const normalized = checkNormalize();
checkValidate(normalized);
checkUploaded(normalized);
checkSample();

if (failures.length > 0) {
  console.error(`\n학년별 연계 검사 ${passed + failures.length}개 사례 중 ${failures.length}개 실패`);
  process.exit(1);
}
console.log(`\n학년별 연계 검사 통과: ${passed}개 사례`);
