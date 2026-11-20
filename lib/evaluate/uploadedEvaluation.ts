import type { AnalysisResult, Assessment, Linkage } from "@/types/analysis";
import { DOCUMENT_AREAS as AREA_CATEGORIES, type UploadedApplicant } from "../applicants/uploaded.ts";
import { PREP_CRITERIA_ID, rubricFingerprint } from "../prep/analysisCriteria.ts";
import { recordFormGroup } from "../recordForm.ts";
import type { PrepElement } from "../prep/criteria.ts";
import { ASSESSMENT_LIMITS, GROWTH_GRADES, NO_GROWTH_LABEL, NO_SUMMARY } from "./assessment.ts";
import { evidenceSource } from "./evaluation.ts";
import {
  EVALUATION_APPLICANTS,
  type ApplicantEvidence,
  type ApplicantLink,
  type ApplicantLinkCard,
  type DocumentArea,
  type EvaluationApplicant,
  type GrowthPoint,
  type Passage,
  type PassageSegment,
  type SlotAssessment,
  type SlotLinkage,
} from "./sampleEvaluations.ts";

// 올린 지원자(학생부 올리기 화면에서 분석한 학생부, lib/applicants/uploaded.ts)를 평가하기 화면의 지원자로 바꾼다. 순수 함수.
// 평가할 수 있는 것은 지금 평가 기준으로 분석해 AI 제안이 있는 학생부뿐이다(assessmentFor). 그 밖의 올린 지원자(분석한 뒤 세부 평가 항목이
// 바뀜, AI 제안이 없는 분석, 예전에 다른 학과 기준으로 분석해 저장소에 남아 있는 것)는 목록에 넣지 않고 수만 센다(화면이 다시 올리라고 안내한다).
// 바꾼 지원자는 예시 지원자와 같은 형식이라 평가하기 세 화면이 그대로 그린다. 원문·근거·AI 제안은 분석 결과의 값이고,
// 다른 위원 의견은 없다(서버 저장소와 계정이 없어 다른 위원이 없다).

/** 독서활동상황은 서류 확인의 네 영역에 들지 않아 따로 둔다 ("독서" 서류 구분) */
const READING_CATEGORY = "독서활동상황";

/** 항목 이름(파서가 준 category) → 서류 구분. 원문을 보여 주지 않는 항목(인적·학적사항, 출결상황, 수상경력 등)은 null. */
function areaOf(category: string): DocumentArea | null {
  const found = AREA_CATEGORIES.find((area) => area.categories.includes(category));
  if (found !== undefined) return found.label;
  return category === READING_CATEGORY ? "독서" : null;
}

