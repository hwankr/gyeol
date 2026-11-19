// 지원자 관리 · 접수 마감 카드의 마감일과 남은 날. 남은 날은 한국 시간(Asia/Seoul) 기준 오늘부터 마감일까지의 날수다
// (브라우저 시간대와 상관없음). 서버에서 부르면 사전 렌더링 결과에 날짜가 굳으므로 화면은 브라우저에서만 부른다.

/** 접수 마감 (T2-data.json 의 deadline) */
export const APPLICATION_DEADLINE = {
  label: "1차 마감",
  /** 마감일 (한국 날짜) */
  date: "2026-11-20",
  /** 카드에 보이는 마감일 */
  dateText: "2026.11.20",
} as const;

/** 남은 날: 마감일 전이면 날수(1 이상), 마감일 당일이면 "오늘", 지났으면 "지남" */
export type DeadlineRemaining = { kind: "days"; days: number } | { kind: "today" } | { kind: "passed" };

const DAY_MS = 24 * 60 * 60 * 1000;

const SEOUL_DATE = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

/** 그 순간의 한국 날짜를 1970-01-01 부터 센 날 번호로 (Date.UTC 는 시간대의 영향을 받지 않는다) */
function seoulDayNumber(date: Date): number {
  const parts = Object.fromEntries(SEOUL_DATE.formatToParts(date).map((part) => [part.type, part.value]));
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) / DAY_MS;
}

/** "2026-11-20" 꼴 날짜의 날 번호 */
function isoDayNumber(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

/** now(한국 날짜)부터 마감일까지 남은 날 */
export function deadlineRemaining(now: Date, deadlineDate: string = APPLICATION_DEADLINE.date): DeadlineRemaining {
  const days = isoDayNumber(deadlineDate) - seoulDayNumber(now);
  if (days > 0) return { kind: "days", days };
  return days === 0 ? { kind: "today" } : { kind: "passed" };
}
