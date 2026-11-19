import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePrepTabReady } from "@/hooks/usePrepTabReady";
import { ADMISSION } from "@/lib/admission";
import { requestAnalysis } from "@/lib/analyzeClient";
import { RequestCanceledError } from "@/lib/apiClient";
import { MAX_UPLOADED_APPLICANTS, NO_UPLOADED_APPLICANTS, type UploadedApplicant } from "@/lib/applicants/uploaded";
import {
  addUploadedApplicant,
  hasUnsavedUploadedApplicants,
  loadUploadedApplicants,
  subscribeUploadedApplicants,
} from "@/lib/applicants/uploadedStorage";
import { APPLICANTS_PATH, applicantOriginalPath } from "@/lib/consoleMenu";
import { summaryPath } from "@/lib/evaluate/evaluation";
import { assessmentFor } from "@/lib/evaluate/uploadedEvaluation";
import { checkPdfFile, formatFileSize, takeInputFile } from "@/lib/pdfPick";
import { tagsLine, type PrepCriteria } from "@/lib/prep/criteria";
import { DEFAULT_PREP_CRITERIA } from "@/lib/prep/defaultCriteria";
import { revealVertically } from "@/lib/prep/reveal";
import { loadPrepCriteria, subscribePrepStorage } from "@/lib/prep/storage";

/** 분석을 기다리는 동안의 상태 글 (근거 추출과 AI 제안을 같이 부른다. 가상 학생부로 20초쯤 걸렸다) */
const ANALYZING_STATUS = "학생부를 분석하는 중… 30초쯤 걸립니다.";

/** 예상하지 못한 실패 (lib/analyzeClient.ts 가 문구를 담아 던지지 않은 경우) */
const ANALYZE_ERROR = "분석에 실패했습니다. 다시 시도해 주세요.";

/** 지원자 코드가 네 자리를 다 써서 남기지 못했을 때 */
const NO_CODE_ERROR = "지원자 코드를 더 만들 수 없어 분석한 학생부를 남기지 못했습니다.";

/** 저장소에 쓰지 못해 메모리에만 둔 올린 지원자가 있을 때의 안내 */
const STORAGE_NOTICE = "브라우저 저장소에 쓰지 못했습니다. 새로고침하면 방금 올린 지원자가 사라집니다.";

/** 평가 기준을 고치는 곳: 전형 준비 · 평가 · 배점 설정 */
const WEIGHTS_PATH = "/prep/weights";

// 서버 렌더링과 hydration 중에는 저장한 값이 없는 모습(기본 평가 기준, 올린 지원자 없음)으로 그린다. 서버 HTML 과 첫 클라이언트
// 렌더링이 같아 hydration 경고가 나지 않고, 브라우저에서 저장소를 읽은 뒤 바뀐다(hooks/useGuidelineUpload.ts 와 같은 방식).
function getServerCriteria(): PrepCriteria {
  return DEFAULT_PREP_CRITERIA;
}

function getServerUploaded(): readonly UploadedApplicant[] {
  return NO_UPLOADED_APPLICANTS;
}

function getServerUnsaved(): boolean {
  return false;
}

/** 방금 올린 학생부의 안내 */
type DoneNotice = {
  code: string;
  evidenceCount: number;
  /** 지금 평가 기준의 AI 제안이 있어 평가 대기 목록에 나오는지 */
  assessed: boolean;
  /** 열한 번째라 가장 오래된 올린 학생부가 목록에서 빠졌는지 */
  evicted: boolean;
};

function doneText(done: DoneNotice): string {
  // 코드 끝 숫자에 따라 조사(로·으로)가 달라지지 않게 "지원자로" 로 적는다.
  const head = `${done.code} 지원자로 올렸습니다.`;
  const body = done.assessed
    ? `근거 ${done.evidenceCount}건과 AI 제안을 만들었고, 평가 대기 목록에 나옵니다.`
    : `근거 ${done.evidenceCount}건을 찾았지만 AI 제안을 만들 기록이 없어 평가 대기 목록에는 나오지 않습니다.`;
  const tail = done.evicted ? ` 최근 ${MAX_UPLOADED_APPLICANTS}건만 남아 가장 오래된 올린 학생부 한 건은 목록에서 빠졌습니다.` : "";
  return `${head} ${body}${tail}`;
}

