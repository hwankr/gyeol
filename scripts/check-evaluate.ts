// 평가하기의 AI 제안 정리와 올린 지원자 연결 검사. 실행(저장소 루트에서): npx tsx scripts/check-evaluate.ts
// AI 를 부르지 않는다. 지어낸 입력으로 lib/evaluate/assessment.ts(AI 응답 → 점수·신뢰도·태그), lib/prep/analysisCriteria.ts(지문),
// lib/validateResult.ts(AI 제안이 든 결과의 형식·내용 확인), lib/evaluate/uploadedEvaluation.ts(분석 결과 → 평가할 지원자),
// lib/evaluate/evaluation.ts(저장한 평가 읽기, 평가를 분석에 묶기, 예시 지원자의 근거), lib/applicants/original.ts(원문보기에 보여 줄 결과)를
// 확인한다. 인자는 받지 않는다.
// 출력: 사례마다 "통과"/"실패" 한 줄, 마지막에 개수. 하나라도 실패하면 종료 코드 1.
// node scripts/check-evaluate.ts 로도 돌도록(Node 의 타입 제거 실행) 값 import 는 상대 경로에 .ts 확장자를 붙인다.
import type { AnalysisResult, Assessment } from "../types/analysis.ts";
import { originalRecordOf } from "../lib/applicants/original.ts";
import type { UploadedApplicant } from "../lib/applicants/uploaded.ts";
import { NO_GROWTH_LABEL, NO_SUMMARY, normalizeAssessment, withEvidenceConfidence } from "../lib/evaluate/assessment.ts";
import {
  EMPTY_EVALUATION,
  MAX_UPLOADED_EVALUATIONS,
  assessmentOf,
  assessmentTags,
  documentAreasOf,
  effectiveRecord,
  evaluationBasis,
  evidencesOf,
  findEvaluationApplicant,
  parseEvaluations,
  queuePosition,
  segmentTone,
  slotOf,
} from "../lib/evaluate/evaluation.ts";
import { EVALUATION_APPLICANTS } from "../lib/evaluate/sampleEvaluations.ts";
import {
  assessmentFor,
  evaluationApplicants,
  splitBySlots,
  uploadedEvaluationApplicant,
} from "../lib/evaluate/uploadedEvaluation.ts";
import { PREP_CRITERIA_ID, prepAnalysisCriteria, rubricFingerprint } from "../lib/prep/analysisCriteria.ts";
import { numberedGroups, type PrepCriteria, type PrepElement } from "../lib/prep/criteria.ts";
import { DEFAULT_PREP_CRITERIA } from "../lib/prep/defaultCriteria.ts";
import { buildPdfPages } from "../lib/recordPdfMarks.ts";
import { isAnalysisResult, validateResult } from "../lib/validateResult.ts";

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

const PREP = DEFAULT_PREP_CRITERIA;
const ELEMENTS = PREP.elements;
const CRITERIA = prepAnalysisCriteria(PREP);

/** 그 요소의 질문 key 목록 (q1 …) */
function keysOf(element: PrepElement): string[] {
  return numberedGroups(element).flatMap((group) => group.questions.map((question) => `q${question.number}`));
}

/** 모든 질문에 같은 값으로 응답한 AI 응답 (지어낸 값) */
function rawWith(rating: number, confidence = 3): { summary: string; elements: Record<string, unknown>[]; growth: unknown[] } {
  return {
    summary: "가격 전략 탐구를 스스로 넓혀 간 학생",
    elements: ELEMENTS.map((element, index) => ({
      id: CRITERIA.criteria[index].id,
      ratings: keysOf(element).map((key) => ({ key, rating })),
      confidence,
    })),
    growth: [
      { grade: 1, label: "기초 탐구", index: 40 },
      { grade: 2, label: "심화 · 프로젝트", index: 70 },
      { grade: 3, label: "융합 · 확장", index: 85 },
    ],
  };
}

// ---------------------------------------------------------------- AI 응답 정리

