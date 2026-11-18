import { useLayoutEffect, useRef, useState } from "react";
import { RequestCanceledError } from "@/lib/apiClient";
import { MAX_CRITERIA } from "@/lib/criteria/limits";
import { normalizeCriteria } from "@/lib/criteria/normalize";
import { requestCriteria } from "@/lib/criteriaClient";
import { createDepartmentId } from "@/lib/criteriaStorage";
import type { DepartmentCriteria } from "@/types/analysis";

const NO_DEPARTMENT_ERROR = "학과 이름을 입력해 주세요.";
const NO_SOURCE_TEXT_ERROR = "학과가 보고 싶은 점을 문장으로 입력해 주세요.";
const NO_ACCESS_CODE_ERROR = '아래 "접속 코드" 입력란에 접속 코드를 입력해 주세요.';
const GENERATE_ERROR = "기준을 만들지 못했습니다. 다시 시도해 주세요.";
const DUPLICATE_DEPARTMENT_ERROR = "같은 이름의 학과가 이미 있습니다. 다른 학과 이름을 입력해 주세요.";
const NO_CRITERIA_ERROR = "기준이 없습니다. 기준을 1개 이상 추가해 주세요.";
const EMPTY_CRITERION_ERROR = "이름이나 설명이 비어 있는 기준이 있습니다. 채우거나 그 기준을 삭제해 주세요.";

/** 초안의 기준 하나 (화면에서 고치는 값). key 는 목록을 그릴 때 쓰는 값으로, 고쳐도 바뀌지 않는다. */
export type DraftCriterion = {
  key: string;
  name: string;
  description: string;
};

type Draft = {
  items: DraftCriterion[];
  /** 기준 생성 응답의 경고 (받은 문장 그대로) */
  warnings: string[];
  /** 이 초안을 만들 때 AI 에 보낸 문장 (확정하면 sourceText 로 저장한다) */
  sourceText: string;
};

let draftKeyCount = 0;

function createDraftKey(): string {
  draftKeyCount += 1;
  return `d${draftKeyCount}`;
}

/**
 * "새 학과 기준 만들기" 상태: 학과 이름·문장 입력, 기준 생성 요청(POST /api/criteria), 초안 고치기, 확정.
 * 초안은 확정하기 전에는 분석에 쓰이지 않는다(확정한 값만 저장하고, 분석은 저장한 학과로만 한다).
 * 학과 선택과 상관없이 값을 유지하므로, 다른 학과를 골랐다가 돌아와도 입력한 값과 초안이 그대로 있다.
 */
