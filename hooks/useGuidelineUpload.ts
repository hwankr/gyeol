import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { handOverFocusToPrepTab } from "@/hooks/usePrepHeader";
import { usePrepTabReady } from "@/hooks/usePrepTabReady";
import { ADMISSION } from "@/lib/admission";
import { RequestCanceledError } from "@/lib/apiClient";
import { requestGuidelineDraft } from "@/lib/guidelineClient";
import type { PrepCriteria } from "@/lib/prep/criteria";
import { DEFAULT_PREP_CRITERIA } from "@/lib/prep/defaultCriteria";
import { GUIDELINE_CHANGES } from "@/lib/prep/guidelineChanges";
import { revealVertically } from "@/lib/prep/reveal";
import { loadPrepCriteria, loadPrepDraft, setPrepDraft, subscribePrepStorage, type PrepDraft } from "@/lib/prep/storage";
import { checkPdfFile, formatFileSize, takeInputFile } from "@/lib/pdfPick";

/** 초안을 기다리는 동안의 상태 글 */
const GENERATING_STATUS = "모집요강을 읽는 중…";

/** 정리한 뒤 평가 요소가 0개일 때의 문구 (실패 문구 자리에 보여 준다) */
const NO_ELEMENTS_ERROR = "모집요강에서 평가 요소를 찾지 못했습니다. 다른 파일로 다시 시도해 주세요.";

/** 예상하지 못한 실패 (lib/guidelineClient.ts 가 문구를 담아 던지지 않은 경우) */
const GENERATE_ERROR = "기준 초안을 만들지 못했습니다. 다시 시도해 주세요.";

/** 모집요강에서 온 변경 사항이 0건일 때의 문장 */
const NO_CHANGES_NOTICE = "모집요강에서 전년 대비 변경 사항을 찾지 못했습니다.";

/** 초안 안내의 링크가 가는 탭: 평가 · 배점 설정 (components/GuidelineUploadTab.tsx 의 링크 주소와 같다) */
const WEIGHTS_PATH = "/prep/weights";

// 서버 렌더링과 hydration 중에는 초안이 없고(초안은 브라우저 메모리에만 있다) 저장한 평가 기준은 기본값이다.
// 그래서 서버 HTML 과 첫 클라이언트 렌더링이 같아 hydration 경고가 나지 않는다(hooks/usePrepWeights.ts 와 같은 방식).
function getServerDraft(): PrepDraft | null {
  return null;
}

function getServerCriteria(): PrepCriteria {
  return DEFAULT_PREP_CRITERIA;
}

/**
 * 전형 준비 · 모집요강 올리기 탭 상태: 고른 모집요강 PDF(이름·크기)와 삭제, 걸린 파일의 오류 문구, 파일을 끌고 상자 위에 있는지,
 * 기준 초안 만들기(POST /api/guideline), 초안 안내, 전년 대비 주요 변경 사항(초안 → 저장한 평가 기준의 것 → 기본 내용)과 접기.
 * 받은 초안은 lib/prep/storage.ts 의 메모리에 둔다(탭을 오가도 남고 새로고침하면 사라진다). 저장은 평가·배점 설정에서 한다.
 */
