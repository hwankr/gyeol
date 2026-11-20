import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePrepTabReady } from "@/hooks/usePrepTabReady";
import { REVIEWER_LABEL } from "@/lib/admission";
import { NO_UPLOADED_APPLICANTS, type UploadedApplicant } from "@/lib/applicants/uploaded";
import { loadUploadedApplicants, subscribeUploadedApplicants } from "@/lib/applicants/uploadedStorage";
import { assessmentFor } from "@/lib/evaluate/uploadedEvaluation";
import { rubricFingerprint } from "@/lib/prep/analysisCriteria";
import {
  MAX_WEIGHT,
  MIN_WEIGHT,
  PREP_LIMITS,
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
  draftGroupsOf,
  draftTagsLine,
  groupsOfDraft,
  isDraftComplete,
  joinSaveSummary,
  rubricChangeSummary,
  rubricEditStats,
  sameGroups,
  withGroupAdded,
  withGroupName,
  withGroupRemoved,
  withGroupTag,
  withQuestionAdded,
  withQuestionRemoved,
  withQuestionText,
  type DraftGroup,
} from "@/lib/prep/rubricEdit";
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

/** 서버 렌더링에는 올린 지원자가 없다(브라우저 저장소에만 있다). */
function getServerUploaded(): readonly UploadedApplicant[] {
  return NO_UPLOADED_APPLICANTS;
}

/** 수정하기·저장하기 왼쪽의 안내 한 줄: 보기 상태, 수정 상태, 방금 저장한 뒤(배점·세부 평가 항목 저장, 초안 저장) */
const NOTE_VIEWING = "배점과 세부 평가 항목을 바꾸려면 수정하기를 누르세요.";
const NOTE_EDITING = `배점과 세부 평가 항목을 수정하고 있습니다. 배점 합계가 ${TOTAL_WEIGHT}일 때 저장할 수 있습니다.`;
const NOTE_SAVED_WEIGHTS = "변경한 배점을 저장했습니다.";
const NOTE_SAVED_RUBRIC = "변경한 세부 평가 항목을 저장했습니다.";
const NOTE_SAVED_BOTH = "변경한 배점과 세부 평가 항목을 저장했습니다.";
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
 * 요소가 넷이면 0~50 이라 디자인과 같고(30점이면 손잡이가 60% 자리), 기본 평가 기준처럼 셋이면 0~67 이다(50점이면 손잡이가 75% 자리).
 * 막대로는 눈금 끝까지만 줄 수 있고, 그보다 큰 배점은 −·+ 로 맞춘다
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

/**
 * 세부 평가 항목 편집 컨트롤의 id. 묶음·질문의 key(lib/prep/rubricEdit.ts: "g0", "g0q1", 새로 더한 것은 "n3")와 종류로 만든다.
 * 패널에는 고른 요소 하나의 묶음만 그려지고 key 는 그 안에서 겹치지 않는다. 더하거나 뺀 뒤 초점을 옮길 곳을 이 id 로 찾는다.
 */
function rubricControlId(key: string, kind: "name" | "tag" | "text" | "delete" | "add"): string {
  return `prep-rubric-${key}-${kind}`;
}

/** 묶음 추가 버튼의 id */
const ADD_GROUP_BUTTON_ID = "prep-rubric-add-group";

/** 세부 평가 항목 입력란의 안내 글자 */
const GROUP_NAME_PLACEHOLDER = "묶음 이름";
const GROUP_TAG_PLACEHOLDER = "태그";
const QUESTION_PLACEHOLDER = "질문을 입력하세요.";

/** 세부 평가 항목에 빈 칸이 있어 저장할 수 없을 때의 안내. names 는 빈 칸이 있는 요소의 이름(요소 순서대로) */
function blankNoticeText(names: readonly string[]): string {
  return `${names.join(", ")}의 세부 평가 항목에 빈 칸이 있습니다. 모두 채워야 저장할 수 있습니다.`;
}

/** 저장하면 평가 대기 목록에서 빠지는 올린 학생부가 있을 때의 안내 */
function reuploadNoticeText(count: number): string {
  return `저장하면 지금 기준으로 분석한 올린 학생부 ${count}건은 평가 대기 목록에서 빠집니다. 다시 올려 분석해야 평가할 수 있습니다.`;
}