function checkNormalize() {
  {
    const result = normalizeAssessment(rawWith(4), ELEMENTS, CRITERIA.criteria);
    check(
      "정리: 모든 질문에 4 로 응답하면 요소마다 80점이고 기준 id 가 순서대로 붙는다",
      result !== null &&
        same(
          result.elements.map((element) => [element.criterionId, element.score, element.confidence]),
          CRITERIA.criteria.map((criterion) => [criterion.id, 80, 3]),
        ),
      JSON.stringify(result?.elements),
    );
    check(
      "정리: 지문은 지금 평가 기준의 지문이고 성장은 1·2·3학년 세 건이다",
      result !== null &&
        result.rubric === rubricFingerprint(ELEMENTS) &&
        same(result.growth, [
          { grade: 1, label: "기초 탐구", index: 40 },
          { grade: 2, label: "심화 · 프로젝트", index: 70 },
          { grade: 3, label: "융합 · 확장", index: 85 },
        ]),
    );
    check(
      "정리: 묶음 평균이 모두 4 면 앞의 두 묶음의 태그가 붙는다",
      result !== null && same(result.elements[0].tags, ELEMENTS[0].groups.slice(0, 2).map((group) => group.tag)),
      JSON.stringify(result?.elements[0].tags),
    );
  }

  {
    // 첫 요소: 첫 묶음은 3, 둘째 묶음은 5, 셋째 묶음은 4, 나머지 3 → 태그는 평균이 높은 순서(둘째, 셋째)
    const raw = rawWith(3);
    const groups = numberedGroups(ELEMENTS[0]);
    const byKey = new Map<string, number>();
    groups[1]?.questions.forEach((question) => byKey.set(`q${question.number}`, 5));
    groups[2]?.questions.forEach((question) => byKey.set(`q${question.number}`, 4));
    raw.elements[0] = {
      id: CRITERIA.criteria[0].id,
      ratings: keysOf(ELEMENTS[0]).map((key) => ({ key, rating: byKey.get(key) ?? 3 })),
      confidence: 4,
    };
    const result = normalizeAssessment(raw, ELEMENTS, CRITERIA.criteria);
    const values = keysOf(ELEMENTS[0]).map((key) => byKey.get(key) ?? 3);
    const expected = Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 20);
    check(
      "정리: 점수는 응답 평균 × 20 의 반올림이고 태그는 평균 4 이상인 묶음을 높은 순서로 둘까지",
      result !== null &&
        result.elements[0].score === expected &&
        same(result.elements[0].tags, [ELEMENTS[0].groups[1].tag, ELEMENTS[0].groups[2].tag]),
      JSON.stringify(result?.elements[0]),
    );
    check("정리: 평균이 4 보다 낮은 요소에는 태그가 없다", result !== null && same(result.elements[1].tags, []));
  }

  {
    const raw = rawWith(5, 4);
    const keys = keysOf(ELEMENTS[1]);
    raw.elements[1] = {
      id: CRITERIA.criteria[1].id,
      // 첫 질문만 응답(같은 key 가 또 나오면 앞의 것), 없는 key·범위 밖·소수는 쓰지 않는다
      ratings: [
        { key: keys[0], rating: 2 },
        { key: keys[0], rating: 5 },
        { key: "q99", rating: 5 },
        { key: keys[1], rating: 6 },
        { key: keys[2], rating: 3.5 },
      ],
      confidence: 4,
    };
    const result = normalizeAssessment(raw, ELEMENTS, CRITERIA.criteria);
    check(
      "정리: 응답이 빠진 질문이 있으면 응답한 것만으로 점수를 내고 신뢰도는 2 를 넘지 않는다",
      result !== null && result.elements[1].score === 40 && result.elements[1].confidence === 2,
      JSON.stringify(result?.elements[1]),
    );
  }

  {
    const raw = rawWith(4);
    raw.elements[2] = { id: CRITERIA.criteria[2].id, ratings: keysOf(ELEMENTS[2]).map((key) => ({ key, rating: 4 })), confidence: 9 };
    const result = normalizeAssessment(raw, ELEMENTS, CRITERIA.criteria);
    check("정리: 신뢰도가 1~4 정수가 아니면 1 이다", result !== null && result.elements[2].confidence === 1);
  }

  {
    const missing = rawWith(4);
    missing.elements.pop();
    check("정리: 응답에 빠진 요소가 있으면 쓰지 않는다(null)", normalizeAssessment(missing, ELEMENTS, CRITERIA.criteria) === null);

    const empty = rawWith(4);
    empty.elements[0] = { id: CRITERIA.criteria[0].id, ratings: [{ key: "q1", rating: 0 }], confidence: 3 };
    check(
      "정리: 한 요소에 쓸 수 있는 응답이 하나도 없으면 쓰지 않는다(null)",
      normalizeAssessment(empty, ELEMENTS, CRITERIA.criteria) === null,
    );

    check(
      "정리: 객체가 아니거나 elements 가 배열이 아니면 null",
      normalizeAssessment(null, ELEMENTS, CRITERIA.criteria) === null &&
        normalizeAssessment("글", ELEMENTS, CRITERIA.criteria) === null &&
        normalizeAssessment({ summary: "", elements: {}, growth: [] }, ELEMENTS, CRITERIA.criteria) === null,
    );
    check(
      "정리: 평가 요소와 기준의 수가 다르면 null",
      normalizeAssessment(rawWith(4), ELEMENTS, CRITERIA.criteria.slice(0, 2)) === null,
    );
  }

  {
    const raw = { ...rawWith(4), summary: `  여러 줄\n요약   글 ${"가".repeat(80)}`, growth: [{ grade: 2, label: `  ${"나".repeat(30)}  `, index: 140.4 }] };
    const result = normalizeAssessment(raw, ELEMENTS, CRITERIA.criteria);
    check(
      "정리: 요약은 한 줄로 줄여 60자까지 자른다",
      result !== null && result.summary.length === 60 && result.summary.startsWith("여러 줄 요약 글 가"),
      result?.summary,
    );
    check(
      "정리: 성장은 없는 학년을 기록 없음·0 으로 채우고 이름표 16자·지수 0~100 으로 맞춘다",
      result !== null &&
        same(result.growth, [
          { grade: 1, label: NO_GROWTH_LABEL, index: 0 },
          { grade: 2, label: "나".repeat(16), index: 100 },
          { grade: 3, label: NO_GROWTH_LABEL, index: 0 },
        ]),
      JSON.stringify(result?.growth),
    );
    const blank = normalizeAssessment({ ...rawWith(4), summary: "   " }, ELEMENTS, CRITERIA.criteria);
    check("정리: 요약이 비면 요약 없음", blank !== null && blank.summary === NO_SUMMARY);
  }

  {
    const assessment = normalizeAssessment(rawWith(4, 4), ELEMENTS, CRITERIA.criteria);
    const adjusted =
      assessment === null
        ? null
        : withEvidenceConfidence(assessment, [
            { id: "e1", criterionId: CRITERIA.criteria[0].id, sectionId: "s1", quote: "가", reason: "나" },
          ]);
    check(
      "신뢰도: 근거가 없는 요소는 1 로 낮추고 근거가 있는 요소는 그대로 둔다",
      adjusted !== null && same(adjusted.elements.map((element) => element.confidence), [4, 1, 1]),
      JSON.stringify(adjusted?.elements.map((element) => element.confidence)),
    );
  }
}

