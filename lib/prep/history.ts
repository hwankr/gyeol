// 전형 준비 · 기준 변경 기록의 형식, 저장 값 확인, 목록 정리, 기준 버전. 순수 함수만 둔다.

/** 기록 한 건 */
export type PrepHistoryEntry = {
  id: string;
  /** 바꾼 시각 (ISO 문자열) */
  at: string;
  /** 바꾼 사람 (예: "홍길동 사정관") */
  actor: string;
  /** 내용 (예: "배점 변경: 학업성취도 30 → 35") */
  summary: string;
  /**
   * 이 변경을 저장해 생긴 평가 기준의 버전. 한 번도 저장하지 않은 처음 기준이 1 이고 저장할 때마다 1 씩 는다(첫 기록이 2).
   * 새로 만든 기록(createHistoryEntry)과 이 값이 생기기 전에 저장한 기록에는 없고, 목록을 정리할 때(arrangeHistory) 채운다.
   * 그래서 정리한 목록(저장소에 쓰는 목록, 화면이 읽는 목록)의 기록에는 늘 있다.
   */
  version?: number;
};

/** 기록을 최신 몇 건까지 두는지. 넘으면 오래된 것부터 버린다. */
export const MAX_HISTORY_ENTRIES = 50;

/** 내용의 최대 길이 (앞뒤 공백을 뺀 글자 수) */
export const MAX_SUMMARY_LENGTH = 500;

/** 처음 평가 기준(한 번도 저장하지 않았을 때)의 버전 */
export const INITIAL_CRITERIA_VERSION = 1;

/** 저장 값으로 받아들이는 버전의 최댓값. 넘는 값은 버전이 없는 기록으로 읽는다. */
const MAX_STORED_VERSION = 1_000_000;

/** 기록이 없을 때의 빈 목록 (늘 같은 참조) */
export const NO_HISTORY: readonly PrepHistoryEntry[] = Object.freeze([]);

/** 저장된 버전으로 쓸 수 있는 값인지: 처음 기준(1)보다 크고 최댓값 이하인 정수 */
function isStoredVersion(value: unknown): value is number {
  return (
    typeof value === "number" && Number.isInteger(value) && value > INITIAL_CRITERIA_VERSION && value <= MAX_STORED_VERSION
  );
}

/**
 * 원소 하나를 확인한다: id·at·actor·summary 가 문자열, at 이 날짜로 읽힘, summary 1~500자. 맞지 않으면 null.
 * version 은 없어도 된다. 있는데 쓸 수 없는 값이면 기록은 살리고 버전만 없는 것으로 읽는다(정리할 때 다시 매긴다).
 */
function parseEntry(value: unknown): PrepHistoryEntry | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const { id, at, actor, summary, version } = value as Record<string, unknown>;
  if (typeof id !== "string" || typeof at !== "string" || typeof actor !== "string" || typeof summary !== "string") {
    return null;
  }
  if (Number.isNaN(Date.parse(at))) return null;
  const trimmed = summary.trim();
  if (trimmed.length < 1 || trimmed.length > MAX_SUMMARY_LENGTH) return null;
  return isStoredVersion(version)
    ? { id, at, actor, summary: trimmed, version }
    : { id, at, actor, summary: trimmed };
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
 * 기록마다 기준 버전을 채우고(numberVersions), 최신 50건까지. 비면 NO_HISTORY. 받은 기록 객체는 바꾸지 않는다.
 * 이미 정리한 목록을 다시 넣으면 같은 내용이 나온다.
 */
export function arrangeHistory(entries: readonly PrepHistoryEntry[]): readonly PrepHistoryEntry[] {
  const seen = new Set<string>();
  const unique = entries.filter((entry) => {
    if (seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });
  // sort 는 같은 값의 순서를 지킨다(안정 정렬).
  const sorted = unique.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  // 버전은 오래된 것을 버리기 전에 매긴다. 그래야 50건을 넘겨 버려지는 기록도 버전 하나를 차지하고,
  // 남은 기록 가운데 가장 오래된 것에 저장된 버전이 그 뒤 번호의 기준이 된다.
  const kept = numberVersions(sorted).slice(0, MAX_HISTORY_ENTRIES);
  return kept.length === 0 ? NO_HISTORY : kept;
}

/**
 * 최신순 목록의 기록마다 기준 버전을 채운 새 목록. 오래된 기록부터 차례로 본다.
 * - 저장된 버전이 바로 앞(더 오래된) 기록의 버전보다 크면 그대로 쓴다. 가장 오래된 기록은 처음 기준(1)보다 크면 된다.
 *   50건을 넘겨 오래된 기록이 버려진 뒤에도 남은 기록의 번호가 그대로인 것은 이 때문이다.
 * - 버전이 없거나(새 기록, 버전이 생기기 전에 저장한 기록) 앞 기록보다 크지 않으면 앞 기록의 버전 + 1 로 매긴다.
 *   저장소에 쓰지 못해 메모리에만 둔 기록은 그 기록들끼리만 정리되어 번호가 낮게 매겨질 수 있는데,
 *   저장소의 기록과 합쳐 다시 정리할 때 이 규칙으로 바로잡힌다.
 * 버전이 생기기 전에 이미 50건을 넘겨 버려진 기록이 있었다면 그 수는 알 수 없어 세지 못한다.
 */
function numberVersions(sorted: readonly PrepHistoryEntry[]): PrepHistoryEntry[] {
  const numbered = sorted.slice();
  let previous = INITIAL_CRITERIA_VERSION;
  for (let index = numbered.length - 1; index >= 0; index -= 1) {
    const entry = numbered[index];
    const version = entry.version !== undefined && entry.version > previous ? entry.version : previous + 1;
    if (version !== entry.version) numbered[index] = { ...entry, version };
    previous = version;
  }
  return numbered;
}

/**
 * 지금 평가 기준의 버전: 가장 최신 기록의 버전이고, 기록이 없으면 처음 기준의 1 이다.
 * 화면이 읽는 기록 목록(lib/prep/storage.ts 의 loadPrepHistory)을 그대로 넘기면 된다. 정리하지 않은 목록을 받아도 맞게 센다.
 */
export function currentCriteriaVersion(entries: readonly PrepHistoryEntry[]): number {
  return arrangeHistory(entries)[0]?.version ?? INITIAL_CRITERIA_VERSION;
}

/** 화면에 적는 기준 버전 글: "v3" */
export function criteriaVersionLabel(version: number): string {
  return `v${version}`;
}

let entryCount = 0;

/**
 * 새 기록. id 는 시간·순번·난수로 만든다(crypto.randomUUID 는 보안 컨텍스트에서만 있어서 쓰지 않는다).
 * 기준 버전은 여기서 붙이지 않는다. 앞선 기록을 알아야 정해지므로 저장하면서 목록을 정리할 때(arrangeHistory) 매겨진다.
 */
export function createHistoryEntry(actor: string, summary: string, now: Date): PrepHistoryEntry {
  entryCount += 1;
  return {
    id: `h-${now.getTime().toString(36)}-${entryCount}-${Math.random().toString(36).slice(2, 8)}`,
    at: now.toISOString(),
    actor,
    summary,
  };
}
