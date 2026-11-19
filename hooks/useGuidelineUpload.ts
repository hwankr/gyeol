import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePrepTabReady } from "@/hooks/usePrepTabReady";
import { ADMISSION } from "@/lib/admission";
import { RequestCanceledError } from "@/lib/apiClient";
import { requestGuidelineDraft } from "@/lib/guidelineClient";
import type { PrepCriteria } from "@/lib/prep/criteria";
import { DEFAULT_PREP_CRITERIA } from "@/lib/prep/defaultCriteria";
import { GUIDELINE_CHANGES } from "@/lib/prep/guidelineChanges";
import { revealVertically } from "@/lib/prep/reveal";
import { loadPrepCriteria, loadPrepDraft, setPrepDraft, subscribePrepStorage, type PrepDraft } from "@/lib/prep/storage";
import { PDF_TOO_LARGE_ERROR, isPdfFile, isPdfTooLarge } from "@/lib/pdf";

/** PDF 가 아닌 파일을 골랐을 때의 문구. 업로드 화면(hooks/useUpload.ts)과 글자 그대로 같다. */
const NOT_PDF_ERROR = "PDF 파일만 선택할 수 있습니다.";

/** 초안을 기다리는 동안의 상태 글 */
const GENERATING_STATUS = "모집요강을 읽는 중…";

/** 정리한 뒤 평가 요소가 0개일 때의 문구 (실패 문구 자리에 보여 준다) */
const NO_ELEMENTS_ERROR = "모집요강에서 평가 요소를 찾지 못했습니다. 다른 파일로 다시 시도해 주세요.";

/** 예상하지 못한 실패 (lib/guidelineClient.ts 가 문구를 담아 던지지 않은 경우) */
const GENERATE_ERROR = "기준 초안을 만들지 못했습니다. 다시 시도해 주세요.";

/** 모집요강에서 온 변경 사항이 0건일 때의 문장 */
const NO_CHANGES_NOTICE = "모집요강에서 전년 대비 변경 사항을 찾지 못했습니다.";

/** 전형 준비 머리의 탭 줄(components/PrepHeader.tsx 의 <nav aria-label>) */
const PREP_TABS_LABEL = "전형 준비 단계";

// 서버 렌더링과 hydration 중에는 초안이 없고(초안은 브라우저 메모리에만 있다) 저장한 평가 기준은 기본값이다.
// 그래서 서버 HTML 과 첫 클라이언트 렌더링이 같아 hydration 경고가 나지 않는다(hooks/usePrepWeights.ts 와 같은 방식).
function getServerDraft(): PrepDraft | null {
  return null;
}

function getServerCriteria(): PrepCriteria {
  return DEFAULT_PREP_CRITERIA;
}

/** 고른 파일의 확인: 통과하면 그 파일, 걸리면 오류 문구. 확인은 업로드 화면과 같은 함수(lib/pdf.ts)다. */
function checkFile(file: File): { file: File | null; fileError: string | null } {
  if (!isPdfFile(file)) return { file: null, fileError: NOT_PDF_ERROR };
  if (isPdfTooLarge(file)) return { file: null, fileError: PDF_TOO_LARGE_ERROR };
  return { file, fileError: null };
}

/**
 * 파일 입력란에 들어 있는 첫 파일을 꺼내고 입력란을 비운다. 비워 두어야 같은 파일을 다시 골라도 change 가 일어난다.
 * (입력란을 새로 만들지 않고 값만 비우므로 키보드 초점은 그대로다.)
 */
function takeInputFile(input: HTMLInputElement | null): File | null {
  const file = input?.files?.[0];
  if (input === null || file === undefined) return null;
  input.value = "";
  return file;
}

/**
 * 전형 준비 · 모집요강 올리기 탭 상태: 고른 모집요강 PDF, 걸린 파일의 오류 문구, 기준 초안 만들기(POST /api/guideline),
 * 초안 안내, 전년 대비 주요 변경 사항(초안 → 저장한 평가 기준의 것 → 기본 내용)과 접기.
 * 받은 초안은 lib/prep/storage.ts 의 메모리에 둔다(탭을 오가도 남고 새로고침하면 사라진다). 저장은 평가·배점 설정에서 한다.
 */
