import { APPLICANTS_PATH, PREP_WEIGHTS_PATH } from "../consoleMenu.ts";
import { summaryPath } from "../evaluate/evaluation.ts";
import type { HomeTrack, RecentWork, ScheduleStage } from "./home.ts";

// 홈 화면의 예시 자료. 시안에 적힌 값(제목, 일정의 날짜, 전형별 모집·지원 수, 일반 전형의 단계별 진행률과 모집 단위 진행 수치, 공지 제목)을
// 옮기고, 시안에 없는 값(다른 전형의 진행률·모집 단위 수치, 공지 본문, 최근 작업의 시각)은 화면을 채우려고 지어냈다. 실제 통계가 아니다.
// 로그인한 사정관의 모집 단위(경영학과)와 오늘 할 일의 수는 여기 없고 화면이 지금 자료로 계산한다(hooks/useHome.ts).

/** 제목 줄: 모집 시기와 지금 하는 일 */
export const HOME_HEADING = {
  season: "2027학년도 수시모집",
  work: "학생부종합 서류평가",
} as const;

/** 1차 평가 마감일. 평가하기의 "1차 평가 마감 11. 20 (금) 18:00"(lib/evaluate/sampleEvaluations.ts)과 같은 날이다. */
export const FIRST_EVALUATION_DEADLINE = {
  label: "1차 평가 마감",
  date: "2026-11-20",
} as const;

/** 전형 일정 (시안의 다섯 단계). 앞의 세 단계는 날짜가 지나도 그 진행률이 100% 가 되기 전에는 "마무리 중" 이다. */
export const HOME_SCHEDULE: readonly ScheduleStage[] = [
  { key: "intake", name: "서류 접수 · 정리", start: "2026-11-02", end: "2026-11-06", progress: "arrange" },
  { key: "mask", name: "개인정보 가림 확인", start: "2026-11-04", end: "2026-11-13", progress: "mask" },
  {
    key: "evaluate",
    name: "서류 평가",
    start: "2026-11-09",
    end: "2026-11-27",
    progress: "evaluate",
    milestone: { label: "1차 마감", date: FIRST_EVALUATION_DEADLINE.date },
  },
  { key: "selection", name: "선발 사정", start: "2026-12-02", end: "2026-12-02" },
  { key: "announce", name: "합격자 발표", start: "2026-12-11", end: "2026-12-11" },
];

/** 로그인한 사정관의 전형 (사이드바의 전형 선택과 같은 전형). 이 전형의 첫 모집 단위 줄은 화면이 지금 자료로 만든다. */
export const MY_TRACK_KEY = "general";

/**
 * 전형별 모집 인원·지원 건수·단계별 진행률(%)과 모집 단위별 평가 진행.
 * 일반 전형의 모집 단위에는 로그인한 사정관의 모집 단위(경영학과)가 없다: 그 줄은 평가하기의 진행 현황과 같은 값으로 화면이 앞에 더한다.
 */
export const HOME_TRACKS: readonly HomeTrack[] = [
  {
    key: MY_TRACK_KEY,
    name: "학생부종합 (일반)",
    quota: 412,
    applied: 3184,
    stages: { arrange: 100, mask: 97, evaluate: 61 },
    units: [
      { name: "컴퓨터공학과", done: 173, total: 288 },
      { name: "기계공학부", done: 266, total: 403 },
      { name: "간호학과", done: 189, total: 357 },
    ],
  },
  {
    key: "regional",
    name: "학생부종합 (지역인재)",
    quota: 240,
    applied: 1516,
    stages: { arrange: 100, mask: 95, evaluate: 48 },
    units: [
      { name: "경영학과", done: 71, total: 148 },
      { name: "컴퓨터공학과", done: 66, total: 126 },
      { name: "기계공학부", done: 58, total: 141 },
      { name: "간호학과", done: 96, total: 172 },
    ],
  },
  {
    key: "potential",
    name: "학생부종합 (잠재능력우수)",
    quota: 186,
    applied: 1402,
    stages: { arrange: 100, mask: 92, evaluate: 44 },
    units: [
      { name: "경영학과", done: 52, total: 124 },
      { name: "컴퓨터공학과", done: 61, total: 131 },
      { name: "기계공학부", done: 44, total: 118 },
      { name: "간호학과", done: 70, total: 139 },
    ],
  },
  {
    key: "equal",
    name: "학생부종합 (고른기회)",
    quota: 78,
    applied: 388,
    stages: { arrange: 100, mask: 100, evaluate: 72 },
    units: [
      { name: "경영학과", done: 30, total: 41 },
      { name: "컴퓨터공학과", done: 27, total: 36 },
      { name: "기계공학부", done: 22, total: 33 },
      { name: "간호학과", done: 29, total: 40 },
    ],
  },
];

/** 공지 한 건 */
export type HomeNotice = {
  id: string;
  /** 알린 날 (한국 날짜) */
  date: string;
  title: string;
  body: string;
};

export const HOME_NOTICES: readonly HomeNotice[] = [
  {
    id: "blind-v3",
    date: "2026-11-13",
    title: "블라인드 규칙 v3 적용",
    body: "11월 13일 접수분부터 블라인드 규칙 v3 으로 식별 정보를 가립니다. 가릴지 확인이 필요한 표현은 지원자 관리의 확인 필요에서 볼 수 있습니다.",
  },
];

/**
 * 최근 작업의 예시 (저장소에 남은 작업이 없어도 목록이 비지 않게 둔다). 예시 지원자의 처음 상태와 맞춘 값이다:
 * A-0187 은 임시 저장 상태로 시작하고, 내 담당 가운데 가림 확인을 마친 지원자가 20명이며, 한 번도 저장하지 않은 평가 기준이 v1 이다.
 */
export const HOME_RECENT_SEEDS: readonly RecentWork[] = [
  { id: "seed-draft", at: "2026-11-19T16:20:00+09:00", title: "A-0187 평가 임시 저장", href: summaryPath("A-0187") },
  { id: "seed-mask", at: "2026-11-18T11:05:00+09:00", title: "가림 20건 확인 완료", href: APPLICANTS_PATH },
  { id: "seed-criteria", at: "2026-11-09T09:30:00+09:00", title: "경영학과 평가 기준 v1 적용", href: PREP_WEIGHTS_PATH },
];