/**
 * 세부 평가 항목을 고치는 화면에 넘기는 값: 묶음마다 이름·태그와 입력란·버튼의 id, 질문마다 번호(요소 안에서 묶음을 넘어 이어짐)와 글,
 * 더하고 뺄 수 있는지(한도: 묶음 1~6개, 묶음마다 질문 1~8개)와 지금 수("질문 3 / 8", "묶음 3 / 6").
 */
function rubricEditorView(draft: readonly DraftGroup[]) {
  /** 묶음마다 그 앞 묶음들의 질문 수 (번호의 시작) */
  const offsets = draft.map((_, index) => draft.slice(0, index).reduce((sum, group) => sum + group.questions.length, 0));
  return {
    groups: draft.map((group, index) => {
      const position = index + 1;
      const name = group.name.trim();
      return {
        key: group.key,
        /** 요소 안에서의 순번 (입력란의 이름에 쓴다: "2번째 묶음 이름") */
        position,
        /** 묶음을 가리키는 말 (버튼의 이름에 쓴다): 이름이 있으면 이름, 비어 있으면 "2번째 묶음" */
        label: name === "" ? `${position}번째 묶음` : name,
        name: group.name,
        tag: group.tag,
        nameInputId: rubricControlId(group.key, "name"),
        tagInputId: rubricControlId(group.key, "tag"),
        deleteButtonId: rubricControlId(group.key, "delete"),
        addQuestionButtonId: rubricControlId(group.key, "add"),
        /** 묶음이 하나만 남으면 뺄 수 없다 */
        canDelete: draft.length > 1,
        canAddQuestion: group.questions.length < PREP_LIMITS.questions,
        questionCountText: `질문 ${group.questions.length} / ${PREP_LIMITS.questions}`,
        questions: group.questions.map((question, offset) => ({
          key: question.key,
          number: offsets[index] + offset + 1,
          text: question.text,
          inputId: rubricControlId(question.key, "text"),
          deleteButtonId: rubricControlId(question.key, "delete"),
          /** 그 묶음의 질문이 하나만 남으면 뺄 수 없다 */
          canDelete: group.questions.length > 1,
        })),
      };
    }),
    addGroupButtonId: ADD_GROUP_BUTTON_ID,
    canAddGroup: draft.length < PREP_LIMITS.groups,
    groupCountText: `묶음 ${draft.length} / ${PREP_LIMITS.groups}`,
    limits: {
      groupName: PREP_LIMITS.groupNameLength,
      tag: PREP_LIMITS.tagLength,
      question: PREP_LIMITS.questionLength,
    },
    placeholders: { groupName: GROUP_NAME_PLACEHOLDER, tag: GROUP_TAG_PLACEHOLDER, question: QUESTION_PLACEHOLDER },
  };
}

/**
 * 고치는 중인 값: 어느 평가 기준(저장한 값 또는 초안)을 고치는 것인지, 요소 id → 배점, 요소 id → 세부 평가 항목(묶음·질문).
 * 고친 요소만 들어 있다(없는 요소는 그 기준의 값 그대로다).
 */
type CriteriaEdits = {
  base: PrepCriteria;
  weights: Readonly<Record<string, number>>;
  groups: Readonly<Record<string, readonly DraftGroup[]>>;
};

/**
 * 전형 준비 · 평가·배점 설정 탭 상태: 저장한 평가 기준(localStorage), 보기/수정 상태와 고치는 중인 배점·세부 평가 항목, 고른 요소,
 * 저장(변경 기록 한 건), 세부 평가 항목 패널의 "크게 보기" 상태.
 * 초안(모집요강으로 만든 것 또는 위원 의견으로 만든 공통 기준 초안. lib/prep/storage.ts 의 메모리)이 있으면 저장한 값 대신
 * 초안을 보여 주고 처음부터 수정 상태다.
 * 저장하면 초안이 저장한 평가 기준이 되고, 취소하면 초안을 버린다.
 * 사람이 바꿀 수 있는 것은 배점과 세부 평가 항목(묶음의 이름·태그, 질문의 글, 묶음·질문의 더하기·빼기)이다. 평가 요소 자체(이름·개수·순서)와
 * 묶음·질문의 순서는 고칠 수 없다. 배점은 −·+ (1 씩)와 배점 막대로, 세부 평가 항목은 오른쪽 패널의 입력란과 추가·삭제 버튼으로 바꾼다
 * (계산은 lib/prep/rubricEdit.ts). 세부 평가 항목은 고른 요소의 것만 패널에 보이지만, 고친 값은 요소를 바꿔 골라도 남는다.
 */