// ---------------------------------------------------------------- 지문

/** 첫 요소의 첫 질문만 바꾼 평가 기준 */
function withChangedQuestion(prep: PrepCriteria): PrepCriteria {
  return {
    ...prep,
    elements: prep.elements.map((element, index) =>
      index !== 0
        ? element
        : {
            ...element,
            groups: element.groups.map((group, groupIndex) =>
              groupIndex !== 0 ? group : { ...group, questions: ["바뀐 질문인가?", ...group.questions.slice(1)] },
            ),
          },
    ),
  };
}

/** 배점만 바꾼 평가 기준 (합계는 100 그대로) */
function withChangedWeights(prep: PrepCriteria): PrepCriteria {
  return {
    ...prep,
    elements: prep.elements.map((element, index) => ({
      ...element,
      weight: index === 0 ? element.weight + 5 : index === 1 ? element.weight - 5 : element.weight,
    })),
  };
}

function checkFingerprint() {
  const base = rubricFingerprint(ELEMENTS);
  check("지문: r1- 뒤에 16진수 열여섯 자리", /^r1-[0-9a-f]{16}$/.test(base), base);
  check("지문: 같은 내용이면 같은 값", base === rubricFingerprint(JSON.parse(JSON.stringify(ELEMENTS)) as PrepElement[]));
  check("지문: 배점만 바꾸면 같은 값", base === rubricFingerprint(withChangedWeights(PREP).elements));
  check("지문: 질문 하나를 바꾸면 다른 값", base !== rubricFingerprint(withChangedQuestion(PREP).elements));
  check("지문: 요소 순서를 바꾸면 다른 값", base !== rubricFingerprint([...ELEMENTS].reverse()));
}

// ---------------------------------------------------------------- 분석 결과 → 평가할 지원자

const DETAIL_TEXT = "매점 판매 자료를 직접 모으고 가격별 판매량을 비교함. 친구에게 결과를 설명함.";

