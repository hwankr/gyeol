// 홈 화면의 계산과 예시 자료 검사. 실행(저장소 루트에서): npx tsx scripts/check-home.ts
// 전형 일정의 상태(오늘 기준 완료·마무리 중·진행 중·예정)와 지금 단계, 날짜 글, 남은 날, 비율, 최근 작업의 순서를 확인하고,
// 예시 자료가 시안의 값·다른 화면의 예시 자료와 맞는지 확인한다. AI 를 부르지 않는다.
// 인자는 받지 않는다. 출력: 사례마다 "통과"/"실패" 한 줄, 마지막에 개수. 하나라도 실패하면 종료 코드 1.
// node scripts/check-home.ts 로도 돌도록(Node 의 타입 제거 실행) 값 import 는 상대 경로에 .ts 확장자를 붙인다.
import { ADMISSION } from "../lib/admission.ts";
import { NO_DECISIONS, applicantStatus, assignedTo } from "../lib/applicants/applicants.ts";
import { SAMPLE_APPLICANTS } from "../lib/applicants/sampleApplicants.ts";
import { rankDecisionApplicants } from "../lib/decision/decision.ts";
import { elementSpreadsOf, needsAdjustment } from "../lib/decision/opinions.ts";
import { DECISION_APPLICANTS, DECISION_FIRST_RANK } from "../lib/decision/sampleDecision.ts";
import { NO_EVALUATIONS, departmentProgressOf, effectiveRecord, evaluationStatus } from "../lib/evaluate/evaluation.ts";
import { EVALUATION_APPLICANTS, EVALUATION_DEADLINE_TEXT } from "../lib/evaluate/sampleEvaluations.ts";
import {
  currentStageIndex,
  latestWorks,
  reachedStageIndex,
  remainingUntil,
  stageDateText,
  stagePeriodText,
  stageStatuses,
  todayTextOf,
  wholePercent,
  type HomeTrack,
} from "../lib/home/home.ts";
import {
  FIRST_EVALUATION_DEADLINE,
  HOME_RECENT_SEEDS,
  HOME_SCHEDULE,
  HOME_TRACKS,
  MY_TRACK_KEY,
} from "../lib/home/sampleHome.ts";
import { seoulDateKey } from "../lib/koreanTime.ts";
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

/** 그 날의 단계별 상태·지금 단계·시작한 마지막 단계 */
function scheduleOn(today: string, tracks: readonly Pick<HomeTrack, "stages">[] = HOME_TRACKS) {
  const statuses = stageStatuses(HOME_SCHEDULE, tracks, today);
  return { statuses, current: currentStageIndex(statuses), reached: reachedStageIndex(statuses) };
}

// ── 날짜 글 ──
check("날짜 글: 2026-11-02 → 11.02 (월)", stageDateText("2026-11-02") === "11.02 (월)", stageDateText("2026-11-02"));
check("날짜 글: 2026-12-11 → 12.11 (금)", stageDateText("2026-12-11") === "12.11 (금)", stageDateText("2026-12-11"));
check(
  "기간 글: 여러 날은 두 날짜를 잇고 하루짜리는 날짜 하나",
  same(HOME_SCHEDULE.map(stagePeriodText), [
    "11.02 (월) – 11.06 (금)",
    "11.04 (수) – 11.13 (금)",
    "11.09 (월) – 11.27 (금)",
    "12.02 (수)",
    "12.11 (금)",
  ]),
  JSON.stringify(HOME_SCHEDULE.map(stagePeriodText)),
);
check(
  "한국 날짜: UTC 로는 전날 15:30 인 순간이 한국에서는 다음 날이다",
  seoulDateKey(new Date("2026-11-13T15:30:00Z")) === "2026-11-14",
  seoulDateKey(new Date("2026-11-13T15:30:00Z")),
);
check("한국 날짜: 월·일은 두 자리", seoulDateKey(new Date("2027-01-05T03:00:00Z")) === "2027-01-05");
check("오늘 날짜 글: 2026-11-14 → 오늘 2026. 11. 14. (토)", todayTextOf("2026-11-14") === "오늘 2026. 11. 14. (토)", todayTextOf("2026-11-14"));