export function useGuidelineUpload() {
  const { ready, bodyRef } = usePrepTabReady<HTMLDivElement>();
  const draft = useSyncExternalStore(subscribePrepStorage, loadPrepDraft, getServerDraft);
  const saved = useSyncExternalStore(subscribePrepStorage, loadPrepCriteria, getServerCriteria);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
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
  /** 초안 안내의 "평가 · 배점 설정으로 이동" 링크 */
  const weightsLinkRef = useRef<HTMLAnchorElement>(null);
  /** 진행 중인 요청을 취소하는 컨트롤러. 진행 중인 요청이 없으면 null(요청은 한 번에 하나). */
  const requestRef = useRef<AbortController | null>(null);
  /**
   * 요청 세대 번호. 새 요청을 시작할 때와 이 화면이 숨겨지거나 언마운트될 때 늘린다.
   * 응답이 왔을 때 시작할 때의 번호와 다르면 그 응답은 버린다(초안·문구를 바꾸지 않는다).
   */
  const generationRef = useRef(0);

  // 이 화면의 수명 관리 (hooks/useUpload.ts 와 같은 방식).
  // - 화면이 준비되기 전에는 본문이 inert 라(usePrepTabReady) 파일을 고를 수 없다. 그래서 준비 전에 고른 파일을 읽어 오는 처리는 없다.
  // - cacheComponents 에서는 다른 화면으로 가도 이 화면이 숨겨질 뿐 상태가 남는다. 숨겨지거나 언마운트될 때 cleanup 에서
  //   진행 중인 요청을 취소하고 세대 번호를 올려 늦게 오는 응답이 아무것도 바꾸지 못하게 한 뒤, 처음 상태(고른 파일 없음, 버튼 줄 없음,
  //   문구 없음, 변경 사항 펼침)로 되돌린다. 초안은 메모리(lib/prep/storage.ts)의 것이라 되돌리지 않는다.
  useLayoutEffect(() => {
    const input = fileInputRef.current;
    return () => {
      if (input !== null) input.value = "";
      generationRef.current += 1;
      requestRef.current?.abort();
      requestRef.current = null;
      setFile(null);
      setFileError(null);
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

  /** 고른 파일을 확인·표시한다. 전에 보이던 실패 문구는 지운다(새 파일에는 맞지 않는다). */
  function showFile(picked: File) {
    const checked = checkFile(picked);
    setFile(checked.file);
    setFileError(checked.fileError);
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

  // 전년 대비 주요 변경 사항: 초안의 것 → 저장한 평가 기준에 딸린 것 → 기본 내용(디자인 값).
  const guidelineChanges = draft?.changes ?? saved.guideline?.changes;
  const changes = guidelineChanges ?? GUIDELINE_CHANGES;

  return {
    ready,
    bodyRef,
    fileInputRef,
    fileName: file?.name ?? null,
    fileError,
    isGenerating,
    statusText: isGenerating ? GENERATING_STATUS : "",
    requestError,
    requestWarnings,
    draftNotice: draft === null ? null : { elementCount: draft.criteria.elements.length, warnings: draft.warnings },
    changes,
    noChangesNotice: guidelineChanges !== undefined && guidelineChanges.length === 0 ? NO_CHANGES_NOTICE : null,
    changesCollapsed,
    /** 파일 입력란의 change: 들어온 첫 파일을 읽는다 (기다리는 동안에는 입력란이 막혀 있다) */
    onFileInputChange: () => {
      const picked = takeInputFile(fileInputRef.current);
      if (picked !== null && requestRef.current === null) showFile(picked);
    },
    /** 점선 상자에 끌어다 놓은 파일들: 첫 파일만 받는다. 기다리는 동안에는 받지 않는다. */
    onDropFiles: (files: FileList) => {
      const picked = files[0];
      if (picked !== undefined && requestRef.current === null) showFile(picked);
    },
    onGenerate: () => void generate(),
    dropBoxRef,
    collapseButtonRef,
    weightsLinkRef,
    /**
     * 초안 안내의 "평가 · 배점 설정으로 이동" 링크로 같은 탭에서 실제로 이동할 때(next/link 의 onNavigate: 보조 키·가운데 버튼·
     * 기본 동작이 막힌 누름에서는 불리지 않는다). 이 링크는 이 화면 안에 있어 이동하면 화면과 함께 숨겨지므로, 링크에 초점이 있었으면
     * (키보드로 눌렀거나 누르면서 초점이 간 경우) 초점이 body 로 빠지지 않게 이동하기 전에 머리의 같은 주소 탭 링크(이동한 뒤 지금 탭이
     * 된다. 숨겨지지 않는다)로 옮긴다. 새 탭으로 여는 누름에서는 원래 탭의 초점·스크롤을 건드리지 않는다.
     */
    onWeightsLinkNavigate: () => {
      if (weightsLinkRef.current === null || document.activeElement !== weightsLinkRef.current) return;
      const tabLink = document.querySelector<HTMLAnchorElement>(`nav[aria-label="${PREP_TABS_LABEL}"] a[href="/prep/weights"]`);
      if (tabLink === null) return;
      // 탭 링크가 (초점 표시까지) 가려져 있으면 보일 만큼만 세로로 스크롤한다. 그러면 탭 바로 아래에서 시작하는 새 화면의 윗변도
      // 화면 안이라 Next.js 가 이동 뒤에 새 화면 쪽으로 다시 스크롤하지 않아 초점이 간 탭이 보인 채로 남는다.
      tabLink.focus({ preventScroll: true });
      revealVertically(tabLink);
    },
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