/** 지어낸 분석 결과 (전형 준비의 기본 평가 기준으로 분석한 것). 실제 학생부가 아니다. */
function fakeResult(assessment: Assessment | undefined): AnalysisResult {
  const [c1, c2, c3] = CRITERIA.criteria.map((criterion) => criterion.id);
  return {
    criteria: CRITERIA,
    sections: [
      { id: "s1", category: "인적·학적사항", grade: null, page: 1, text: "[블라인드]" },
      { id: "s2", category: "교과 성적", grade: 1, page: 2, text: "학기 | 과목 | 성취도\n1 | 국어 | A" },
      { id: "s3", category: "세부능력 및 특기사항", grade: 2, subject: "경제", page: 3, text: DETAIL_TEXT },
      { id: "s4", category: "동아리활동", grade: 2, page: 2, text: "동아리 부장으로 활동 계획을 세움." },
      { id: "s5", category: "독서활동상황", grade: 1, subject: "국어", page: 4, text: "과학 분야 책을 읽음." },
      { id: "s6", category: "행동특성 및 종합의견", grade: 3, page: 4, text: "책임감이 강함." },
    ],
    evidences: [
      // 받은 순서는 원문 순서와 다르게 둔다(e3 이 e1 보다 먼저)
      { id: "e3", criterionId: c2, sectionId: "s3", quote: "친구에게 결과를 설명함.", reason: "설명하는 역할" },
      { id: "e1", criterionId: c1, sectionId: "s3", quote: "매점 판매 자료를 직접 모으고 가격별 판매량을 비교함.", reason: "직접 조사" },
      { id: "e2", criterionId: c3, sectionId: "s3", quote: "직접 모으고 가격별 판매량을 비교함. 친구에게", reason: "나눔" },
      { id: "e4", criterionId: c2, sectionId: "s4", quote: "동아리 부장으로 활동 계획을 세움.", reason: "  " },
      { id: "e5", criterionId: c3, sectionId: "s6", quote: "책임감이 강함.", reason: "책임감" },
      { id: "e6", criterionId: c1, sectionId: "s5", quote: "과학 분야 책을 읽음.", reason: "독서" },
    ],
    masks: [{ type: "인적·학적사항", count: 1 }],
    ...(assessment === undefined ? {} : { assessment }),
  };
}

function checkSplit() {
  check("조각: 근거가 없으면 원문 전체가 조각 하나", same(splitBySlots("가나다", []), [{ text: "가나다", slots: [] }]));
  check("조각: 빈 원문은 조각이 없다", same(splitBySlots("", []), []));
  check(
    "조각: 겹친 구절은 겹친 부분이 두 자리의 조각이 된다",
    same(
      splitBySlots("가나다라마", [
        { start: 0, end: 3, slot: 0 },
        { start: 2, end: 5, slot: 1 },
      ]),
      [
        { text: "가나", slots: [0] },
        { text: "다", slots: [0, 1] },
        { text: "라마", slots: [1] },
      ],
    ),
  );
  check(
    "조각: 같은 구절이 두 요소의 근거면 조각 하나에 자리 둘, 같은 자리의 이웃 조각은 합친다",
    same(
      splitBySlots("가나다라", [
        { start: 1, end: 3, slot: 2 },
        { start: 1, end: 3, slot: 0 },
        { start: 0, end: 1, slot: 0 },
        { start: 3, end: 9, slot: 0 },
      ]),
      [
        { text: "가", slots: [0] },
        { text: "나다", slots: [0, 2] },
        { text: "라", slots: [0] },
      ],
    ),
  );
}

