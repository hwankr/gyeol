import { PREP_CRITERIA_STORAGE_KEY, PREP_HISTORY_STORAGE_KEY } from "../constants.ts";
import type { ConsensusPoint } from "./consensusDraft.ts";
import { PREP_LIMITS, parsePrepCriteria, type PrepCriteria } from "./criteria.ts";
import { DEFAULT_PREP_CRITERIA } from "./defaultCriteria.ts";
import type { GuidelineChange } from "./guidelineChanges.ts";
import { NO_HISTORY, arrangeHistory, parsePrepHistory, type PrepHistoryEntry } from "./history.ts";
import { truncateText } from "../criteria/normalize.ts";

// 전형 준비의 평가 기준과 기준 변경 기록을 브라우저 localStorage 에 JSON 으로 저장하고 불러온다. 브라우저에서만 호출한다.
//
// 읽기와 쓰기는 모두 try/catch 로 감싼다. 저장소 읽기 결과는 둘로 나눈다(두 키를 따로 본다).
// - 읽음: 값이 없거나 JSON 이 아니거나 모양·한도에서 벗어나면 "저장한 값 없음"(평가 기준은 기본값, 기록은 빈 목록). 저장소의 값은 지우지 않는다.
// - 읽지 못함: getItem 이나 localStorage 접근 자체가 예외를 던짐. 그 저장소에 무엇이 있는지 모르므로 그 저장소에는 쓰지 않는다.
//   화면에는 이 페이지를 연 뒤 마지막으로 읽는 데 성공한 값을 보여 준다(읽기가 중간에 실패하기 시작해도 잘 보이던 값이 기본값으로
//   바뀌지 않게). 한 번도 읽지 못했으면 기본값(평가 기준)·빈 목록(기록)이다.
//
// 쓰지 않았거나 쓰기가 실패한 값은 이 페이지의 메모리에만 둔다(새로고침하면 사라진다).
// - 평가 기준: 메모리에 둔 값이 있으면 저장소의 값보다 먼저 보여 준다(사람이 마지막으로 저장한 값이다).
// - 기록: 저장하지 못한 기록을 저장소의 기록과 합쳐 보여 주고, 다음에 기록을 저장할 수 있을 때 같이 저장한다.
//   저장하지 못한 기록도 저장할 때와 같은 정리(arrangeHistory)로 최신 50건만 둔다(저장 실패가 이어져도 50건을 넘지 않는다).
// - 메모리에만 둔 값이 있는 동안 화면은 "저장하지 못함" 안내를 보여 준다(hasUnsavedPrepChanges). 다음 저장이 성공하면 사라진다.
// 다른 탭의 변경은 구독하지 않는다(storage 이벤트 없음). 화면이 다시 그려질 때 저장소를 다시 읽으면서 반영된다.
// 화면은 useSyncExternalStore 로 읽는다. 내용이 같으면 같은 객체를 돌려준다.
//
// 기준 초안(PrepDraft)은 이 페이지의 메모리에만 둔다(localStorage 에 쓰지 않는다. 새로고침하면 사라진다).
// 초안은 한 번에 하나이고 두 가지다: 모집요강으로 만든 초안(source "guideline")과 위원 의견으로 만든 공통 기준 초안(source "consensus").
// 전형 준비의 탭을 오가도 남고, 평가·배점 설정에서 저장하면(savePrepDraft) 저장한 평가 기준이 되며 초안은 사라진다.
// 취소하면(discardPrepDraft) 버린다. 서버 렌더링에는 초안이 없다(화면의 getServerSnapshot 은 null).

const listeners = new Set<() => void>();

/**
 * 마지막으로 읽는 데 성공한(또는 쓴) 평가 기준 문자열(undefined: 이 페이지에서 아직 한 번도 읽지 못함)과 그 값(null: 저장한 값 없음).
 * 읽기가 실패하는 동안에는 이 값을 그대로 쓴다.
 */
let lastCriteriaRaw: string | null | undefined;
let lastCriteria: PrepCriteria | null = null;
/** 저장소에 쓰지 못해 메모리에만 둔 평가 기준 */
let memoryCriteria: PrepCriteria | null = null;

/** 마지막으로 읽는 데 성공한(또는 쓴) 기록 문자열과 그 목록 (읽기가 실패하는 동안에는 이 목록을 그대로 쓴다) */
let lastHistoryRaw: string | null | undefined;
let lastHistory: readonly PrepHistoryEntry[] = NO_HISTORY;
/** 저장소에 쓰지 못해 메모리에만 둔 기록 (최신순, 50건까지) */
let memoryHistory: readonly PrepHistoryEntry[] = NO_HISTORY;
/** 마지막으로 만든 화면 기록 목록과 그것을 만든 재료 */
let composed: {
  stored: readonly PrepHistoryEntry[];
  memory: readonly PrepHistoryEntry[];
  list: readonly PrepHistoryEntry[];
} | null = null;

