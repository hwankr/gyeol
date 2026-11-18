import { useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCriteriaDraft } from "@/hooks/useCriteriaDraft";
import { useSavedDepartments } from "@/hooks/useSavedDepartments";
import { RequestCanceledError } from "@/lib/apiClient";
import { requestAnalysis, type AnalysisCriteria } from "@/lib/analyzeClient";
import { DEPARTMENT_CRITERIA_LIST, findDepartmentCriteria } from "@/lib/criteria";
import { addSavedDepartment, loadSavedDepartments, removeSavedDepartment } from "@/lib/criteriaStorage";
import { sampleResult } from "@/lib/mock/sampleResult";
import { PDF_TOO_LARGE_ERROR, isPdfFile, isPdfTooLarge } from "@/lib/pdf";
import { saveResult } from "@/lib/resultStorage";
import type { AnalysisResult } from "@/types/analysis";

const NOT_PDF_ERROR = "PDF 파일만 선택할 수 있습니다.";
const NO_ACCESS_CODE_ERROR = "접속 코드를 입력해 주세요.";
const SAVE_ERROR = "분석 결과를 브라우저에 저장하지 못했습니다. 다시 시도해 주세요.";
const ANALYZE_ERROR = "분석에 실패했습니다. 다시 시도해 주세요.";
const NOT_CONFIRMED_REASON = "기준을 확정한 뒤 분석을 시작할 수 있습니다.";
const STORAGE_SAVE_FAILED = "브라우저에 저장하지 못했습니다. 이 학과 기준은 새로고침하면 사라집니다.";
const STORAGE_DELETE_FAILED = "브라우저 저장소에서 지우지 못했습니다. 새로고침하면 이 학과가 다시 나타날 수 있습니다.";
const SELECTED_DEPARTMENT_GONE = "선택한 학과 기준이 삭제되어 찾을 수 없습니다. 학과를 다시 선택해 주세요.";

/** 학과 선택의 기본값: 코드에 적힌 학과 목록의 첫 번째 학과 */
const DEFAULT_CRITERIA_ID = DEPARTMENT_CRITERIA_LIST[0]?.id ?? "";

/**
 * 학과 선택 목록에서 "새 학과 기준 만들기"의 값. 빈 문자열이라서 학과 id(코드에 적힌 id, 저장한 학과의 id 는
 * 앞뒤 공백을 뺀 길이가 1 이상)와 겹치지 않는다.
 */
const NEW_DEPARTMENT_VALUE = "";
const NEW_DEPARTMENT_LABEL = "새 학과 기준 만들기";

/**
 * 업로드 화면 상태: 학과 선택(코드에 적힌 학과 → 저장한 학과 → 새 학과 기준 만들기), 저장한 학과 삭제,
 * 새 학과 기준 만들기(useCriteriaDraft), 파일 선택, 접속 코드, 분석 요청, 결과 저장 후 결과 화면으로 이동.
 */
