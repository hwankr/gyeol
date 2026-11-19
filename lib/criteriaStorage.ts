import type { DepartmentCriteria } from "@/types/analysis";
import { DEPARTMENT_CRITERIA_STORAGE_KEY } from "./constants.ts";
import { DEPARTMENT_CRITERIA_LIST } from "./criteria/index.ts";
import { parseDepartmentCriteria } from "./criteria/normalize.ts";
import { PREP_CRITERIA_ID } from "./prep/analysisCriteria.ts";

// 확정한 학과 기준(저장한 학과)을 브라우저 localStorage 에 DepartmentCriteria[] JSON 으로 저장하고 불러온다. 브라우저에서만 호출한다.
//
// 읽기와 쓰기는 모두 try/catch 로 감싼다. 저장소 읽기 결과는 둘로 나눈다.
// - 읽음: 값이 없거나 깨졌으면(JSON·배열이 아님) "저장한 학과 없음", 정상이면 그 목록. 배열의 원소는 parseDepartmentCriteria 로
//   하나씩 확인해 통과한 것만 쓰고, 코드에 적힌 학과와 id 가 같거나 앞의 원소와 id 가 겹치는 것은 버린다.
//   id 가 전형 준비 항목의 값("prep", lib/prep/analysisCriteria.ts)인 것도 버린다(업로드 화면의 학과 선택에서 값이 겹치지 않게).
// - 읽지 못함: getItem 이나 localStorage 접근 자체가 예외를 던짐. 저장소에 무엇이 있는지 모르므로 이때는 저장소에 쓰지 않는다
//   (덮어쓰면 이미 저장된 학과가 사라진다). 확정·삭제는 이 페이지의 메모리에만 반영하고 "저장하지 못함"을 돌려준다.
//
// 화면에 보이는 목록 = (마지막으로 읽는 데 성공한 목록 + 이 페이지에서 저장소에 쓰지 못하고 메모리에만 둔 학과)
//                      − 이 페이지에서 지운 학과.
// - 읽지 못하는 동안에도 그 전에 읽은 학과는 목록에 남는다. 쓰기에 성공하면 쓴 목록을 "마지막으로 읽은 목록"으로 삼으므로,
//   그 뒤 읽기가 실패해도 방금 저장한 학과는 사라지지 않는다. 읽기가 다시 되면 저장소의 값을 따른다.
// - 메모리에만 둔 학과는 새로고침하면 사라진다(나중에 저장소가 되살아나도 따로 저장하지 않는다).
// - 다른 탭의 변경은 구독하지 않는다(storage 이벤트 없음). 이 탭이 다시 그려질 때 저장소를 다시 읽으면서 반영될 수 있다.
//   두 탭이 정말 동시에 쓰는 경우(읽기와 쓰기 사이에 다른 탭이 끼어드는 경우)를 막는 잠금은 없다.
// - 화면은 useSyncExternalStore 로 읽는다(hooks/useSavedDepartments.ts). 내용이 같으면 같은 배열을 돌려준다.

/** 저장한 학과가 없을 때 돌려주는 빈 목록 (서버 스냅숏도 이것. 늘 같은 참조) */
export const NO_SAVED_DEPARTMENTS: readonly DepartmentCriteria[] = Object.freeze([]);

/** 확정 결과: 저장소에 저장함 / 저장하지 못해 이 페이지의 메모리에만 둠 / 같은 이름의 학과가 있어 저장하지 않음 */
export type AddDepartmentResult = "saved" | "notSaved" | "duplicateName";

const listeners = new Set<() => void>();

/** 마지막으로 읽는 데 성공한 저장소 문자열(undefined: 아직 읽지 못함)과 그 목록 */
let lastRaw: string | null | undefined;
let lastReadList: readonly DepartmentCriteria[] = NO_SAVED_DEPARTMENTS;

/** 이 페이지에서 확정했지만 저장소에 쓰지 못해 메모리에만 둔 학과 (확정한 순서) */
let memoryOnly: readonly DepartmentCriteria[] = [];
/** 이 페이지에서 지운 학과 id */
let removedIds: ReadonlySet<string> = new Set();
/** memoryOnly·removedIds 가 바뀔 때마다 늘리는 번호 (화면 목록을 다시 만들지 판단) */
let localVersion = 0;
/** 마지막으로 만든 화면 목록과 그것을 만든 재료 */
let composed: { base: readonly DepartmentCriteria[]; version: number; list: readonly DepartmentCriteria[] } | null = null;

