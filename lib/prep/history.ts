// 전형 준비 · 기준 변경 기록의 형식, 저장 값 확인, 목록 정리. 순수 함수만 둔다.

/** 기록 한 건 */
export type PrepHistoryEntry = {
  id: string;
  /** 바꾼 시각 (ISO 문자열) */
  at: string;
  /** 바꾼 사람 (예: "홍길동 사정관") */
  actor: string;
  /** 내용 (예: "배점 변경: 학업성취도 30 → 35") */
  summary: string;
};

/** 기록을 최신 몇 건까지 두는지. 넘으면 오래된 것부터 버린다. */
export const MAX_HISTORY_ENTRIES = 50;

/** 내용의 최대 길이 (앞뒤 공백을 뺀 글자 수) */
export const MAX_SUMMARY_LENGTH = 500;

/** 기록이 없을 때의 빈 목록 (늘 같은 참조) */
export const NO_HISTORY: readonly PrepHistoryEntry[] = Object.freeze([]);

/** 원소 하나를 확인한다: id·at·actor·summary 가 문자열, at 이 날짜로 읽힘, summary 1~500자. 맞지 않으면 null. */
function parseEntry(value: unknown): PrepHistoryEntry | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const { id, at, actor, summary } = value as Record<string, unknown>;
  if (typeof id !== "string" || typeof at !== "string" || typeof actor !== "string" || typeof summary !== "string") {
    return null;
  }
  if (Number.isNaN(Date.parse(at))) return null;
  const trimmed = summary.trim();
  if (trimmed.length < 1 || trimmed.length > MAX_SUMMARY_LENGTH) return null;
  return { id, at, actor, summary: trimmed };
}

/** 저장소에서 읽은 값(JSON.parse 결과)을 기록 목록으로 읽는다. 배열이 아니면 빈 목록, 원소는 하나씩 확인해 통과한 것만 쓴다. */
export function parsePrepHistory(value: unknown): readonly PrepHistoryEntry[] {
  if (!Array.isArray(value)) return NO_HISTORY;
  const entries: PrepHistoryEntry[] = [];
  for (const item of value) {
    const entry = parseEntry(item);
    if (entry !== null) entries.push(entry);
  }
  return arrangeHistory(entries);
}

/**
 * 기록을 화면·저장 순서로 정리한다: id 가 겹치면 앞의 것만 남기고, 시각이 늦은 것부터(같으면 받은 순서대로),
 * 최신 50건까지. 비면 NO_HISTORY.
 */
export function arrangeHistory(entries: readonly PrepHistoryEntry[]): readonly PrepHistoryEntry[] {
  const seen = new Set<string>();
  const unique = entries.filter((entry) => {
    if (seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });
  // sort 는 같은 값의 순서를 지킨다(안정 정렬).
  const sorted = unique.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, MAX_HISTORY_ENTRIES);
  return sorted.length === 0 ? NO_HISTORY : sorted;
}

let entryCount = 0;

/** 새 기록. id 는 시간·순번·난수로 만든다(crypto.randomUUID 는 보안 컨텍스트에서만 있어서 쓰지 않는다). */
export function createHistoryEntry(actor: string, summary: string, now: Date): PrepHistoryEntry {
  entryCount += 1;
  return {
    id: `h-${now.getTime().toString(36)}-${entryCount}-${Math.random().toString(36).slice(2, 8)}`,
    at: now.toISOString(),
    actor,
    summary,
  };
}