export function useUpload() {
  const router = useRouter();
  const savedDepartments = useSavedDepartments();
  const criteriaDraft = useCriteriaDraft();
  const [selectedId, setSelectedId] = useState(DEFAULT_CRITERIA_ID);
  /** 저장한 학과를 브라우저에 저장(또는 삭제)하지 못했을 때의 안내 문구 */
  const [storageNotice, setStorageNotice] = useState<string | null>(null);
  /** 접속 코드. 이 상태에만 두고 sessionStorage·localStorage 에는 저장하지 않는다. */
  const [accessCode, setAccessCode] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  /** 파일 입력(<input type="file">)을 비우려고 바꾸는 key. 바뀌면 입력이 새로 만들어진다. */
  const [fileInputKey, setFileInputKey] = useState(0);
  /** 진행 중인 분석 요청을 취소하는 컨트롤러. 진행 중인 요청이 없으면 null. */
  const requestRef = useRef<AbortController | null>(null);
  /**
   * 요청 세대 번호. 새 분석을 시작할 때와 이 화면이 숨겨지거나 언마운트될 때 늘린다.
   * 응답이 왔을 때 시작할 때의 번호와 다르면 그 응답은 버린다(저장·이동·상태 변경을 하지 않는다).
   */
  const generationRef = useRef(0);

  // 이 화면의 수명 관리.
  // cacheComponents 에서는 다른 화면으로 이동해도 이 화면이 사라지지 않고 숨겨지며(Activity) 상태와 DOM 이 보존된다.
  // 숨겨지거나 언마운트될 때는 이유·시점과 상관없이(분석 성공 뒤 이동, 분석 도중 뒤로 가기 등) cleanup 에서
  //   1) 진행 중인 분석 요청을 취소하고 세대 번호를 올려, 늦게 오는 응답이 아무것도 바꾸지 못하게 하고
  //   2) 화면 상태를 처음으로 되돌린다. 그래서 다시 보이는 업로드 화면은 항상 초기 상태다.
  // 진행 중인 기준 생성 요청과 새 학과 기준 입력값·초안은 useCriteriaDraft 의 같은 cleanup 이 처리한다.
  // 저장한 학과 목록은 저장소(localStorage)의 것이므로 되돌리지 않는다.
  // 설치 문서 node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md 의 useLayoutEffect cleanup 방식이다.
  // 페이지가 매번 새로 마운트되는 경우(언마운트)에도 같은 cleanup 이 실행된다. 개발 모드 StrictMode 가 마운트 직후
  // effect 를 한 번 더 실행할 때도 이 cleanup 이 돌지만, 그때는 진행 중인 요청이 없고 상태도 이미 초기값이라 영향이 없다.
  useLayoutEffect(() => {
    return () => {
      generationRef.current += 1;
      requestRef.current?.abort();
      requestRef.current = null;
      setSelectedId(DEFAULT_CRITERIA_ID);
      setStorageNotice(null);
      setAccessCode("");
      setFileName(null);
      setFile(null);
      setFileError(null);
      setRequestError(null);
      setIsAnalyzing(false);
      setFileInputKey((key) => key + 1);
    };
  }, []);

  const isNewDepartment = selectedId === NEW_DEPARTMENT_VALUE;
  const selectedBuiltIn = isNewDepartment ? undefined : findDepartmentCriteria(selectedId);
  const selectedSaved = isNewDepartment
    ? undefined
    : savedDepartments.find((department) => department.id === selectedId);
  // 선택한 저장 학과가 목록에서 사라졌으면(저장소 값이 바뀌는 등) 기본 학과를 고른 것으로 본다.
  const builtInFallback =
    !isNewDepartment && selectedBuiltIn === undefined && selectedSaved === undefined
      ? findDepartmentCriteria(DEFAULT_CRITERIA_ID)
      : undefined;
  const currentBuiltIn = selectedBuiltIn ?? builtInFallback;
  const currentCriteria = currentBuiltIn ?? selectedSaved;
  const effectiveSelectedId = isNewDepartment ? NEW_DEPARTMENT_VALUE : (currentCriteria?.id ?? DEFAULT_CRITERIA_ID);

  /** 분석에 보낼 학과 기준. 코드에 적힌 학과는 id, 저장한 학과는 기준 묶음. 새 학과 기준 만들기(확정 전)는 null. */
  const analysisCriteria: AnalysisCriteria | null =
    currentBuiltIn !== undefined
      ? { criteriaId: currentBuiltIn.id }
      : selectedSaved !== undefined
        ? { criteria: selectedSaved }
        : null;

  /** 선택한 학과가 삭제되어 분석하지 못했다는 안내만 지운다(학과 선택이 바뀌면 더는 맞지 않는다). 다른 오류 문구는 그대로 둔다. */
  function clearDepartmentGoneError() {
    setRequestError((current) => (current === SELECTED_DEPARTMENT_GONE ? null : current));
  }

  function selectDepartment(id: string) {
    setSelectedId(id);
    setStorageNotice(null);
    clearDepartmentGoneError();
  }

  function deleteSelectedDepartment() {
    if (selectedSaved === undefined || isAnalyzing) return;
    const removed = removeSavedDepartment(selectedSaved.id);
    // 확인 창 없이 바로 지우고 선택은 기본 학과로 돌아간다.
    setSelectedId(DEFAULT_CRITERIA_ID);
    setStorageNotice(removed ? null : STORAGE_DELETE_FAILED);
    clearDepartmentGoneError();
  }

  function startCriteriaGeneration() {
    if (isAnalyzing) return;
    void criteriaDraft.generate(accessCode);
  }

  /**
   * 초안을 확정해 저장하고 그 학과를 고른다.
   * - 같은 이름 확인은 저장소 모듈이 이 순간 다시 읽은 목록으로 한다. 같은 이름이 있으면 저장하지 않고 초안·입력값을 그대로 둔 채 안내한다.
   * - 저장소를 읽거나 쓰지 못해도 이 화면에서는 그대로 쓸 수 있다(목록에 나타나 선택되고, 저장 실패 안내를 보여 준다).
   */
  function confirmDraft() {
    if (isAnalyzing || criteriaDraft.isGenerating) return;
    const confirmed = criteriaDraft.buildConfirmed();
    if (confirmed === null) return;
    const result = addSavedDepartment(confirmed);
    if (result === "duplicateName") {
      criteriaDraft.rejectDuplicateName();
      return;
    }
    criteriaDraft.clear();
    setSelectedId(confirmed.id);
    setStorageNotice(result === "saved" ? null : STORAGE_SAVE_FAILED);
    clearDepartmentGoneError();
  }

  function selectFile(selected: File | null) {
    setRequestError(null);
    setFileName(selected?.name ?? null);
    if (selected === null) {
      setFile(null);
      setFileError(null);
      return;
    }
    // 파일 선택 창의 필터(accept)를 우회해 고른 파일도 여기서 걸러낸다.
    if (!isPdfFile(selected)) {
      setFile(null);
      setFileError(NOT_PDF_ERROR);
      return;
    }
    if (isPdfTooLarge(selected)) {
      setFile(null);
      setFileError(PDF_TOO_LARGE_ERROR);
      return;
    }
    setFile(selected);
    setFileError(null);
  }

  function openResult(result: AnalysisResult): boolean {
    try {
      saveResult(result);
    } catch {
      setRequestError(SAVE_ERROR);
      return false;
    }
    router.push("/result");
    return true;
  }

  async function startAnalysis() {
    // 확정하지 않은 기준(새 학과 기준 만들기)으로는 분석하지 않는다. 초안은 /api/analyze 로 보내지 않는다.
    if (file === null || isAnalyzing || analysisCriteria === null) return;
    // 접속 코드가 비어 있으면 요청을 보내지 않고 안내한다(버튼은 막지 않는다).
    if (accessCode.trim() === "") {
      setRequestError(NO_ACCESS_CODE_ERROR);
      return;
    }

    // 저장한 학과를 골랐으면 화면에 마지막으로 그려진 값이 아니라 이 순간 다시 읽은 목록에서 찾는다
    // (다른 탭에서 지웠는데 이 탭이 아직 다시 그려지지 않은 경우). 없으면 요청하지 않고 기본 학과로 돌린 뒤 안내한다.
    // 파일과 접속 코드 입력값은 그대로 둔다.
    let criteriaToSend = analysisCriteria;
    if (selectedSaved !== undefined) {
      const latest = loadSavedDepartments().find((department) => department.id === selectedSaved.id);
      if (latest === undefined) {
        setSelectedId(DEFAULT_CRITERIA_ID);
        setRequestError(SELECTED_DEPARTMENT_GONE);
        return;
      }
      criteriaToSend = { criteria: latest };
    }

    // 남아 있는 요청이 있으면 취소하고(정상 흐름에서는 없음) 새 세대로 시작한다.
    requestRef.current?.abort();
    generationRef.current += 1;
    const generation = generationRef.current;
    const controller = new AbortController();
    requestRef.current = controller;
    /** 이 요청이 아직 유효한지: 취소되지 않았고, 그 뒤로 새 요청이나 화면 숨김이 없었는지 */
    const isCurrent = () => !controller.signal.aborted && generationRef.current === generation;

    setIsAnalyzing(true);
    setRequestError(null);

    let result: AnalysisResult;
    try {
      result = await requestAnalysis({ ...criteriaToSend, file, accessCode }, controller.signal);
    } catch (error) {
      // 취소된 요청이나 더 이상 유효하지 않은 요청은 아무것도 바꾸지 않는다(오류 문구도 세우지 않음).
      if (error instanceof RequestCanceledError || !isCurrent()) return;
      requestRef.current = null;
      setRequestError(error instanceof Error ? error.message : ANALYZE_ERROR);
      setIsAnalyzing(false);
      return;
    }

    // 응답이 왔지만 그사이 화면이 숨겨졌거나 새 요청이 시작됐으면 저장·이동하지 않는다.
    if (!isCurrent()) return;
    requestRef.current = null;
    // 이동하는 동안에는 "분석 중…" 상태를 유지한다(요청이 한 번 더 나가지 않게).
    // 되돌리는 것은 이 화면이 숨겨질 때의 cleanup 이 한다.
    if (!openResult(result)) setIsAnalyzing(false);
  }

  /** 샘플 데이터는 미리 만든 결과(lib/mock/sample-result.json)를 그대로 연다. 학과 선택·초안·접속 코드와 상관없고 API 를 부르지 않는다. */
  function viewSample() {
    if (isAnalyzing) return;
    setRequestError(null);
    openResult(sampleResult);
  }

  const draft = criteriaDraft.draft;

  return {
    departments: [
      ...DEPARTMENT_CRITERIA_LIST.map(({ id, department }) => ({ id, department })),
      ...savedDepartments.map(({ id, department }) => ({ id, department })),
      { id: NEW_DEPARTMENT_VALUE, department: NEW_DEPARTMENT_LABEL },
    ],
    criteriaId: effectiveSelectedId,
    isNewDepartment,
    criteriaItems: currentCriteria?.criteria ?? [],
    canDeleteDepartment: selectedSaved !== undefined,
    storageNotice,
    newDepartment: {
      departmentName: criteriaDraft.departmentName,
      sourceText: criteriaDraft.sourceText,
      isGenerating: criteriaDraft.isGenerating,
      generateError: criteriaDraft.generateError,
      draft,
      confirmError: criteriaDraft.confirmError,
      onChangeDepartmentName: criteriaDraft.changeDepartmentName,
      onChangeSourceText: criteriaDraft.changeSourceText,
      onGenerate: startCriteriaGeneration,
      onChangeItemName: criteriaDraft.changeItemName,
      onChangeItemDescription: criteriaDraft.changeItemDescription,
      onRemoveItem: criteriaDraft.removeItem,
      onAddItem: criteriaDraft.addItem,
      onConfirm: confirmDraft,
    },
    accessCode,
    fileName,
    fileError,
    requestError,
    isAnalyzing,
    fileInputKey,
    canStart: file !== null && !isAnalyzing && analysisCriteria !== null,
    startBlockedReason: isNewDepartment ? NOT_CONFIRMED_REASON : null,
    onSelectCriteria: selectDepartment,
    onDeleteDepartment: deleteSelectedDepartment,
    onChangeAccessCode: setAccessCode,
    onSelectFile: selectFile,
    onStart: startAnalysis,
    onViewSample: viewSample,
  };
}