export function useCriteriaDraft() {
  const [departmentName, setDepartmentName] = useState("");
  const [sourceText, setSourceText] = useState("");
  /** 기준 만들기가 한 번이라도 성공한 뒤의 초안. 그 전에는 null. */
  const [draft, setDraft] = useState<Draft | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  /** 기준 만들기의 안내·오류 문구 (입력이 비었음, 서버 문구 등) */
  const [generateError, setGenerateError] = useState<string | null>(null);
  /** 확정할 수 없는 이유 */
  const [confirmError, setConfirmError] = useState<string | null>(null);
  /** 진행 중인 기준 생성 요청을 취소하는 컨트롤러. 진행 중인 요청이 없으면 null. */
  const requestRef = useRef<AbortController | null>(null);
  /** 요청 세대 번호. 새 요청을 시작할 때와 화면이 숨겨지거나 언마운트될 때 늘린다. 다르면 늦게 온 응답을 버린다. */
  const generationRef = useRef(0);

  // 업로드 화면이 숨겨지거나 언마운트될 때(hooks/useUpload.ts 와 같은 규칙) 진행 중인 기준 생성 요청을 취소하고
  // 세대 번호를 올려 늦게 온 응답이 아무것도 바꾸지 못하게 한 뒤, 입력값·초안·오류 문구를 처음으로 되돌린다.
  useLayoutEffect(() => {
    return () => {
      generationRef.current += 1;
      requestRef.current?.abort();
      requestRef.current = null;
      setDepartmentName("");
      setSourceText("");
      setDraft(null);
      setIsGenerating(false);
      setGenerateError(null);
      setConfirmError(null);
    };
  }, []);

  /** 기준 만들기. 학과 이름·문장·접속 코드가 비어 있으면 요청하지 않고 안내한다. */
  async function generate(accessCode: string) {
    if (isGenerating) return;
    const department = departmentName.trim();
    const text = sourceText.trim();
    if (department === "") {
      setGenerateError(NO_DEPARTMENT_ERROR);
      return;
    }
    if (text === "") {
      setGenerateError(NO_SOURCE_TEXT_ERROR);
      return;
    }
    if (accessCode.trim() === "") {
      setGenerateError(NO_ACCESS_CODE_ERROR);
      return;
    }

    requestRef.current?.abort();
    generationRef.current += 1;
    const generation = generationRef.current;
    const controller = new AbortController();
    requestRef.current = controller;
    const isCurrent = () => !controller.signal.aborted && generationRef.current === generation;

    setIsGenerating(true);
    setGenerateError(null);

    let result: Awaited<ReturnType<typeof requestCriteria>>;
    try {
      // 앞뒤 공백을 뺀 문장을 보낸다. 확정하면 이 문장을 그대로 sourceText 로 저장한다.
      result = await requestCriteria({ department, sourceText: text, accessCode }, controller.signal);
    } catch (error) {
      // 취소된 요청이나 더 이상 유효하지 않은 요청은 아무것도 바꾸지 않는다.
      if (error instanceof RequestCanceledError || !isCurrent()) return;
      requestRef.current = null;
      setGenerateError(error instanceof Error ? error.message : GENERATE_ERROR);
      setIsGenerating(false);
      return;
    }
    if (!isCurrent()) return;
    requestRef.current = null;

    // 이미 초안이 있었다면 새 결과로 바꾼다.
    setDraft({
      items: result.criteria.map(({ name, description }) => ({ key: createDraftKey(), name, description })),
      warnings: result.warnings,
      sourceText: text,
    });
    setConfirmError(null);
    setIsGenerating(false);
  }

  function updateItems(update: (items: DraftCriterion[]) => DraftCriterion[]) {
    setDraft((current) => (current === null ? current : { ...current, items: update(current.items) }));
    setConfirmError(null);
  }

  function changeItemName(key: string, name: string) {
    updateItems((items) => items.map((item) => (item.key === key ? { ...item, name } : item)));
  }

  function changeItemDescription(key: string, description: string) {
    updateItems((items) => items.map((item) => (item.key === key ? { ...item, description } : item)));
  }

  function removeItem(key: string) {
    updateItems((items) => items.filter((item) => item.key !== key));
  }

  /** 빈 기준 하나를 끝에 더한다. 6개면 더하지 않는다(화면이 이유를 보여 준다). */
  function addItem() {
    updateItems((items) =>
      items.length >= MAX_CRITERIA ? items : [...items, { key: createDraftKey(), name: "", description: "" }],
    );
  }

  /** 학과 이름을 고친다. 확정을 막은 이유 문구는 지운다(다음 확정 때 다시 판단한다). */
  function changeDepartmentName(value: string) {
    setDepartmentName(value);
    setConfirmError(null);
  }

  /**
   * 초안을 확정할 학과 기준으로 만든다. 확정할 수 없으면(학과 이름 없음, 기준 0개, 이름·설명이 빈 기준) 이유를 문구로 세우고
   * null 을 돌려준다. 입력값과 초안은 그대로 둔다(저장이 끝나면 호출한 쪽이 clear 를 부른다).
   * 새 DepartmentCriteria: 새 id, 학과 이름은 입력란 값의 앞뒤 공백 제거, sourceText 는 이 초안을 만들 때 보낸 문장,
   * 기준은 normalizeCriteria 로 정리. 같은 이름 확인은 저장하는 쪽(lib/criteriaStorage.ts)이 그 순간의 목록으로 한다.
   */
  function buildConfirmed(): DepartmentCriteria | null {
    if (draft === null) return null;
    const department = departmentName.trim();
    if (department === "") {
      setConfirmError(NO_DEPARTMENT_ERROR);
      return null;
    }
    if (draft.items.length === 0) {
      setConfirmError(NO_CRITERIA_ERROR);
      return null;
    }
    if (draft.items.some((item) => item.name.trim() === "" || item.description.trim() === "")) {
      setConfirmError(EMPTY_CRITERION_ERROR);
      return null;
    }
    const criteria = normalizeCriteria(draft.items);
    if (criteria.length === 0) {
      setConfirmError(NO_CRITERIA_ERROR);
      return null;
    }
    return { id: createDepartmentId(), department, sourceText: draft.sourceText, criteria };
  }

  /** 같은 이름의 학과가 있어 저장하지 못했을 때: 초안과 입력값은 그대로 두고 안내한다. */
  function rejectDuplicateName() {
    setConfirmError(DUPLICATE_DEPARTMENT_ERROR);
  }

  /** 확정한 뒤 입력란과 초안을 비운다. */
  function clear() {
    setDepartmentName("");
    setSourceText("");
    setDraft(null);
    setGenerateError(null);
    setConfirmError(null);
  }

  return {
    departmentName,
    sourceText,
    isGenerating,
    generateError,
    draft:
      draft === null
        ? null
        : {
            items: draft.items,
            warnings: draft.warnings,
            canAddItem: draft.items.length < MAX_CRITERIA,
          },
    confirmError,
    changeDepartmentName,
    changeSourceText: setSourceText,
    generate,
    changeItemName,
    changeItemDescription,
    removeItem,
    addItem,
    buildConfirmed,
    rejectDuplicateName,
    clear,
  };
}
