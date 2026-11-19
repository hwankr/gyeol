import { useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { useCriteriaDraft } from "@/hooks/useCriteriaDraft";
import { usePrepTabReady } from "@/hooks/usePrepTabReady";
import { useSavedDepartments } from "@/hooks/useSavedDepartments";
import { RequestCanceledError } from "@/lib/apiClient";
import { requestAnalysis, type AnalysisCriteria } from "@/lib/analyzeClient";
import { addUploadedApplicant } from "@/lib/applicants/uploadedStorage";
import { DEPARTMENT_CRITERIA_LIST, findDepartmentCriteria } from "@/lib/criteria";
import { CRITERIA_EXAMPLES, type CriteriaExample } from "@/lib/criteria/examples";
import { addSavedDepartment, loadSavedDepartments, removeSavedDepartment } from "@/lib/criteriaStorage";
import { sampleResult } from "@/lib/mock/sampleResult";
import { PDF_TOO_LARGE_ERROR, isPdfFile, isPdfTooLarge } from "@/lib/pdf";
import { PREP_CRITERIA_ID, prepAnalysisCriteria, prepDepartmentLabel } from "@/lib/prep/analysisCriteria";
import type { PrepCriteria } from "@/lib/prep/criteria";
import { DEFAULT_PREP_CRITERIA } from "@/lib/prep/defaultCriteria";
import { loadPrepCriteria, subscribePrepStorage } from "@/lib/prep/storage";
import { saveResult } from "@/lib/resultStorage";
import type { AnalysisResult } from "@/types/analysis";

const NOT_PDF_ERROR = "PDF 파일만 선택할 수 있습니다.";
const SAVE_ERROR = "분석 결과를 브라우저에 저장하지 못했습니다. 다시 시도해 주세요.";
const ANALYZE_ERROR = "분석에 실패했습니다. 다시 시도해 주세요.";
const NOT_CONFIRMED_REASON = "기준을 확정한 뒤 분석을 시작할 수 있습니다.";
const STORAGE_SAVE_FAILED = "브라우저에 저장하지 못했습니다. 이 학과 기준은 새로고침하면 사라집니다.";
const STORAGE_DELETE_FAILED = "브라우저 저장소에서 지우지 못했습니다. 새로고침하면 이 학과가 다시 나타날 수 있습니다.";
const SELECTED_DEPARTMENT_GONE = "선택한 학과 기준이 삭제되어 찾을 수 없습니다. 학과를 다시 선택해 주세요.";

/**
 * 코드에 적힌 학과 목록의 첫 번째 학과(경영학과). 저장한 학과를 지웠을 때, 고른 저장 학과가 목록에서 사라졌거나 다른 탭에서 지워져
 * 분석하지 못했을 때 이 학과로 돌아간다(전형 준비 항목을 더하기 전과 같다).
 */
const DEFAULT_CRITERIA_ID = DEPARTMENT_CRITERIA_LIST[0]?.id ?? "";

/** 처음 선택(결과 화면 등에 다녀온 뒤의 처음 상태도): 전형 준비 항목 */
const INITIAL_SELECTED_ID = PREP_CRITERIA_ID;

// 전형 준비의 저장한 평가 기준. 서버 렌더링과 hydration 중에는 기본 평가 기준으로 그린다(서버 HTML 과 첫 클라이언트 렌더링이 같아
// hydration 경고가 없다). 브라우저에서 저장소를 읽은 뒤 저장한 값으로 바뀐다(hooks/useSavedDepartments.ts 와 같은 방식).
// 읽기는 lib/prep/storage.ts 의 loadPrepCriteria(메모리에만 둔 값 → 저장소의 값 → 기본값)이고, 모집요강 초안(저장하기 전)은 쓰지 않는다.
function getServerPrepCriteria(): PrepCriteria {
  return DEFAULT_PREP_CRITERIA;
}

/**
 * 분석 응답을 기다리는 중이면 그 분석을 취소한다(화면이 숨겨질 때의 취소와 같은 효과: 세대를 올리고 요청을 중단해 늦게 온 응답이
 * 아무것도 하지 않게 한다. sessionStorage 저장·올린 지원자 남기기·결과 화면 이동·오류 문구 없음). "분석 중…" 표시는 바로 푼다.
 * 고른 파일·학과 선택 같은 다른 상태는 건드리지 않는다(이동이 끝나 화면이 숨겨질 때의 정리가 처음 상태로 되돌린다. 이동이 끝내
 * 일어나지 않으면 분석 시작을 다시 누를 수 있는 상태로 남는다). 기다리는 중이 아니면(응답을 이미 받아 결과 화면으로 가는 중 포함)
 * 아무것도 하지 않는다.
 */
function cancelWaitingAnalysis(
  requestRef: RefObject<AbortController | null>,
  generationRef: RefObject<number>,
  setIsAnalyzing: (value: boolean) => void,
) {
  const controller = requestRef.current;
  if (controller === null) return;
  generationRef.current += 1;
  requestRef.current = null;
  controller.abort();
  setIsAnalyzing(false);
}

/**
 * 학과 선택 목록에서 "새 학과 기준 만들기"의 값. 빈 문자열이라서 학과 id(코드에 적힌 id, 저장한 학과의 id 는
 * 앞뒤 공백을 뺀 길이가 1 이상)와 겹치지 않는다.
 */
const NEW_DEPARTMENT_VALUE = "";
const NEW_DEPARTMENT_LABEL = "새 학과 기준 만들기";

/**
 * 업로드 화면 상태: 학과 선택(전형 준비 → 코드에 적힌 학과 → 저장한 학과 → 새 학과 기준 만들기), 저장한 학과 삭제,
 * 새 학과 기준 만들기(useCriteriaDraft)와 예시 넣기, 파일 선택, 분석 요청, 결과 저장 후 결과 화면으로 이동(분석 결과는 올린 지원자로도 남긴다).
 */
export function useUpload() {
  const router = useRouter();
  const savedDepartments = useSavedDepartments();
  const prepCriteria = useSyncExternalStore(subscribePrepStorage, loadPrepCriteria, getServerPrepCriteria);
  const criteriaDraft = useCriteriaDraft();
  const [selectedId, setSelectedId] = useState(INITIAL_SELECTED_ID);
  /**
   * 화면이 준비됐는지와 본문 요소에 붙일 ref (준비 전에는 "상단" 영역 아래 본문을 inert 로 둔다: components/UploadScreen.tsx).
   * "준비" = 이 훅이 브라우저에서 실행되고 저장소 값(저장한 학과, 전형 준비의 저장한 평가 기준)이 화면에 반영된 뒤. 전형 준비 탭과 같은 훅이다.
   * - 서버 HTML 과 hydration 중(첫 클라이언트 렌더링)에는 false 다(서버와 같아 hydration 경고가 없다).
   * - 본문이 문서에 붙은 커밋의 layout effect 에서 true 로 바꾼다. 이 갱신은 그리기 전에 동기로 다시 그리고, 그때 useSyncExternalStore 는
   *   서버 값이 아니라 저장소의 값을 읽으므로 저장소 값이 반영된 화면과 준비가 같은 커밋에 함께 나온다.
   * - 다른 화면에 다녀와 다시 보일 때: 숨겨질 때(cleanup) false 로 돌려 두고, 다시 보이는 커밋의 layout effect 에서 true 로 바꾼다.
   *   이 다시 그리기가 저장소를 다시 읽으므로 숨겨진 동안 바뀐 저장소 값(다른 탭이 지운 학과, 전형 준비에서 저장한 기준)도 반영된 뒤에 풀린다.
   */
  const { ready, bodyRef } = usePrepTabReady<HTMLDivElement>();
  /** 저장한 학과를 브라우저에 저장(또는 삭제)하지 못했을 때의 안내 문구 */
  const [storageNotice, setStorageNotice] = useState<string | null>(null);
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
      setSelectedId(INITIAL_SELECTED_ID);
      setStorageNotice(null);
      setFileName(null);
      setFile(null);
      setFileError(null);
      setRequestError(null);
      setIsAnalyzing(false);
      setFileInputKey((key) => key + 1);
    };
  }, []);

  // 분석을 기다리는 동안 같은 탭에서 다른 화면으로 가는 이동이 시작되면 그 순간 분석을 취소한다(위 "숨겨질 때"의 취소보다 앞선다).
  // 이동이 시작된 뒤 목적지 화면이 늦게 도착하는 사이에 응답이 오면, 숨겨질 때의 취소로는 걸러지지 않아 그 응답이 사람의 이동을
  // 결과 화면 이동으로 덮어쓰고 올린 지원자로 남기 때문이다. 업로드 화면에서 그런 이동은 두 가지뿐이다.
  //   1) 상단의 새 링크를 같은 탭에서 누름: 링크의 onNavigate(아래 leaveByLink). next/link 는 같은 탭의 클라이언트 이동에서만 부르고
  //      보조 키·가운데 버튼처럼 새 탭으로 여는 누름에서는 부르지 않으므로, 그때는 원래 탭의 분석이 끝까지 간다.
  //   2) 브라우저의 뒤로·앞으로: popstate. 이 화면이 보이는 동안에만 듣는다(숨겨지면 cleanup 에서 뗀다. 숨겨진 업로드 화면이
  //      다른 화면의 뒤로·앞으로에 반응하지 않게).
  // 주소창·새로고침·탭 닫기처럼 문서 자체가 바뀌는 이동은 문서가 사라지며 요청이 끊긴다(이 규칙의 대상이 아니다).
  useLayoutEffect(() => {
    function onPopState() {
      cancelWaitingAnalysis(requestRef, generationRef, setIsAnalyzing);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  /** 전형 준비 항목이 분석에 보낼 학과 기준 (화면의 기준 목록도 이것으로 그린다) */
  const prepDepartment = useMemo(() => prepAnalysisCriteria(prepCriteria), [prepCriteria]);

  const isNewDepartment = selectedId === NEW_DEPARTMENT_VALUE;
  // 전형 준비 항목은 늘 있다(저장한 값이 없으면 기본 평가 기준). 코드에 적힌 학과·저장한 학과의 id 와 겹치지 않는다.
  const isPrep = selectedId === PREP_CRITERIA_ID;
  const selectedBuiltIn = isNewDepartment || isPrep ? undefined : findDepartmentCriteria(selectedId);
  const selectedSaved =
    isNewDepartment || isPrep ? undefined : savedDepartments.find((department) => department.id === selectedId);
  // 선택한 저장 학과가 목록에서 사라졌으면(저장소 값이 바뀌는 등) 기본 학과를 고른 것으로 본다.
  const builtInFallback =
    !isNewDepartment && !isPrep && selectedBuiltIn === undefined && selectedSaved === undefined
      ? findDepartmentCriteria(DEFAULT_CRITERIA_ID)
      : undefined;
  const currentBuiltIn = selectedBuiltIn ?? builtInFallback;
  const currentCriteria = isPrep ? prepDepartment : (currentBuiltIn ?? selectedSaved);
  const effectiveSelectedId = isNewDepartment ? NEW_DEPARTMENT_VALUE : (currentCriteria?.id ?? DEFAULT_CRITERIA_ID);

  /**
   * 분석에 보낼 학과 기준. 코드에 적힌 학과는 id, 저장한 학과와 전형 준비 항목은 기준 묶음. 새 학과 기준 만들기(확정 전)는 null.
   * 전형 준비 항목과 저장한 학과는 누른 순간 저장소를 다시 읽은 값으로 바꿔 보낸다(startAnalysis).
   */
  const analysisCriteria: AnalysisCriteria | null = isPrep
    ? { criteria: prepDepartment }
    : currentBuiltIn !== undefined
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
    void criteriaDraft.generate();
  }

  /** 예시를 넣는다: "새 학과 기준 만들기"를 고르고 학과 이름과 문장을 채운다. 기준 만들기는 사용자가 직접 누른다. */
  function fillExample(example: CriteriaExample) {
    if (isAnalyzing || criteriaDraft.isGenerating) return;
    selectDepartment(NEW_DEPARTMENT_VALUE);
    criteriaDraft.applyExample(example.department, example.sourceText);
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

  /**
   * 결과를 sessionStorage 에 저장하고 결과 화면으로 간다. 저장하지 못하면 이동하지 않고 안내한다(false).
   * keep 이 true 면(분석한 결과) 결과 화면으로 갈 때 그 결과를 올린 지원자로도 남긴다(lib/applicants/uploadedStorage.ts).
   * 결과 화면으로 가지 못하면(sessionStorage 실패, "다시 시도해 주세요") 남기지 않는다. 다시 분석했을 때 같은 학생부가 두 번 남지 않게 하려는 것이다.
   * 올린 지원자를 저장소에 쓰지 못해도 메모리에만 두고 결과 화면으로 간다(업로드 화면에는 안내를 보여 주지 않는다). 파일 이름은 남기지 않는다.
   */
  function openResult(result: AnalysisResult, keep: boolean): boolean {
    try {
      saveResult(result);
    } catch {
      setRequestError(SAVE_ERROR);
      return false;
    }
    if (keep) addUploadedApplicant(result, new Date());
    router.push("/result");
    return true;
  }

  async function startAnalysis() {
    // 확정하지 않은 기준(새 학과 기준 만들기)으로는 분석하지 않는다. 초안은 /api/analyze 로 보내지 않는다.
    if (file === null || isAnalyzing || analysisCriteria === null) return;

    // 저장한 학과를 골랐으면 화면에 마지막으로 그려진 값이 아니라 이 순간 다시 읽은 목록에서 찾는다
    // (다른 탭에서 지웠는데 이 탭이 아직 다시 그려지지 않은 경우). 없으면 요청하지 않고 기본 학과로 돌린 뒤 안내한다.
    // 고른 파일은 그대로 둔다.
    let criteriaToSend = analysisCriteria;
    // 전형 준비 항목은 이 순간 다시 읽은 저장한 평가 기준(메모리에만 둔 값 → 저장소의 값 → 기본값)으로 만든다
    // (다른 탭이나 전형 준비 화면이 바꿨는데 이 화면이 아직 다시 그려지지 않은 경우). 저장하지 않은 모집요강 초안은 쓰지 않는다. 배점은 보내지 않는다.
    if (isPrep) criteriaToSend = { criteria: prepAnalysisCriteria(loadPrepCriteria()) };
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
      result = await requestAnalysis({ ...criteriaToSend, file }, controller.signal);
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
    if (!openResult(result, true)) setIsAnalyzing(false);
  }

  /** 상단의 새 링크를 같은 탭에서 눌러 다른 화면으로 가는 이동이 시작될 때(next/link 의 onNavigate). 기다리는 분석을 취소한다(위 popstate 와 같은 규칙). */
  function leaveByLink() {
    cancelWaitingAnalysis(requestRef, generationRef, setIsAnalyzing);
  }

  /** 샘플 데이터는 미리 만든 결과(lib/mock/sample-result.json)를 그대로 연다. 학과 선택·초안과 상관없고 API 를 부르지 않는다. */
  function viewSample() {
    if (isAnalyzing) return;
    setRequestError(null);
    openResult(sampleResult, false);
  }

  const draft = criteriaDraft.draft;

  return {
    ready,
    bodyRef,
    departments: [
      { id: PREP_CRITERIA_ID, department: prepDepartmentLabel(prepCriteria) },
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
    examples: CRITERIA_EXAMPLES,
    fileName,
    fileError,
    requestError,
    isAnalyzing,
    fileInputKey,
    canStart: file !== null && !isAnalyzing && analysisCriteria !== null,
    startBlockedReason: isNewDepartment ? NOT_CONFIRMED_REASON : null,
    onSelectCriteria: selectDepartment,
    onDeleteDepartment: deleteSelectedDepartment,
    onUseExample: fillExample,
    onSelectFile: selectFile,
    onStart: startAnalysis,
    onViewSample: viewSample,
    onLeave: leaveByLink,
  };
}
