import { useLayoutEffect, useRef, useState } from "react";
import { GUIDELINE_CHANGES } from "@/lib/prep/guidelineChanges";
import { PDF_TOO_LARGE_ERROR, isPdfFile, isPdfTooLarge } from "@/lib/pdf";

/** PDF 가 아닌 파일을 골랐을 때의 문구. 업로드 화면(hooks/useUpload.ts)과 글자 그대로 같다. */
const NOT_PDF_ERROR = "PDF 파일만 선택할 수 있습니다.";

/** 고른 파일의 표시: 통과하면 파일 이름, 걸리면 오류 문구(전에 고른 파일 표시는 지운다). 확인은 업로드 화면과 같은 함수(lib/pdf.ts)다. */
function checkFile(file: File): { fileName: string | null; fileError: string | null } {
  if (!isPdfFile(file)) return { fileName: null, fileError: NOT_PDF_ERROR };
  if (isPdfTooLarge(file)) return { fileName: null, fileError: PDF_TOO_LARGE_ERROR };
  return { fileName: file.name, fileError: null };
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
 * 전형 준비 · 모집요강 올리기 탭 상태: 고른 모집요강 PDF(이름만), 걸린 파일의 오류 문구, 변경 사항 목록 접기.
 * 이번 작업에서는 고른 파일을 어디로도 보내지 않는다(네트워크 요청 없음). 고른 뒤의 표시만 한다.
 */
export function useGuidelineUpload() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [changesCollapsed, setChangesCollapsed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 이 화면의 수명 관리 (hooks/useUpload.ts 와 같은 방식).
  // - 화면의 JavaScript 가 준비되기 전에 고른 파일: 파일 선택은 브라우저 기본 동작이라 JS 전에도 창이 열리고 입력란에 파일이 들어간다.
  //   화면이 뜨면 입력란에 이미 들어 있는 파일을 한 번 읽어 고른 것과 똑같이 확인·표시한다. 개발 모드 StrictMode 가 effect 를
  //   한 번 더 돌릴 때 아래 cleanup 이 상태를 되돌리므로, 바로 읽지 않고 다음 차례(setTimeout 0)에 읽는다(cleanup 이 취소한다).
  // - cacheComponents 에서는 다른 화면으로 가도 이 화면이 숨겨질 뿐 상태가 남는다. 숨겨지거나 언마운트될 때 cleanup 에서
  //   처음 상태(고른 파일 없음, 변경 사항 펼침)로 되돌린다. 입력란은 파일을 읽을 때마다 비우므로 비어 있다.
  useLayoutEffect(() => {
    const timer = window.setTimeout(() => {
      const file = takeInputFile(fileInputRef.current);
      if (file === null) return;
      const checked = checkFile(file);
      setFileName(checked.fileName);
      setFileError(checked.fileError);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      setFileName(null);
      setFileError(null);
      setChangesCollapsed(false);
    };
  }, []);

  function showFile(file: File) {
    const checked = checkFile(file);
    setFileName(checked.fileName);
    setFileError(checked.fileError);
  }

  return {
    fileInputRef,
    fileName,
    fileError,
    changes: GUIDELINE_CHANGES,
    changesCollapsed,
    /** 파일 입력란의 change: 들어온 첫 파일을 읽는다 */
    onFileInputChange: () => {
      const file = takeInputFile(fileInputRef.current);
      if (file !== null) showFile(file);
    },
    /** 점선 상자에 끌어다 놓은 파일들: 첫 파일만 받는다 */
    onDropFiles: (files: FileList) => {
      const file = files[0];
      if (file !== undefined) showFile(file);
    },
    onToggleChanges: () => setChangesCollapsed((collapsed) => !collapsed),
  };
}