function checkUploaded() {
  const assessment = normalizeAssessment(rawWith(4), ELEMENTS, CRITERIA.criteria);
  if (assessment === null) {
    check("올린 지원자: 시험용 AI 제안 만들기", false);
    return;
  }
  const item: UploadedApplicant = { code: "A-0315", at: "2026-11-19T01:02:03.000Z", result: fakeResult(assessment) };

  check("형식: AI 제안이 든 결과는 형식 검사를 통과한다", isAnalysisResult(item.result));
  check("내용: AI 제안이 든 결과에 문제가 없다", same(validateResult(item.result), []), validateResult(item.result).join(" / "));
  check(
    "형식: AI 제안의 모양이 틀리면 결과를 받지 않는다",
    !isAnalysisResult({ ...item.result, assessment: { ...assessment, elements: [{ criterionId: "c1", score: "80", confidence: 3, tags: [] }] } }) &&
      !isAnalysisResult({ ...item.result, assessment: { ...assessment, summary: 3 } }) &&
      !isAnalysisResult({ ...item.result, assessment: null }),
  );
  {
    const broken: AnalysisResult = {
      ...item.result,
      assessment: {
        ...assessment,
        elements: assessment.elements.slice(0, 2).map((element, index) => (index === 0 ? { ...element, score: 120, confidence: 0 } : element)),
        growth: [{ grade: 2, label: "가", index: 50.5 }],
      },
    };
    const problems = validateResult(broken);
    check(
      "내용: 요소 수·점수·신뢰도·성장이 어긋나면 문제로 적는다",
      problems.some((problem) => problem.includes("요소 수")) &&
        problems.some((problem) => problem.includes("점수가 0~100")) &&
        problems.some((problem) => problem.includes("신뢰도가 1~4")) &&
        problems.some((problem) => problem.includes("학년별 성장이 3건이 아님")) &&
        problems.some((problem) => problem.includes("지수가 0~100")),
      problems.join(" / "),
    );
  }

  check("연결: AI 제안이 없는 결과는 평가할 수 없다", assessmentFor(fakeResult(undefined), ELEMENTS) === null);
  check(
    "연결: 전형 준비 기준이 아닌 결과는 평가할 수 없다",
    assessmentFor({ ...item.result, criteria: { ...CRITERIA, id: "business" } }, ELEMENTS) === null &&
      CRITERIA.id === PREP_CRITERIA_ID,
  );
  check("연결: 세부 평가 항목이 바뀌면 평가할 수 없다", uploadedEvaluationApplicant(item, withChangedQuestion(PREP).elements) === null);
  check("연결: 배점만 바뀌면 그대로 평가할 수 있다", uploadedEvaluationApplicant(item, withChangedWeights(PREP).elements) !== null);

  const applicant = uploadedEvaluationApplicant(item, ELEMENTS);
  if (applicant === null) {
    check("연결: 지금 평가 기준으로 분석한 결과는 평가할 지원자가 된다", false);
    return;
  }
  check(
    "연결: 코드·요약·처음 상태(대기)·다른 위원 없음·원문보기·분석 표시",
    applicant.code === "A-0315" &&
      applicant.summary === assessment.summary &&
      applicant.seed === null &&
      applicant.peers.length === 0 &&
      applicant.original === item.result &&
      applicant.stamp === item.at,
  );
  check(
    "연결: AI 제안은 요소 수만큼이고 점수·신뢰도·태그가 그대로다",
    applicant.ai.length === ELEMENTS.length &&
      ELEMENTS.every((element, index) => {
        const slot = assessmentOf(applicant, index);
        return (
          slot.score === 80 &&
          slot.confidence === 3 &&
          assessmentTags(slot, element) === assessment.elements[index].tags.map((tag) => `# ${tag}`).join(" ")
        );
      }),
  );
  check(
    "연결: 원문은 교과·세특·창체·독서·행특 항목만 문서 순서대로(인적·학적사항은 없다)",
    same(
      applicant.passages.map((passage) => [passage.area, passage.grade, passage.subject]),
      [
        ["교과", 1, "교과 성적"],
        ["세특", 2, "경제"],
        ["창체", 2, "동아리활동"],
        ["독서", 1, "국어"],
        ["행특", 3, "행동특성 및 종합의견"],
      ],
    ),
    JSON.stringify(applicant.passages.map((passage) => [passage.area, passage.grade, passage.subject])),
  );
  check("연결: 독서 원문이 있으면 서류 구분에 독서가 더해진다", same(documentAreasOf(applicant), ["교과", "세특", "창체", "행특", "독서"]));
  check(
    "연결: 예시 지원자의 서류 구분은 넷이다",
    same(documentAreasOf(EVALUATION_APPLICANTS[0]), ["교과", "세특", "창체", "행특"]),
  );
  {
    const detail = applicant.passages.find((passage) => passage.area === "세특");
    check(
      "연결: 세특 원문은 겹친 근거 구절의 경계에서 나뉘고 이어 붙이면 원문과 같다",
      detail !== undefined &&
        detail.segments.map((segment) => segment.text).join("") === DETAIL_TEXT &&
        same(detail.segments, [
          { text: "매점 판매 자료를 ", slots: [0] },
          { text: "직접 모으고 가격별 판매량을 비교함.", slots: [0, 2] },
          { text: " ", slots: [2] },
          { text: "친구에게", slots: [1, 2] },
          { text: " 결과를 설명함.", slots: [1] },
        ]),
      JSON.stringify(detail?.segments),
    );
  }
  check(
    "연결: 근거 문장은 요소마다 원문 순서대로이고 출처와 이유가 붙는다(빈 이유는 뺀다)",
    same(
      ELEMENTS.map((_, index) => evidencesOf(applicant, index, ELEMENTS.length).map((evidence) => [evidence.source, evidence.text, evidence.reason])),
      [
        [
          ["2학년 · 세특 · 경제", "매점 판매 자료를 직접 모으고 가격별 판매량을 비교함.", "직접 조사"],
          ["1학년 · 독서 · 국어", "과학 분야 책을 읽음.", "독서"],
        ],
        [
          ["2학년 · 세특 · 경제", "친구에게 결과를 설명함.", "설명하는 역할"],
          ["2학년 · 창체 · 동아리활동", "동아리 부장으로 활동 계획을 세움.", undefined],
        ],
        [
          ["2학년 · 세특 · 경제", "직접 모으고 가격별 판매량을 비교함. 친구에게", "나눔"],
          ["3학년 · 행특 · 행동특성 및 종합의견", "책임감이 강함.", "책임감"],
        ],
      ],
    ),
    JSON.stringify(ELEMENTS.map((_, index) => evidencesOf(applicant, index, ELEMENTS.length))),
  );
  check(
    "연결: 근거 문장의 id 는 서로 다르다",
    new Set(ELEMENTS.flatMap((_, index) => evidencesOf(applicant, index, ELEMENTS.length).map((evidence) => evidence.id))).size === 6,
  );
  {
    // 서류 원문에서 근거의 자리로 가는 데 쓰는 값: 자리(place)의 범위가 그 원문에서 근거 구절과 같고, 분석 결과의 근거 id·항목 id(origin)가 맞다.
    const all = ELEMENTS.flatMap((_, index) => evidencesOf(applicant, index, ELEMENTS.length));
    check(
      "연결: 근거 문장마다 서류 원문에서의 자리가 그 구절의 범위다",
      all.length === 6 &&
        all.every((evidence) => {
          const passage = applicant.passages.find((item) => item.id === evidence.place?.passageId);
          if (passage === undefined || evidence.place === undefined) return false;
          const text = passage.segments.map((segment) => segment.text).join("");
          return text.slice(evidence.place.start, evidence.place.end) === evidence.text;
        }),
      JSON.stringify(all.map((evidence) => evidence.place)),
    );
    check(
      "연결: 근거 문장마다 분석 결과의 근거 id 와 항목 id 가 붙는다(실제 PDF 에서 자리를 찾는 열쇠)",
      all.every((evidence) => {
        const source = item.result.evidences.find((entry) => entry.id === evidence.origin?.evidenceId);
        const passage = applicant.passages.find((entry) => entry.id === evidence.place?.passageId);
        return (
          source !== undefined &&
          source.quote === evidence.text &&
          source.sectionId === evidence.origin?.sectionId &&
          passage?.origin?.sectionId === source.sectionId
        );
      }) && new Set(all.map((evidence) => evidence.origin?.evidenceId)).size === 6,
      JSON.stringify(all.map((evidence) => evidence.origin)),
    );
  }
  check(
    "연결: 학년별 성장의 이름표·지수는 AI 제안, 건수는 그 학년의 근거 수",
    same(
      applicant.growth.map((point) => [point.grade, point.label, point.index, point.count]),
      [
        [1, "기초 탐구", 40, 1],
        [2, "심화 · 프로젝트", 70, 4],
        [3, "융합 · 확장", 85, 1],
      ],
    ),
    JSON.stringify(applicant.growth),
  );

  // 평가할 지원자 목록
  {
    const none = evaluationApplicants([], ELEMENTS);
    check(
      "목록: 올린 지원자가 없으면 예시 지원자 24명 그대로",
      none.applicants === EVALUATION_APPLICANTS && none.uploadedCount === 0 && none.skippedCount === 0,
    );
    const old: UploadedApplicant = { code: "A-0316", at: "2026-11-19T02:00:00.000Z", result: fakeResult(undefined) };
    const uploaded = [item, old];
    const list = evaluationApplicants(uploaded, ELEMENTS);
    check(
      "목록: 평가할 수 있는 올린 지원자만 예시 지원자 뒤에 붙고, 넣지 못한 수를 센다",
      list.applicants.length === EVALUATION_APPLICANTS.length + 1 &&
        list.applicants[list.applicants.length - 1].code === "A-0315" &&
        list.uploadedCount === 2 &&
        list.skippedCount === 1,
    );
    check("목록: 재료가 같으면 같은 객체를 돌려준다", evaluationApplicants(uploaded, ELEMENTS) === list);
    check(
      "목록: 올린 지원자를 코드로 찾고 평가 순서의 마지막 자리다",
      findEvaluationApplicant(list.applicants, "A-0315")?.code === "A-0315" &&
        findEvaluationApplicant(list.applicants, "A-0316") === undefined &&
        same(queuePosition(list.applicants, "A-0315"), {
          position: EVALUATION_APPLICANTS.length + 1,
          total: EVALUATION_APPLICANTS.length + 1,
          previous: EVALUATION_APPLICANTS[EVALUATION_APPLICANTS.length - 1].code,
          next: null,
        }),
    );
  }

  // 원문보기에 보여 줄 결과
  {
    const found = originalRecordOf("A-0315", [item]);
    check(
      "원문보기: 올린 지원자는 그 학생부의 분석 결과를 보여 준다",
      found !== null && found.result === item.result && !found.sample && found.key === `A-0315@${item.at}`,
    );
    const sample = originalRecordOf("A-0187", [item]);
    check(
      "원문보기: 예시 지원자는 샘플 결과를 보여 준다",
      sample !== null && sample.sample && sample.result.criteria.id !== PREP_CRITERIA_ID && sample.key === "A-0187",
    );
    check(
      "원문보기: 코드가 없거나 목록에 없는 올린 지원자·형식이 아닌 코드는 찾지 못한다",
      originalRecordOf(null, [item]) === null &&
        originalRecordOf("A-0316", [item]) === null &&
        originalRecordOf("A-0000", [item]) === null &&
        originalRecordOf("a-0187", [item]) === null &&
        originalRecordOf("A-187", [item]) === null,
    );
  }

  // 저장한 평가
  {
    const record = { ...EMPTY_EVALUATION, status: "draft" as const, basis: evaluationBasis(applicant, ELEMENTS), scores: { e1: 90 } };
    const parsed = parseEvaluations({ version: 1, records: { "A-0315": record, "A-0314": record, "B-0001": record, "A-0187": record } });
    check(
      "평가: 올린 지원자 코드와 예시 지원자 24명의 코드만 읽는다",
      same(Object.keys(parsed).sort(), ["A-0187", "A-0315"]),
      Object.keys(parsed).join(","),
    );
    check("평가: 그 분석에 대해 저장한 평가를 쓴다", effectiveRecord(applicant, parsed, ELEMENTS)?.scores.e1 === 90);
    const other = { ...applicant, stamp: "2026-11-20T00:00:00.000Z" };
    check(
      "평가: 같은 코드라도 다른 분석이면 저장한 평가를 쓰지 않는다(대기)",
      effectiveRecord(other, parsed, ELEMENTS) === null && evaluationBasis(other, ELEMENTS) !== record.basis,
    );
    check(
      "평가: 예시 지원자의 basis 는 평가 요소 구성 그대로다",
      evaluationBasis(EVALUATION_APPLICANTS[0], ELEMENTS) === ELEMENTS.map((element) => `${element.id}:${element.name}`).join("|"),
    );

    const many: Record<string, unknown> = {};
    for (let number = 315; number < 315 + MAX_UPLOADED_EVALUATIONS + 5; number += 1) many[`A-${String(number).padStart(4, "0")}`] = record;
    const kept = Object.keys(parseEvaluations({ version: 1, records: many }));
    check(
      "평가: 올린 지원자의 평가는 번호가 큰 50건까지만 읽는다",
      kept.length === MAX_UPLOADED_EVALUATIONS && !kept.includes("A-0315") && kept.includes("A-0320") && kept.includes("A-0369"),
      `${kept.length}건`,
    );
  }
}

