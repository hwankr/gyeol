// 지원자 관리의 예시 자료 검사. 실행(저장소 루트에서): npx tsx scripts/check-applicants.ts
// 지원자 관리 화면은 로그인한 사정관이 담당하는 지원자만 보여 준다. 그 지원자들이 평가하기에 배정된 지원자
// (lib/evaluate/sampleEvaluations.ts)와 같은 사람들인지, 화면에 처음 보이는 수(걸러 보기 수, 검토 완료 비율)가 맞는지 확인한다.
// 인자는 받지 않는다. 출력: 사례마다 "통과"/"실패" 한 줄, 마지막에 개수. 하나라도 실패하면 종료 코드 1.
// node scripts/check-applicants.ts 로도 돌도록(Node 의 타입 제거 실행) 값 import 는 상대 경로에 .ts 확장자를 붙인다.
import { ADMISSION } from "../lib/admission.ts";
import { NO_DECISIONS, applicantStatus, assignedTo, reviewPercent, statusCounts } from "../lib/applicants/applicants.ts";
import { SAMPLE_APPLICANTS } from "../lib/applicants/sampleApplicants.ts";
import { EVALUATION_APPLICANTS } from "../lib/evaluate/sampleEvaluations.ts";

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

const ME = ADMISSION.reviewerName;
const mine = assignedTo(SAMPLE_APPLICANTS, ME);
const mineCodes = mine.map((applicant) => applicant.code);
const evaluationCodes = EVALUATION_APPLICANTS.map((applicant) => applicant.code);

// ── 내 담당 ──
check(
  "내 담당 예시 지원자는 평가하기에 배정된 지원자와 같은 사람들이다 (순서까지)",
  same(mineCodes, evaluationCodes),
  `지원자 관리 ${mineCodes.length}명, 평가하기 ${evaluationCodes.length}명, 겹치는 사람 ${mineCodes.filter((code) => evaluationCodes.includes(code)).length}명`,
);
check(
  "가릴지 확인이 필요한 표현이 있는 지원자(A-0133·A-0187·A-0251)는 모두 내 담당이다",
  same(
    SAMPLE_APPLICANTS.filter((applicant) => applicant.expressions.length > 0).map((applicant) => `${applicant.code} ${applicant.assignee}`),
    [`A-0133 ${ME}`, `A-0187 ${ME}`, `A-0251 ${ME}`],
  ),
);

// ── 화면에 처음 보이는 수 (저장한 결정이 없을 때, 내 담당 기준) ──
const counts = statusCounts(mine.map((applicant) => applicantStatus(applicant, NO_DECISIONS)));
check(
  "걸러 보기 수: 전체 24 · 확인 필요 3 · 진행 중 1 · 대기 0 · 완료 20",
  same(counts, { 전체: 24, "확인 필요": 3, "진행 중": 1, 대기: 0, 완료: 20 }),
  JSON.stringify(counts),
);
check(
  "서류 검토 진행 현황: 24건 가운데 20건 완료 = 83.3%",
  reviewPercent(counts["완료"], counts["전체"]) === "83.3",
  reviewPercent(counts["완료"], counts["전체"]),
);

if (failures.length > 0) {
  console.error(`\n지원자 관리 검사 ${passed + failures.length}개 사례 중 ${failures.length}개 실패`);
  process.exit(1);
}
console.log(`\n지원자 관리 검사 통과: ${passed}개 사례`);