/**
 * 지원자 관리 · 학생부 올리기 화면 상태: 고른 학생부 PDF(이름·크기)와 삭제, 걸린 파일의 오류 문구, 파일을 끌고 상자 위에 있는지,
 * 분석 시작(POST /api/analyze, 전형 준비의 평가 기준을 함께 보낸다), 분석 결과를 올린 지원자로 남기기, 방금 올린 학생부의 안내,
 * 분석에 쓰는 평가 기준(전형 준비에서 저장한 값) 보여 주기.
 * 분석이 끝나도 다른 화면으로 가지 않는다(이어서 다른 학생부를 올릴 수 있다). 올린 학생부는 지원자 관리와 평가하기에 지원자로 나온다.
 */
export function useRecordUpload() {
  // "준비" 는 전형 준비 탭과 같은 훅이다: 준비 전(서버 HTML·hydration)에는 본문이 inert 라 파일을 고를 수 없다.
  const { ready, bodyRef } = usePrepTabReady<HTMLDivElement>();
  const criteria = useSyncExternalStore(subscribePrepStorage, loadPrepCriteria, getServerCriteria);
  const uploaded = useSyncExternalStore(subscribeUploadedApplicants, loadUploadedApplicants, getServerUploaded);
  const unsaved = useSyncExternalStore(subscribeUploadedApplicants, hasUnsavedUploadedApplicants, getServerUnsaved);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  /** 파일을 끌고 점선 상자 위에 있는지 (상자를 파랗게 강조한다) */
  const [isDragOver, setIsDragOver] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [done, setDone] = useState<DoneNotice | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** 점선 상자(<label>). 키보드 초점이 숨긴 입력란에 가면 초점 표시가 이 상자에 그려진다. */
  const dropBoxRef = useRef<HTMLLabelElement>(null);
  const analyzeButtonRef = useRef<HTMLButtonElement>(null);
  /** 방금 올린 학생부 안내의 첫 링크 (분석 시작 버튼이 사라질 때 초점을 받는다) */
  const doneLinkRef = useRef<HTMLAnchorElement>(null);
  /** "삭제" 를 그 버튼에 초점이 있는 채로 눌러 초점을 파일 입력란으로 옮겼으면, 다시 그린 뒤 점선 상자가 보이게 한다. */
  const revealDropBoxRef = useRef(false);
  /** 분석이 끝나 "분석 시작" 이 사라질 때 그 버튼에 초점이 있었으면, 다시 그린 뒤 안내의 첫 링크로 초점을 옮긴다. */
  const focusDoneRef = useRef(false);
  /** 진행 중인 요청을 취소하는 컨트롤러. 진행 중인 요청이 없으면 null(요청은 한 번에 하나). */
  const requestRef = useRef<AbortController | null>(null);
  /**
   * 요청 세대 번호. 새 요청을 시작할 때와 이 화면이 숨겨지거나 언마운트될 때 늘린다.
   * 응답이 왔을 때 시작할 때의 번호와 다르면 그 응답은 버린다(올린 지원자로 남기지 않고 문구도 바꾸지 않는다).
   */
  const generationRef = useRef(0);

  // 이 화면의 수명 관리 (hooks/useGuidelineUpload.ts 와 같은 방식).
  // cacheComponents 에서는 다른 화면으로 가도 이 화면이 숨겨질 뿐 상태가 남는다. 숨겨지거나 언마운트될 때 cleanup 에서
  // 진행 중인 요청을 취소하고 세대 번호를 올려 늦게 오는 응답이 아무것도 바꾸지 못하게 한 뒤, 처음 상태(고른 파일 없음, 문구·안내 없음,
  // 상자 강조 없음)로 되돌린다. 올린 지원자는 저장소의 것이라 되돌리지 않는다.
  useLayoutEffect(() => {
    const input = fileInputRef.current;
    return () => {
      if (input !== null) input.value = "";
      generationRef.current += 1;
      requestRef.current?.abort();
      requestRef.current = null;
      setFile(null);
      setFileError(null);
      setIsDragOver(false);
      setIsAnalyzing(false);
      setRequestError(null);
      setDone(null);
    };
  }, []);

  // "삭제" 를 누르면 파일 줄·버튼 줄이 사라진다. 초점을 파일 입력란으로 옮겨 둔 경우(clearFile), 다시 그린 뒤 키보드 초점 표시가
  // 그려지는 점선 상자가 보이게 벗어난 만큼만 세로로 스크롤한다. 초점 표시가 없으면(마우스로 누름) 스크롤하지 않는다.
  useLayoutEffect(() => {
    if (!revealDropBoxRef.current) return;
    revealDropBoxRef.current = false;
    const input = fileInputRef.current;
    const box = dropBoxRef.current;
    if (input === null || box === null || document.activeElement !== input || !input.matches(":focus-visible")) return;
    revealVertically(box);
  }, [file]);

  // 분석이 끝나면 파일 줄과 "분석 시작" 이 사라지고 안내가 나타난다. 그 버튼에 초점이 있었으면 초점이 문서(body)로 빠지지 않게
  // 안내의 첫 링크로 옮기고, 가려져 있으면 보일 만큼만 세로로 스크롤한다.
  useLayoutEffect(() => {
    if (!focusDoneRef.current) return;
    focusDoneRef.current = false;
    const link = doneLinkRef.current;
    if (link === null) return;
    link.focus({ preventScroll: true });
    revealVertically(link);
  }, [done]);

  /** 고른 파일을 확인·표시한다. 전에 보이던 실패 문구와 안내는 지운다(새 파일에는 맞지 않는다). */
  function showFile(picked: File) {
    const checked = checkPdfFile(picked);
    setFile(checked.file);
    setFileError(checked.fileError);
    setRequestError(null);
    setDone(null);
  }

  /**
   * "삭제": 고른 파일을 비워 파일을 고르기 전 모습으로 돌아간다. 기다리는 동안에는 아무것도 하지 않는다(버튼은 aria-disabled).
   * 누른 버튼은 파일 줄과 함께 사라진다. hadFocus(그 버튼에 초점이 있었음)이면 사라지기 전에 초점을 파일 입력란으로 옮긴다.
   */
  function clearFile(hadFocus: boolean) {
    if (requestRef.current !== null) return;
    if (hadFocus && fileInputRef.current !== null) {
      fileInputRef.current.focus({ preventScroll: true });
      revealDropBoxRef.current = true;
    }
    setFile(null);
    setFileError(null);
    setRequestError(null);
  }

  async function analyze() {
    // 기다리는 동안 다시 눌러도 아무 일도 하지 않는다(요청은 한 번에 하나).
    if (file === null || requestRef.current !== null) return;
    generationRef.current += 1;
    const generation = generationRef.current;
    const controller = new AbortController();
    requestRef.current = controller;
    /** 이 요청이 아직 유효한지: 취소되지 않았고, 그 뒤로 새 요청이나 화면 숨김이 없었는지 */
    const isCurrent = () => !controller.signal.aborted && generationRef.current === generation;

    setIsAnalyzing(true);
    setRequestError(null);
    setDone(null);

    // 평가 기준은 누른 순간 다시 읽은 값이다(메모리에만 둔 값 → 저장소의 값 → 기본값. 다른 탭이나 전형 준비 화면이 바꿨는데
    // 이 화면이 아직 다시 그려지지 않은 경우). 저장하지 않은 모집요강 초안은 쓰지 않는다.
    const prep = loadPrepCriteria();
    try {
      const result = await requestAnalysis({ prepCriteria: prep, file }, controller.signal);
      if (!isCurrent()) return;
      const evicted = loadUploadedApplicants().length >= MAX_UPLOADED_APPLICANTS;
      // 파일 이름은 남기지 않는다(학생 이름이 들어 있는 경우가 많다). 저장소에 쓰지 못하면 메모리에만 남고 안내가 나온다(unsaved).
      const code = addUploadedApplicant(result, new Date());
      if (code === null) {
        setRequestError(NO_CODE_ERROR);
      } else {
        focusDoneRef.current = analyzeButtonRef.current !== null && document.activeElement === analyzeButtonRef.current;
        setDone({
          code,
          evidenceCount: result.evidences.length,
          assessed: assessmentFor(result, prep.elements) !== null,
          evicted,
        });
        setFile(null);
        setFileError(null);
      }
    } catch (error) {
      // 취소된 요청이나 더 이상 유효하지 않은 요청은 아무것도 바꾸지 않는다(오류 문구도 세우지 않는다).
      if (error instanceof RequestCanceledError || !isCurrent()) return;
      setRequestError(error instanceof Error ? error.message : ANALYZE_ERROR);
    }
    requestRef.current = null;
    setIsAnalyzing(false);
  }

  return {
    ready,
    bodyRef,
    crumbs: [{ label: "홈" }, { label: "지원자 관리", href: APPLICANTS_PATH }, { label: "학생부 올리기" }],
    /** 제목 옆의 글: 전형 · 모집 단위 */
    headNote: `${ADMISSION.trackFull} · ${ADMISSION.unit}`,
    backHref: APPLICANTS_PATH,
    fileInputRef,
    dropBoxRef,
    analyzeButtonRef,
    doneLinkRef,
    fileName: file?.name ?? null,
    fileSizeText: file === null ? "" : formatFileSize(file.size),
    fileError,
    // 기다리는 동안에는 끌어다 놓은 파일을 받지 않으므로 상자를 강조하지 않는다.
    isDragOver: isDragOver && !isAnalyzing,
    isAnalyzing,
    statusText: isAnalyzing ? ANALYZING_STATUS : "",
    requestError,
    storageNotice: unsaved ? STORAGE_NOTICE : "",
    /** 방금 올린 학생부의 안내. 평가 대기 목록에 나오면 총평으로 가는 링크가 있다. */
    done:
      done === null
        ? null
        : {
            text: doneText(done),
            evaluateHref: done.assessed ? summaryPath(done.code) : null,
            originalHref: applicantOriginalPath(done.code),
          },
    /** 이 브라우저에 남아 있는 올린 학생부 수와 한도 */
    keptText: `이 브라우저에 올린 학생부 ${uploaded.length}건 · 최근 ${MAX_UPLOADED_APPLICANTS}건까지 남습니다.`,
    /** 분석에 쓰는 평가 기준 (전형 준비에서 저장한 값) */
    criteria: {
      department: criteria.department,
      elements: criteria.elements.map((element) => ({
        id: element.id,
        name: element.name,
        weight: element.weight,
        tags: tagsLine(element),
      })),
      weightsHref: WEIGHTS_PATH,
    },
    /** 파일 입력란의 change: 들어온 첫 파일을 읽는다 (기다리는 동안에는 입력란이 막혀 있다) */
    onFileInputChange: () => {
      const picked = takeInputFile(fileInputRef.current);
      if (picked !== null && requestRef.current === null) showFile(picked);
    },
    /** 점선 상자에 끌어다 놓은 파일들: 첫 파일만 받는다. 기다리는 동안에는 받지 않는다. 상자 강조는 끈다. */
    onDropFiles: (files: FileList) => {
      setIsDragOver(false);
      const picked = files[0];
      if (picked !== undefined && requestRef.current === null) showFile(picked);
    },
    /** 파일을 끌고 점선 상자 위에 있음 (끄는 동안 되풀이해 불린다). 기다리는 동안에는 강조하지 않는다. */
    onDragOverBox: () => {
      if (requestRef.current === null) setIsDragOver(true);
    },
    /** 끌던 것이 점선 상자 밖으로 나감 */
    onDragLeaveBox: () => setIsDragOver(false),
    /** 파일 줄의 "삭제". hadFocus 는 누른 버튼에 초점이 있었는지 */
    onClearFile: clearFile,
    onAnalyze: () => void analyze(),
    /**
     * 숨긴 파일 입력란에 초점이 감. 키보드 초점(:focus-visible)이면 초점 표시가 그려지는 점선 상자가 위아래 8px 까지 화면 안에 보이게
     * 벗어난 만큼만 세로로 스크롤한다(브라우저는 1px 입력란만 보이게 스크롤한다).
     */
    onFileInputFocus: () => {
      const input = fileInputRef.current;
      const box = dropBoxRef.current;
      if (input === null || box === null || !input.matches(":focus-visible")) return;
      revealVertically(box);
    },
  };
}