// ---------------------------------------------------------------- 예시 지원자 (바꾸기 전과 같은지)

function checkSample() {
  const sample = findEvaluationApplicant(EVALUATION_APPLICANTS, "A-0187");
  if (sample === undefined) {
    check("예시: A-0187 찾기", false);
    return;
  }
  check(
    "예시: A-0187 의 근거 수는 잠재역량 2·학업역량 3·공동체역량 1 (세특 두 건만 근거다)",
    same(
      ELEMENTS.map((_, index) => evidencesOf(sample, index, ELEMENTS.length).length),
      [2, 3, 1],
    ),
  );
  check(
    "예시: A-0187 의 AI 점수와 태그는 정해 둔 값이다",
    same(
      ELEMENTS.map((element, index) => [assessmentOf(sample, index).score, assessmentTags(assessmentOf(sample, index), element)]),
      [
        [88, "# 전공활동탐색 # 자기주도성"],
        [85, "# 탐구력 # 학습태도"],
        [78, "# 사회역량"],
      ],
    ),
    JSON.stringify(ELEMENTS.map((element, index) => [assessmentOf(sample, index).score, assessmentTags(assessmentOf(sample, index), element)])),
  );
  check(
    "예시: 요소가 둘뿐이면 셋째 자리의 조각은 근거가 아니다",
    evidencesOf(sample, 0, 2).length === 2 && evidencesOf(sample, 1, 2).length === 3 && evidencesOf(sample, 2, 2).length === 0,
  );
  check(
    "예시: 요소가 여섯이면 넷째 요소는 첫 자리를 다시 쓴다",
    evidencesOf(sample, 3, 6).length === 2 &&
      same(
        evidencesOf(sample, 3, 6).map((evidence) => evidence.text),
        evidencesOf(sample, 0, 6).map((evidence) => evidence.text),
      ),
  );
  check(
    "예시: 근거 문장의 자리는 그 원문 조각의 범위다",
    ELEMENTS.flatMap((_, index) => evidencesOf(sample, index, ELEMENTS.length)).every((evidence) => {
      const passage = sample.passages.find((item) => item.id === evidence.place?.passageId);
      if (passage === undefined || evidence.place === undefined) return false;
      return passage.segments.map((segment) => segment.text).join("").slice(evidence.place.start, evidence.place.end) === evidence.text;
    }),
  );
  check(
    "형광펜: 지금 고른 요소의 근거면 그 요소의 색, 아니면 맨 앞 요소의 색이고 근거가 아니면 없다",
    same(segmentTone({ text: "가", slots: [0, 3] }, 3, 3, 4), { tone: 3, selected: true }) &&
      same(segmentTone({ text: "가", slots: [1, 3] }, 0, 0, 4), { tone: 1, selected: false }) &&
      segmentTone({ text: "가", slots: [] }, 0, 0, 4) === null &&
      // 요소가 셋뿐이면 넷째 자리는 근거가 아니다.
      segmentTone({ text: "가", slots: [3] }, 0, 0, 3) === null,
  );
  check(
    "형광펜: 요소가 여섯이면 넷째 요소를 골랐을 때 첫 자리의 조각이 넷째 요소의 색이다",
    same(segmentTone({ text: "가", slots: [0] }, slotOf(sample, 3), 3, 3), { tone: 3, selected: true }),
  );
  check(
    "예시: 평가 순서의 첫 지원자는 앞이 없고 24명이다",
    same(queuePosition(EVALUATION_APPLICANTS, EVALUATION_APPLICANTS[0].code), {
      position: 1,
      total: 24,
      previous: null,
      next: EVALUATION_APPLICANTS[1].code,
    }),
  );
}

