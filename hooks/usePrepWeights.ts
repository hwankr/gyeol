import { useLayoutEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { usePrepTabReady } from "@/hooks/usePrepTabReady";
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
import { guidelineSaveSummary } from "@/lib/prep/guidelineDraft";
import { createHistoryEntry } from "@/lib/prep/history";
import { FOCUS_REVEAL_MARGIN, revealVertically } from "@/lib/prep/reveal";
import {
  discardPrepDraft,
  hasUnsavedPrepChanges,
  loadPrepCriteria,
  loadPrepDraft,
  savePrepCriteria,
  savePrepDraft,
  subscribePrepStorage,
  type PrepDraft,
} from "@/lib/prep/storage";

// 서버 렌더링과 hydration 중에는 기본 평가 기준(저장한 값 없음)으로 그린다. 그래서 서버 HTML 과 첫 클라이언트 렌더링이 같아
// hydration 경고가 나지 않고, 브라우저에서 localStorage 를 읽은 뒤 저장한 배점이 나타난다(hooks/useSavedDepartments.ts 와 같은 방식).
function getServerCriteria(): PrepCriteria {
  return DEFAULT_PREP_CRITERIA;
}

function getServerUnsaved(): boolean {
  return false;
}

/** 서버 렌더링에는 초안이 없다(초안은 브라우저 메모리에만 있다). */
function getServerDraft(): PrepDraft | null {
  return null;
}

/** 배점 합계가 100 이 아닐 때의 안내 (수정 상태에서만) */
const TOTAL_NOTICE = `배점 합계가 ${TOTAL_WEIGHT}이 되어야 저장할 수 있습니다.`;
/** 저장소에 쓰지 못해 메모리에만 둔 값이 있을 때의 안내 */
const STORAGE_NOTICE = "브라우저에 저장하지 못했습니다. 새로고침하면 방금 바꾼 값이 사라집니다.";

/** 모집요강 초안이 있을 때 탭 줄 아래에 보여 주는 안내 */
function draftNoticeText(fileName: string): string {
  return `모집요강(${fileName})으로 만든 초안입니다. 저장하기 전에는 쓰이지 않습니다.`;
}

/** 배점 조절 버튼의 id. 순서(0 부터)와 종류로 만든다(요소 id 에는 id 로 쓰기 어려운 글자가 있을 수 있어 쓰지 않는다). */
export function stepButtonId(index: number, kind: "decrease" | "increase"): string {
  return `prep-weight-${index}-${kind}`;
}

/** 고치는 중인 배점: 어느 평가 기준(저장한 값 또는 초안)을 고치는 것인지와 요소 id → 배점 */
type WeightEdits = { base: PrepCriteria; weights: Readonly<Record<string, number>> };

/**
 * 전형 준비 · 평가·배점 설정 탭 상태: 저장한 평가 기준(localStorage), 보기/수정 상태와 고치는 중인 배점, 고른 요소,
 * 저장(변경 기록 한 건), 세부 평가 항목 패널의 스크롤과 "크게 보기" 창.
 * 모집요강으로 만든 초안(lib/prep/storage.ts 의 메모리)이 있으면 저장한 값 대신 초안을 보여 주고 처음부터 수정 상태다.
 * 저장하면 초안이 저장한 평가 기준이 되고, 취소하면 초안을 버린다.
 * 사람이 바꿀 수 있는 것은 배점뿐이다(요소·묶음·질문의 글자는 고칠 수 없다).
 */
export function usePrepWeights() {
  const { ready, bodyRef } = usePrepTabReady<HTMLDivElement>();
  const saved = useSyncExternalStore(subscribePrepStorage, loadPrepCriteria, getServerCriteria);
  const prepDraft = useSyncExternalStore(subscribePrepStorage, loadPrepDraft, getServerDraft);
  const hasUnsaved = useSyncExternalStore(subscribePrepStorage, hasUnsavedPrepChanges, getServerUnsaved);
  /** 저장한 값을 고치는 수정 상태인지 (초안이 있으면 이 값과 상관없이 수정 상태다) */
  const [editingSaved, setEditingSaved] = useState(false);
  /** 고치는 중인 배점. 아직 고치지 않았으면 null. 고치던 기준이 바뀌면(초안이 새로 생기는 등) 쓰지 않는다. */
  const [edits, setEdits] = useState<WeightEdits | null>(null);
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
  /** 수정하기·취소 버튼(같은 자리에서 글자만 바뀐다) */
  const editButtonRef = useRef<HTMLButtonElement>(null);
  /** 저장하기·취소를 누른 버튼에 초점이 있었으면, 다시 그린 뒤 수정하기 버튼에 초점을 두고 보이게 한다. */
  const focusEditButtonRef = useRef(false);
  /** 초점이 있던 배점 조절 버튼이 0·100 에 닿아 눌리지 않게 되면, 다시 그린 뒤 초점을 옮길 같은 요소의 반대쪽 버튼 id */
  const focusStepButtonRef = useRef<string | null>(null);

  // 이 화면의 수명 관리 (hooks/useUpload.ts 와 같은 방식).
  // cacheComponents 에서는 다른 화면으로 가도 이 화면이 숨겨질 뿐 상태가 남는다. 숨겨지거나 언마운트될 때 cleanup 에서
  // 고치던 배점을 버리고 보기 상태(저장된 값)·첫 요소 선택으로 되돌리고, 열린 창을 닫고 패널 스크롤을 맨 위로 돌린다.
  // 저장한 값과 메모리에만 둔 값, 초안(lib/prep/storage.ts)은 되돌리지 않는다. 초안이 있으면 다시 보일 때 초안의 배점으로 수정 상태다.
  useLayoutEffect(() => {
    const scrollArea = scrollAreaRef.current;
    const dialog = dialogRef.current;
    return () => {
      setEditingSaved(false);
      setEdits(null);
      setSelectedId(null);
      dialog?.close();
      if (scrollArea !== null) scrollArea.scrollTop = 0;
    };
  }, []);

  /** 화면에 보이는 평가 기준: 초안이 있으면 초안, 없으면 저장한 값 */
  const base = prepDraft?.criteria ?? saved;
  const editing = prepDraft !== null || editingSaved;
  const elements = base.elements;
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

  // 저장하기·취소를 키보드(또는 초점이 간 누름)로 눌렀으면, 저장하기가 눌리지 않게 되어 초점이 body 로 빠지지 않도록
  // 같은 자리의 수정하기 버튼에 초점을 둔다(취소는 이미 그 버튼이다). 초점 표시까지 가려졌으면 보일 만큼만 세로로 스크롤한다.
  useLayoutEffect(() => {
    if (!focusEditButtonRef.current) return;
    focusEditButtonRef.current = false;
    const button = editButtonRef.current;
    if (button === null) return;
    button.focus({ preventScroll: true });
    revealVertically(button, FOCUS_REVEAL_MARGIN);
  });

  // 배점 조절 버튼은 0(−)·100(+)에 닿으면 disabled 가 되어 초점이 body 로 빠진다. 그 버튼에 초점이 있었으면 같은 요소의 반대쪽
  // 버튼(눌릴 수 있다)으로 옮긴다. 같은 줄에 있어 화면 안에 있지만, 가려졌으면 보일 만큼만 세로로 스크롤한다.
  useLayoutEffect(() => {
    const id = focusStepButtonRef.current;
    if (id === null) return;
    focusStepButtonRef.current = null;
    const button = document.getElementById(id);
    if (button === null) return;
    button.focus({ preventScroll: true });
    revealVertically(button, FOCUS_REVEAL_MARGIN);
  });

  /** 지금 기준을 고치는 중인 배점 (보기 상태이거나 고치던 기준이 바뀌었으면 쓰지 않는다) */
  const currentEdits = editing && edits !== null && edits.base === base ? edits.weights : null;

  /** 화면에 보이는 배점: 수정 상태에서는 고치는 중인 값, 아니면 저장된(또는 초안의) 값 */
  function weightOf(element: PrepElement): number {
    return currentEdits?.[element.id] ?? element.weight;
  }

  const total = totalWeight(elements.map(weightOf));
  const changed = elements.some((element) => weightOf(element) !== element.weight);
  // 초안은 저장된 값과 늘 다르므로 합계가 100 이면 저장할 수 있다.
  const canSave = editing && total === TOTAL_WEIGHT && (prepDraft !== null || changed);

  /** 요소를 고른다. hadFocus 는 누른 버튼에 초점이 있었는지(키보드로 눌렀거나, 누르면서 초점이 간 경우) */
  function selectElement(id: string, hadFocus = false) {
    if (id === selected.id) return;
    moveFocusToArrowRef.current = hadFocus;
    setSelectedId(id);
    // 요소를 바꾸면 세부 평가 항목 목록은 맨 위부터 보여 준다.
    if (scrollAreaRef.current !== null) scrollAreaRef.current.scrollTop = 0;
  }

  function startEditing() {
    setEdits(null);
    setEditingSaved(true);
  }

  /** 취소: 고치던 배점을 버리고 저장된 값으로 보기 상태에 돌아간다. 초안이 있으면 초안을 버린다. */
  function cancelEditing() {
    if (prepDraft !== null) discardPrepDraft();
    setEdits(null);
    setEditingSaved(false);
  }

  /** 배점을 delta 만큼 바꾼다. hadFocus 는 누른 버튼에 초점이 있었는지 (0·100 에 닿으면 반대쪽 버튼으로 초점을 옮긴다) */
  function changeWeight(id: string, delta: number, hadFocus: boolean) {
    if (!editing) return;
    const index = elements.findIndex((item) => item.id === id);
    if (index < 0) return;
    const next = Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, weightOf(elements[index]) + delta));
    setEdits({ base, weights: { ...currentEdits, [id]: next } });
    const reachedBound = delta < 0 ? next === MIN_WEIGHT : next === MAX_WEIGHT;
    if (hadFocus && reachedBound) focusStepButtonRef.current = stepButtonId(index, delta < 0 ? "increase" : "decrease");
  }

  /**
   * 저장: 평가 기준을 저장하고 기록을 한 건 남긴 뒤 보기 상태로 돌아간다. 저장했으면 true.
   * - 초안: 초안(고친 배점 포함)이 저장한 평가 기준이 되고(모집요강 파일 이름·변경 사항을 붙인다) 초안은 사라진다.
   *   저장소에 쓰지 못해도 메모리의 평가 기준이 되고 초안은 사라진다(lib/prep/storage.ts).
   * - 저장한 값: 바뀐 요소만 적은 배점 변경 기록. 모집요강에서 온 값(guideline)은 그대로 남는다.
   */
  function save(): boolean {
    if (!canSave) return false;
    const elementsWithWeights = elements.map((element) => ({ ...element, weight: weightOf(element) }));
    if (prepDraft !== null) {
      const next: PrepCriteria = { ...prepDraft.criteria, elements: elementsWithWeights };
      const summary = guidelineSaveSummary(prepDraft.fileName, elementsWithWeights);
      if (savePrepDraft(prepDraft, next, createHistoryEntry(REVIEWER_LABEL, summary, new Date())) === null) return false;
    } else {
      const next: PrepCriteria = { ...saved, elements: elementsWithWeights };
      const summary = weightChangeSummary(saved, next);
      if (summary === null) return false;
      savePrepCriteria(next, createHistoryEntry(REVIEWER_LABEL, summary, new Date()));
    }
    setEdits(null);
    setEditingSaved(false);
    return true;
  }

  return {
    ready,
    bodyRef,
    department: base.department,
    draftNotice: prepDraft === null ? null : draftNoticeText(prepDraft.fileName),
    elements: elements.map((element, index) => {
      const weight = weightOf(element);
      return {
        id: element.id,
        decreaseButtonId: stepButtonId(index, "decrease"),
        increaseButtonId: stepButtonId(index, "increase"),
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
    editButtonRef,
    onSelectElement: selectElement,
    /** 배점 −·+. hadFocus 는 누른 버튼에 초점이 있었는지 */
    onDecrease: (id: string, hadFocus: boolean) => changeWeight(id, -1, hadFocus),
    onIncrease: (id: string, hadFocus: boolean) => changeWeight(id, 1, hadFocus),
    /** 수정하기·취소. hadFocus 는 누른 버튼에 초점이 있었는지 (취소 뒤 내용이 움직여 그 버튼이 가려졌으면 보이게 한다) */
    onToggleEditing: (hadFocus: boolean) => {
      if (editing) {
        // 표시는 상태를 바꾸기 전에 세운다(다시 그린 뒤의 layout effect 가 읽는다).
        focusEditButtonRef.current = hadFocus;
        cancelEditing();
      } else {
        startEditing();
      }
    },
    /** 저장하기. hadFocus 는 누른 버튼에 초점이 있었는지 (있었으면 저장 뒤 수정하기 버튼으로 초점을 옮긴다) */
    onSave: (hadFocus: boolean) => {
      focusEditButtonRef.current = hadFocus;
      if (!save()) focusEditButtonRef.current = false;
    },
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
