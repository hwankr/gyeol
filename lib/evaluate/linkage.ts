import type { AnalysisResult, Criterion, Evidence, Linkage, LinkageCard, LinkageLink, Section } from "@/types/analysis";
import { MAX_CRITERIA, MAX_CRITERION_NAME_LENGTH } from "../criteria/limits.ts";
import { truncateText } from "../criteria/normalize.ts";
import { locateQuote } from "../pipeline/locateQuote.ts";
import {
  MAX_RECORD_SECTIONS,
  MAX_RECORD_TEXT_LENGTH,
  MAX_SECTION_CATEGORY_LENGTH,
  MAX_SECTION_FIELD_ID_LENGTH,
  MAX_SECTION_GRADE,
  MAX_SECTION_SUBJECT_LENGTH,
  MAX_SECTION_TEXT_LENGTH,
} from "../recordSections.ts";

// 학년별 연계(평가하기 총평의 학년별 연계 상자)의 요청 모양과 받은 값 정리. 순수 함수라 브라우저와 Node 어디서나 돈다.
// 연계는 근거 추출이 이미 뽑은 근거를 잇는다: 카드는 한 평가 요소의 근거 가운데 같은 항목에서 같은 활동을 가리키는 것들이고,
// 연결은 같은 요소의 앞 학년 카드 → 뒤 학년 카드다. AI 에는 어느 근거가 어느 근거로 이어지는지와 카드의 제목·주제·깊이만 묻는다
// (lib/pipeline/linkEvidence.ts). 근거 추출의 지시와 결과는 건드리지 않는다.
// - 브라우저(lib/linkageClient.ts)는 분석 결과에서 요청을 만들고(buildLinkageRequest), 서버(app/api/linkage/route.ts)는 받은 요청을
//   확인한 뒤(readLinkageRequest) AI 응답을 정리한다(normalizeLinkage).
// 어떤 입력에도 예외를 던지지 않는다.

/** 값의 범위와 길이 한도 */
export const LINKAGE_LIMITS = {
  /** 카드 제목의 길이 */
  titleLength: 24,
  /** 주제 태그의 길이 */
  themeLength: 12,
  /** 연결 이유의 길이 */
  reasonLength: 120,
  /** 평가 요소 하나의 연결 수 (AI 에 주는 지시와 같은 수. 넘으면 앞의 것만 남긴다) */
  linksPerCriterion: 8,
  /** 평가 요소 하나의 근거 수: 근거 추출의 상한(lib/pipeline/extractEvidence.ts 의 MAX_PER_CRITERION)과 같다 */
  evidencesPerCriterion: 12,
  /** 기준·항목·근거 id 의 길이 */
  idLength: 64,
  minDepth: 1,
  maxDepth: 3,
} as const;

/** 카드를 놓는 학년. 학년이 이 밖인(없는) 항목의 근거는 카드가 되지 않는다. */
export const LINKAGE_GRADES = [1, 2, 3] as const;

/** 연결 찾기에 보내는 기준: id 와 이름 */
export type LinkageCriterion = Pick<Criterion, "id" | "name">;

/** 연결 찾기에 보내는 항목(근거가 하나라도 든 항목): 가려진 원문 전체와 학년·과목 */
export type LinkageSection = Pick<Section, "id" | "category" | "grade" | "subject" | "fieldId" | "text">;

/** 연결 찾기에 보내는 근거 (AI 가 적은 이유는 보내지 않는다) */
export type LinkageEvidence = Pick<Evidence, "id" | "criterionId" | "sectionId" | "quote">;

