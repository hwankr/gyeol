import { PREP_OPINIONS_STORAGE_KEY } from "../constants.ts";
import { truncateText } from "../criteria/normalize.ts";
import { CONSENSUS_LIMITS } from "./consensusDraft.ts";

// 전형 준비 · 공통 기준 협의의 위원 의견을 브라우저 localStorage 에 JSON 으로 저장하고 불러온다. 브라우저에서만 호출한다.
// 의견은 위원이 적는 대로(글자를 칠 때마다) 저장해, 새로고침하거나 다른 화면에 다녀와도 남는다.
// 읽기와 쓰기는 try/catch 로 감싼다(lib/prep/storage.ts 와 같은 방식).
// - 읽음: 값이 없거나 JSON 이 아니거나 모양에서 벗어나면 "저장한 의견 없음"(빈 목록). 저장소의 값은 지우지 않는다.
// - 읽지 못함: 이 페이지에서 마지막으로 읽은 값을 그대로 쓴다.
// - 쓰지 못함: 그 값은 이 페이지의 메모리에만 둔다(새로고침하면 사라진다). 화면은 "저장하지 못함" 안내를 보여 준다.
// 화면은 useSyncExternalStore 로 읽는다. 내용이 같으면 같은 객체를 돌려준다.

/** 위원 번호 → 의견. 의견을 적지 않은 위원은 키가 없다. 글은 위원이 적은 그대로다(앞뒤 공백 포함, 1,000자까지). */
export type PrepOpinions = Readonly<Record<number, string>>;

/** 의견이 하나도 없을 때의 빈 목록 (늘 같은 참조) */
export const NO_OPINIONS: PrepOpinions = Object.freeze({});

const listeners = new Set<() => void>();

/** 마지막으로 읽는 데 성공한(또는 쓴) 문자열(undefined: 아직 한 번도 읽지 못함)과 그 값 */
let lastRaw: string | null | undefined;
let lastOpinions: PrepOpinions = NO_OPINIONS;
/** 저장소에 쓰지 못해 메모리에만 둔 의견 */
let memoryOpinions: PrepOpinions | null = null;

/** 의견이 바뀔 때 알림을 받는다. 구독을 끝내는 함수를 돌려준다. */
export function subscribePrepOpinions(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 화면에 보이는 의견: 메모리에만 둔 값 → 저장소의 값 → 빈 목록. 저장소를 다시 읽는다. */
export function loadPrepOpinions(): PrepOpinions {
  read();
  return memoryOpinions ?? lastOpinions;
}

/** 저장소에 쓰지 못해 메모리에만 둔 의견이 있는지 */
export function hasUnsavedPrepOpinions(): boolean {
  return memoryOpinions !== null;
}

/**
 * 위원 한 사람의 의견을 바꾼다. 글은 1,000자로 자르고, 빈 글이면 그 위원의 의견을 지운다. 저장소에 쓰지 못하면 메모리에만 둔다.
 * 위원 번호가 1~6 정수가 아니면 아무것도 하지 않는다.
 */
export function setPrepOpinion(member: number, text: string): void {
  if (!isMemberNumber(member)) return;
  const current = loadPrepOpinions();
  const next: Record<number, string> = { ...current };
  const cut = truncateOpinion(text);
  if (cut === "") delete next[member];
  else next[member] = cut;
  const frozen = Object.keys(next).length === 0 ? NO_OPINIONS : Object.freeze(next);
  memoryOpinions = write(frozen) ? null : frozen;
  notify();
}

function isMemberNumber(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= CONSENSUS_LIMITS.members;
}

/** 의견을 저장 한도(1,000자)로 자른다. 자르지 않을 때는 받은 글 그대로다(치는 중인 끝 공백을 지우지 않는다). */
function truncateOpinion(text: string): string {
  return text.length <= CONSENSUS_LIMITS.opinionLength ? text : truncateText(text, CONSENSUS_LIMITS.opinionLength);
}

/** 저장소에서 읽은 값을 의견 목록으로 읽는다: version 1, opinions 는 객체, 키는 위원 번호(1~6), 값은 비지 않은 문자열(1,000자로 자른다). */
function parseOpinions(value: unknown): PrepOpinions {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return NO_OPINIONS;
  const record = value as Record<string, unknown>;
  const raw = record.opinions;
  if (record.version !== 1 || typeof raw !== "object" || raw === null || Array.isArray(raw)) return NO_OPINIONS;
  const opinions: Record<number, string> = {};
  for (const [key, text] of Object.entries(raw as Record<string, unknown>)) {
    const member = Number(key);
    if (!isMemberNumber(member) || String(member) !== key || typeof text !== "string" || text === "") continue;
    opinions[member] = truncateOpinion(text);
  }
  return Object.keys(opinions).length === 0 ? NO_OPINIONS : Object.freeze(opinions);
}

/** 저장소를 읽는다. 읽으면 "마지막으로 읽은 값"을 바꾸고, 읽지 못하면 그대로 둔다. */
function read(): void {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(PREP_OPINIONS_STORAGE_KEY);
  } catch {
    return;
  }
  if (raw === lastRaw) return;
  lastRaw = raw;
  lastOpinions = raw === null ? NO_OPINIONS : parseOpinions(parseJson(raw));
}

/** 의견을 쓴다. 쓰면 그 값을 "마지막으로 읽은 값"으로 삼고 true, 예외가 나면 false. */
function write(opinions: PrepOpinions): boolean {
  const raw = JSON.stringify({ version: 1, opinions });
  try {
    window.localStorage.setItem(PREP_OPINIONS_STORAGE_KEY, raw);
  } catch {
    return false;
  }
  lastRaw = raw;
  lastOpinions = opinions;
  return true;
}

/** JSON 이 아니면 undefined (확인 함수가 "저장한 의견 없음"으로 본다) */
function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function notify() {
  listeners.forEach((listener) => listener());
}
