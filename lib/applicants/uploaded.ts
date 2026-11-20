import type { AnalysisResult, Linkage, Section } from "@/types/analysis";
import { ADMISSION } from "../admission.ts";
import { isAnalysisResult, isLinkage } from "../validateResult.ts";
import type { Applicant } from "./applicants.ts";
import { SAMPLE_APPLICANT_COUNT, sampleApplicantCode } from "./sampleApplicants.ts";

// 올린 지원자: 학생부 올리기 화면에서 분석한 학생부를 지원자 관리에 지원자로 보여 주기 위한 형식·확인·변환. 순수 함수.
// 저장 값은 { version: 1, items: [{ code, at, result }] } 이다(lib/applicants/uploadedStorage.ts 가 localStorage 에 쓴다).
// - code: "A-" + 네 자리 숫자. 예시 지원자(A-0001~A-0314) 뒤 번호(315 이상)다.
// - at: 남긴 때(ISO 문자열).
// - result: 서버가 돌려준 분석 결과 그대로(블라인드 처리된 원문·근거·처리 내역·AI 제안). 원문보기 화면과 평가하기 화면이 이 값을 쓴다.
// 파일 이름은 학생 이름이 들어 있는 경우가 많아 어디에도 두지 않는다(이 형식에 필드가 없다).

/** 지금 저장 형식의 버전 */
export const UPLOADED_APPLICANTS_VERSION = 1;

/**
 * 올린 지원자를 남기는 최대 수 (넘으면 오래된 것부터 버린다). 학생부를 여러 건 한꺼번에 올릴 수 있어 30건이다.
 * 한 건의 분석 결과가 수만 자라, 더 늘리면 localStorage 의 용량(브라우저마다 500만 자 안팎)에 걸린다.
 */
export const MAX_UPLOADED_APPLICANTS = 30;

/** 올린 지원자의 가장 작은 번호 (예시 지원자 다음 번호) */
const FIRST_UPLOADED_NUMBER = SAMPLE_APPLICANT_COUNT + 1;

/** 코드에 쓸 수 있는 가장 큰 번호 ("A-" + 네 자리) */
const MAX_CODE_NUMBER = 9999;

/** 올린 지원자 하나 */
export type UploadedApplicant = {
  code: string;
  at: string;
  result: AnalysisResult;
};

/** 올린 지원자가 없을 때 돌려주는 빈 목록 (서버 스냅숏도 이것. 늘 같은 참조) */
export const NO_UPLOADED_APPLICANTS: readonly UploadedApplicant[] = Object.freeze([]);

const CODE_PATTERN = /^A-(\d{4})$/;

/** 코드의 번호 ("A-0315" → 315). 형식이 아니면 null. */
function codeNumber(code: string): number | null {
  const match = CODE_PATTERN.exec(code);
  return match === null ? null : Number(match[1]);
}

/** 올린 지원자의 코드인지: "A-" + 네 자리이고 번호가 예시 지원자 다음(315) 이상 */
export function isUploadedCode(code: string): boolean {
  const number = codeNumber(code);
  return number !== null && number >= FIRST_UPLOADED_NUMBER;
}