/** POST /api/linkage 의 본문 */
export type LinkageRequest = {
  criteria: LinkageCriterion[];
  sections: LinkageSection[];
  evidences: LinkageEvidence[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isId(value: unknown): value is string {
  return typeof value === "string" && value.length >= 1 && value.length <= LINKAGE_LIMITS.idLength;
}

function isCardGrade(grade: number | null): grade is 1 | 2 | 3 {
  return grade === 1 || grade === 2 || grade === 3;
}

/** 여러 줄·연속 공백을 공백 하나로 줄이고 길이를 자른다. 문자열이 아니면 빈 글. */
function oneLine(value: unknown, maxLength: number): string {
  return typeof value === "string" ? truncateText(value.replace(/\s+/g, " ").trim(), maxLength) : "";
}

/**
 * 분석 결과에서 연결 찾기 요청을 만든다: 기준의 id·이름, 기준과 항목이 실제로 있는 근거(id·기준·항목·인용 구절),
 * 그 근거가 하나라도 든 항목(결과의 항목 순서 그대로). 근거가 없는 항목(인적·학적사항 등)과 AI 제안·블라인드 처리 내역은 넣지 않는다.
 * 결과의 항목은 이미 가려진 것이다(가리기 전 원문은 브라우저에 없다).
 */
export function buildLinkageRequest(result: Pick<AnalysisResult, "criteria" | "sections" | "evidences">): LinkageRequest {
  const criterionIds = new Set(result.criteria.criteria.map((criterion) => criterion.id));
  const sectionIds = new Set(result.sections.map((section) => section.id));
  const evidences = result.evidences
    .filter((evidence) => criterionIds.has(evidence.criterionId) && sectionIds.has(evidence.sectionId))
    .map(({ id, criterionId, sectionId, quote }) => ({ id, criterionId, sectionId, quote }));
  const used = new Set(evidences.map((evidence) => evidence.sectionId));
  return {
    criteria: result.criteria.criteria.map(({ id, name }) => ({ id, name })),
    sections: result.sections
      .filter((section) => used.has(section.id))
      .map((section) => ({
        id: section.id,
        category: section.category,
        grade: section.grade,
        ...(section.subject !== undefined ? { subject: section.subject } : {}),
        ...(section.fieldId !== undefined ? { fieldId: section.fieldId } : {}),
        text: section.text,
      })),
    evidences,
  };
}

/**
 * 밖에서 받은 값(POST /api/linkage 의 본문)을 확인해 연결 찾기 요청으로 만든다. 맞지 않으면 null.
 * - criteria: 1~MAX_CRITERIA 개. id 는 1~64자이고 겹치지 않으며, 이름은 공백을 뺀 길이가 1 이상이고 30자 이하.
 * - sections: 0~MAX_RECORD_SECTIONS 개. id 는 1~64자이고 겹치지 않는다. 나머지 필드의 한도는 학생부 항목의 것(lib/recordSections.ts)이다:
 *   category·text 는 공백을 뺀 길이가 1 이상, grade 는 null 이거나 1~MAX_SECTION_GRADE 의 정수, subject·fieldId 는 없거나 한도 안의 문자열,
 *   모든 text 길이의 합이 MAX_RECORD_TEXT_LENGTH 이하. 근거가 하나도 없는 항목이 있으면 맞지 않는 요청이다(근거가 든 항목만 받는다).
 * - evidences: 0 ~ 기준 수 × 12 개. id 는 1~64자이고 겹치지 않으며, 기준 id·항목 id 가 받은 것 안에 있고,
 *   인용 구절은 공백만이 아니며 그 항목 원문에 글자 그대로 있어야 한다.
 * 위 필드만 꺼내 새 객체로 만들므로 다른 키는 결과에 섞이지 않는다.
 */
export function readLinkageRequest(value: unknown): LinkageRequest | null {
  if (!isRecord(value)) return null;
  const { criteria, sections, evidences } = value;
  if (!Array.isArray(criteria) || !Array.isArray(sections) || !Array.isArray(evidences)) return null;
  if (criteria.length < 1 || criteria.length > MAX_CRITERIA || sections.length > MAX_RECORD_SECTIONS) return null;
  if (evidences.length > criteria.length * LINKAGE_LIMITS.evidencesPerCriterion) return null;

  const readCriteria: LinkageCriterion[] = [];
  const criterionIds = new Set<string>();
  for (const item of criteria) {
    if (!isRecord(item) || !isId(item.id) || criterionIds.has(item.id)) return null;
    if (typeof item.name !== "string" || item.name.trim() === "" || item.name.length > MAX_CRITERION_NAME_LENGTH) return null;
    criterionIds.add(item.id);
    readCriteria.push({ id: item.id, name: item.name });
  }

  const readSections: LinkageSection[] = [];
  const textById = new Map<string, string>();
  let totalLength = 0;
  for (const item of sections) {
    if (!isRecord(item) || !isId(item.id) || textById.has(item.id)) return null;
    const { category, grade, subject, fieldId, text } = item;
    if (typeof category !== "string" || category.trim() === "" || category.length > MAX_SECTION_CATEGORY_LENGTH) return null;
    if (grade !== null && !(typeof grade === "number" && Number.isInteger(grade) && grade >= 1 && grade <= MAX_SECTION_GRADE)) return null;
    if (subject !== undefined && (typeof subject !== "string" || subject.length > MAX_SECTION_SUBJECT_LENGTH)) return null;
    if (fieldId !== undefined && (typeof fieldId !== "string" || fieldId.length > MAX_SECTION_FIELD_ID_LENGTH)) return null;
    if (typeof text !== "string" || text.trim() === "" || text.length > MAX_SECTION_TEXT_LENGTH) return null;
    totalLength += text.length;
    if (totalLength > MAX_RECORD_TEXT_LENGTH) return null;
    textById.set(item.id, text);
    readSections.push({
      id: item.id,
      category,
      grade,
      ...(subject !== undefined && subject !== "" ? { subject } : {}),
      ...(fieldId !== undefined ? { fieldId } : {}),
      text,
    });
  }

  const readEvidences: LinkageEvidence[] = [];
  const evidenceIds = new Set<string>();
  const usedSectionIds = new Set<string>();
  for (const item of evidences) {
    if (!isRecord(item) || !isId(item.id) || evidenceIds.has(item.id)) return null;
    const { criterionId, sectionId, quote } = item;
    if (typeof criterionId !== "string" || !criterionIds.has(criterionId)) return null;
    if (typeof sectionId !== "string" || typeof quote !== "string" || quote.trim() === "") return null;
    const text = textById.get(sectionId);
    if (text === undefined || !text.includes(quote)) return null;
    evidenceIds.add(item.id);
    usedSectionIds.add(sectionId);
    readEvidences.push({ id: item.id, criterionId, sectionId, quote });
  }
  if (readSections.some((section) => !usedSectionIds.has(section.id))) return null;

  return { criteria: readCriteria, sections: readSections, evidences: readEvidences };
}

/** 정리하는 동안의 카드 (id 를 주기 전) */
type DraftCard = {
  criterionId: string;
  section: LinkageSection;
  grade: 1 | 2 | 3;
  evidences: LinkageEvidence[];
  title: string;
  theme: string;
  depth: 1 | 2 | 3 | null;
  /** 놓는 순서의 열쇠: 요청에서의 기준 순번, 항목 순번, 첫 근거가 원문에 나오는 자리 */
  order: readonly [number, number, number];
};

/** 인용 구절이 원문에 나오는 자리 (찾지 못하면 맨 뒤) */
function quotePosition(section: LinkageSection, evidence: LinkageEvidence): number {
  const at = section.text.indexOf(evidence.quote);
  return at < 0 ? Number.MAX_SAFE_INTEGER : at;
}

/** AI 가 제목을 주지 않은 카드의 제목: 과목, 과목이 없으면 항목명 */
function fallbackTitle(section: LinkageSection): string {
  const subject = section.subject?.trim() ?? "";
  return oneLine(subject === "" ? section.category : subject, LINKAGE_LIMITS.titleLength);
}

/** 주제 태그: 한 줄로 줄이고 앞의 "#" 을 뗀다(화면이 "#" 을 붙인다) */
function readTheme(value: unknown): string {
  return typeof value === "string" ? oneLine(value.replace(/^[\s#]+/, ""), LINKAGE_LIMITS.themeLength) : "";
}

function readDepth(value: unknown): 1 | 2 | 3 | null {
  return value === 1 || value === 2 || value === 3 ? value : null;
}

/**
 * AI 가 준 값(JSON 해석 결과)을 학년별 연계로 정리한다. 쓸 수 없으면(객체가 아니거나 criteria 가 배열이 아님) null.
 * 모양: { criteria: [{ id, cards: [{ evidenceIds, title, theme, depth }], links: [{ fromEvidenceId, toEvidenceId, kind, statedQuote, reason }] }] }.
 * 기준은 요청의 순서대로 보고 응답에서는 id 로 찾는다(응답에 없는 기준은 카드·연결을 주지 않은 것으로 본다).
 * - 카드: 근거 id 가 요청에 있고 그 기준의 것이며 학년이 1~3 인 항목의 것이어야 한다. 카드의 항목은 남은 첫 근거의 항목이고, 다른 항목의 근거는 뺀다.
 *   한 근거는 한 카드에만 든다(먼저 나온 카드). 남은 근거가 없으면 카드를 버린다. 근거는 원문에 나오는 순서로 둔다.
 *   제목은 한 줄 24자(비면 과목, 과목이 없으면 항목명), 주제 태그는 한 줄 12자(앞의 "#" 은 뗀다), 깊이는 1~3 의 정수가 아니면 null.
 * - 어느 카드에도 들지 않은 근거(학년이 1~3 인 항목의 것)는 근거 하나짜리 카드가 된다(제목은 과목·항목명, 태그 없음, 깊이 null).
 * - 카드는 기준 순서, 항목 순서, 첫 근거가 원문에 나오는 순서로 놓고 k1, k2 … id 를 준다.
 * - 연결: 두 근거가 든 카드로 바꾼다. 두 카드가 그 기준의 것이어야 하고, 학년이 거꾸로면 앞뒤를 바꾸고, 같은 학년이거나 같은 카드면 버린다.
 *   이유(한 줄 120자)가 비면 버린다. 같은 두 카드의 연결은 처음 남은 것만 둔다. 기준마다 8개까지(넘으면 앞의 것만).
 *   종류가 "stated" 이고 이어짐을 적은 구절을 뒤 카드의 항목 원문, 없으면 앞 카드의 항목 원문에서 찾으면(locateQuote) 기록에 적힌 연속이고
 *   구절은 원문에 적힌 그대로의 것으로 바꾼다. 찾지 못하면 AI 가 제안한 연관("suggested")으로 내리고 구절을 버린다.
 *   연결은 기준 순서, 받은 순서로 n1, n2 … id 를 준다.
 * 결과는 lib/validateResult.ts 의 linkageProblems 를 늘 통과한다(요청이 readLinkageRequest 를 통과한 것일 때).
 */
export function normalizeLinkage(raw: unknown, request: LinkageRequest): Linkage | null {
  if (!isRecord(raw) || !Array.isArray(raw.criteria)) return null;
  const sources = raw.criteria.filter(isRecord);
  const sectionIndex = new Map(request.sections.map((section, index) => [section.id, index]));
  const evidenceById = new Map(request.evidences.map((evidence) => [evidence.id, evidence]));

  const drafts: DraftCard[] = [];
  const cardOfEvidence = new Map<string, DraftCard>();

  /** 그 근거가 카드에 들 수 있으면(학년이 1~3 인 항목의 것) 그 항목과 학년 */
  const placeOf = (evidence: LinkageEvidence): { section: LinkageSection; index: number; grade: 1 | 2 | 3 } | null => {
    const index = sectionIndex.get(evidence.sectionId);
    if (index === undefined) return null;
    const section = request.sections[index];
    return isCardGrade(section.grade) ? { section, index, grade: section.grade } : null;
  };

  request.criteria.forEach((criterion, criterionIndex) => {
    const source = sources.find((item) => item.id === criterion.id);
    const rawCards = source !== undefined && Array.isArray(source.cards) ? source.cards.filter(isRecord) : [];

    const addCard = (evidences: LinkageEvidence[], place: NonNullable<ReturnType<typeof placeOf>>, rawCard: Record<string, unknown> | null) => {
      const ordered = [...evidences].sort((a, b) => quotePosition(place.section, a) - quotePosition(place.section, b));
      const title = rawCard === null ? "" : oneLine(rawCard.title, LINKAGE_LIMITS.titleLength);
      const draft: DraftCard = {
        criterionId: criterion.id,
        section: place.section,
        grade: place.grade,
        evidences: ordered,
        title: title === "" ? fallbackTitle(place.section) : title,
        theme: rawCard === null ? "" : readTheme(rawCard.theme),
        depth: rawCard === null ? null : readDepth(rawCard.depth),
        order: [criterionIndex, place.index, quotePosition(place.section, ordered[0])],
      };
      drafts.push(draft);
      for (const evidence of ordered) cardOfEvidence.set(evidence.id, draft);
    };

    for (const rawCard of rawCards) {
      const ids = Array.isArray(rawCard.evidenceIds) ? rawCard.evidenceIds : [];
      const kept: LinkageEvidence[] = [];
      let place: ReturnType<typeof placeOf> = null;
      for (const id of ids) {
        const evidence = typeof id === "string" ? evidenceById.get(id) : undefined;
        if (evidence === undefined || evidence.criterionId !== criterion.id) continue;
        if (cardOfEvidence.has(evidence.id) || kept.includes(evidence)) continue;
        const found = placeOf(evidence);
        if (found === null) continue;
        if (place === null) place = found;
        else if (found.section.id !== place.section.id) continue;
        kept.push(evidence);
      }
      if (place !== null && kept.length > 0) addCard(kept, place, rawCard);
    }

    // 어느 카드에도 들지 않은 근거는 근거 하나짜리 카드가 된다.
    for (const evidence of request.evidences) {
      if (evidence.criterionId !== criterion.id || cardOfEvidence.has(evidence.id)) continue;
      const place = placeOf(evidence);
      if (place !== null) addCard([evidence], place, null);
    }
  });

  drafts.sort((a, b) => a.order[0] - b.order[0] || a.order[1] - b.order[1] || a.order[2] - b.order[2]);
  const idOfDraft = new Map<DraftCard, string>();
  const cards: LinkageCard[] = drafts.map((draft, index) => {
    const id = `k${index + 1}`;
    idOfDraft.set(draft, id);
    return {
      id,
      criterionId: draft.criterionId,
      sectionId: draft.section.id,
      evidenceIds: draft.evidences.map((evidence) => evidence.id),
      title: draft.title,
      theme: draft.theme,
      depth: draft.depth,
    };
  });

  const links: LinkageLink[] = [];
  for (const criterion of request.criteria) {
    const source = sources.find((item) => item.id === criterion.id);
    const rawLinks = source !== undefined && Array.isArray(source.links) ? source.links.filter(isRecord) : [];
    const pairs = new Set<string>();
    let kept = 0;
    for (const rawLink of rawLinks) {
      if (kept >= LINKAGE_LIMITS.linksPerCriterion) break;
      const first = typeof rawLink.fromEvidenceId === "string" ? cardOfEvidence.get(rawLink.fromEvidenceId) : undefined;
      const second = typeof rawLink.toEvidenceId === "string" ? cardOfEvidence.get(rawLink.toEvidenceId) : undefined;
      if (first === undefined || second === undefined || first === second) continue;
      if (first.criterionId !== criterion.id || second.criterionId !== criterion.id || first.grade === second.grade) continue;
      const [from, to] = first.grade < second.grade ? [first, second] : [second, first];
      const fromId = idOfDraft.get(from);
      const toId = idOfDraft.get(to);
      if (fromId === undefined || toId === undefined) continue;
      const pair = `${fromId}>${toId}`;
      const reason = oneLine(rawLink.reason, LINKAGE_LIMITS.reasonLength);
      if (pairs.has(pair) || reason === "") continue;
      pairs.add(pair);
      kept += 1;
      const base = { id: `n${links.length + 1}`, criterionId: criterion.id, fromCardId: fromId, toCardId: toId };
      const stated = rawLink.kind === "stated" && typeof rawLink.statedQuote === "string" ? locateStated(rawLink.statedQuote, to, from) : null;
      links.push(
        stated === null
          ? { ...base, kind: "suggested", reason }
          : { ...base, kind: "stated", statedQuote: stated.quote, statedSectionId: stated.sectionId, reason },
      );
    }
  }

  return { cards, links };
}

/** 이어짐을 적은 구절을 뒤 카드의 항목 원문, 없으면 앞 카드의 항목 원문에서 찾는다. 찾으면 원문에 적힌 그대로의 구절과 그 항목. */
function locateStated(quote: string, to: DraftCard, from: DraftCard): { quote: string; sectionId: string } | null {
  for (const card of [to, from]) {
    const found = locateQuote(card.section.text, quote);
    if (found !== null && found.trim() !== "") return { quote: found, sectionId: card.section.id };
  }
  return null;
}
