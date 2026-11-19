import type { PageRect } from "./recordLocate.ts";
import type { RecordPageImage, RecordPages } from "./recordPages.ts";

// 올린 학생부의 가린 쪽 그림과 자리 목록(lib/recordPages.ts 의 RecordPages)을 브라우저 IndexedDB 에 남기고 불러온다. 브라우저에서만 호출한다.
// 올린 지원자의 분석 결과는 localStorage 에 있고(lib/applicants/uploadedStorage.ts), 쪽 그림은 커서(쪽마다 수백 KB) 여기에 따로 둔다.
// 열쇠는 "<지원자 코드>@<남긴 때>" 다(같은 코드가 다른 학생부에 다시 붙어도 섞이지 않는다).
// 남기는 것은 가린 그림과 자리(숫자)뿐이다. 가리기 전 PDF·원문·파일 이름은 남기지 않는다.
// 읽기·쓰기·지우기는 모두 실패해도 예외를 던지지 않는다(쪽 그림이 없으면 원문보기는 글만 보여 준다).

const DB_NAME = "gyeol";
const DB_VERSION = 1;
const STORE = "recordPages";

/** 저장 값의 버전 */
const RECORD_PAGES_VERSION = 1;

/** 저장 값 */
type StoredRecordPages = RecordPages & { version: number };

/** 올린 지원자의 쪽 그림 열쇠 */
export function recordPagesKey(code: string, at: string): string {
  return `${code}@${at}`;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("blocked"));
  });
}

/** 저장소 하나에 대한 작업을 하고 끝나면 데이터베이스를 닫는다 */
async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE, mode);
      const request = run(transaction.objectStore(STORE));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

/** 쪽 그림을 남긴다. 남겼으면 true, 실패하면(저장 공간 부족, IndexedDB 를 쓸 수 없음) false */
export async function saveRecordPages(key: string, pages: RecordPages): Promise<boolean> {
  try {
    const value: StoredRecordPages = { version: RECORD_PAGES_VERSION, ...pages };
    await withStore("readwrite", (store) => store.put(value, key));
    return true;
  } catch {
    return false;
  }
}

/** 쪽 그림을 불러온다. 없거나 모양이 틀리거나 읽지 못하면 null */
export async function loadRecordPages(key: string): Promise<RecordPages | null> {
  try {
    return parseRecordPages(await withStore<unknown>("readonly", (store) => store.get(key)));
  } catch {
    return null;
  }
}

/** 남길 열쇠(keep)에 없는 쪽 그림을 모두 지운다(목록에서 빠진 올린 지원자의 것). 실패해도 넘어간다 */
export async function pruneRecordPages(keep: ReadonlySet<string>): Promise<void> {
  try {
    const keys = await withStore<IDBValidKey[]>("readonly", (store) => store.getAllKeys());
    for (const key of keys) {
      if (typeof key === "string" && keep.has(key)) continue;
      await withStore("readwrite", (store) => store.delete(key));
    }
  } catch {
    // 지우지 못한 그림은 다음에 다시 지운다.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPageRect(value: unknown): value is PageRect {
  return Array.isArray(value) && value.length === 5 && value.every((part) => typeof part === "number" && Number.isFinite(part));
}

/** 자리 목록: id → 네모 배열. 모양이 틀린 것은 버린다 */
function parseRects(value: unknown): Record<string, PageRect[]> {
  const rects: Record<string, PageRect[]> = {};
  if (!isRecord(value)) return rects;
  for (const [id, list] of Object.entries(value)) {
    if (Array.isArray(list) && list.every(isPageRect)) rects[id] = list;
  }
  return rects;
}

function parsePage(value: unknown): RecordPageImage | null {
  if (!isRecord(value)) return null;
  const { width, height, state, image } = value;
  if (typeof width !== "number" || typeof height !== "number" || !(width > 0) || !(height > 0)) return null;
  if (state === "shown") return image instanceof Blob ? { width, height, state, image } : null;
  if (state === "scan" || state === "unverified") return { width, height, state, image: null };
  return null;
}

/** 읽은 값을 확인한다: 버전이 맞고, 쪽이 하나 이상이고, 쪽마다 모양이 맞아야 한다 */
function parseRecordPages(value: unknown): RecordPages | null {
  if (!isRecord(value) || value.version !== RECORD_PAGES_VERSION || !Array.isArray(value.pages) || value.pages.length === 0) {
    return null;
  }
  const pages: RecordPageImage[] = [];
  for (const raw of value.pages) {
    const page = parsePage(raw);
    if (page === null) return null;
    pages.push(page);
  }
  return { pages, sections: parseRects(value.sections), evidences: parseRects(value.evidences) };
}
