import type { AnalysisResult } from "@/types/analysis";

// 지원자 관리 화면의 지원자 형식과 화면 숫자·문구를 만드는 순수 함수. 화면에서만 쓴다.
// 숫자(접수 건수, 걸러 보기 수, 경쟁률, 검토 완료 비율·건수, 검토 대기 건수)는 모두 지금 데이터에서 계산한다(상수로 적지 않는다).

/** 지원자의 상태. 저장한 가림 결정에 따라 "확인 필요" ↔ "완료" 만 바뀐다("진행 중"·"대기" 는 바뀌지 않는다). */
export const APPLICANT_STATUSES = ["확인 필요", "진행 중", "대기", "완료"] as const;
export type ApplicantStatus = (typeof APPLICANT_STATUSES)[number];

/** 걸러 보기: 전체 또는 상태 하나 */
export type ApplicantFilter = "전체" | ApplicantStatus;
export const APPLICANT_FILTERS: readonly ApplicantFilter[] = ["전체", ...APPLICANT_STATUSES];

/** 가릴지 확인이 필요한 표현 하나에 대한 결정: 가림(mask) / 그대로 둠(keep) */
export type MaskDecision = "mask" | "keep";

/** 표현 id → 결정. 정하지 않은 표현은 키가 없다. */
export type ApplicantDecisions = Readonly<Record<string, MaskDecision>>;

/** 지원자 코드 → 그 지원자의 결정 */
export type ApplicantReviews = Readonly<Record<string, ApplicantDecisions>>;

export const NO_DECISIONS: ApplicantDecisions = Object.freeze({});
export const NO_REVIEWS: ApplicantReviews = Object.freeze({});

/** 가릴지 확인이 필요한 표현: 맥락 줄과 문장(before + target + after, target 만 강조) */
export type ReviewExpression = {
  id: string;
  context: string;
  before: string;
  target: string;
  after: string;
};

/** 지원자 한 명 */
export type Applicant = {
  /** "A-0133" 꼴 */
  code: string;
  /** 서류 정리 요약 (예: "4개 영역 인식") */
  documentSummary: string;
  /** 서류 정리에 문제가 있는지 (요약을 빨강으로 그리고 상세에 확인 안내를 붙인다) */
  documentProblem: boolean;
  /** 영역별 서류 수 (교과·세특·창체·행특 순서, 값은 "36과목" 처럼 단위까지 붙인 글) */
  documentCounts: readonly { label: string; value: string }[];
  /** 종류별 가림 수. 종류 이름과 개수는 정해져 있지 않다(받은 순서대로 그린다). */
  maskCounts: readonly { label: string; count: number }[];
  /** 가릴지 확인이 필요한 표현 (없으면 빈 배열) */
  expressions: readonly ReviewExpression[];
  /** 배정된 사정관 이름 */
  assignee: string;
  /** 처음 상태 (저장한 결정이 없을 때) */
  initialStatus: ApplicantStatus;
  /**
   * 원문보기로 여는 분석 결과. 업로드 화면에서 분석한 학생부(올린 지원자, lib/applicants/uploaded.ts)만 그 결과가 있고,
   * 예시 지원자는 없다(원문보기는 미리 만든 샘플 결과를 연다).
   */
  original?: AnalysisResult;
};

/** 종류별 가림 수의 합 (결정과 상관없이 그대로다) */
export function maskTotal(applicant: Applicant): number {
  return applicant.maskCounts.reduce((sum, item) => sum + item.count, 0);
}

/** 저장한 결정이 아직 없는 표현 수 */
export function undecidedCount(applicant: Applicant, decisions: ApplicantDecisions | undefined): number {
  return applicant.expressions.filter((expression) => decisions?.[expression.id] === undefined).length;
}

/**
 * 지금 상태: 처음 상태가 "확인 필요" 인 지원자는 저장한 결정으로 모든 표현이 정해졌으면 "완료", 아니면 "확인 필요".
 * 표현이 하나도 없는 "확인 필요" 지원자는 정할 것이 없으므로 그대로다. 다른 처음 상태는 바뀌지 않는다.
 */
export function applicantStatus(applicant: Applicant, decisions: ApplicantDecisions | undefined): ApplicantStatus {
  if (applicant.initialStatus !== "확인 필요" || applicant.expressions.length === 0) return applicant.initialStatus;
  return undecidedCount(applicant, decisions) === 0 ? "완료" : "확인 필요";
}

/**
 * 표의 "개인정보 가림" 글. 가린 곳 수("13곳 가림")와, 저장한 결정으로 정하지 않은 표현이 있으면 그 수("확인 2곳")다.
 * 화면은 둘을 " · " 로 이어 "13곳 가림 · 확인 2곳" 으로 적고 뒤쪽만 빨강으로 그린다. 정하지 않은 표현이 없으면 check 는 null 이다.
 */
export function maskSummary(
  applicant: Applicant,
  decisions: ApplicantDecisions | undefined,
): { masked: string; check: string | null } {
  const remaining = undecidedCount(applicant, decisions);
  return { masked: `${maskTotal(applicant)}곳 가림`, check: remaining > 0 ? `확인 ${remaining}곳` : null };
}

/** 검색 비교용 글: 공백과 "-" 를 빼고 영문을 대문자로 ("a -0133" → "A0133") */
export function normalizeSearchText(text: string): string {
  return text.replace(/[\s-]/g, "").toUpperCase();
}

/** 지원자 코드에 검색어가 들어 있는지. 검색어가 (공백·"-" 를 빼고) 비어 있으면 거르지 않는다. */
export function matchesSearch(code: string, query: string): boolean {
  const needle = normalizeSearchText(query);
  return needle === "" || normalizeSearchText(code).includes(needle);
}

/** 걸러 보기 버튼의 수: 전체와 상태마다의 지원자 수 */
export function statusCounts(statuses: readonly ApplicantStatus[]): Record<ApplicantFilter, number> {
  const counts: Record<ApplicantFilter, number> = { 전체: statuses.length, "확인 필요": 0, "진행 중": 0, 대기: 0, 완료: 0 };
  for (const status of statuses) counts[status] += 1;
  return counts;
}

/** 소수 첫째 자리까지 반올림한 글 (10.4666… → "10.5", 96.4968… → "96.5"). 나눌 수 없으면 "0.0". */
function oneDecimal(value: number): string {
  if (!Number.isFinite(value)) return "0.0";
  return (Math.round(value * 10) / 10).toFixed(1);
}

/** 경쟁률: 접수 인원 ÷ 모집 인원, 소수 첫째 자리 반올림 ("10.5:1") */
export function competitionRate(total: number, quota: number): string {
  return `${oneDecimal(quota > 0 ? total / quota : Number.NaN)}:1`;
}

/** 검토 완료 비율(%): 완료 ÷ 전체 × 100, 소수 첫째 자리까지 ("96.5"). 막대의 채움 너비도 이 값이다. */
export function reviewPercent(done: number, total: number): string {
  return oneDecimal(total > 0 ? (done / total) * 100 : Number.NaN);
}