function gradeOf(grade: number | null): 1 | 2 | 3 | null {
  return grade === 1 || grade === 2 || grade === 3 ? grade : null;
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * 그 분석의 AI 제안이 지금 평가 기준의 것이면 그 제안, 아니면 null.
 * - 전형 준비 기준으로 분석했고(기준 id "prep") AI 제안이 있어야 한다.
 * - 제안을 만든 세부 평가 항목의 지문(rubric)이 지금 평가 기준의 지문과 같아야 한다(요소 이름·묶음·질문이 같다. 배점은 달라도 된다).
 * - 제안의 요소가 분석 기준과 같은 순서·개수여야 한다(요소 순번으로 짝을 짓는다).
 */
export function assessmentFor(result: AnalysisResult, elements: readonly PrepElement[]): Assessment | null {
  const { assessment, criteria } = result;
  if (assessment === undefined || criteria.id !== PREP_CRITERIA_ID) return null;
  if (assessment.rubric !== rubricFingerprint(elements)) return null;
  if (criteria.criteria.length !== elements.length || assessment.elements.length !== elements.length) return null;
  if (!assessment.elements.every((element, index) => element.criterionId === criteria.criteria[index].id)) return null;
  return assessment;
}

function sameSlots(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((slot, index) => slot === b[index]);
}

/**
 * 원문을 근거 구절의 경계에서 조각으로 나눈다. 조각마다 그 조각을 덮는 구절의 자리들(작은 순서, 겹치지 않게)을 붙인다.
 * 구절이 서로 겹치거나 같은 구절이 두 요소의 근거여도 된다(겹친 부분은 자리가 여럿인 조각이 된다). 이웃한 조각의 자리가 같으면 합친다.
 * 조각을 이어 붙이면 원문과 같다. 범위가 원문을 벗어난 구절은 원문 안쪽만 쓴다.
 */
export function splitBySlots(
  text: string,
  marks: readonly { start: number; end: number; slot: number }[],
): PassageSegment[] {
  const bounded = marks
    .map((mark) => ({ start: Math.max(0, mark.start), end: Math.min(text.length, mark.end), slot: mark.slot }))
    .filter((mark) => mark.start < mark.end);
  const points = [...new Set([0, text.length, ...bounded.flatMap((mark) => [mark.start, mark.end])])].sort((a, b) => a - b);
  const segments: PassageSegment[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const slots = [...new Set(bounded.filter((mark) => mark.start <= start && end <= mark.end).map((mark) => mark.slot))].sort(
      (a, b) => a - b,
    );
    const last = segments[segments.length - 1];
    if (last !== undefined && sameSlots(last.slots, slots)) {
      segments[segments.length - 1] = { text: last.text + text.slice(start, end), slots: last.slots };
    } else {
      segments.push({ text: text.slice(start, end), slots });
    }
  }
  return segments;
}

/**
 * 올린 지원자 → 평가할 지원자. 지금 평가 기준으로 평가할 수 없으면(assessmentFor) null.
 * - 한 줄 요약, 요소별 AI 점수·신뢰도·태그: AI 제안의 값(범위 밖 값은 범위 안으로 맞춘다). 자리는 평가 요소 순번이다.
 * - 서류 원문: 교과(교과 성적)·세특·창체(자율·동아리·진로·봉사)·행특·독서(독서활동상황) 항목을 문서 순서대로. 과목이 없는 항목은
 *   서식의 묶음 이름(교과 성적의 "진로 선택 과목"·"체육·예술")이나 항목 이름을 과목 자리에 쓴다. 그 밖의 항목은 넣지 않는다.
 *   근거 구절은 원문에서 처음 나오는 자리에 표시한다(splitBySlots). 원문마다 학생부 항목의 id 와 쪽 번호를 붙인다(origin).
 * - 근거 문장: 요소마다 근거 구절과 AI 가 적은 이유를 원문 순서대로(항목 순서, 항목 안에서는 구절이 나오는 순서).
 *   근거마다 서류 원문에서의 자리(place)와 분석 결과의 근거 id·항목 id(origin: 실제 PDF 에서 자리를 찾는 열쇠)를 붙인다.
 * - 학년별 성장: 이름표와 지수는 AI 제안, 건수는 그 학년 항목에서 나온 근거 구절의 수.
 * - 학년별 연계: 분석 결과에 연계가 있으면 자리별 카드와 연결로 옮긴다(applicantLinkage). 없으면 연계가 없는 지원자다.
 * - 처음 평가 상태는 없고("대기") 다른 위원 의견도 없다. 원문보기는 이 분석 결과를 연다. 평가는 이 분석(남긴 때)에 묶는다(stamp).
 */
export function uploadedEvaluationApplicant(
  item: UploadedApplicant,
  elements: readonly PrepElement[],
): EvaluationApplicant | null {
  const assessment = assessmentFor(item.result, elements);
  if (assessment === null) return null;
  const { sections, evidences, criteria } = item.result;
  const slotOfCriterion = new Map(criteria.criteria.map((criterion, index) => [criterion.id, index]));

  const passages: Passage[] = [];
  const evidenceLists: ApplicantEvidence[][] = elements.map(() => []);
  const countByGrade = new Map<number, number>();
  /** 학생부 항목 id → 그 항목의 서류 원문, 분석 결과의 근거 id → 근거 문장 id (학년별 연계를 옮길 때 쓴다) */
  const passageOfSection = new Map<string, Passage>();
  const evidenceIdOf = new Map<string, string>();
  sections.forEach((section, sectionIndex) => {
    const area = areaOf(section.category);
    if (area === null) return;
    const grade = gradeOf(section.grade);
    const marks = evidences.flatMap((evidence) => {
      const slot = slotOfCriterion.get(evidence.criterionId);
      if (evidence.sectionId !== section.id || slot === undefined || evidence.quote === "") return [];
      return [{ evidence, slot, start: section.text.indexOf(evidence.quote) }];
    });
    const passage: Passage = {
      id: `${item.code}-p${sectionIndex}`,
      area,
      grade,
      subject:
        section.subject !== undefined && section.subject.trim() !== ""
          ? section.subject
          : (recordFormGroup(section.fieldId) ?? section.category),
      origin: { sectionId: section.id, page: section.page },
      segments: splitBySlots(
        section.text,
        marks
          .filter((mark) => mark.start >= 0)
          .map((mark) => ({ start: mark.start, end: mark.start + mark.evidence.quote.length, slot: mark.slot })),
      ),
    };
    passages.push(passage);
    passageOfSection.set(section.id, passage);
    // 원문에서 나오는 순서대로(원문에서 찾지 못한 구절은 그 항목의 맨 뒤). Array.prototype.sort 는 안정 정렬이라 같은 자리면 받은 순서다.
    const ordered = [...marks].sort(
      (a, b) => (a.start < 0 ? Number.MAX_SAFE_INTEGER : a.start) - (b.start < 0 ? Number.MAX_SAFE_INTEGER : b.start),
    );
    for (const mark of ordered) {
      const list = evidenceLists[mark.slot];
      const reason = mark.evidence.reason.trim();
      evidenceIdOf.set(mark.evidence.id, `${item.code}-e${mark.slot}-${list.length}`);
      list.push({
        id: `${item.code}-e${mark.slot}-${list.length}`,
        source: evidenceSource(passage),
        text: mark.evidence.quote,
        ...(reason === "" ? {} : { reason }),
        ...(mark.start < 0
          ? {}
          : { place: { passageId: passage.id, start: mark.start, end: mark.start + mark.evidence.quote.length } }),
        origin: { evidenceId: mark.evidence.id, sectionId: section.id },
      });
      if (grade !== null) countByGrade.set(grade, (countByGrade.get(grade) ?? 0) + 1);
    }
  });

  const ai = assessment.elements.map(
    (element): SlotAssessment => ({
      score: clampInteger(element.score, ASSESSMENT_LIMITS.minScore, ASSESSMENT_LIMITS.maxScore),
      confidence: clampInteger(
        element.confidence,
        ASSESSMENT_LIMITS.minConfidence,
        ASSESSMENT_LIMITS.maxConfidence,
      ) as SlotAssessment["confidence"],
      tagPicks: [],
      tags: element.tags,
    }),
  );
  const growth = GROWTH_GRADES.map((grade): GrowthPoint => {
    const point = assessment.growth.find((entry) => entry.grade === grade);
    const label = point?.label.trim() ?? "";
    return {
      grade,
      label: label === "" ? NO_GROWTH_LABEL : label,
      index: point === undefined ? 0 : clampInteger(point.index, ASSESSMENT_LIMITS.minScore, ASSESSMENT_LIMITS.maxScore),
      count: countByGrade.get(grade) ?? 0,
    };
  }) as unknown as EvaluationApplicant["growth"];
  const summary = assessment.summary.trim();
  const linkage =
    item.result.linkage === undefined
      ? undefined
      : applicantLinkage(item.result.linkage, slotOfCriterion, elements.length, passageOfSection, evidenceIdOf);

  return {
    code: item.code,
    summary: summary === "" ? NO_SUMMARY : summary,
    ai,
    growth,
    passages,
    seed: null,
    peers: [],
    evidences: evidenceLists,
    ...(linkage === undefined ? {} : { linkage }),
    original: item.result,
    stamp: item.at,
  };
}

/**
 * 분석 결과의 학년별 연계를 평가할 지원자의 자리별 연계로 옮긴다(자리 = 평가 요소 순번, slotCount 개).
 * - 카드: 기준이 평가 요소에 있고, 항목이 서류 원문에 나오며 학년이 1~3 이고, 근거 가운데 근거 문장으로 옮겨진 것이 하나라도 있어야 한다.
 *   옮기지 못한 근거는 빼고, 남은 것이 없으면 카드를 버린다. 제목이 비면 그 원문의 과목·활동 이름을 쓴다. 깊이가 1~3 이 아니면 null.
 * - 연결: 두 카드가 같은 자리에 남아 있고 앞 카드의 학년이 뒤 카드보다 낮아야 한다. 기록에 적힌 연속은 그 구절이 든 항목이 서류 원문에
 *   나오고 구절이 비지 않았을 때만이고, 아니면 AI 가 제안한 연관으로 둔다.
 * 저장소에서 읽은 결과는 모양만 확인된 것이라(lib/validateResult.ts 의 isLinkage) 내용이 어긋난 카드·연결은 여기서 걸러진다.
 */
function applicantLinkage(
  linkage: Linkage,
  slotOfCriterion: ReadonlyMap<string, number>,
  slotCount: number,
  passageOfSection: ReadonlyMap<string, Passage>,
  evidenceIdOf: ReadonlyMap<string, string>,
): SlotLinkage[] {
  const slots = Array.from({ length: slotCount }, () => ({ cards: [] as ApplicantLinkCard[], links: [] as ApplicantLink[] }));
  const placed = new Map<string, { slot: number; card: ApplicantLinkCard }>();
  for (const card of linkage.cards) {
    const slot = slotOfCriterion.get(card.criterionId);
    const passage = passageOfSection.get(card.sectionId);
    if (slot === undefined || slot >= slotCount || passage === undefined || passage.grade === null || placed.has(card.id)) continue;
    const evidenceIds = card.evidenceIds.flatMap((id) => {
      const mapped = evidenceIdOf.get(id);
      return mapped === undefined ? [] : [mapped];
    });
    if (evidenceIds.length === 0) continue;
    const title = card.title.trim();
    const converted: ApplicantLinkCard = {
      id: card.id,
      passageId: passage.id,
      grade: passage.grade,
      title: title === "" ? passage.subject : title,
      theme: card.theme.trim(),
      depth: card.depth === 1 || card.depth === 2 || card.depth === 3 ? card.depth : null,
      evidenceIds,
    };
    slots[slot].cards.push(converted);
    placed.set(card.id, { slot, card: converted });
  }
  const linkIds = new Set<string>();
  for (const link of linkage.links) {
    const from = placed.get(link.fromCardId);
    const to = placed.get(link.toCardId);
    if (from === undefined || to === undefined || from.slot !== to.slot || from.card.grade >= to.card.grade || linkIds.has(link.id)) continue;
    linkIds.add(link.id);
    const quote = link.kind === "stated" ? (link.statedQuote?.trim() ?? "") : "";
    const statedPassage = quote === "" || link.statedSectionId === undefined ? undefined : passageOfSection.get(link.statedSectionId);
    slots[from.slot].links.push({
      id: link.id,
      fromCardId: link.fromCardId,
      toCardId: link.toCardId,
      kind: statedPassage === undefined ? "suggested" : "stated",
      stated: statedPassage === undefined ? null : { quote, passageId: statedPassage.id },
      reason: link.reason.trim(),
    });
  }
  return slots;
}

/** 평가할 지원자 목록과 올린 지원자의 수 */
export type EvaluationApplicantList = {
  /** 평가할 지원자 전체: 예시 지원자 24명과 지금 평가 기준으로 분석한 올린 지원자 (평가 순서 = 코드 순서) */
  applicants: readonly EvaluationApplicant[];
  /** 올린 지원자 전체 수 (목록에 넣지 못한 것 포함) */
  uploadedCount: number;
  /** 지금 평가 기준으로 분석하지 않아 목록에 넣지 못한 올린 지원자 수 */
  skippedCount: number;
};

const SAMPLE_ONLY: EvaluationApplicantList = { applicants: EVALUATION_APPLICANTS, uploadedCount: 0, skippedCount: 0 };

/** 마지막으로 만든 목록과 그것을 만든 재료 (재료가 같으면 같은 객체를 돌려준다) */
let cached: {
  uploaded: readonly UploadedApplicant[];
  elements: readonly PrepElement[];
  value: EvaluationApplicantList;
} | null = null;

/**
 * 평가할 지원자 목록: 예시 지원자 뒤에, 올린 지원자 가운데 지금 평가 기준으로 평가할 수 있는 것을 코드 순서대로 붙인다
 * (올린 지원자의 코드는 예시 지원자 뒤 번호라 전체가 코드 순서다). 올린 지원자 목록은 코드 순서로 받는다.
 * 재료(올린 지원자 목록과 평가 요소 배열)가 같은 객체면 다시 만들지 않는다(화면 셋이 그릴 때마다 부른다).
 */
export function evaluationApplicants(
  uploaded: readonly UploadedApplicant[],
  elements: readonly PrepElement[],
): EvaluationApplicantList {
  if (uploaded.length === 0) return SAMPLE_ONLY;
  if (cached !== null && cached.uploaded === uploaded && cached.elements === elements) return cached.value;
  const converted = uploaded.flatMap((item) => {
    const applicant = uploadedEvaluationApplicant(item, elements);
    return applicant === null ? [] : [applicant];
  });
  const value: EvaluationApplicantList = {
    applicants: converted.length === 0 ? EVALUATION_APPLICANTS : [...EVALUATION_APPLICANTS, ...converted],
    uploadedCount: uploaded.length,
    skippedCount: uploaded.length - converted.length,
  };
  cached = { uploaded, elements, value };
  return value;
}
