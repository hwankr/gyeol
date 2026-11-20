import { deadlineRemaining, type DeadlineRemaining } from "../applicants/deadline.ts";
import { formatSeoulToday } from "../koreanTime.ts";

// 홈 화면의 형식과 화면용 계산. 순수 함수만 둔다(브라우저와 Node 어디서나 돈다).
// 날짜는 모두 "2026-11-20" 꼴의 한국 날짜다. 같은 꼴이라 글자 순서로 앞뒤를 견준다(오늘은 lib/koreanTime.ts 의 seoulDateKey).

/** 전형 단위로 재는 진행률의 종류: 서류 정리, 가림 확인, 평가 */
export type StageProgressKey = "arrange" | "mask" | "evaluate";

export const STAGE_PROGRESS_KEYS: readonly StageProgressKey[] = ["arrange", "mask", "evaluate"];

/** 전형 일정의 단계 하나 */
export type ScheduleStage = {
  key: string;
  name: string;
  /** 시작일과 마지막 날 (하루짜리 일정은 둘이 같다) */
  start: string;
  end: string;
  /** 이 단계의 일이 다 끝났는지 볼 진행률. 없으면 마지막 날이 지나면 끝난 것으로 본다. */
  progress?: StageProgressKey;
  /** 진행 중일 때 상태 대신 적는 날 (예: 1차 마감) */
  milestone?: { label: string; date: string };
};

/** 단계의 상태. "마무리 중" 은 마지막 날이 지났는데 일이 남은 단계다. */
export type StageStatus = "완료" | "마무리 중" | "진행 중" | "예정";

/** 모집 단위 하나의 평가 진행 (제출을 마친 건수 / 전체 건수) */
export type HomeUnit = {
  name: string;
  done: number;
  total: number;
};

/** 전형 하나: 모집 인원, 지원 건수, 단계별 진행률(%), 모집 단위별 평가 진행 */
export type HomeTrack = {
  key: string;
  name: string;
  quota: number;
  applied: number;
  stages: Readonly<Record<StageProgressKey, number>>;
  units: readonly HomeUnit[];
};

/** 최근 작업 한 건 */
export type RecentWork = {
  id: string;
  /** 한 시각 (ISO 문자열) */
  at: string;
  title: string;
  href: string;
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** "2026-11-02" → 연·월·일 */
function dateParts(isoDate: string): { year: number; month: number; day: number } {
  const [year, month, day] = isoDate.split("-").map(Number);
  return { year, month, day };
}

/** 일정의 날짜 글: "11.02 (월)". 요일은 그 날짜로 계산한다(Date.UTC 는 시간대의 영향을 받지 않는다). */
export function stageDateText(isoDate: string): string {
  const { year, month, day } = dateParts(isoDate);
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")} (${weekday})`;
}

/** 단계의 기간 글: "11.02 (월) – 11.06 (금)", 하루짜리는 "12.02 (수)" */
export function stagePeriodText(stage: Pick<ScheduleStage, "start" | "end">): string {
  return stage.start === stage.end ? stageDateText(stage.start) : `${stageDateText(stage.start)} – ${stageDateText(stage.end)}`;
}

/**
 * 오늘 기준 단계의 상태. 시작 전이면 "예정", 기간 안이면 "진행 중", 마지막 날이 지났으면 일이 다 끝났는지(complete)에 따라
 * "완료" 또는 "마무리 중" 이다.
 */
export function stageStatusOf(stage: Pick<ScheduleStage, "start" | "end">, today: string, complete: boolean): StageStatus {
  if (today < stage.start) return "예정";
  if (today <= stage.end) return "진행 중";
  return complete ? "완료" : "마무리 중";
}

/** 그 진행률이 모든 전형에서 100% 인지 (단계의 일이 다 끝났는지) */
export function stageComplete(tracks: readonly Pick<HomeTrack, "stages">[], key: StageProgressKey): boolean {
  return tracks.every((track) => track.stages[key] >= 100);
}

/** 단계마다의 상태. 진행률을 보지 않는 단계는 마지막 날이 지나면 "완료" 다. */
export function stageStatuses(
  stages: readonly ScheduleStage[],
  tracks: readonly Pick<HomeTrack, "stages">[],
  today: string,
): StageStatus[] {
  return stages.map((stage) =>
    stageStatusOf(stage, today, stage.progress === undefined || stageComplete(tracks, stage.progress)),
  );
}

/**
 * 지금 단계의 순번: 진행 중인 단계 가운데 가장 뒤의 것(기간이 겹치면 나중에 시작한 단계).
 * 진행 중인 단계가 없으면(시작 전, 단계 사이의 날, 모두 지난 뒤) -1 이다.
 */
export function currentStageIndex(statuses: readonly StageStatus[]): number {
  return statuses.lastIndexOf("진행 중");
}

/** 시작한 단계 가운데 가장 뒤의 순번 (일정 줄을 여기까지 짙게 그린다). 아직 아무것도 시작하지 않았으면 -1. */
export function reachedStageIndex(statuses: readonly StageStatus[]): number {
  return statuses.findLastIndex((status) => status !== "예정");
}

/** 그 한국 날짜의 한낮. 어느 시간대에서 계산해도 같은 한국 날짜로 읽힌다. */
function seoulNoon(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00+09:00`);
}

/**
 * 제목 아래의 오늘 날짜 글: "오늘 2026. 11. 14. (토)". 화면은 오늘을 한 번만 읽고(날짜 하나) 이 글과 일정의 상태·남은 날을
 * 모두 그 날짜로 만든다. 자정을 사이에 두고 따로 읽어 서로 어긋나는 일이 없다.
 */
export function todayTextOf(today: string): string {
  return formatSeoulToday(seoulNoon(today));
}

/** 오늘("2026-11-14")부터 마감일까지 남은 날. 계산은 지원자 관리의 접수 마감과 같다(lib/applicants/deadline.ts). */
export function remainingUntil(today: string, deadlineDate: string): DeadlineRemaining {
  return deadlineRemaining(seoulNoon(today), deadlineDate);
}

/** 비율(%)을 정수로 반올림한 값 (248 / 312 → 79). 나눌 수 없으면 0. */
export function wholePercent(done: number, total: number): number {
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

/** 최근 작업을 최신 순으로 limit 건까지. 시각이 같으면 받은 순서를 지킨다. */
export function latestWorks(works: readonly RecentWork[], limit: number): RecentWork[] {
  return [...works].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, limit);
}
