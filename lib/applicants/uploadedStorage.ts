import type { AnalysisResult } from "@/types/analysis";
import { UPLOADED_APPLICANTS_STORAGE_KEY } from "../constants.ts";
import {
  NO_UPLOADED_APPLICANTS,
  arrangeUploadedApplicants,
  nextUploadedCode,
  parseUploadedApplicants,
  serializeUploadedApplicants,
  type UploadedApplicant,
} from "./uploaded.ts";

// 올린 지원자(업로드 화면에서 분석한 학생부)를 브라우저 localStorage 에 JSON 으로 저장하고 불러온다. 브라우저에서만 호출한다.
// 실패 처리는 전형 준비의 평가 기준·기록 저장(lib/prep/storage.ts), 지원자 관리의 가림 결정(./reviewStorage.ts)과 같은 규칙이다.
//
// 읽기와 쓰기는 모두 try/catch 로 감싼다. 저장소 읽기 결과는 둘로 나눈다.
// - 읽음: 값이 없거나 JSON 이 아니거나 모양이 틀리면 "올린 지원자 없음"(./uploaded.ts 의 확인). 저장소의 값은 지우지 않는다.
// - 읽지 못함: getItem 이나 localStorage 접근 자체가 예외를 던짐. 저장소에 무엇이 있는지 모르므로 쓰지 않는다(덮어써서 다른 결과를 잃지 않게).
//   화면에는 이 페이지를 연 뒤 마지막으로 읽는 데 성공한 값을 보여 준다. 한 번도 읽지 못했으면 메모리에만 둔 것뿐이다.
//
// 쓰지 않았거나 쓰기가 실패한 항목은 이 페이지의 메모리에만 둔다(지원자 관리에는 보이고 새로고침하면 사라진다). 메모리에 두는 것도
// 저장할 때와 같은 정리로 최근 10건까지다(실패가 이어져도 10건을 넘지 않는다). 다음에 저장할 수 있을 때 같이 저장한다.
// 업로드 화면은 분석이 끝나면 바로 결과 화면으로 가므로 "저장하지 못함" 안내를 보여 주지 않는다.
// 남길 때는 저장소를 그 순간 다시 읽고 그 끝에 더해 쓴다(다른 탭이 그사이 남긴 지원자를 지우지 않게). 코드도 그 순간의 목록으로 정한다.
// 다른 탭의 변경은 구독하지 않는다(storage 이벤트 없음). 화면이 다시 그려질 때 저장소를 다시 읽으면서 반영된다.
// 두 탭이 정말 동시에 쓰는 경우(읽기와 쓰기 사이에 다른 탭이 끼어드는 경우)를 막는 잠금은 없다. 그때 같은 코드가 둘 생기면 읽을 때 뒤의 것을 버린다.
// 화면은 useSyncExternalStore 로 읽는다. 내용이 같으면 같은 배열을 돌려준다.

const listeners = new Set<() => void>();

/** 마지막으로 읽는 데 성공한(또는 쓴) 저장 문자열(undefined: 이 페이지에서 아직 한 번도 읽지 못함)과 그 목록 */
let lastRaw: string | null | undefined;
let lastItems: readonly UploadedApplicant[] = NO_UPLOADED_APPLICANTS;
/** 저장소에 쓰지 못해 메모리에만 둔 항목 (코드 순서, 10건까지) */
let memoryItems: readonly UploadedApplicant[] = NO_UPLOADED_APPLICANTS;
/** 마지막으로 만든 화면 목록과 그것을 만든 재료 */
let composed: {
  stored: readonly UploadedApplicant[];
  memory: readonly UploadedApplicant[];
  list: readonly UploadedApplicant[];
} | null = null;

/** 올린 지원자가 바뀔 때 알림을 받는다. 구독을 끝내는 함수를 돌려준다. */
export function subscribeUploadedApplicants(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * 화면에 보이는 올린 지원자(코드 순서, 최근 10건까지): 마지막으로 읽은 저장소의 값 + 메모리에만 둔 값. 저장소를 다시 읽는다.
 * 읽지 못하면 이 페이지에서 마지막으로 읽은 값을 쓰고, 한 번도 읽지 못했으면 메모리에만 둔 것뿐이다(없으면 빈 목록).
 */
export function loadUploadedApplicants(): readonly UploadedApplicant[] {
  readStored();
  return composeVisible();
}

/**
 * 분석 결과를 올린 지원자로 남긴다. 저장소를 이 순간 다시 읽고, 그 목록과 메모리에만 둔 항목 가운데 가장 큰 번호 + 1 을 코드로 붙여
 * 읽은 목록 끝에 더해 쓴다(메모리에만 두었던 항목도 같이 쓴다). 읽지 못하면 쓰지 않는다. 쓰지 않았거나 쓰지 못한 항목은 메모리에만 둔다.
 * 남긴 코드를 돌려준다(코드가 네 자리를 넘어 남기지 못하면 null). 결과에는 파일 이름이 없다(받은 값을 그대로 둔다).
 */
export function addUploadedApplicant(result: AnalysisResult, now: Date): string | null {
  const read = readStored();
  const code = nextUploadedCode(composeVisible());
  if (code === null) return null;
  const pending = [...memoryItems, { code, at: now.toISOString(), result }];
  const saved = read.ok && writeStored(arrangeUploadedApplicants([...read.items, ...pending]));
  memoryItems = saved ? NO_UPLOADED_APPLICANTS : arrangeUploadedApplicants(pending);
  notify();
  return code;
}

/** 저장소를 읽는다. 읽으면 "마지막으로 읽은 목록"을 바꾸고 그 목록을, 읽지 못하면 그 목록을 그대로 두고 ok: false 를 돌려준다. */
function readStored(): { ok: true; items: readonly UploadedApplicant[] } | { ok: false; items?: undefined } {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(UPLOADED_APPLICANTS_STORAGE_KEY);
  } catch {
    return { ok: false };
  }
  if (raw !== lastRaw) {
    lastRaw = raw;
    lastItems = raw === null ? NO_UPLOADED_APPLICANTS : parseUploadedApplicants(parseJson(raw));
  }
  return { ok: true, items: lastItems };
}

/** 목록을 쓴다. 쓰면 그 목록을 "마지막으로 읽은 목록"으로 삼고 true, 예외가 나면(저장 공간 부족 등) false. */
function writeStored(items: readonly UploadedApplicant[]): boolean {
  const raw = serializeUploadedApplicants(items);
  try {
    window.localStorage.setItem(UPLOADED_APPLICANTS_STORAGE_KEY, raw);
  } catch {
    return false;
  }
  lastRaw = raw;
  lastItems = parseUploadedApplicants(JSON.parse(raw));
  return true;
}

/**
 * 화면 목록 = 마지막으로 읽은 목록 + 메모리에만 둔 항목 (코드가 겹치면 저장소의 것, 코드 순서, 최근 10건). 재료가 같으면 같은 배열.
 * 저장소의 값은 배열 순서대로 읽으므로(손으로 순서를 바꾼 값 등) 여기서 코드 순서로 늘어놓는다.
 */
function composeVisible(): readonly UploadedApplicant[] {
  if (composed !== null && composed.stored === lastItems && composed.memory === memoryItems) return composed.list;
  const list = arrangeUploadedApplicants([...lastItems, ...memoryItems]);
  composed = { stored: lastItems, memory: memoryItems, list };
  return list;
}

/** JSON 이 아니면 undefined (확인 함수가 "올린 지원자 없음"으로 본다) */
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