/** 저장한 학과 목록이 바뀔 때 알림을 받는다. 구독을 끝내는 함수를 돌려준다. */
export function subscribeSavedDepartments(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * 화면에 보이는 저장한 학과 목록(저장한 순서, 그다음 메모리에만 둔 학과). 없으면 빈 목록.
 * 저장소를 다시 읽는다. 읽지 못하면 마지막으로 읽은 목록을 쓴다. 내용이 같으면 같은 배열을 돌려준다.
 */
export function loadSavedDepartments(): readonly DepartmentCriteria[] {
  readStoredList();
  return composeVisible();
}

/**
 * 확정한 학과를 더한다. 같은 이름 확인은 이 순간 다시 읽은 목록(코드에 적힌 학과 + 저장소에서 방금 읽은 학과 + 메모리에만 둔 학과,
 * 이 페이지에서 지운 학과 제외)으로 한다. 앞뒤 공백을 뺀 이름이 같으면 아무것도 바꾸지 않고 "duplicateName".
 * - 읽음: 방금 읽은 목록 끝에 더해 저장소에 쓴다(다른 탭이 그사이 저장한 학과를 지우지 않는다). 쓰면 "saved",
 *   쓰지 못하면 메모리에만 두고 "notSaved".
 * - 읽지 못함: 저장소에 쓰지 않고 메모리에만 두고 "notSaved".
 * 어느 경우든 duplicateName 이 아니면 화면 목록에 나타난다.
 */
export function addSavedDepartment(department: DepartmentCriteria): AddDepartmentResult {
  const read = readStoredList();
  const name = department.department.trim();
  const taken = [...DEPARTMENT_CRITERIA_LIST, ...composeVisible()].some((item) => item.department.trim() === name);
  if (taken) return "duplicateName";

  let result: AddDepartmentResult = "notSaved";
  if (read.ok && writeList([...read.list.filter((item) => !removedIds.has(item.id)), department])) {
    result = "saved";
  } else {
    memoryOnly = [...memoryOnly, department];
    localVersion += 1;
  }
  notify();
  return result;
}

/**
 * 학과를 지운다. 화면 목록에서는 항상 사라진다. 저장소에서도 지웠거나 지울 필요가 없으면(메모리에만 있던 학과,
 * 저장소에 이미 없음) true, 저장소를 읽지 못했거나 쓰지 못해 저장소에 남아 있으면 false.
 */
export function removeSavedDepartment(id: string): boolean {
  const wasMemoryOnly = memoryOnly.some((item) => item.id === id);
  memoryOnly = memoryOnly.filter((item) => item.id !== id);
  removedIds = new Set([...removedIds, id]);
  localVersion += 1;

  let removed = true;
  if (!wasMemoryOnly) {
    const read = readStoredList();
    if (!read.ok) {
      removed = false;
    } else if (read.list.some((item) => item.id === id)) {
      removed = writeList(read.list.filter((item) => !removedIds.has(item.id)));
    }
  }
  notify();
  return removed;
}

let idCount = 0;

/**
 * 새 학과 기준 id. 코드에 적힌 id(business 등)와 겹치지 않게 "custom-" 접두사에 시간·순번·난수를 붙이고,
 * 화면 목록의 학과와 겹치면 다시 만든다. (crypto.randomUUID 는 보안 컨텍스트에서만 있어서 쓰지 않는다.)
 */
export function createDepartmentId(): string {
  const taken = new Set([...loadSavedDepartments().map((item) => item.id), ...removedIds]);
  let id: string;
  do {
    idCount += 1;
    id = `custom-${Date.now().toString(36)}-${idCount}-${Math.random().toString(36).slice(2, 8)}`;
  } while (taken.has(id) || isBuiltInId(id));
  return id;
}

/** 저장소를 읽는다. 읽으면 "마지막으로 읽은 목록"을 바꾸고 그 목록을, 읽지 못하면 ok: false 를 돌려준다. */
function readStoredList(): { ok: true; list: readonly DepartmentCriteria[] } | { ok: false } {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(DEPARTMENT_CRITERIA_STORAGE_KEY);
  } catch {
    return { ok: false };
  }
  if (raw !== lastRaw) {
    lastRaw = raw;
    lastReadList = raw === null ? NO_SAVED_DEPARTMENTS : parseSavedList(raw);
  }
  return { ok: true, list: lastReadList };
}

/** 저장소에 목록을 쓴다. 쓰면 그 목록을 "마지막으로 읽은 목록"으로 삼고 true, 예외가 나면 false. */
function writeList(list: readonly DepartmentCriteria[]): boolean {
  const raw = JSON.stringify(list);
  try {
    window.localStorage.setItem(DEPARTMENT_CRITERIA_STORAGE_KEY, raw);
  } catch {
    return false;
  }
  lastRaw = raw;
  lastReadList = parseSavedList(raw);
  return true;
}

/** 화면 목록 = (마지막으로 읽은 목록 + 메모리에만 둔 학과) − 지운 학과. 재료가 같으면 같은 배열을 돌려준다. */
function composeVisible(): readonly DepartmentCriteria[] {
  if (composed !== null && composed.base === lastReadList && composed.version === localVersion) {
    return composed.list;
  }
  const seen = new Set<string>();
  const list: DepartmentCriteria[] = [];
  for (const item of [...lastReadList, ...memoryOnly]) {
    if (removedIds.has(item.id) || seen.has(item.id)) continue;
    seen.add(item.id);
    list.push(item);
  }
  composed = { base: lastReadList, version: localVersion, list: list.length === 0 ? NO_SAVED_DEPARTMENTS : list };
  return composed.list;
}

function notify() {
  listeners.forEach((listener) => listener());
}

function parseSavedList(raw: string): readonly DepartmentCriteria[] {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return NO_SAVED_DEPARTMENTS;
  }
  if (!Array.isArray(value)) return NO_SAVED_DEPARTMENTS;
  const list: DepartmentCriteria[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const parsed = parseDepartmentCriteria(item);
    if (parsed === null || isBuiltInId(parsed.id) || parsed.id === PREP_CRITERIA_ID || seen.has(parsed.id)) continue;
    seen.add(parsed.id);
    list.push(parsed);
  }
  return list.length === 0 ? NO_SAVED_DEPARTMENTS : list;
}

function isBuiltInId(id: string): boolean {
  return DEPARTMENT_CRITERIA_LIST.some((item) => item.id === id);
}
