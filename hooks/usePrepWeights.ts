import { useLayoutEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { REVIEWER_LABEL } from "@/lib/admission";
import {
  MAX_WEIGHT,
  MIN_WEIGHT,
  TOTAL_WEIGHT,
  numberedGroups,
  tagsLine,
  totalWeight,
  weightBarPercent,
  weightChangeSummary,
  type PrepCriteria,
  type PrepElement,
} from "@/lib/prep/criteria";
import { DEFAULT_PREP_CRITERIA } from "@/lib/prep/defaultCriteria";
import { createHistoryEntry } from "@/lib/prep/history";
import {
  hasUnsavedPrepChanges,
  loadPrepCriteria,
  savePrepCriteria,
  subscribePrepStorage,
} from "@/lib/prep/storage";

// 서버 렌더링과 hydration 중에는 기본 평가 기준(저장한 값 없음)으로 그린다. 그래서 서버 HTML 과 첫 클라이언트 렌더링이 같아
// hydration 경고가 나지 않고, 브라우저에서 localStorage 를 읽은 뒤 저장한 배점이 나타난다(hooks/useSavedDepartments.ts 와 같은 방식).
function getServerCriteria(): PrepCriteria {
  return DEFAULT_PREP_CRITERIA;
}

function getServerUnsaved(): boolean {
  return false;
}

/** 고른 요소의 화살표 버튼 위아래로 함께 보여야 하는 범위(px): 초점 표시(2px 띄움 + 2px 선) 4px 와 여유 */
const FOCUS_REVEAL_MARGIN = 8;

/**
 * element 의 위아래 margin 까지가 화면(뷰포트, 가로 스크롤바 제외) 안에 다 보이게 한다. 이미 다 보이면 스크롤하지 않고, 위나 아래로
 * 벗어났으면 벗어난 만큼만 문서를 세로로 바로 스크롤한다. scrollIntoView 는 가로로도 움직일 수 있어 쓰지 않는다.
 * 위치는 지금 배치(문서가 짧아져 브라우저가 스크롤 위치를 문서 끝에 맞춘 뒤 포함)에서 잰다.
 */
function revealVertically(element: HTMLElement, margin: number) {
  const rect = element.getBoundingClientRect();
  const viewportHeight = document.documentElement.clientHeight;
  const overTop = rect.top - margin;
  const overBottom = rect.bottom + margin - viewportHeight;
  let delta = 0;
  if (overTop < 0) delta = overTop;
  else if (overBottom > 0) delta = Math.min(overBottom, overTop);
  if (delta !== 0) window.scrollBy({ top: delta, left: 0, behavior: "instant" });
}

/** 배점 합계가 100 이 아닐 때의 안내 (수정 상태에서만) */
const TOTAL_NOTICE = `배점 합계가 ${TOTAL_WEIGHT}이 되어야 저장할 수 있습니다.`;
/** 저장소에 쓰지 못해 메모리에만 둔 값이 있을 때의 안내 */
const STORAGE_NOTICE = "브라우저에 저장하지 못했습니다. 새로고침하면 방금 바꾼 값이 사라집니다.";

/**
 * 전형 준비 · 평가·배점 설정 탭 상태: 저장한 평가 기준(localStorage), 보기/수정 상태와 고치는 중인 배점, 고른 요소,
 * 저장(변경 기록 한 건), 세부 평가 항목 패널의 스크롤과 "크게 보기" 창.
 * 사람이 바꿀 수 있는 것은 배점뿐이다(요소·묶음·질문의 글자는 고칠 수 없다).
 */
export function usePrepWeights() {
  const saved = useSyncExternalStore(subscribePrepStorage, loadPrepCriteria, getServerCriteria);
  const hasUnsaved = useSyncExternalStore(subscribePrepStorage, hasUnsavedPrepChanges, getServerUnsaved);
  const [editing, setEditing] = useState(false);
  /** 수정 상태에서 고치는 중인 배점 (요소 id → 배점). 보기 상태에서는 null. */
  const [draft, setDraft] = useState<Readonly<Record<string, number>> | null>(null);
  /** 고른 요소 id. null 이면 첫 요소. */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** 세부 평가 항목 패널의 묶음·질문 스크롤 영역 */
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  /** "크게 보기" 창과 그 창을 여는 버튼, 창의 닫기 버튼 */
  const dialogRef = useRef<HTMLDialogElement>(null);
  const expandButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  /** "크게 보기" 창의 제목. 창을 열면 여기에 초점을 두어 맨 위부터 읽게 한다. */
  const dialogTitleRef = useRef<HTMLHeadingElement>(null);
  /** 고른 요소(떠 있는 카드)의 화살표 버튼 */
  const selectedArrowRef = useRef<HTMLButtonElement>(null);
  /** 요소를 고른 버튼에 초점이 있었으면, 다시 그린 뒤 새 카드의 화살표 버튼으로 초점을 옮긴다. */
  const moveFocusToArrowRef = useRef(false);

  // 이 화면의 수명 관리 (hooks/useUpload.ts 와 같은 방식).
  // cacheComponents 에서는 다른 화면으로 가도 이 화면이 숨겨질 뿐 상태가 남는다. 숨겨지거나 언마운트될 때 cleanup 에서
  // 고치던 배점을 버리고 보기 상태(저장된 값)·첫 요소 선택으로 되돌리고, 열린 창을 닫고 패널 스크롤을 맨 위로 돌린다.
  // 저장한 값과 메모리에만 둔 값(lib/prep/storage.ts)은 되돌리지 않는다.
  useLayoutEffect(() => {
    const scrollArea = scrollAreaRef.current;
    const dialog = dialogRef.current;
    return () => {
      setEditing(false);
      setDraft(null);
      setSelectedId(null);
      dialog?.close();
      if (scrollArea !== null) scrollArea.scrollTop = 0;
    };
  }, []);

  const elements = saved.elements;
  const selected = elements.find((element) => element.id === selectedId) ?? elements[0];
  const selectedIndex = elements.indexOf(selected);

  // 이름 버튼으로 요소를 고르면 그 버튼은 카드의 제목 글자로 바뀌어 사라진다. 초점이 그 버튼에 있었다면 body 로 빠지지 않게
  // 새로 고른 요소의 화살표 버튼으로 옮긴다. 초점 표시는 :focus-visible 규칙대로 키보드일 때만 보인다.
  // 화살표 버튼은 이름보다 아래에 있어 화면 아래쪽 끝에서 고르면 가려질 수 있으므로, 초점은 스크롤 없이 준 뒤 배치가 끝난 위치를 재서
  // 초점 표시까지 가려졌을 때만 보일 만큼 세로로 스크롤한다(revealVertically). 요소를 고를 때만 돈다(처음 열 때·다시 보일 때는 표시가 없음).
  useLayoutEffect(() => {
    if (!moveFocusToArrowRef.current) return;
    moveFocusToArrowRef.current = false;
    const arrow = selectedArrowRef.current;
    if (arrow === null) return;
    arrow.focus({ preventScroll: true });
    revealVertically(arrow, FOCUS_REVEAL_MARGIN);
  }, [selected.id]);

  /** 화면에 보이는 배점: 수정 상태에서는 고치는 중인 값, 아니면 저장된 값 */
  function weightOf(element: PrepElement): number {
    return draft?.[element.id] ?? element.weight;
  }

  const total = totalWeight(elements.map(weightOf));
  const changed = elements.some((element) => weightOf(element) !== element.weight);
  const canSave = editing && total === TOTAL_WEIGHT && changed;

  /** 요소를 고른다. hadFocus 는 누른 버튼에 초점이 있었는지(키보드로 눌렀거나, 누르면서 초점이 간 경우) */
  function selectElement(id: string, hadFocus = false) {
    if (id === selected.id) return;
    moveFocusToArrowRef.current = hadFocus;
    setSelectedId(id);
    // 요소를 바꾸면 세부 평가 항목 목록은 맨 위부터 보여 준다.
    if (scrollAreaRef.current !== null) scrollAreaRef.current.scrollTop = 0;
  }

  function startEditing() {
    setDraft(Object.fromEntries(elements.map((element) => [element.id, element.weight])));
    setEditing(true);
  }

  /** 취소: 고치던 배점을 버리고 저장된 값으로 보기 상태에 돌아간다. */
  function cancelEditing() {
    setDraft(null);
    setEditing(false);
  }

  function changeWeight(id: string, delta: number) {
    if (!editing) return;
    const element = elements.find((item) => item.id === id);
    if (element === undefined) return;
    const next = Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, weightOf(element) + delta));
    setDraft((current) => ({ ...current, [id]: next }));
  }

  /** 저장: 평가 기준을 저장하고 바뀐 요소만 적은 기록을 한 건 남긴 뒤 보기 상태로 돌아간다. */
  function save() {
    if (!canSave) return;
    const next: PrepCriteria = {
      ...saved,
      elements: elements.map((element) => ({ ...element, weight: weightOf(element) })),
    };
    const summary = weightChangeSummary(saved, next);
    if (summary === null) return;
    savePrepCriteria(next, createHistoryEntry(REVIEWER_LABEL, summary, new Date()));
    setDraft(null);
    setEditing(false);
  }

  return {
    department: saved.department,
    elements: elements.map((element) => {
      const weight = weightOf(element);
      return {
        id: element.id,
        name: element.name,
        tagsLine: tagsLine(element),
        weight,
        barPercent: weightBarPercent(weight, elements.length),
        canDecrease: editing && weight > MIN_WEIGHT,
        canIncrease: editing && weight < MAX_WEIGHT,
      };
    }),
    selectedIndex,
    detail: { name: selected.name, groups: numberedGroups(selected) },
    total,
    totalMax: TOTAL_WEIGHT,
    editing,
    canSave,
    totalNotice: editing && total !== TOTAL_WEIGHT ? TOTAL_NOTICE : null,
    storageNotice: hasUnsaved ? STORAGE_NOTICE : null,
    scrollAreaRef,
    dialogRef,
    expandButtonRef,
    closeButtonRef,
    dialogTitleRef,
    selectedArrowRef,
    onSelectElement: selectElement,
    onDecrease: (id: string) => changeWeight(id, -1),
    onIncrease: (id: string) => changeWeight(id, 1),
    onToggleEditing: () => (editing ? cancelEditing() : startEditing()),
    onSave: save,
    /**
     * 창을 연다. showModal 은 창 안의 첫 컨트롤(맨 끝의 닫기)에 초점을 두며 창을 아래로 스크롤하므로, 곧바로 제목(tabIndex -1)으로
     * 초점을 옮기고 창 스크롤을 맨 위로 돌려 처음부터 읽게 한다. 다음 Tab 은 닫기로 간다.
     */
    onOpenDialog: () => {
      const dialog = dialogRef.current;
      if (dialog === null) return;
      dialog.showModal();
      dialogTitleRef.current?.focus({ preventScroll: true });
      dialog.scrollTop = 0;
    },
    onCloseDialog: () => dialogRef.current?.close(),
    /** 창이 닫히면(닫기·Esc) 초점을 "크게 보기" 버튼으로 돌린다. */
    onDialogClose: () => expandButtonRef.current?.focus(),
    /** 창 안에서 Tab 은 창 밖으로 나가지 않는다(창 안의 컨트롤은 닫기 버튼 하나다). */
    onDialogKeyDown: (event: KeyboardEvent<HTMLDialogElement>) => {
      if (event.key !== "Tab") return;
      event.preventDefault();
      closeButtonRef.current?.focus();
    },
  };
}