/** 모집요강으로 만든 기준 초안 (저장하기 전에는 어디에도 쓰이지 않는다) */
export type GuidelinePrepDraft = {
  source: "guideline";
  /** 초안 평가 기준 (모집 단위, 요소, AI 가 준 배점 또는 똑같이 나눈 배점) */
  criteria: PrepCriteria;
  /** 초안을 만든 모집요강 파일 이름 (화면에 보여 주고, 저장할 때 guideline.fileName 이 된다. AI 에는 보내지 않는다) */
  fileName: string;
  /** 모집요강의 전년 대비 변경 사항 (0~6건) */
  changes: readonly GuidelineChange[];
  /** 정리하면서 붙인 경고와 AI 의 경고 (받은 문장 그대로) */
  warnings: readonly string[];
};

/**
 * 위원 의견으로 만든 공통 기준 초안 (저장하기 전에는 어디에도 쓰이지 않는다).
 * 저장한 평가 기준에서 시작해 세부 평가 항목과 배점만 고친 것이라 요소의 id·이름·순서와 guideline 은 저장한 기준과 같다.
 */
export type ConsensusPrepDraft = {
  source: "consensus";
  /** 초안 평가 기준 (AI 가 제안한 배점. 평가·배점 설정에서 협의해 고친다) */
  criteria: PrepCriteria;
  /** 의견을 낸 위원 수 (화면 안내와 기록 내용에 쓴다) */
  memberCount: number;
  /** 의견 정리: 모인 의견과 더 협의할 점 (0~6건) */
  points: readonly ConsensusPoint[];
  /** 정리하면서 붙인 경고와 AI 의 경고 (받은 문장 그대로) */
  warnings: readonly string[];
};

/** 기준 초안: 모집요강으로 만든 것 또는 위원 의견으로 만든 것 */
export type PrepDraft = GuidelinePrepDraft | ConsensusPrepDraft;

/** 지금 초안 (없으면 null). 이 페이지의 메모리에만 있다. */
let draft: PrepDraft | null = null;

/** 평가 기준·기록·초안이 바뀔 때 알림을 받는다. 구독을 끝내는 함수를 돌려준다. */
export function subscribePrepStorage(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * 화면에 보이는 평가 기준: 메모리에만 둔 값 → 저장소의 값 → 기본값. 저장소를 다시 읽는다.
 * 읽지 못하면 이 페이지에서 마지막으로 읽은 값을 쓰고, 한 번도 읽지 못했으면 기본값이다.
 */
export function loadPrepCriteria(): PrepCriteria {
  readCriteria();
  return memoryCriteria ?? lastCriteria ?? DEFAULT_PREP_CRITERIA;
}

/**
 * 화면에 보이는 기록(최신순, 50건까지): 저장소의 기록 + 메모리에만 둔 기록. 저장소를 다시 읽는다.
 * 읽지 못하면 이 페이지에서 마지막으로 읽은 기록을 쓰고, 한 번도 읽지 못했으면 메모리에만 둔 기록뿐이다(없으면 빈 목록).
 */
export function loadPrepHistory(): readonly PrepHistoryEntry[] {
  readHistory();
  return composeHistory();
}

/** 저장소에 쓰지 못해 메모리에만 둔 값(평가 기준 또는 기록)이 있는지 */
export function hasUnsavedPrepChanges(): boolean {
  return memoryCriteria !== null || memoryHistory.length > 0;
}

/**
 * 배점을 바꾼 평가 기준을 저장하고 기록을 한 건 남긴다. 순서: 기록 저장소를 이 순간 다시 읽고 → 평가 기준을 쓰고 →
 * 새 기록을 맨 앞에 더한 기록을 쓴다. 평가 기준도 쓰기 직전에 읽어 보고, 읽지 못하면 쓰지 않는다.
 * 쓰지 않았거나 쓰지 못한 값은 메모리에만 둔다. 둘 다 저장소에 저장했으면 true.
 */
export function savePrepCriteria(next: PrepCriteria, entry: PrepHistoryEntry): boolean {
  const historyRead = readHistory();

  const criteriaSaved = readCriteria().ok && writeCriteria(next);
  memoryCriteria = criteriaSaved ? null : next;

  const pending = [entry, ...memoryHistory];
  const historySaved = historyRead.ok && writeHistory(arrangeHistory([...pending, ...historyRead.list]));
  // 저장하지 못한 기록도 저장할 때와 같은 정리로 최신 50건만 둔다.
  memoryHistory = historySaved ? NO_HISTORY : arrangeHistory(pending);

  notify();
  return criteriaSaved && historySaved;
}

/** 지금 초안. 없으면 null. */
export function loadPrepDraft(): PrepDraft | null {
  return draft;
}

/** 새 초안을 둔다(있던 초안은 바뀐다). 모집요강 초안의 파일 이름은 저장할 수 있는 길이(255자)로 자른다. */
export function setPrepDraft(next: PrepDraft): void {
  draft =
    next.source === "guideline"
      ? { ...next, fileName: truncateText(next.fileName.trim(), PREP_LIMITS.fileNameLength) }
      : next;
  notify();
}

/** 초안을 버린다. 없으면 아무것도 하지 않는다. */
export function discardPrepDraft(): void {
  if (draft === null) return;
  draft = null;
  notify();
}

/**
 * 초안을 저장한 평가 기준으로 삼는다(savePrepCriteria 와 같은 순서·실패 처리). criteria 는 고친 배점이 들어간 초안 평가 기준이다.
 * 모집요강 초안이면 저장하는 값에 guideline(파일 이름, 변경 사항)을 붙이고, 위원 의견 초안이면 초안 평가 기준에 딸린 guideline
 * (바탕이 된 저장 기준의 것. 없을 수 있다)을 그대로 둔다. 저장소에 쓰지 못해도 그 값은 메모리의 평가 기준이 되고 초안은 사라진다.
 * expected 가 지금 초안이 아니면(그사이 버렸거나 새로 만들었으면) 아무것도 하지 않고 null 을 돌려준다(두 번 눌러 기록이 두 번 남지 않게).
 * 저장했으면 저장소에 다 썼는지(true/false).
 */
export function savePrepDraft(
  expected: PrepDraft,
  criteria: PrepCriteria,
  entry: PrepHistoryEntry,
): boolean | null {
  if (draft === null || draft !== expected) return null;
  const guideline =
    expected.source === "guideline" ? { fileName: expected.fileName, changes: expected.changes } : criteria.guideline;
  const next: PrepCriteria =
    guideline === undefined
      ? { version: 1, department: criteria.department, elements: criteria.elements }
      : { version: 1, department: criteria.department, elements: criteria.elements, guideline };
  draft = null;
  // savePrepCriteria 가 알림을 보낸다(초안이 사라진 것도 같은 알림으로 반영된다).
  return savePrepCriteria(next, entry);
}

/** 평가 기준 저장소를 읽는다. 읽으면 "마지막으로 읽은 값"을 바꾸고 ok: true, 읽지 못하면 그 값을 그대로 두고 ok: false. */
function readCriteria(): { ok: boolean } {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(PREP_CRITERIA_STORAGE_KEY);
  } catch {
    return { ok: false };
  }
  if (raw !== lastCriteriaRaw) {
    lastCriteriaRaw = raw;
    lastCriteria = raw === null ? null : parsePrepCriteria(parseJson(raw));
  }
  return { ok: true };
}