/** 실제 PDF 쪽 위의 표시(형광펜) 만들기 (lib/recordPdfMarks.ts) */
function checkPdfMarks() {
  const pages = [
    { page: 1, width: 595, height: 842, state: "shown" as const, url: "blob:1" },
    { page: 2, width: 595, height: 842, state: "scan" as const, url: null },
    { page: 3, width: 595, height: 842, state: "unverified" as const, url: null },
  ];
  const built = buildPdfPages(
    pages,
    [
      { id: "e2", rects: [[2, 0.1, 0.2, 0.3, 0.02], [1, 0.1, 0.5, 0.3, 0.02], [1, 0.1, 0.52, 0.2, 0.02]], tone: 1, level: "focus", stamp: 7 },
      { id: "e1", rects: [[1, 0.1, 0.1, 0.3, 0.02]], tone: 0, level: "strong" },
      { id: "e3", rects: [[1, 0.1, 0.3, 0.3, 0.02]], tone: 2, level: "soft" },
      { id: "section:s1", rects: [[1, 0.1, 0.1, 0.8, 0.5]], tone: null, level: "section" },
      { id: "e4", rects: undefined, tone: 3, level: "soft" },
    ],
    "e2",
  );
  check(
    "PDF 표시: 쪽마다 그 쪽의 표시만, 옅은 것부터(항목 < 다른 요소 < 지금 요소 < 고른 근거) 놓인다",
    same(
      built.map((page) => page.marks.map((mark) => `${mark.groupId}:${mark.level}:${mark.tone}`)),
      [["section:s1:section:null", "e3:soft:2", "e1:strong:0", "e2:focus:1", "e2:focus:1"], ["e2:focus:1"], []],
    ),
    JSON.stringify(built.map((page) => page.marks.map((mark) => `${mark.groupId}:${mark.level}:${mark.tone}`))),
  );
  check(
    "PDF 표시: 스크롤 대상은 대상 묶음의 표시 가운데 문서에서 맨 앞의 것 하나다",
    same(
      built.flatMap((page) => page.marks.filter((mark) => mark.isTarget).map((mark) => [page.page, mark.groupId, mark.y])),
      [[1, "e2", 0.5]],
    ),
  );
  check(
    "PDF 표시: 표시의 key 는 서로 다르고, 고른 근거의 key 에는 고를 때마다 바뀌는 값이 든다",
    new Set(built.flatMap((page) => page.marks.map((mark) => mark.key))).size === 6 &&
      built[1].marks[0].key === "e2#0#7" &&
      built[0].marks[1].key === "e3#0#0",
  );
  check(
    "PDF 표시: 자리가 없는 묶음이 대상이면 대상이 없다",
    buildPdfPages(pages, [{ id: "e4", rects: undefined, tone: 3, level: "focus" }], "e4").every((page) => page.marks.length === 0),
  );
  check(
    "PDF 표시: 그림이 없는 쪽에는 그 까닭을 적는다",
    same(
      built.map((page) => [page.url, page.stateText]),
      [
        ["blob:1", ""],
        [null, "스캔본 · 가린 그림 없음"],
        [null, "가림 확인 안 됨 · 그림 없음"],
      ],
    ),
  );
}

checkNormalize();
checkFingerprint();
checkSplit();
checkUploaded();
checkSample();
checkPdfMarks();

if (failures.length > 0) {
  console.error(`\n평가하기 검사 ${passed + failures.length}개 사례 중 ${failures.length}개 실패`);
  process.exit(1);
}
console.log(`\n평가하기 검사 통과: ${passed}개 사례`);