// ── 전형 일정의 상태 ──
check(
  "시안의 오늘(11.14): 완료 · 마무리 중 · 진행 중 · 예정 · 예정, 지금 단계는 서류 평가",
  same(scheduleOn("2026-11-14"), { statuses: ["완료", "마무리 중", "진행 중", "예정", "예정"], current: 2, reached: 2 }),
  JSON.stringify(scheduleOn("2026-11-14")),
);
check(
  "시작 전(11.01): 모두 예정이고 지금 단계가 없다",
  same(scheduleOn("2026-11-01"), { statuses: ["예정", "예정", "예정", "예정", "예정"], current: -1, reached: -1 }),
  JSON.stringify(scheduleOn("2026-11-01")),
);
check(
  "겹치는 날(11.05): 진행 중인 단계가 둘이면 뒤의 것이 지금 단계다",
  same(scheduleOn("2026-11-05"), { statuses: ["진행 중", "진행 중", "예정", "예정", "예정"], current: 1, reached: 1 }),
  JSON.stringify(scheduleOn("2026-11-05")),
);
check(
  "시작일과 마지막 날은 진행 중이다 (11.09, 11.27)",
  scheduleOn("2026-11-09").statuses[2] === "진행 중" && scheduleOn("2026-11-27").statuses[2] === "진행 중",
);
check(
  "단계 사이의 날(11.30): 평가가 남아 서류 평가는 마무리 중이고 지금 단계가 없다",
  same(scheduleOn("2026-11-30"), { statuses: ["완료", "마무리 중", "마무리 중", "예정", "예정"], current: -1, reached: 2 }),
  JSON.stringify(scheduleOn("2026-11-30")),
);
check(
  "하루짜리 일정(12.02): 그날은 진행 중, 다음 날은 완료",
  scheduleOn("2026-12-02").statuses[3] === "진행 중" && scheduleOn("2026-12-02").current === 3 && scheduleOn("2026-12-03").statuses[3] === "완료",
);
const allDone = HOME_TRACKS.map((track) => ({ stages: { arrange: 100, mask: 100, evaluate: 100 } as const, key: track.key }));
check(
  "모든 전형의 진행률이 100% 면 지난 단계는 모두 완료다",
  same(scheduleOn("2026-12-12", allDone), { statuses: ["완료", "완료", "완료", "완료", "완료"], current: -1, reached: 4 }),
  JSON.stringify(scheduleOn("2026-12-12", allDone)),
);

// ── 남은 날 ──
check(
  "남은 날: 시안의 오늘(11.14)에서 1차 평가 마감(11.20)까지 6일",
  same(remainingUntil("2026-11-14", FIRST_EVALUATION_DEADLINE.date), { kind: "days", days: 6 }),
  JSON.stringify(remainingUntil("2026-11-14", FIRST_EVALUATION_DEADLINE.date)),
);
check("남은 날: 마감일 당일", same(remainingUntil("2026-11-20", FIRST_EVALUATION_DEADLINE.date), { kind: "today" }));
check("남은 날: 마감일이 지남", same(remainingUntil("2026-11-21", FIRST_EVALUATION_DEADLINE.date), { kind: "passed" }));
check(
  "1차 평가 마감일은 평가하기의 마감 문구와 같은 날이다",
  EVALUATION_DEADLINE_TEXT.replace(/\s/g, "").startsWith(stageDateText(FIRST_EVALUATION_DEADLINE.date).replace(/\s/g, "")),
  `${EVALUATION_DEADLINE_TEXT} / ${stageDateText(FIRST_EVALUATION_DEADLINE.date)}`,
);

// ── 비율, 최근 작업 ──
check("비율: 248 / 312 → 79, 나눌 수 없으면 0", wholePercent(248, 312) === 79 && wholePercent(0, 0) === 0);
const works = [
  { id: "a", at: "2026-11-18T02:00:00Z", title: "a", href: "/" },
  { id: "b", at: "2026-11-20T02:00:00Z", title: "b", href: "/" },
  { id: "c", at: "2026-11-19T02:00:00Z", title: "c", href: "/" },
  { id: "d", at: "2026-11-19T02:00:00Z", title: "d", href: "/" },
];
check(
  "최근 작업: 최신 순, 시각이 같으면 받은 순서, 정한 건수까지",
  same(latestWorks(works, 3).map((work) => work.id), ["b", "c", "d"]),
  JSON.stringify(latestWorks(works, 3).map((work) => work.id)),
);