export function usePrepWeights() {
  const { ready, bodyRef } = usePrepTabReady<HTMLDivElement>();
  const saved = useSyncExternalStore(subscribePrepStorage, loadPrepCriteria, getServerCriteria);
  const prepDraft = useSyncExternalStore(subscribePrepStorage, loadPrepDraft, getServerDraft);
  const hasUnsaved = useSyncExternalStore(subscribePrepStorage, hasUnsavedPrepChanges, getServerUnsaved);
  /** 올린 지원자 (세부 평가 항목을 바꿔 저장하면 평가 대기 목록에서 빠지는 수를 미리 알리는 데 쓴다) */
  const uploaded = useSyncExternalStore(subscribeUploadedApplicants, loadUploadedApplicants, getServerUploaded);
  /** 저장한 값을 고치는 수정 상태인지 (초안이 있으면 이 값과 상관없이 수정 상태다) */
  const [editingSaved, setEditingSaved] = useState(false);
  /** 고치는 중인 배점·세부 평가 항목. 아직 고치지 않았으면 null. 고치던 기준이 바뀌면(초안이 새로 생기는 등) 쓰지 않는다. */
  const [edits, setEdits] = useState<CriteriaEdits | null>(null);
  /** 새로 더하는 묶음·질문의 key 에 붙이는 순번 (이 화면에서 겹치지 않으면 된다) */
  const newKeySerialRef = useRef(0);
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
  /**
   * 다시 그린 뒤 초점을 옮길 컨트롤의 id. 초점이 있던 배점 조절 버튼이 0·100 에 닿아 눌리지 않게 되면 같은 요소의 반대쪽 버튼,
   * 질문·묶음을 더했으면 새 입력란, 초점이 있던 삭제 버튼으로 질문·묶음을 뺐으면 그 자리에 온 줄의 삭제 버튼(없으면 추가 버튼)이다.
   */
  const focusControlRef = useRef<string | null>(null);
  /** 크게 보기·작게 보기 버튼(같은 자리에서 글자만 바뀐다) */
  const bigButtonRef = useRef<HTMLButtonElement>(null);
  /** 크게 보기·작게 보기를 누른 버튼에 초점이 있었으면, 다시 그린 뒤 그 버튼이 보이게 한다. */
  const revealBigButtonRef = useRef(false);

  // 이 화면의 수명 관리 (hooks/useGuidelineUpload.ts 와 같은 방식).
  // cacheComponents 에서는 다른 화면으로 가도 이 화면이 숨겨질 뿐 상태가 남는다. 숨겨지거나 언마운트될 때 cleanup 에서
  // 고치던 배점·세부 평가 항목을 버리고 보기 상태(저장된 값)·첫 요소 선택·작게 보기로 되돌리고, 방금 저장했다는 안내를 지운다.
  // 저장한 값과 메모리에만 둔 값, 초안(lib/prep/storage.ts)은 되돌리지 않는다. 초안이 있으면 다시 보일 때 초안의 값으로 수정 상태다.
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
  // 세부 평가 항목도 같은 길을 쓴다: 질문·묶음을 더하면 새 입력란으로, 초점이 있던 삭제 버튼으로 빼면(그 버튼이 문서에서 빠진다)
  // 그 자리에 온 줄의 삭제 버튼이나 추가 버튼으로 옮긴다.
  useLayoutEffect(() => {
    const id = focusControlRef.current;
    if (id === null) return;
    focusControlRef.current = null;
    const control = document.getElementById(id);
    if (control === null) return;
    control.focus({ preventScroll: true });
    revealVertically(control, FOCUS_REVEAL_MARGIN);
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

  /** 지금 기준을 고치는 중인 값 (보기 상태이거나 고치던 기준이 바뀌었으면 쓰지 않는다) */
  const currentEdits = editing && edits !== null && edits.base === base ? edits : null;

  /** 화면에 보이는 배점: 수정 상태에서는 고치는 중인 값, 아니면 저장된(또는 초안의) 값 */
  function weightOf(element: PrepElement): number {
    return currentEdits?.weights[element.id] ?? element.weight;
  }

  /** 그 요소의 세부 평가 항목을 고치는 값: 고친 적이 있으면 그 값, 없으면 저장된(또는 초안의) 묶음으로 만든 값(key 는 늘 같다) */
  function draftOf(element: PrepElement): readonly DraftGroup[] {
    return currentEdits?.groups[element.id] ?? draftGroupsOf(element.groups);
  }

  /** 요소마다 저장하면 될 값: 배점, 묶음(고친 요소는 앞뒤 공백을 뺀 값), 세부 평가 항목이 저장할 수 있는 모양인지·내용이 바뀌었는지 */
  const pending = elements.map((element) => {
    const draft = currentEdits?.groups[element.id];
    const groups = draft === undefined ? element.groups : groupsOfDraft(draft);
    return {
      element,
      draft,
      weight: weightOf(element),
      groups,
      complete: draft === undefined || isDraftComplete(draft),
      rubricChanged: draft !== undefined && !sameGroups(element.groups, groups),
    };
  });
  /** 저장하면 평가 기준이 될 요소들 */
  const nextElements: PrepElement[] = pending.map((item) => ({ ...item.element, weight: item.weight, groups: item.groups }));

  const total = totalWeight(pending.map((item) => item.weight));
  const weightsChanged = pending.some((item) => item.weight !== item.element.weight);
  const rubricChanged = pending.some((item) => item.rubricChanged);
  /** 세부 평가 항목에 빈 칸이 있는 요소의 이름 */
  const blankNames = pending.filter((item) => !item.complete).map((item) => item.element.name);
  // 초안은 저장된 값과 늘 다르므로 합계가 100 이고 빈 칸이 없으면 저장할 수 있다.
  const canSave =
    editing && total === TOTAL_WEIGHT && blankNames.length === 0 && (prepDraft !== null || weightsChanged || rubricChanged);

  // 세부 평가 항목(요소 이름·묶음·질문)이 저장한 기준과 달라지면 지문이 달라져, 지금 기준으로 분석해 둔 올린 학생부는 평가 대기 목록에서
  // 빠지고 다시 올려 분석해야 한다(lib/evaluate/uploadedEvaluation.ts 의 assessmentFor). 저장하기 전에 그 수를 알린다.
  // 초안(모집요강, 위원 의견)을 저장할 때도 같은 일이 생기므로 같이 알린다. 배점만 바꾸면 지문이 같아 알릴 것이 없다.
  const reuploadCount =
    editing && rubricFingerprint(nextElements) !== rubricFingerprint(saved.elements)
      ? uploaded.filter((item) => assessmentFor(item.result, saved.elements) !== null).length
      : 0;

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
    setEdits({ base, weights: { ...currentEdits?.weights, [id]: next }, groups: currentEdits?.groups ?? {} });
    const reachedBound = delta < 0 ? next === MIN_WEIGHT : next === MAX_WEIGHT;
    if (hadFocus && reachedBound) focusControlRef.current = stepButtonId(index, delta < 0 ? "increase" : "decrease");
  }

  /**
   * 배점 막대를 움직여 배점을 value 로 정한다(정수로 맞추고 0~100 으로 자른다). 초점은 막대에 그대로 있다
   * (막대로 0·100 에 닿아 −·+ 가 눌리지 않게 되어도 초점이 있는 곳은 막대라 옮길 것이 없다).
   */
  function setWeight(id: string, value: number) {
    if (!editing || !Number.isFinite(value)) return;
    if (!elements.some((item) => item.id === id)) return;
    const next = Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, Math.round(value)));
    setEdits({ base, weights: { ...currentEdits?.weights, [id]: next }, groups: currentEdits?.groups ?? {} });
  }

  /**
   * 고른 요소의 세부 평가 항목을 change 로 바꾼다. 바뀐 것이 없으면(보기 상태, 한도에 걸림, 없는 key, 같은 값) 아무것도 하지 않고
   * false 를 돌려준다. 고친 값은 요소 id 로 두므로 요소를 바꿔 골라도 남는다.
   */
  function changeRubric(change: (draft: readonly DraftGroup[]) => readonly DraftGroup[]): boolean {
    if (!editing) return false;
    const current = draftOf(selected);
    const next = change(current);
    if (next === current) return false;
    setEdits({ base, weights: currentEdits?.weights ?? {}, groups: { ...currentEdits?.groups, [selected.id]: next } });
    return true;
  }

  /** 새로 더하는 묶음·질문의 key ("n1", "n2" …. 저장된 것의 key "g0"·"g0q1" 과 겹치지 않는다) */
  function newKey(): string {
    newKeySerialRef.current += 1;
    return `n${newKeySerialRef.current}`;
  }

  /** 그 묶음의 맨 뒤에 빈 질문을 더하고 새 입력란으로 초점을 옮긴다(바로 적을 수 있게. 마우스로 눌렀어도 옮긴다). */
  function addQuestion(groupKey: string) {
    const questionKey = newKey();
    if (changeRubric((draft) => withQuestionAdded(draft, groupKey, questionKey))) {
      focusControlRef.current = rubricControlId(questionKey, "text");
    }
  }

  /**
   * 질문을 뺀다. hadFocus 는 누른 삭제 버튼에 초점이 있었는지: 그 버튼은 줄과 함께 사라지므로, 있었으면 그 자리에 온 질문(다음 질문,
   * 마지막 줄이었으면 앞 질문)의 삭제 버튼으로 초점을 옮긴다. 질문이 하나만 남으면 그 삭제 버튼은 꺼지므로 그 묶음의 질문 추가 버튼으로 간다.
   */
  function removeQuestion(groupKey: string, questionKey: string, hadFocus: boolean) {
    const group = draftOf(selected).find((item) => item.key === groupKey);
    if (group === undefined) return;
    const index = group.questions.findIndex((question) => question.key === questionKey);
    if (!changeRubric((draft) => withQuestionRemoved(draft, groupKey, questionKey))) return;
    if (!hadFocus) return;
    const neighbor = group.questions[index + 1] ?? group.questions[index - 1];
    focusControlRef.current =
      group.questions.length <= 2 || neighbor === undefined
        ? rubricControlId(groupKey, "add")
        : rubricControlId(neighbor.key, "delete");
  }

  /** 맨 뒤에 새 묶음(빈 질문 하나)을 더하고 그 이름 입력란으로 초점을 옮긴다. */
  function addGroup() {
    const groupKey = newKey();
    const questionKey = newKey();
    if (changeRubric((draft) => withGroupAdded(draft, groupKey, questionKey))) {
      focusControlRef.current = rubricControlId(groupKey, "name");
    }
  }

  /**
   * 묶음을 그 질문과 함께 뺀다. hadFocus 가 참이면 그 자리에 온 묶음(다음 묶음, 마지막이었으면 앞 묶음)의 삭제 버튼으로 초점을 옮기고,
   * 묶음이 하나만 남으면 그 삭제 버튼은 꺼지므로 묶음 추가 버튼으로 간다.
   */
  function removeGroup(groupKey: string, hadFocus: boolean) {
    const current = draftOf(selected);
    const index = current.findIndex((group) => group.key === groupKey);
    if (!changeRubric((draft) => withGroupRemoved(draft, groupKey))) return;
    if (!hadFocus) return;
    const neighbor = current[index + 1] ?? current[index - 1];
    focusControlRef.current =
      current.length <= 2 || neighbor === undefined ? ADD_GROUP_BUTTON_ID : rubricControlId(neighbor.key, "delete");
  }

  /**
   * 저장: 평가 기준을 저장하고 기록을 한 건 남긴 뒤 보기 상태로 돌아간다. 저장했으면 true.
   * - 초안: 초안(고친 배점·세부 평가 항목 포함)이 저장한 평가 기준이 되고(모집요강 초안이면 파일 이름·변경 사항을 붙인다) 초안은 사라진다.
   *   기록은 모집요강 초안이면 "모집요강으로 평가 기준을 새로 만듦: …", 위원 의견 초안이면 "위원 의견으로 공통 기준을 만듦: …" 한 건이다
   *   (초안을 손으로 고친 것은 따로 적지 않는다). 저장소에 쓰지 못해도 메모리의 평가 기준이 되고 초안은 사라진다(lib/prep/storage.ts).
   * - 저장한 값: 바뀐 요소만 적은 기록 한 건("배점 변경: …", "세부 평가 항목 변경: …", 둘 다 바꿨으면 " / " 로 이은 것).
   *   모집요강에서 온 값(guideline)은 그대로 남는다.
   */
  function save(): boolean {
    if (!canSave) return false;
    if (prepDraft !== null) {
      const next: PrepCriteria = { ...prepDraft.criteria, elements: nextElements };
      const summary =
        prepDraft.source === "guideline"
          ? guidelineSaveSummary(prepDraft.fileName, nextElements)
          : consensusSaveSummary(prepDraft.memberCount, nextElements);
      if (savePrepDraft(prepDraft, next, createHistoryEntry(REVIEWER_LABEL, summary, new Date())) === null) return false;
      setSavedNote(prepDraft.source === "guideline" ? NOTE_SAVED_DRAFT : NOTE_SAVED_CONSENSUS);
    } else {
      const next: PrepCriteria = { ...saved, elements: nextElements };
      const rubricChanges = pending.flatMap((item) =>
        item.rubricChanged && item.draft !== undefined
          ? [{ name: item.element.name, stats: rubricEditStats(item.element.groups, item.draft) }]
          : [],
      );
      const summary = joinSaveSummary([weightChangeSummary(saved, next), rubricChangeSummary(rubricChanges)]);
      if (summary === null) return false;
      savePrepCriteria(next, createHistoryEntry(REVIEWER_LABEL, summary, new Date()));
      setSavedNote(weightsChanged ? (rubricChanged ? NOTE_SAVED_BOTH : NOTE_SAVED_WEIGHTS) : NOTE_SAVED_RUBRIC);
    }
    setEdits(null);
    setEditingSaved(false);
    return true;
  }

  /**
   * 수정하기·저장하기 왼쪽의 안내. 저장소에 쓰지 못해 메모리에만 둔 값이 있으면(storageNotice 가 보이는 동안) 저장했다고 적지 않는다.
   */
  const viewNote = savedNote !== null && !hasUnsaved ? savedNote : NOTE_VIEWING;
  /**
   * 수정 상태의 안내는 한 줄만 보여 준다(글자를 적는 동안 줄이 늘어 아래 상자가 밀리지 않게). 먼저인 것부터:
   * 세부 평가 항목에 빈 칸이 있음(저장할 수 없다) → 저장하면 평가 대기 목록에서 빠지는 올린 학생부가 있음 → 수정 상태 문구.
   */
  const editNote: { text: string; tone: "plain" | "warning" | "error" } =
    blankNames.length > 0
      ? { text: blankNoticeText(blankNames), tone: "error" }
      : reuploadCount > 0
        ? { text: reuploadNoticeText(reuploadCount), tone: "warning" }
        : { text: NOTE_EDITING, tone: "plain" };
  const modeNote = editing ? editNote.text : viewNote;

  return {
    ready,
    bodyRef,
    department: base.department,
    draftNotice: prepDraft === null ? null : draftNoticeText(prepDraft),
    modeNote,
    /** 안내 한 줄의 색: 보통(회색), 알림(갈색: 저장하면 다시 올려야 하는 학생부가 있음), 막힘(빨강: 빈 칸이 있어 저장할 수 없음) */
    modeNoteTone: editing ? editNote.tone : ("plain" as const),
    elements: elements.map((element, index) => {
      const weight = weightOf(element);
      const draft = currentEdits?.groups[element.id];
      return {
        id: element.id,
        decreaseButtonId: stepButtonId(index, "decrease"),
        increaseButtonId: stepButtonId(index, "increase"),
        name: element.name,
        // 태그를 고치는 중이면 고친 태그로 그린다(비어 있는 태그는 빼고).
        tagsLine: draft === undefined ? tagsLine(element) : draftTagsLine(draft),
        weight,
        canDecrease: editing && weight > MIN_WEIGHT,
        canIncrease: editing && weight < MAX_WEIGHT,
      };
    }),
    selectedIndex,
    detail: {
      name: selected.name,
      groups: numberedGroups(selected),
      /** 수정 상태에서 고른 요소의 세부 평가 항목을 고치는 입력란·버튼 (보기 상태에서는 null 이고 groups 를 글로 그린다) */
      editor: editing ? rubricEditorView(draftOf(selected)) : null,
    },
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
    /** 세부 평가 항목 고치기 (고른 요소의 것. 보기 상태에서는 아무것도 하지 않는다) */
    onGroupNameChange: (groupKey: string, value: string) => {
      changeRubric((draft) => withGroupName(draft, groupKey, value));
    },
    onGroupTagChange: (groupKey: string, value: string) => {
      changeRubric((draft) => withGroupTag(draft, groupKey, value));
    },
    onQuestionChange: (groupKey: string, questionKey: string, value: string) => {
      changeRubric((draft) => withQuestionText(draft, groupKey, questionKey, value));
    },
    onAddQuestion: addQuestion,
    /** hadFocus 는 누른 삭제 버튼에 초점이 있었는지 (있었으면 그 자리에 온 줄의 삭제 버튼이나 추가 버튼으로 초점을 옮긴다) */
    onRemoveQuestion: removeQuestion,
    onAddGroup: addGroup,
    onRemoveGroup: removeGroup,
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