export function useGuidelineUpload() {
  const { ready, bodyRef } = usePrepTabReady<HTMLDivElement>();
  const draft = useSyncExternalStore(subscribePrepStorage, loadPrepDraft, getServerDraft);
  const saved = useSyncExternalStore(subscribePrepStorage, loadPrepCriteria, getServerCriteria);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  /** 파일을 끌고 점선 상자 위에 있는지 (상자를 파랗게 강조한다) */
  const [isDragOver, setIsDragOver] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  /** 초안 만들기 실패 문구(요소 0개 포함)와, 요소 0개일 때 받은 경고 */
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestWarnings, setRequestWarnings] = useState<readonly string[]>([]);
  const [changesCollapsed, setChangesCollapsed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** 점선 상자(<label>). 키보드 초점이 숨긴 입력란에 가면 초점 표시가 이 상자에 그려진다. */
  const dropBoxRef = useRef<HTMLLabelElement>(null);
  /** 전년 대비 주요 변경 사항의 접기·펼치기 버튼 */
  const collapseButtonRef = useRef<HTMLButtonElement>(null);
  /** 접기·펼치기를 그 버튼에 초점이 있는 채로 눌렀으면, 다시 그린 뒤 버튼이 보이게 한다. */
  const revealCollapseRef = useRef(false);
  /** "삭제" 를 그 버튼에 초점이 있는 채로 눌러 초점을 파일 입력란으로 옮겼으면, 다시 그린 뒤 점선 상자가 보이게 한다. */
  const revealDropBoxRef = useRef(false);
  /** 초안 안내의 "평가 · 배점 설정으로 이동" 링크 */
  const weightsLinkRef = useRef<HTMLAnchorElement>(null);
  /** 진행 중인 요청을 취소하는 컨트롤러. 진행 중인 요청이 없으면 null(요청은 한 번에 하나). */
  const requestRef = useRef<AbortController | null>(null);
  /**
   * 요청 세대 번호. 새 요청을 시작할 때와 이 화면이 숨겨지거나 언마운트될 때 늘린다.
   * 응답이 왔을 때 시작할 때의 번호와 다르면 그 응답은 버린다(초안·문구를 바꾸지 않는다).
   */
  const generationRef = useRef(0);

  // 이 화면의 수명 관리 (학생부 올리기 hooks/useRecordUpload.ts 도 같은 방식이다).
  // - 화면이 준비되기 전에는 본문이 inert 라(usePrepTabReady) 파일을 고를 수 없다. 그래서 준비 전에 고른 파일을 읽어 오는 처리는 없다.
  // - cacheComponents 에서는 다른 화면으로 가도 이 화면이 숨겨질 뿐 상태가 남는다. 숨겨지거나 언마운트될 때 cleanup 에서
  //   진행 중인 요청을 취소하고 세대 번호를 올려 늦게 오는 응답이 아무것도 바꾸지 못하게 한 뒤, 처음 상태(고른 파일 없음, 파일 줄·버튼 줄
  //   없음, 문구 없음, 상자 강조 없음, 변경 사항 펼침)로 되돌린다. 초안은 메모리(lib/prep/storage.ts)의 것이라 되돌리지 않는다.
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
      setIsGenerating(false);
      setRequestError(null);
      setRequestWarnings([]);
      setChangesCollapsed(false);
    };
  }, []);

  // 접기·펼치기 버튼은 목록 맨 아래에 있어, 변경 사항이 길면 펼친 뒤 버튼이 화면 아래로 내려가고 접으면 위로 올라간다.
  // 그 버튼에 초점이 있는 채로 눌렀으면(키보드든 마우스든) 다시 그린 뒤 버튼이 위아래 8px 까지 화면 안에 보이게, 벗어난 만큼만 세로로
  // 스크롤한다(이미 다 보이면 스크롤하지 않는다. lib/prep/reveal.ts).
  useLayoutEffect(() => {
    if (!revealCollapseRef.current) return;
    revealCollapseRef.current = false;
    const button = collapseButtonRef.current;
    if (button !== null && document.activeElement === button) revealVertically(button);
  }, [changesCollapsed]);

  // "삭제" 를 누르면 파일 줄·버튼 줄이 사라져 점선 상자의 자리와 크기가 바뀐다. 초점을 파일 입력란으로 옮겨 둔 경우(clearFile),
  // 다시 그린 뒤 키보드 초점 표시가 그려지는 점선 상자가 보이게 벗어난 만큼만 세로로 스크롤한다. 초점 표시가 없으면(마우스로 누름)
  // 스크롤하지 않는다(onFileInputFocus 와 같은 기준).
  useLayoutEffect(() => {
    if (!revealDropBoxRef.current) return;
    revealDropBoxRef.current = false;
    const input = fileInputRef.current;
    const box = dropBoxRef.current;
    if (input === null || box === null || document.activeElement !== input || !input.matches(":focus-visible")) return;
    revealVertically(box);
  }, [file]);

  /** 고른 파일을 확인·표시한다. 전에 보이던 실패 문구는 지운다(새 파일에는 맞지 않는다). */
  function showFile(picked: File) {
    // 고른 파일의 확인과 크기 글, 입력란에서 파일 꺼내기는 학생부 올리기와 같이 쓴다(lib/pdfPick.ts).
    const checked = checkPdfFile(picked);
    setFile(checked.file);
    setFileError(checked.fileError);
    setRequestError(null);
    setRequestWarnings([]);
  }

  /**
   * "삭제": 고른 파일을 비워 파일을 고르기 전 모습으로 돌아간다(그 파일의 실패 문구도 지운다). 이미 만든 초안은 그대로 둔다
   * (초안은 평가·배점 설정에서 저장하거나 취소한다). 기다리는 동안에는 아무것도 하지 않는다(버튼은 aria-disabled).
   * 누른 버튼은 파일 줄과 함께 사라진다. hadFocus(그 버튼에 초점이 있었음)이면 초점이 body 로 빠지지 않게, 사라지기 전에
   * 파일 입력란(초점 표시는 점선 상자에 그려진다)으로 옮긴다.
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
    setRequestWarnings([]);
  }

  async function generate() {
    // 기다리는 동안 다시 눌러도 아무 일도 하지 않는다(요청은 한 번에 하나).
    if (file === null || requestRef.current !== null) return;
    generationRef.current += 1;
    const generation = generationRef.current;
    const controller = new AbortController();
    requestRef.current = controller;
    /** 이 요청이 아직 유효한지: 취소되지 않았고, 그 뒤로 새 요청이나 화면 숨김이 없었는지 */
    const isCurrent = () => !controller.signal.aborted && generationRef.current === generation;

    setIsGenerating(true);
    setRequestError(null);
    setRequestWarnings([]);

    try {
      const result = await requestGuidelineDraft({ file, department: ADMISSION.unit }, controller.signal);
      if (!isCurrent()) return;
      if (result.criteria === null) {
        // 초안을 만들지 않는다(있던 초안은 그대로 둔다).
        setRequestError(NO_ELEMENTS_ERROR);
        setRequestWarnings(result.warnings);
      } else {
        setPrepDraft({
          source: "guideline",
          criteria: result.criteria,
          fileName: file.name,
          changes: result.changes,
          warnings: result.warnings,
        });
      }
    } catch (error) {
      // 취소된 요청이나 더 이상 유효하지 않은 요청은 아무것도 바꾸지 않는다(오류 문구도 세우지 않는다).
      if (error instanceof RequestCanceledError || !isCurrent()) return;
      setRequestError(error instanceof Error ? error.message : GENERATE_ERROR);
    }
    requestRef.current = null;
    setIsGenerating(false);
  }

  // 이 탭의 초안 안내와 변경 사항은 모집요강으로 만든 초안의 것만 쓴다. 위원 의견으로 만든 공통 기준 초안(공통 기준 협의 탭)은
  // 저장한 기준에서 시작한 것이라 변경 사항이 저장한 기준의 것과 같다.
  const guidelineDraft = draft?.source === "guideline" ? draft : null;
  // 전년 대비 주요 변경 사항: 초안의 것 → 저장한 평가 기준에 딸린 것 → 기본 내용(디자인 값).
  const guidelineChanges = guidelineDraft?.changes ?? saved.guideline?.changes;
  const changes = guidelineChanges ?? GUIDELINE_CHANGES;

  return {
    ready,
    bodyRef,
    fileInputRef,
    fileName: file?.name ?? null,
    fileSizeText: file === null ? "" : formatFileSize(file.size),
    fileError,
    // 기다리는 동안에는 끌어다 놓은 파일을 받지 않으므로 상자를 강조하지 않는다.
    isDragOver: isDragOver && !isGenerating,
    isGenerating,
    statusText: isGenerating ? GENERATING_STATUS : "",
    requestError,
    requestWarnings,
    draftNotice:
      guidelineDraft === null
        ? null
        : { elementCount: guidelineDraft.criteria.elements.length, warnings: guidelineDraft.warnings },
    changes,
    noChangesNotice: guidelineChanges !== undefined && guidelineChanges.length === 0 ? NO_CHANGES_NOTICE : null,
    changesCollapsed,
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
    /** 끌던 것이 점선 상자 밖으로 나감 (놓지 않고 나갔거나 끌기를 그만둠) */
    onDragLeaveBox: () => setIsDragOver(false),
    /** 파일 줄의 "삭제". hadFocus 는 누른 버튼에 초점이 있었는지 (있었으면 초점을 파일 입력란으로 옮긴다) */
    onClearFile: clearFile,
    onGenerate: () => void generate(),
    dropBoxRef,
    collapseButtonRef,
    weightsLinkRef,
    /**
     * 초안 안내의 "평가 · 배점 설정으로 이동" 링크로 같은 탭에서 실제로 이동할 때(next/link 의 onNavigate). 이 링크는 이 화면 안에 있어
     * 이동하면 화면과 함께 숨겨지므로, 링크에 초점이 있었으면 이동하기 전에 초점을 머리의 같은 주소 탭 링크로 옮긴다
     * (hooks/usePrepHeader.ts 의 handOverFocusToPrepTab. 기준 변경 기록의 빈 목록 링크와 같은 처리다).
     */
    onWeightsLinkNavigate: () => handOverFocusToPrepTab(weightsLinkRef.current, WEIGHTS_PATH),
    /**
     * 숨긴 파일 입력란에 초점이 감. 키보드 초점(:focus-visible)이면 초점 표시가 그려지는 점선 상자가 위아래 8px 까지 화면 안에 보이게
     * 벗어난 만큼만 세로로 스크롤한다(브라우저는 1px 입력란만 보이게 스크롤한다). 상자가 화면보다 크면 위쪽 끝을 맞춘다(revealVertically).
     */
    onFileInputFocus: () => {
      const input = fileInputRef.current;
      const box = dropBoxRef.current;
      if (input === null || box === null || !input.matches(":focus-visible")) return;
      revealVertically(box);
    },
    /** 접기·펼치기. hadFocus 는 누른 버튼에 초점이 있었는지 (있었으면 다시 그린 뒤 그 버튼이 보이게 한다) */
    onToggleChanges: (hadFocus: boolean) => {
      revealCollapseRef.current = hadFocus;
      setChangesCollapsed((collapsed) => !collapsed);
    },
  };
}
