import { MAX_WARNINGS } from "../criteria/limits.ts";
import { normalizeWarnings, truncateText } from "../criteria/normalize.ts";
import {
  MAX_WEIGHT,
  MIN_WEIGHT,
  TOTAL_WEIGHT,
  parsePrepCriteria,
  totalWeight,
  type PrepCriteria,
  type PrepElement,
} from "./criteria.ts";
import { normalizeDraftGroups } from "./guidelineDraft.ts";

// 위원 의견으로 만든 공통 기준 초안: 요청에 실리는 위원 의견의 형식 확인, AI 가 돌려준 값을 정리하는 순수 함수,
// 초안을 저장할 때 남기는 기록 내용. /api/consensus(서버)가 요청을 확인하고 AI 응답을 정리하며, 화면(lib/consensusClient.ts)도
// 받은 값을 같은 함수로 한 번 더 확인한다. 브라우저와 Node 어디서나 돌며, 어떤 입력에도 예외를 던지지 않는다.
//
// 공통 기준 초안은 지금 저장한 평가 기준에서 시작한다. 평가 요소(이름·순서·id)는 그대로 두고(평가 요소는 모집요강이 정한다),
// 세부 평가 항목(묶음·질문)과 배점만 위원 의견에 맞춰 고친 것이다. 배점은 사람이 평가·배점 설정에서 다시 협의해 정한다.

/** 위원 의견과 의견 정리의 한도. 길이는 앞뒤 공백을 뺀 글자 수로 잰다. */
export const CONSENSUS_LIMITS = {
  /** 한 번에 보낼 수 있는 위원 수(= 위원 번호의 최댓값) */
  members: 6,
  /** 의견 한 건의 길이 */
  opinionLength: 1000,
  /** 위원의 역할("사정관", "위촉위원") 길이 */
  roleLength: 20,
  /** 의견 정리 건수와 제목·내용 길이 */
  points: 6,
  pointTitleLength: 40,
  pointBodyLength: 300,
} as const;

/** 위원 한 사람의 의견. member 는 위원 번호(1 부터)이고 AI 에는 "위원 <번호>" 로 보낸다(이름은 보내지 않는다). */
export type ConsensusOpinion = {
  member: number;
  role: string;
  text: string;
};

/** 의견 정리 한 건의 종류: 의견이 모여 초안에 반영한 것(agreed), 의견이 갈리거나 사람이 정해야 하는 것(open) */
export type ConsensusPointKind = "agreed" | "open";

/** 의견 정리 한 건 (위원들이 다시 협의할 때 보는 글) */
export type ConsensusPoint = {
  kind: ConsensusPointKind;
  title: string;
  body: string;
};

/** 정리한 공통 기준 초안 */
export type ConsensusDraftResult = {
  /** 공통 기준 초안. 요소의 id·이름·순서는 바탕이 된 평가 기준과 같다. */
  criteria: PrepCriteria;
  /** 의견 정리 (0~6건) */
  points: ConsensusPoint[];
  /** 경고 (0~10건, 한 건 300자) */
  warnings: string[];
};

/** AI 가 준 배점을 쓸 수 없어(정수가 아님, 합이 100 이 아님 등) 지금 배점을 그대로 뒀을 때의 경고 */
export const KEPT_WEIGHT_WARNING = "AI 가 제안한 배점을 쓸 수 없어 지금 배점을 그대로 두었습니다. 평가·배점 설정에서 조정해 주세요.";

/** AI 응답에서 그 요소의 세부 평가 항목을 쓸 수 없어 지금 것을 그대로 뒀을 때의 경고 */
export function keptElementWarning(elementName: string): string {
  return `${elementName}: AI 응답에서 세부 평가 항목을 읽지 못해 지금 항목을 그대로 두었습니다.`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/** 문자열이면 앞뒤 공백을 빼고 max 글자로 자른 값, 아니면 "" */
function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? truncateText(value.trim(), max) : "";
}

/**
 * 요청에 실린 위원 의견을 확인한다. 맞으면 위원 번호순으로 정리한 목록(문자열은 앞뒤 공백을 뺀 값)을, 하나라도 벗어나면 null 을 돌려준다
 * (일부만 살리지 않는다). 확인: 1~6건의 배열, 위원 번호는 1~6 정수이고 서로 다름, 역할 1~20자, 의견 1~1,000자.
 */
export function parseConsensusOpinions(value: unknown): ConsensusOpinion[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > CONSENSUS_LIMITS.members) return null;
  const opinions: ConsensusOpinion[] = [];
  const seen = new Set<number>();
  for (const item of value) {
    const record = asRecord(item);
    if (record === null) return null;
    const { member, role, text } = record;
    if (typeof member !== "number" || !Number.isInteger(member) || member < 1 || member > CONSENSUS_LIMITS.members) return null;
    if (seen.has(member) || typeof role !== "string" || typeof text !== "string") return null;
    const trimmedRole = role.trim();
    const trimmedText = text.trim();
    if (trimmedRole.length < 1 || trimmedRole.length > CONSENSUS_LIMITS.roleLength) return null;
    if (trimmedText.length < 1 || trimmedText.length > CONSENSUS_LIMITS.opinionLength) return null;
    seen.add(member);
    opinions.push({ member, role: trimmedRole, text: trimmedText });
  }
  return opinions.sort((a, b) => a.member - b.member);
}