/** 평가 기준을 쓴다. 쓰면 그 값을 "마지막으로 읽은 값"으로 삼고 true, 예외가 나면 false. */
function writeCriteria(criteria: PrepCriteria): boolean {
  const raw = JSON.stringify(criteria);
  try {
    window.localStorage.setItem(PREP_CRITERIA_STORAGE_KEY, raw);
  } catch {
    return false;
  }
  lastCriteriaRaw = raw;
  lastCriteria = parsePrepCriteria(criteria);
  return true;
}

/** 기록 저장소를 읽는다. 읽으면 "마지막으로 읽은 목록"을 바꾸고 그 목록을, 읽지 못하면 그 목록을 그대로 두고 ok: false 를 돌려준다. */
function readHistory(): { ok: true; list: readonly PrepHistoryEntry[] } | { ok: false; list?: undefined } {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(PREP_HISTORY_STORAGE_KEY);
  } catch {
    return { ok: false };
  }
  if (raw !== lastHistoryRaw) {
    lastHistoryRaw = raw;
    lastHistory = raw === null ? NO_HISTORY : parsePrepHistory(parseJson(raw));
  }
  return { ok: true, list: lastHistory };
}

/** 기록을 쓴다. 쓰면 그 목록을 "마지막으로 읽은 목록"으로 삼고 true, 예외가 나면 false. */
function writeHistory(list: readonly PrepHistoryEntry[]): boolean {
  const raw = JSON.stringify(list);
  try {
    window.localStorage.setItem(PREP_HISTORY_STORAGE_KEY, raw);
  } catch {
    return false;
  }
  lastHistoryRaw = raw;
  lastHistory = list;
  return true;
}

/** 화면 기록 = 메모리에만 둔 기록 + 마지막으로 읽은 기록 (최신순, 50건까지). 재료가 같으면 같은 배열을 돌려준다. */
function composeHistory(): readonly PrepHistoryEntry[] {
  if (composed !== null && composed.stored === lastHistory && composed.memory === memoryHistory) return composed.list;
  const list = memoryHistory.length === 0 ? lastHistory : arrangeHistory([...memoryHistory, ...lastHistory]);
  composed = { stored: lastHistory, memory: memoryHistory, list };
  return list;
}

/** JSON 이 아니면 undefined (확인 함수가 "저장한 값 없음"으로 본다) */
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
