import { ADMISSION } from "../admission.ts";
import type { Applicant, ApplicantStatus, ReviewExpression } from "./applicants.ts";

// 지원자 관리 화면의 예시 지원자 314명 (.orchestration/prep-applicants-pages/specs/T2-data.json 을 옮긴 것).
// 실제 지원자·학교·지명이 아니다. A-0133 의 값은 디자인에 적힌 그대로이고, A-0187·A-0251 의 상세 값과 나머지 311명을 만드는 규칙은
// 화면을 채우려고 지어낸 임시 값이다. 314명을 일일이 적지 않고 아래 규칙으로 계산해 만든다(난수·현재 시각을 쓰지 않아 늘 같은 결과).

/** 예시 지원자 수 (A-0001 ~ A-0314) */
export const SAMPLE_APPLICANT_COUNT = 314;

/** 번호(1~314) → 코드 "A-0133" (A- 뒤에 네 자리 숫자) */
export function sampleApplicantCode(n: number): string {
  return `A-${String(n).padStart(4, "0")}`;
}

/** 처음 상태. 여기에 없는 지원자는 모두 "완료" 다. */
const INITIAL_STATUSES: Readonly<Record<Exclude<ApplicantStatus, "완료">, readonly string[]>> = {
  "확인 필요": ["A-0133", "A-0187", "A-0251"],
  "진행 중": ["A-0042", "A-0096", "A-0158", "A-0203", "A-0277", "A-0301"],
  대기: ["A-0310", "A-0314"],
};

/** 상세 값이 정해진 세 명. 배정은 모두 로그인한 사정관이다(아래 MY_NUMBERS). */
type DetailedApplicant = Omit<Applicant, "assignee" | "initialStatus">;

const DETAILED_APPLICANTS: readonly DetailedApplicant[] = [
  {
    code: "A-0133",
    documentSummary: "4개 영역 인식",
    documentProblem: false,
    documentCounts: documentCounts("36과목", "29건", "13건", "3건"),
    maskCounts: [
      { label: "이름", count: 4 },
      { label: "출신 학교", count: 6 },
      { label: "지역", count: 2 },
      { label: "부모 정보", count: 1 },
    ],
    expressions: [
      {
        id: "x1",
        context: "창체 · 2학년 동아리 · 학교 고유 행사명일 수 있음",
        before: "교내 축제 ‘",
        target: "한울제",
        after: "’에서 통학 버스 도착 알림 앱을 시연함.",
      },
      {
        id: "x2",
        context: "세특 · 2학년 정보 · 사전에 없는 지명",
        before: "지역 문제를 찾기 위해 ",
        target: "솔내구청",
        after: " 청소년 정책 공모전에 팀으로 참가함.",
      },
    ],
  },
  {
    code: "A-0187",
    documentSummary: "4개 영역 인식",
    documentProblem: false,
    documentCounts: documentCounts("34과목", "27건", "12건", "3건"),
    maskCounts: [
      { label: "이름", count: 3 },
      { label: "출신 학교", count: 4 },
      { label: "지역", count: 1 },
      { label: "부모 정보", count: 1 },
    ],
    expressions: [
      {
        id: "x1",
        context: "창체 · 1학년 자율활동 · 학교 고유 행사명일 수 있음",
        before: "학급 대표로 ‘",
        target: "가람제",
        after: "’ 부스 운영 계획을 세우고 역할을 나눔.",
      },
    ],
  },
  {
    code: "A-0251",
    documentSummary: "스캔본 인식 신뢰도 71%",
    documentProblem: true,
    documentCounts: documentCounts("31과목", "22건", "9건", "3건"),
    maskCounts: [
      { label: "이름", count: 2 },
      { label: "출신 학교", count: 3 },
      { label: "지역", count: 1 },
      { label: "부모 정보", count: 0 },
    ],
    expressions: [
      {
        id: "x1",
        context: "세특 · 3학년 수학 · 사전에 없는 기관명",
        before: "방과 후 ",
        target: "미리내도서관",
        after: " 수학 멘토링에서 중학생의 질문에 답함.",
      },
    ],
  },
];

const NO_EXPRESSIONS: readonly ReviewExpression[] = [];