/** 올린 지원자 코드의 번호 (형식이 아니면 0). 코드 순서로 늘어놓을 때 쓴다. */
export function uploadedCodeNumber(code: string): number {
  return codeNumber(code) ?? 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 항목 하나를 확인한다: 코드가 "A-" + 네 자리이고 번호가 315 이상, at 이 날짜로 읽힘, result 가 결과 모양 검사(isAnalysisResult)를 통과.
 * result 의 학년별 연계(linkage)만 모양이 틀리면 연계를 뺀 결과로 남긴다.
 */
function parseItem(value: unknown): UploadedApplicant | null {
  if (!isRecord(value)) return null;
  const { code, at, result } = value;
  if (typeof code !== "string" || typeof at !== "string") return null;
  const number = codeNumber(code);
  if (number === null || number < FIRST_UPLOADED_NUMBER) return null;
  if (Number.isNaN(Date.parse(at))) return null;
  // 학년별 연계의 모양이 틀리면 연계만 버리고 지원자는 남긴다(연계는 다시 만들 수 있지만 분석 결과는 그렇지 않다).
  const checked = isRecord(result) && result.linkage !== undefined && !isLinkage(result.linkage) ? withoutLinkage(result) : result;
  if (!isAnalysisResult(checked)) return null;
  return { code, at, result: checked };
}

function withoutLinkage(result: Record<string, unknown>): Record<string, unknown> {
  const { linkage: _linkage, ...rest } = result;
  void _linkage;
  return rest;
}

/**
 * 저장소에서 읽은 값(JSON 해석 결과)을 확인한다. 객체가 아니거나 version 이 1 이 아니거나 items 가 배열이 아니면 올린 지원자가 없는 것으로 본다.
 * 항목은 하나씩 확인해(parseItem, 앞의 항목과 코드가 겹치면 뒤의 것을 버림) 통과한 것만 쓰고, 30건을 넘으면 뒤의 30건만 쓴다.
 */
export function parseUploadedApplicants(value: unknown): readonly UploadedApplicant[] {
  if (!isRecord(value) || value.version !== UPLOADED_APPLICANTS_VERSION || !Array.isArray(value.items)) {
    return NO_UPLOADED_APPLICANTS;
  }
  const items: UploadedApplicant[] = [];
  const seen = new Set<string>();
  for (const raw of value.items) {
    const item = parseItem(raw);
    if (item === null || seen.has(item.code)) continue;
    seen.add(item.code);
    items.push(item);
  }
  const kept = items.slice(-MAX_UPLOADED_APPLICANTS);
  return kept.length === 0 ? NO_UPLOADED_APPLICANTS : kept;
}

/** 저장할 값 */
export function serializeUploadedApplicants(items: readonly UploadedApplicant[]): string {
  return JSON.stringify({ version: UPLOADED_APPLICANTS_VERSION, items });
}

/**
 * 목록 정리: 코드가 겹치면 앞의 것을 남기고, 코드 순서로 늘어놓고, 최근(번호가 큰) 30건만 둔다.
 * 저장할 때와 화면 목록(저장소의 값 + 메모리에만 둔 값)을 만들 때 쓴다.
 */
export function arrangeUploadedApplicants(items: readonly UploadedApplicant[]): readonly UploadedApplicant[] {
  const seen = new Set<string>();
  const unique: UploadedApplicant[] = [];
  for (const item of items) {
    if (seen.has(item.code)) continue;
    seen.add(item.code);
    unique.push(item);
  }
  unique.sort((a, b) => (codeNumber(a.code) ?? 0) - (codeNumber(b.code) ?? 0));
  const kept = unique.slice(-MAX_UPLOADED_APPLICANTS);
  return kept.length === 0 ? NO_UPLOADED_APPLICANTS : kept;
}

/**
 * 올린 지원자 한 명의 분석 결과에 학년별 연계를 붙인 새 목록. 코드와 남긴 때(at)가 모두 같은 지원자만 바꾸고(코드는 다른 학생부에
 * 다시 붙을 수 있다), 그 지원자의 코드·남긴 때·결과의 다른 필드는 그대로 둔다(적어 둔 평가와 가린 쪽 그림이 코드와 남긴 때에 묶여 있다).
 * 그런 지원자가 없으면 null 이다. 받은 목록은 바꾸지 않는다.
 */
export function withUploadedLinkage(
  items: readonly UploadedApplicant[],
  code: string,
  at: string,
  linkage: Linkage,
): readonly UploadedApplicant[] | null {
  const index = items.findIndex((item) => item.code === code && item.at === at);
  if (index < 0) return null;
  return items.map((item, position) => (position === index ? { ...item, result: { ...item.result, linkage } } : item));
}

/**
 * 새 올린 지원자의 코드: 예시 지원자(1~314)와 지금 남아 있는 올린 지원자 가운데 가장 큰 번호 + 1 (처음은 "A-0315").
 * 네 자리를 넘으면(이미 A-9999 가 있으면) null 이다(그때는 남기지 않는다).
 */
export function nextUploadedCode(items: readonly UploadedApplicant[]): string | null {
  let max = SAMPLE_APPLICANT_COUNT;
  for (const item of items) max = Math.max(max, codeNumber(item.code) ?? 0);
  const next = max + 1;
  return next > MAX_CODE_NUMBER ? null : sampleApplicantCode(next);
}

/**
 * 서류 확인의 네 영역과 영역에 드는 항목 이름(파서가 준 category). 그 밖의 항목(인적·학적사항, 출결 등)은 세지 않는다.
 * 평가하기 화면의 서류 원문도 이 나눔을 쓴다(lib/evaluate/uploadedEvaluation.ts).
 */
export const DOCUMENT_AREAS: readonly { label: "교과" | "세특" | "창체" | "행특"; categories: readonly string[] }[] = [
  { label: "교과", categories: ["교과 성적"] },
  { label: "세특", categories: ["세부능력 및 특기사항"] },
  { label: "창체", categories: ["자율활동", "동아리활동", "진로활동", "봉사활동실적"] },
  { label: "행특", categories: ["행동특성 및 종합의견"] },
];

/** 영역별 항목 수 (교과·세특·창체·행특 순서) */
function areaCounts(sections: readonly Section[]): { label: string; count: number }[] {
  return DOCUMENT_AREAS.map(({ label, categories }) => ({
    label,
    count: sections.filter((section) => categories.includes(section.category)).length,
  }));
}

/** 종류별 가림 수: masks 를 받은 순서대로, 같은 종류가 또 나오면 처음 나온 자리에 더한다(서버 결과는 종류가 겹치지 않는다). */
function maskCountsOf(masks: AnalysisResult["masks"]): { label: string; count: number }[] {
  const counts: { label: string; count: number }[] = [];
  for (const mask of masks) {
    const existing = counts.find((item) => item.label === mask.type);
    if (existing !== undefined) existing.count += mask.count;
    else counts.push({ label: mask.type, count: mask.count });
  }
  return counts;
}

/**
 * 올린 지원자 → 지원자 관리의 지원자.
 * - 배정은 로그인한 사정관, 상태는 "완료"(가릴지 확인이 필요한 표현이 없다).
 * - 서류 정리: 항목이 하나라도 있는 영역 수로 "<N>개 영역 인식". N 이 4 보다 작으면 문제로 표시한다(빨간 글자, 상세의 안내 한 줄).
 * - 서류 확인 네 칸: 영역별 항목 수 "<n>건"(교과도 "건". 파서의 항목은 과목 단위가 아니다).
 * - 개인정보 가림: 결과의 masks 를 받은 순서대로 종류별 가림 수. masks 가 비면 0곳이고 종류별 칸은 없다.
 * - 원문보기는 이 결과를 연다(original).
 */
export function uploadedToApplicant(item: UploadedApplicant): Applicant {
  const counts = areaCounts(item.result.sections);
  const recognized = counts.filter((area) => area.count > 0).length;
  return {
    code: item.code,
    documentSummary: `${recognized}개 영역 인식`,
    documentProblem: recognized < DOCUMENT_AREAS.length,
    documentCounts: counts.map(({ label, count }) => ({ label, value: `${count}건` })),
    maskCounts: maskCountsOf(item.result.masks),
    expressions: [],
    assignee: ADMISSION.reviewerName,
    initialStatus: "완료",
    original: item.result,
  };
}
