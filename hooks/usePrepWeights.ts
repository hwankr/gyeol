import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePrepTabReady } from "@/hooks/usePrepTabReady";
import { REVIEWER_LABEL } from "@/lib/admission";
import {
  MAX_WEIGHT,
  MIN_WEIGHT,
  TOTAL_WEIGHT,
  numberedGroups,
  tagsLine,
  totalWeight,
  weightChangeSummary,
  type PrepCriteria,
  type PrepElement,
} from "@/lib/prep/criteria";
import { consensusSaveSummary } from "@/lib/prep/consensusDraft";
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
// hydration 경고가 나지 않고, 브라우저에서 localStorage 를 읽은 뒤 저장한 배점이 나타난다(hooks/useEvaluationData.ts 와 같은 방식).
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

/** 수정하기·저장하기 왼쪽의 안내 한 줄: 보기 상태, 수정 상태, 방금 저장한 뒤(배점 저장, 초안 저장) */
const NOTE_VIEWING = "배점을 바꾸려면 수정하기를 누르세요.";
const NOTE_EDITING = `배점을 수정하고 있습니다. 합계가 ${TOTAL_WEIGHT}일 때 저장할 수 있습니다.`;
const NOTE_SAVED_WEIGHTS = "변경한 배점을 저장했습니다.";
const NOTE_SAVED_DRAFT = "모집요강으로 만든 평가 기준을 저장했습니다.";
const NOTE_SAVED_CONSENSUS = "위원 의견으로 만든 공통 기준을 저장했습니다.";
/** 저장소에 쓰지 못해 메모리에만 둔 값이 있을 때의 안내 */
const STORAGE_NOTICE = "브라우저에 저장하지 못했습니다. 새로고침하면 방금 바꾼 값이 사라집니다.";

/** 배점 합계가 100 이 아닐 때의 안내 (수정 상태에서만): 모자라면 더 줄 점수, 넘으면 넘은 점수 */
function totalNoticeText(total: number): string {
  return total < TOTAL_WEIGHT
    ? `합계가 ${TOTAL_WEIGHT}이 되도록 ${TOTAL_WEIGHT - total}점을 더 배정하세요.`
    : `합계가 ${TOTAL_WEIGHT}을 ${total - TOTAL_WEIGHT}점 넘었습니다.`;
}

/** 초안이 있을 때 탭 줄 아래에 보여 주는 안내 (모집요강 초안, 위원 의견으로 만든 공통 기준 초안) */
function draftNoticeText(draft: PrepDraft): string {
  return draft.source === "guideline"
    ? `모집요강(${draft.fileName})으로 만든 초안입니다. 저장하기 전에는 쓰이지 않습니다.`
    : `위원 ${draft.memberCount}명의 의견으로 만든 공통 기준 초안입니다. 저장하기 전에는 쓰이지 않습니다.`;
}

/**
 * 배점 막대(range 입력란)의 눈금 끝: 2 × 100 ÷ 요소 수를 정수로 올린 값이고 100 을 넘지 않는다.
 * 요소가 넷이면 0~50 이라 디자인과 같다(30점이면 손잡이가 60% 자리). 막대로는 눈금 끝까지만 줄 수 있고, 그보다 큰 배점은 −·+ 로 맞춘다
 * (그때 손잡이는 끝에 머문다).
 */
function weightSliderMax(elementCount: number): number {
  if (elementCount <= 0) return MAX_WEIGHT;
  return Math.min(MAX_WEIGHT, Math.ceil((2 * TOTAL_WEIGHT) / elementCount));
}

/** 배점 조절 버튼의 id. 순서(0 부터)와 종류로 만든다(요소 id 에는 id 로 쓰기 어려운 글자가 있을 수 있어 쓰지 않는다). */
export function stepButtonId(index: number, kind: "decrease" | "increase"): string {
  return `prep-weight-${index}-${kind}`;
}

/** 고치는 중인 배점: 어느 평가 기준(저장한 값 또는 초안)을 고치는 것인지와 요소 id → 배점 */
type WeightEdits = { base: PrepCriteria; weights: Readonly<Record<string, number>> };