// ── 예시 자료 ──
const myTrack = HOME_TRACKS.find((track) => track.key === MY_TRACK_KEY);
check("내 전형은 전형 목록의 첫 줄이고 모집 인원이 전형 요약의 전체 인원과 같다", HOME_TRACKS[0] === myTrack && ADMISSION.quotaTotalText.includes(String(myTrack?.quota)));
check(
  "시안의 전형별 모집·지원: 412·3,184 / 240·1,516 / 186·1,402 / 78·388",
  same(HOME_TRACKS.map((track) => [track.quota, track.applied]), [[412, 3184], [240, 1516], [186, 1402], [78, 388]]),
);
check(
  "시안의 모집 단위 진행(내 전형): 남은 115건 · 60%, 137건 · 66%, 168건 · 53%",
  same(myTrack?.units.map((unit) => [unit.total - unit.done, wholePercent(unit.done, unit.total)]), [[115, 60], [137, 66], [168, 53]]),
  JSON.stringify(myTrack?.units.map((unit) => [unit.total - unit.done, wholePercent(unit.done, unit.total)])),
);
check(
  "내 전형의 모집 단위에는 내 모집 단위가 없다 (화면이 지금 자료로 앞에 더한다)",
  myTrack !== undefined && myTrack.units.every((unit) => unit.name !== ADMISSION.unit),
);
check(
  "진행률은 0~100 이고 모집 단위의 제출 수는 전체 건수를 넘지 않는다",
  HOME_TRACKS.every(
    (track) =>
      Object.values(track.stages).every((percent) => percent >= 0 && percent <= 100) &&
      track.units.every((unit) => unit.done >= 0 && unit.done <= unit.total),
  ),
);

// ── 다른 화면의 예시 자료와 맞는지 (저장한 값이 없을 때) ──
const elements = DEFAULT_PREP_CRITERIA.elements;
const records = EVALUATION_APPLICANTS.map((applicant) => effectiveRecord(applicant, NO_EVALUATIONS, elements));
const submitted = records.filter((record) => record?.status === "submitted").length;
const department = departmentProgressOf(submitted, records.length);
check(
  "내 모집 단위 줄: 시안의 남은 64건 · 79% (평가하기의 모집 단위 전체 248 / 312)",
  same([department.total - department.done, wholePercent(department.done, department.total)], [64, 79]),
  JSON.stringify(department),
);
check("오늘 할 일의 처음 수: 평가 대기 3건", records.length - submitted === 3, String(records.length - submitted));
const markedCount = records.filter((record) => record !== null && record.status !== "submitted" && record.mark !== null).length;
check("오늘 할 일의 처음 수: 보류 · 재검토 요청 없음", markedCount === 0, String(markedCount));
const mine = assignedTo(SAMPLE_APPLICANTS, ADMISSION.reviewerName);
const statuses = mine.map((applicant) => applicantStatus(applicant, NO_DECISIONS));
check("오늘 할 일의 처음 수: 가림 확인 필요 3건", statuses.filter((status) => status === "확인 필요").length === 3);
const ranked = rankDecisionApplicants(DECISION_APPLICANTS, elements, ADMISSION.quota, DECISION_FIRST_RANK);
const adjustCount = ranked.filter((row) => needsAdjustment(elementSpreadsOf(row, elements))).length;
check("오늘 할 일의 처음 수: 위원 간 점수 조정 4건", adjustCount === 4, String(adjustCount));
const draftSeed = EVALUATION_APPLICANTS.find((applicant) => applicant.code === "A-0187");
check(
  "최근 작업의 예시: A-0187 은 임시 저장 상태로 시작하고, 내 담당의 가림 확인 완료가 20건이다",
  draftSeed !== undefined &&
    evaluationStatus(effectiveRecord(draftSeed, NO_EVALUATIONS, elements)) === "임시 저장" &&
    statuses.filter((status) => status === "완료").length === 20 &&
    HOME_RECENT_SEEDS.some((work) => work.title === "A-0187 평가 임시 저장") &&
    HOME_RECENT_SEEDS.some((work) => work.title === "가림 20건 확인 완료"),
);
check(
  "최근 작업의 예시는 최신 순으로 적혀 있다",
  same(latestWorks(HOME_RECENT_SEEDS, HOME_RECENT_SEEDS.length), HOME_RECENT_SEEDS),
);

if (failures.length > 0) {
  console.error(`\n홈 화면 검사 ${passed + failures.length}개 사례 중 ${failures.length}개 실패`);
  process.exit(1);
}
console.log(`\n홈 화면 검사 통과: ${passed}개 사례`);