/**
 * 의견 정리를 정리한다: 객체이고 종류가 "agreed"·"open" 이며 제목·내용이 문자열이고 앞뒤 공백을 뺀 뒤 비지 않은 것만,
 * 제목 40자·내용 300자로 자르고 앞에서 6건까지. 배열이 아니면 빈 배열.
 */
export function normalizeConsensusPoints(value: unknown): ConsensusPoint[] {
  if (!Array.isArray(value)) return [];
  const points: ConsensusPoint[] = [];
  for (const item of value) {
    if (points.length >= CONSENSUS_LIMITS.points) break;
    const record = asRecord(item);
    if (record === null) continue;
    const kind = record.kind;
    if (kind !== "agreed" && kind !== "open") continue;
    const title = cleanText(record.title, CONSENSUS_LIMITS.pointTitleLength);
    const body = cleanText(record.body, CONSENSUS_LIMITS.pointBodyLength);
    if (title !== "" && body !== "") points.push({ kind, title, body });
  }
  return points;
}

function isValidWeight(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= MIN_WEIGHT && value <= MAX_WEIGHT;
}

/**
 * AI 가 돌려준 공통 기준 초안 { elements, points, warnings } 를 바탕 평가 기준(base)에 맞춰 정리한다.
 * - 요소: 바탕의 요소를 순서대로 본다. 같은 자리의 받은 요소 이름이 (앞뒤 공백을 빼고) 같으면 그것을, 아니면 아직 쓰지 않은 받은 요소
 *   가운데 이름이 같은 첫 것을 짝으로 삼는다. 요소의 id·이름·순서는 늘 바탕의 것이다(받은 값에 요소가 더 있거나 이름이 달라도 쓰지 않는다).
 * - 세부 평가 항목: 짝의 묶음을 모집요강 초안과 같은 규칙(normalizeDraftGroups)으로 정리해 쓴다. 짝이 없거나 남은 묶음이 0개면
 *   바탕의 묶음을 그대로 두고 그 요소의 경고를 더한다.
 * - 배점: 모든 요소에 짝이 있고 그 weight 가 모두 0~100 정수이며 합이 100 이면 그대로, 아니면 바탕의 배점을 그대로 두고 배점 경고를 더한다.
 * - 의견 정리: normalizeConsensusPoints. 경고: AI 의 경고(normalizeWarnings) 뒤에 코드가 붙이는 경고를 두되, 전체가 10건을 넘지 않게
 *   AI 의 경고를 앞에서부터 자른다(코드가 붙이는 경고는 빠지지 않는다).
 * - 바탕의 guideline(모집요강 파일 이름·변경 사항)은 그대로 남는다. 결과는 parsePrepCriteria 를 통과한다.
 */
export function normalizeConsensusDraft(value: unknown, base: PrepCriteria): ConsensusDraftResult {
  const record = asRecord(value) ?? {};
  const received = Array.isArray(record.elements) ? record.elements.map(asRecord) : [];
  const used = new Set<number>();

  function matchOf(index: number, name: string): Record<string, unknown> | null {
    const sameName = (candidate: Record<string, unknown> | null | undefined) =>
      candidate !== null && candidate !== undefined && typeof candidate.name === "string" && candidate.name.trim() === name;
    let found = -1;
    if (!used.has(index) && sameName(received[index])) found = index;
    else found = received.findIndex((candidate, position) => !used.has(position) && sameName(candidate));
    if (found < 0) return null;
    used.add(found);
    return received[found];
  }

  const codeWarnings: string[] = [];
  const weights: unknown[] = [];
  const elements: PrepElement[] = base.elements.map((element, index) => {
    const match = matchOf(index, element.name);
    weights.push(match?.weight);
    const groups = match === null ? [] : normalizeDraftGroups(match.groups);
    if (groups.length === 0) {
      codeWarnings.push(keptElementWarning(element.name));
      return { ...element };
    }
    return { id: element.id, name: element.name, weight: element.weight, groups };
  });

  const usable = weights.every(isValidWeight) && totalWeight(weights as number[]) === TOTAL_WEIGHT;
  if (!usable) codeWarnings.push(KEPT_WEIGHT_WARNING);
  const weighted = usable ? elements.map((element, index) => ({ ...element, weight: weights[index] as number })) : elements;

  const built =
    base.guideline === undefined
      ? { version: 1, department: base.department, elements: weighted }
      : { version: 1, department: base.department, elements: weighted, guideline: base.guideline };
  // 정리한 값은 저장 값 확인을 늘 통과한다. 그래도 한 번 거쳐 저장할 때와 같은 모양을 보장하고, 통과하지 못하면 바탕을 그대로 둔다.
  const criteria = parsePrepCriteria(built) ?? base;

  const kept = codeWarnings.slice(0, MAX_WARNINGS);
  const room = Math.max(0, MAX_WARNINGS - kept.length);
  const warnings = [...normalizeWarnings(record.warnings).slice(0, room), ...kept];

  return { criteria, points: normalizeConsensusPoints(record.points), warnings };
}

/**
 * 공통 기준 초안을 저장할 때 남기는 기록 내용:
 * "위원 의견으로 공통 기준을 만듦: 위원 <N>명 (평가 요소 <M>개, 배점 <a>·<b>·…)".
 */
export function consensusSaveSummary(memberCount: number, elements: readonly PrepElement[]): string {
  return `위원 의견으로 공통 기준을 만듦: 위원 ${memberCount}명 (평가 요소 ${elements.length}개, 배점 ${elements
    .map((element) => element.weight)
    .join("·")})`;
}