/**
 * 전형 준비 · 평가·배점 설정 탭 상태: 저장한 평가 기준(localStorage), 보기/수정 상태와 고치는 중인 배점, 고른 요소,
 * 저장(변경 기록 한 건), 세부 평가 항목 패널의 "크게 보기" 상태.
 * 초안(모집요강으로 만든 것 또는 위원 의견으로 만든 공통 기준 초안. lib/prep/storage.ts 의 메모리)이 있으면 저장한 값 대신
 * 초안을 보여 주고 처음부터 수정 상태다.
 * 저장하면 초안이 저장한 평가 기준이 되고, 취소하면 초안을 버린다.
 * 사람이 바꿀 수 있는 것은 배점뿐이다(요소·묶음·질문의 글자는 고칠 수 없다). 배점은 −·+ (1 씩)와 배점 막대로 바꾼다.
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
  /** 세부 평가 항목을 크게 보는 중인지 (왼쪽 요소 목록을 숨기고 패널을 상자 폭 전체로 넓힌다. 질문 글자도 커진다) */
  const [big, setBig] = useState(false);
  /** 방금 저장한 뒤의 안내 문구. 저장하면 채우고 다시 수정 상태에 들어가면 비운다. */
  const [savedNote, setSavedNote] = useState<string | null>(null);
  /** 고른 요소의 이름 버튼 */
  const selectedNameButtonRef = useRef<HTMLButtonElement>(null);
  /** 요소를 고른 버튼에 초점이 있었으면, 다시 그린 뒤 그 버튼이 보이게 한다. */
  const revealSelectedRef = useRef(false);
  /** 수정하기·취소 버튼(같은 자리에서 글자만 바뀐다) */
  const editButtonRef = useRef<HTMLButtonElement>(null);
  /** 저장하기·취소를 누른 버튼에 초점이 있었으면, 다시 그린 뒤 수정하기 버튼에 초점을 두고 보이게 한다. */
  const focusEditButtonRef = useRef(false);
  /** 초점이 있던 배점 조절 버튼이 0·100 에 닿아 눌리지 않게 되면, 다시 그린 뒤 초점을 옮길 같은 요소의 반대쪽 버튼 id */
  const focusStepButtonRef = useRef<string | null>(null);
  /** 크게 보기·작게 보기 버튼(같은 자리에서 글자만 바뀐다) */
  const bigButtonRef = useRef<HTMLButtonElement>(null);
  /** 크게 보기·작게 보기를 누른 버튼에 초점이 있었으면, 다시 그린 뒤 그 버튼이 보이게 한다. */
  const revealBigButtonRef = useRef(false);

  // 이 화면의 수명 관리 (hooks/useGuidelineUpload.ts 와 같은 방식).
  // cacheComponents 에서는 다른 화면으로 가도 이 화면이 숨겨질 뿐 상태가 남는다. 숨겨지거나 언마운트될 때 cleanup 에서
  // 고치던 배점을 버리고 보기 상태(저장된 값)·첫 요소 선택·작게 보기로 되돌리고, 방금 저장했다는 안내를 지운다.
  // 저장한 값과 메모리에만 둔 값, 초안(lib/prep/storage.ts)은 되돌리지 않는다. 초안이 있으면 다시 보일 때 초안의 배점으로 수정 상태다.
  useLayoutEffect(() => {
    return () => {
      setEditingSaved(false);
      setEdits(null);
      setSelectedId(null);
      setBig(false);
      setSavedNote(null);
    };
  }, []);

  /** 화면에 보이는 평가 기준: 초안이 있으면 초안, 없으면 저장한 값 */
  const base = prepDraft?.criteria ?? saved;
  const editing = prepDraft !== null || editingSaved;
  const elements = base.elements;
  const selected = elements.find((element) => element.id === selectedId) ?? elements[0];
  const selectedIndex = elements.indexOf(selected);

  // 요소를 고르면 오른쪽 패널의 내용이 바뀌어 문서 높이가 달라진다. 문서가 짧아져 브라우저가 스크롤 위치를 문서 끝에 맞추면 누른 이름
  // 버튼이 화면 아래로 밀려날 수 있다. 이름 버튼은 고른 뒤에도 그 자리에 남으므로(눌린 상태만 바뀐다) 초점은 그대로이고, 그 버튼에
  // 초점이 있는 채로 눌렀으면(키보드든 마우스든) 배치가 끝난 위치를 재서 초점 표시까지 가려졌을 때만 보일 만큼 세로로 스크롤한다
  // (revealVertically). 요소를 고를 때만 돈다(처음 열 때·다시 보일 때는 표시가 없음).
  useLayoutEffect(() => {
    if (!revealSelectedRef.current) return;
    revealSelectedRef.current = false;
    const button = selectedNameButtonRef.current;
    if (button !== null && document.activeElement === button) revealVertically(button, FOCUS_REVEAL_MARGIN);
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

  // 크게 보기·작게 보기를 누르면 왼쪽 요소 목록이 사라지거나 다시 나타난다. 두 단이 위아래로 쌓이는 좁은 화면에서는 목록이 패널 위에
  // 있어서 패널(과 이 버튼)이 목록 높이만큼 위아래로 움직인다. 버튼은 그 자리에 남아 초점은 그대로이고, 그 버튼에 초점이 있는 채로
  // 눌렀으면(키보드든 마우스든) 다시 그린 뒤 초점 표시까지 가려졌을 때만 보일 만큼 세로로 스크롤한다.
  useLayoutEffect(() => {
    if (!revealBigButtonRef.current) return;
    revealBigButtonRef.current = false;
    const button = bigButtonRef.current;
    if (button !== null && document.activeElement === button) revealVertically(button, FOCUS_REVEAL_MARGIN);
  }, [big]);

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
    revealSelectedRef.current = hadFocus;
    setSelectedId(id);
  }

  function startEditing() {
    setEdits(null);
    setSavedNote(null);
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
   * 배점 막대를 움직여 배점을 value 로 정한다(정수로 맞추고 0~100 으로 자른다). 초점은 막대에 그대로 있다
   * (막대로 0·100 에 닿아 −·+ 가 눌리지 않게 되어도 초점이 있는 곳은 막대라 옮길 것이 없다).
   */
  function setWeight(id: string, value: number) {
    if (!editing || !Number.isFinite(value)) return;
    if (!elements.some((item) => item.id === id)) return;
    const next = Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, Math.round(value)));
    setEdits({ base, weights: { ...currentEdits, [id]: next } });
  }

  /**
   * 저장: 평가 기준을 저장하고 기록을 한 건 남긴 뒤 보기 상태로 돌아간다. 저장했으면 true.
   * - 초안: 초안(고친 배점 포함)이 저장한 평가 기준이 되고(모집요강 초안이면 파일 이름·변경 사항을 붙인다) 초안은 사라진다.
   *   기록은 모집요강 초안이면 "모집요강으로 평가 기준을 새로 만듦: …", 위원 의견 초안이면 "위원 의견으로 공통 기준을 만듦: …" 한 건이다.
   *   저장소에 쓰지 못해도 메모리의 평가 기준이 되고 초안은 사라진다(lib/prep/storage.ts).
   * - 저장한 값: 바뀐 요소만 적은 배점 변경 기록. 모집요강에서 온 값(guideline)은 그대로 남는다.
   */
  function save(): boolean {
    if (!canSave) return false;
    const elementsWithWeights = elements.map((element) => ({ ...element, weight: weightOf(element) }));
    if (prepDraft !== null) {
      const next: PrepCriteria = { ...prepDraft.criteria, elements: elementsWithWeights };
      const summary =
        prepDraft.source === "guideline"
          ? guidelineSaveSummary(prepDraft.fileName, elementsWithWeights)
          : consensusSaveSummary(prepDraft.memberCount, elementsWithWeights);
      if (savePrepDraft(prepDraft, next, createHistoryEntry(REVIEWER_LABEL, summary, new Date())) === null) return false;
      setSavedNote(prepDraft.source === "guideline" ? NOTE_SAVED_DRAFT : NOTE_SAVED_CONSENSUS);
    } else {
      const next: PrepCriteria = { ...saved, elements: elementsWithWeights };
      const summary = weightChangeSummary(saved, next);
      if (summary === null) return false;
      savePrepCriteria(next, createHistoryEntry(REVIEWER_LABEL, summary, new Date()));
      setSavedNote(NOTE_SAVED_WEIGHTS);
    }
    setEdits(null);
    setEditingSaved(false);
    return true;
  }

  /**
   * 수정하기·저장하기 왼쪽의 안내. 저장소에 쓰지 못해 메모리에만 둔 값이 있으면(storageNotice 가 보이는 동안) 저장했다고 적지 않는다.
   */
  const modeNote = editing ? NOTE_EDITING : savedNote !== null && !hasUnsaved ? savedNote : NOTE_VIEWING;

  return {
    ready,
    bodyRef,
    department: base.department,
    draftNotice: prepDraft === null ? null : draftNoticeText(prepDraft),
    modeNote,
    elements: elements.map((element, index) => {
      const weight = weightOf(element);
      return {
        id: element.id,
        decreaseButtonId: stepButtonId(index, "decrease"),
        increaseButtonId: stepButtonId(index, "increase"),
        name: element.name,
        tagsLine: tagsLine(element),
        weight,
        canDecrease: editing && weight > MIN_WEIGHT,
        canIncrease: editing && weight < MAX_WEIGHT,
      };
    }),
    selectedIndex,
    detail: { name: selected.name, groups: numberedGroups(selected) },
    weightRange: { min: MIN_WEIGHT, max: weightSliderMax(elements.length), step: 1 },
    total,
    totalMax: TOTAL_WEIGHT,
    editing,
    canSave,
    totalNotice: editing && total !== TOTAL_WEIGHT ? totalNoticeText(total) : null,
    storageNotice: hasUnsaved ? STORAGE_NOTICE : null,
    big,
    selectedNameButtonRef,
    editButtonRef,
    bigButtonRef,
    onSelectElement: selectElement,
    /** 배점 −·+. hadFocus 는 누른 버튼에 초점이 있었는지 */
    onDecrease: (id: string, hadFocus: boolean) => changeWeight(id, -1, hadFocus),
    onIncrease: (id: string, hadFocus: boolean) => changeWeight(id, 1, hadFocus),
    /** 배점 막대를 움직였을 때. value 는 막대의 새 값 */
    onSetWeight: setWeight,
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
    /** 크게 보기·작게 보기. hadFocus 는 누른 버튼에 초점이 있었는지 (있었으면 다시 그린 뒤 그 버튼이 보이게 한다) */
    onToggleBig: (hadFocus: boolean) => {
      revealBigButtonRef.current = hadFocus;
      setBig((value) => !value);
    },
  };
}