/** 영역별 서류 수 (교과·세특·창체·행특 순서) */
function documentCounts(subjects: string, details: string, activities: string, behavior: string): Applicant["documentCounts"] {
  return [
    { label: "교과", value: subjects },
    { label: "세특", value: details },
    { label: "창체", value: activities },
    { label: "행특", value: behavior },
  ];
}

/** 처음 상태 */
function initialStatusOf(code: string): ApplicantStatus {
  for (const [status, codes] of Object.entries(INITIAL_STATUSES)) {
    if (codes.includes(code)) return status as ApplicantStatus;
  }
  return "완료";
}

/**
 * 로그인한 사정관이 담당하는 예시 지원자의 번호 (24명). 지원자 관리 화면에는 이 지원자들과 올린 지원자만 보인다.
 * 평가하기에 배정된 지원자(lib/evaluate/sampleEvaluations.ts 의 APPLICANT_SOURCES)와 같은 사람들이어야 한다. 한쪽만 바꾸면
 * 지원자 관리에는 있는데 평가하기에는 없는 지원자가 생긴다(scripts/check-applicants.ts 가 확인한다).
 * 상세 값이 정해진 세 명(133·187·251)도 여기에 들어 있다.
 */
const MY_NUMBERS: readonly number[] = [
  4, 9, 15, 21, 26, 33, 38, 42, 47, 53, 58, 67, 72, 79, 85, 91, 98, 104, 110, 117, 124, 133, 187, 251,
];

/**
 * 배정: 로그인한 사정관이 담당하는 번호면 그 사정관(홍길동), 아니면 번호가 짝수일 때 "사정관 B", 홀수일 때 "사정관 C".
 * 다른 사정관이 담당하는 지원자는 지원자 관리 화면에 보이지 않고 접수 인원에만 들어간다.
 */
function assigneeOf(n: number): string {
  if (MY_NUMBERS.includes(n)) return ADMISSION.reviewerName;
  return n % 2 === 0 ? "사정관 B" : "사정관 C";
}

/**
 * 상세 값이 없는 지원자(311명)의 값. n 은 번호(1~314).
 * - 가림 수 합 k = 5 + ((n × 7) mod 12) → 5~16. 이름 = floor(k × 0.3), 출신 학교 = floor(k × 0.45), 부모 정보 = n mod 2,
 *   지역 = k − 이름 − 출신 학교 − 부모 정보. 소수 곱셈의 오차가 없게 정수로 계산한다(k × 3 ÷ 10, k × 45 ÷ 100).
 * - 서류 수: 교과 = 30 + (n mod 9) 과목, 세특 = 24 + (n mod 8) 건, 창체 = 10 + (n mod 6) 건, 행특 = 3 건.
 * - 서류 정리는 "4개 영역 인식"(문제 없음), 가릴지 확인이 필요한 표현은 없다.
 */
export function generatedApplicant(n: number): DetailedApplicant {
  const k = 5 + ((n * 7) % 12);
  const name = Math.floor((k * 3) / 10);
  const school = Math.floor((k * 45) / 100);
  const parent = n % 2;
  return {
    code: sampleApplicantCode(n),
    documentSummary: "4개 영역 인식",
    documentProblem: false,
    documentCounts: documentCounts(`${30 + (n % 9)}과목`, `${24 + (n % 8)}건`, `${10 + (n % 6)}건`, "3건"),
    maskCounts: [
      { label: "이름", count: name },
      { label: "출신 학교", count: school },
      { label: "지역", count: k - name - school - parent },
      { label: "부모 정보", count: parent },
    ],
    expressions: NO_EXPRESSIONS,
  };
}

/** 예시 지원자 314명을 코드 순서대로 만든다. 같은 입력이 없는 순수 함수라 늘 같은 결과다. */
export function createSampleApplicants(): Applicant[] {
  const detailedByCode = new Map(DETAILED_APPLICANTS.map((applicant) => [applicant.code, applicant]));
  const applicants: Applicant[] = [];
  for (let n = 1; n <= SAMPLE_APPLICANT_COUNT; n += 1) {
    const code = sampleApplicantCode(n);
    const detailed = detailedByCode.get(code);
    applicants.push({
      ...(detailed ?? generatedApplicant(n)),
      assignee: assigneeOf(n),
      initialStatus: initialStatusOf(code),
    });
  }
  return applicants;
}

/** 화면이 쓰는 예시 지원자 (코드 순서) */
export const SAMPLE_APPLICANTS: readonly Applicant[] = createSampleApplicants();
