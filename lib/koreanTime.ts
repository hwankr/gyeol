// 한국 시간(Asia/Seoul)으로 날짜·시각 글을 만든다. 브라우저의 시간대와 상관없이 늘 한국 시간이다.
// 서버에서 부르면 사전 렌더링 결과에 시각이 굳으므로 화면은 브라우저에서만 부른다.

const SEOUL_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** 그 순간의 한국 시간 연·월·일·시·분 (월·일은 1부터) */
function seoulParts(date: Date) {
  const parts = Object.fromEntries(SEOUL_PARTS.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: parts.hour,
    minute: parts.minute,
  };
}

/** 제목 줄의 오늘 날짜: "오늘 2026. 11. 18. (수)". 월·일 앞에 0 을 붙이지 않는다. */
export function formatSeoulToday(date: Date): string {
  const { year, month, day } = seoulParts(date);
  // 요일은 한국 날짜(연·월·일)로 계산한다. Date.UTC 는 시간대의 영향을 받지 않는다.
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `오늘 ${year}. ${month}. ${day}. (${weekday})`;
}

/** 기록의 시각: "2026. 11. 18. 14:05" (24시간제). 날짜로 읽을 수 없으면 받은 글 그대로. */
export function formatSeoulDateTime(iso: string): string {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return iso;
  const { year, month, day, hour, minute } = seoulParts(new Date(time));
  return `${year}. ${month}. ${day}. ${hour}:${minute}`;
}
