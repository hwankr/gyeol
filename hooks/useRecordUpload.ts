import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePrepTabReady } from "@/hooks/usePrepTabReady";
import { ADMISSION } from "@/lib/admission";
import { requestAnalysis, type AnalysisProgress } from "@/lib/analyzeClient";
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
import { NOT_PDF_ERROR, checkRecordPdfFile, formatFileSize, takeInputFiles } from "@/lib/pdfPick";
import { tagsLine, type PrepCriteria } from "@/lib/prep/criteria";
import { DEFAULT_PREP_CRITERIA } from "@/lib/prep/defaultCriteria";
import { revealVertically } from "@/lib/prep/reveal";
import { loadPrepCriteria, subscribePrepStorage } from "@/lib/prep/storage";
import { pruneRecordPages, recordPagesKey, saveRecordPages } from "@/lib/recordPagesStorage";

/** 한 번에 올려 둘 수 있는 학생부 수 (남는 올린 지원자 수와 같다. 넘게 올리면 먼저 분석한 것이 목록에서 빠진다) */
const MAX_BATCH_FILES = MAX_UPLOADED_APPLICANTS;

/** 분석을 기다리는 동안의 상태 글 (근거 추출과 AI 제안을 같이 부른다. 가상 학생부로 20초쯤 걸렸다) */
const ANALYZING_STATUS = "식별 정보를 가리고 분석하는 중… 30초쯤 걸립니다.";

/** 브라우저에서 PDF 를 읽는 동안의 상태 글 (PDF 파일은 서버로 보내지 않는다) */
const READING_STATUS = "학생부 PDF 를 읽는 중…";

/** 분석이 끝나 가린 쪽 그림을 만드는 동안의 상태 글 */
const RENDERING_STATUS = "가린 쪽 그림을 만드는 중…";

/**
 * 기다리는 동안의 상태 글. 단계는 lib/analyzeClient.ts 가 알려 준다: PDF 읽기 → (AI 가 읽어야 하는 쪽이 있으면) 쪽별 읽기 → 가리고 분석
 * → 가린 쪽 그림 만들기. 쪽별 읽기는 글자가 없는 쪽(스캔본)이나 파서가 양식을 알아보지 못한 학생부에서만 거치고, 쪽마다 AI 를 한 번 부른다.
 */
function stageText(progress: AnalysisProgress | null): string {
  if (progress === null || progress.stage === "reading") return READING_STATUS;
  if (progress.stage === "pages") {
    return `AI 가 학생부를 쪽별로 읽는 중… ${progress.done}/${progress.total}쪽 (몇 분 걸릴 수 있습니다)`;
  }
  if (progress.stage === "rendering") return RENDERING_STATUS;
  return ANALYZING_STATUS;
}

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

/** 올려 둔 학생부 한 건의 상태: 대기 → 처리 중 → 완료 또는 실패 */
type EntryStatus = "waiting" | "working" | "done" | "failed";

/** 분석이 끝난 학생부의 결과 */
type EntryDone = {
  code: string;
  evidenceCount: number;
  /** 지금 평가 기준의 AI 제안이 있어 평가 대기 목록에 나오는지 */
  assessed: boolean;
  /** 원문보기에서 실제 PDF 의 자리를 볼 수 있는지 (가린 쪽 그림을 남겼는지) */
  hasPages: boolean;
};

/** 올려 둔 학생부 한 건 */
type Entry = {
  /** 줄의 열쇠 (올려 둔 순서) */
  id: number;
  /** 고른 파일의 이름·크기. 분석이 끝나면 비운다(파일 이름은 학생 이름이 들어 있는 경우가 많아 남기지 않는다) */
  name: string;
  sizeText: string;
  status: EntryStatus;
  /** 실패했을 때의 문구 */
  error: string | null;
  done: EntryDone | null;
};

/** 화면의 한 줄 */
export type RecordUploadRow = {
  id: number;
  /** 줄의 제목: 끝나기 전에는 파일 이름, 끝난 뒤에는 지원자 코드 */
  title: string;
  sizeText: string;
  status: EntryStatus;
  /** 상태 표시의 글 ("대기", "처리 중", "완료", "실패") */
  statusLabel: string;
  /** 줄 아래의 글: 처리 중의 단계, 실패 문구, 완료한 학생부의 결과 */
  note: string;
  noteIsError: boolean;
  /** 지울 수 있는 줄인지 (대기·실패. 처리 중에는 꺼져 있다) */
  removable: boolean;
  /** 끝난 학생부의 링크. evaluateHref 가 null 이면 평가 대기 목록에 나오지 않는 학생부다 */
  links: { evaluateHref: string | null; originalHref: string } | null;
};

const STATUS_LABEL: Record<EntryStatus, string> = { waiting: "대기", working: "처리 중", done: "완료", failed: "실패" };

function doneNote(done: EntryDone): string {
  const body = done.assessed
    ? `근거 ${done.evidenceCount}건과 AI 제안을 만들었고, 평가 대기 목록에 나옵니다.`
    : `근거 ${done.evidenceCount}건을 찾았지만 AI 제안을 만들 기록이 없어 평가 대기 목록에는 나오지 않습니다.`;
  return done.hasPages ? body : `${body} 가린 쪽 그림은 남기지 못했습니다.`;
}

/**
 * 지원자 관리 · 학생부 올리기 화면 상태: 올려 둔 학생부 PDF 여러 건(이름·크기·상태)과 지우기, 걸린 파일의 오류 문구, 파일을 끌고 상자 위에
 * 있는지, 분석 시작(올려 둔 순서대로 한 건씩: 브라우저에서 PDF 를 읽어 항목을 POST /api/analyze 로 보낸다. 서버가 식별 정보를 먼저 가린 뒤
 * 근거 추출과 AI 제안을 만든다. PDF 파일은 서버로 보내지 않는다. lib/analyzeClient.ts), 건마다의 단계별 상태 글, 분석 결과를 올린 지원자로
 * 남기기, 가린 쪽 그림 남기기(lib/recordPagesStorage.ts), 분석에 쓰는 평가 기준(전형 준비에서 저장한 값) 보여 주기.
 * 분석이 끝나도 다른 화면으로 가지 않는다(이어서 다른 학생부를 올릴 수 있다). 올린 학생부는 지원자 관리와 평가하기에 지원자로 나온다.
 * 한 건이 실패해도 나머지는 이어서 분석한다. 실패한 건은 "분석 시작" 을 다시 누르면 다시 한다.
 */
export function useRecordUpload() {
  // "준비" 는 전형 준비 탭과 같은 훅이다: 준비 전(서버 HTML·hydration)에는 본문이 inert 라 파일을 고를 수 없다.
  const { ready, bodyRef } = usePrepTabReady<HTMLDivElement>();
  const criteria = useSyncExternalStore(subscribePrepStorage, loadPrepCriteria, getServerCriteria);
  const uploaded = useSyncExternalStore(subscribeUploadedApplicants, loadUploadedApplicants, getServerUploaded);
  const unsaved = useSyncExternalStore(subscribeUploadedApplicants, hasUnsavedUploadedApplicants, getServerUnsaved);
  const [entries, setEntries] = useState<readonly Entry[]>([]);
  /** 방금 고른 파일 가운데 받지 못한 것이 있을 때의 문구 */
  const [fileError, setFileError] = useState<string | null>(null);
  /** 파일을 끌고 점선 상자 위에 있는지 (상자를 파랗게 강조한다) */
  const [isDragOver, setIsDragOver] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  /** 지금 처리 중인 건이 어디까지 왔는지 (그 줄의 글에 쓴다). 처리 중이 아니면 null */
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** 점선 상자(<label>). 키보드 초점이 숨긴 입력란에 가면 초점 표시가 이 상자에 그려진다. */
  const dropBoxRef = useRef<HTMLLabelElement>(null);
  const analyzeButtonRef = useRef<HTMLButtonElement>(null);
  /** 끝난 학생부 줄의 첫 링크 가운데 가장 나중 것 (분석 시작 버튼이 사라질 때 초점을 받는다) */
  const doneLinkRef = useRef<HTMLAnchorElement>(null);
  /** 줄의 "삭제" 를 그 버튼에 초점이 있는 채로 눌러 초점을 파일 입력란으로 옮겼으면, 다시 그린 뒤 점선 상자가 보이게 한다. */
  const revealDropBoxRef = useRef(false);
  /** 분석이 모두 끝나 "분석 시작" 이 사라질 때 그 버튼에 초점이 있었으면, 다시 그린 뒤 끝난 줄의 링크로 초점을 옮긴다. */
  const focusDoneRef = useRef(false);
  /** 올려 둔 파일 (줄의 id → 파일). 화면 상태에는 이름·크기만 두고 파일은 여기에 둔다. 끝난 건은 지운다. */
  const filesRef = useRef(new Map<number, File>());
  /** 다음 줄의 id */
  const nextIdRef = useRef(1);
  /** 진행 중인 분석을 취소하는 컨트롤러. 진행 중이 아니면 null(분석은 한 번에 한 건). */
  const requestRef = useRef<AbortController | null>(null);
  /**
   * 요청 세대 번호. 분석을 시작할 때와 이 화면이 숨겨지거나 언마운트될 때 늘린다.
   * 응답이 왔을 때 시작할 때의 번호와 다르면 그 응답은 버린다(올린 지원자로 남기지 않고 줄도 바꾸지 않는다).
   */
  const generationRef = useRef(0);

  // 이 화면의 수명 관리 (hooks/useGuidelineUpload.ts 와 같은 방식).
  // cacheComponents 에서는 다른 화면으로 가도 이 화면이 숨겨질 뿐 상태가 남는다. 숨겨지거나 언마운트될 때 cleanup 에서
  // 진행 중인 분석을 취소하고 세대 번호를 올려 늦게 오는 응답이 아무것도 바꾸지 못하게 한 뒤, 처음 상태(올려 둔 파일 없음, 문구 없음,
  // 상자 강조 없음)로 되돌린다. 올린 지원자는 저장소의 것이라 되돌리지 않는다.
  useLayoutEffect(() => {
    const input = fileInputRef.current;
    const files = filesRef.current;
    return () => {
      if (input !== null) input.value = "";
      generationRef.current += 1;
      requestRef.current?.abort();
      requestRef.current = null;
      files.clear();
      setEntries([]);
      setFileError(null);
      setIsDragOver(false);
      setIsAnalyzing(false);
      setProgress(null);
    };
  }, []);

  // 줄의 "삭제" 를 누르면 그 줄이 사라진다. 초점을 파일 입력란으로 옮겨 둔 경우(removeEntry), 다시 그린 뒤 키보드 초점 표시가
  // 그려지는 점선 상자가 보이게 벗어난 만큼만 세로로 스크롤한다. 초점 표시가 없으면(마우스로 누름) 스크롤하지 않는다.
  // 분석이 모두 끝나 "분석 시작" 이 사라질 때 그 버튼에 초점이 있었으면, 초점이 문서(body)로 빠지지 않게 끝난 줄의 링크로 옮긴다.
  useLayoutEffect(() => {
    if (revealDropBoxRef.current) {
      revealDropBoxRef.current = false;
      const input = fileInputRef.current;
      const box = dropBoxRef.current;
      if (input !== null && box !== null && document.activeElement === input && input.matches(":focus-visible")) {
        revealVertically(box);
      }
    }
    if (focusDoneRef.current && !isAnalyzing) {
      focusDoneRef.current = false;
      const link = doneLinkRef.current;
      if (link !== null && analyzeButtonRef.current === null) {
        link.focus({ preventScroll: true });
        revealVertically(link);
      }
    }
  }, [entries, isAnalyzing]);

  /**
   * 고른 파일들을 확인해 올려 둔다. PDF 가 아니거나 너무 큰 파일, 이미 올려 둔 파일(이름·크기·고친 때가 같음), 한도를 넘는 파일은 받지 않고
   * 그 까닭을 문구로 보여 준다. 받은 파일은 "대기" 줄이 된다.
   */
  function addFiles(picked: readonly File[]) {
    if (picked.length === 0) return;
    const problems: string[] = [];
    const accepted: Entry[] = [];
    const known = new Set([...filesRef.current.values()].map(fileIdentity));
    let waiting = filesRef.current.size;
    let skippedForLimit = 0;
    for (const candidate of picked) {
      const checked = checkRecordPdfFile(candidate);
      if (checked.file === null) {
        const message = checked.fileError ?? NOT_PDF_ERROR;
        if (!problems.includes(message)) problems.push(message);
        continue;
      }
      if (known.has(fileIdentity(checked.file))) continue;
      if (waiting >= MAX_BATCH_FILES) {
        skippedForLimit += 1;
        continue;
      }
      known.add(fileIdentity(checked.file));
      waiting += 1;
      const id = nextIdRef.current;
      nextIdRef.current += 1;
      filesRef.current.set(id, checked.file);
      accepted.push({
        id,
        name: checked.file.name,
        sizeText: formatFileSize(checked.file.size),
        status: "waiting",
        error: null,
        done: null,
      });
    }
    if (skippedForLimit > 0) {
      problems.push(`한 번에 ${MAX_BATCH_FILES}건까지 올려 둘 수 있습니다. ${skippedForLimit}건은 받지 않았습니다.`);
    }
    setFileError(problems.length === 0 ? null : problems.join(" "));
    if (accepted.length > 0) setEntries((list) => [...list, ...accepted]);
  }

  /**
   * 줄의 "삭제": 그 학생부를 올려 둔 목록에서 뺀다(대기·실패 줄만). 분석하는 동안에는 아무것도 하지 않는다(버튼은 aria-disabled).
   * 누른 버튼은 줄과 함께 사라진다. hadFocus(그 버튼에 초점이 있었음)이면 사라지기 전에 초점을 파일 입력란으로 옮긴다.
   */
  function removeEntry(id: number, hadFocus: boolean) {
    if (requestRef.current !== null || !filesRef.current.has(id)) return;
    if (hadFocus && fileInputRef.current !== null) {
      fileInputRef.current.focus({ preventScroll: true });
      revealDropBoxRef.current = true;
    }
    filesRef.current.delete(id);
    setEntries((list) => list.filter((entry) => entry.id !== id));
    setFileError(null);
  }

  /** 올려 둔 학생부(대기·실패)를 올려 둔 순서대로 한 건씩 분석한다. 한 건이 실패해도 다음 건으로 넘어간다. */
  async function analyze() {
    // 분석하는 동안 다시 눌러도 아무 일도 하지 않는다.
    if (requestRef.current !== null) return;
    const queue = [...filesRef.current.keys()].sort((a, b) => a - b);
    if (queue.length === 0) return;
    generationRef.current += 1;
    const generation = generationRef.current;
    const controller = new AbortController();
    requestRef.current = controller;
    /** 이 분석이 아직 유효한지: 취소되지 않았고, 그 뒤로 새 분석이나 화면 숨김이 없었는지 */
    const isCurrent = () => !controller.signal.aborted && generationRef.current === generation;
    const update = (id: number, changes: Partial<Entry>) =>
      setEntries((list) => list.map((entry) => (entry.id === id ? { ...entry, ...changes } : entry)));

    setIsAnalyzing(true);
    setFileError(null);
    // 실패했던 건은 다시 대기로 돌린다.
    setEntries((list) => list.map((entry) => (entry.status === "failed" ? { ...entry, status: "waiting", error: null } : entry)));

    // 평가 기준은 누른 순간 다시 읽은 값이다(메모리에만 둔 값 → 저장소의 값 → 기본값. 다른 탭이나 전형 준비 화면이 바꿨는데
    // 이 화면이 아직 다시 그려지지 않은 경우). 한 번에 올린 학생부는 모두 같은 기준으로 분석한다. 저장하지 않은 모집요강 초안은 쓰지 않는다.
    const prep = loadPrepCriteria();
    for (const id of queue) {
      const file = filesRef.current.get(id);
      if (file === undefined) continue;
      setProgress(null);
      update(id, { status: "working", error: null });
      try {
        // 단계가 바뀌거나 쪽을 하나 읽을 때마다 상태 글을 바꾼다. 더 이상 유효하지 않은 분석의 알림은 버린다.
        const { result, pages } = await requestAnalysis({ prepCriteria: prep, file }, controller.signal, (next) => {
          if (isCurrent()) setProgress(next);
        });
        if (!isCurrent()) return;
        // 파일 이름은 남기지 않는다(학생 이름이 들어 있는 경우가 많다). 저장소에 쓰지 못하면 메모리에만 남고 안내가 나온다(unsaved).
        const now = new Date();
        const code = addUploadedApplicant(result, now);
        if (code === null) {
          update(id, { status: "failed", error: NO_CODE_ERROR });
          continue;
        }
        // 가린 쪽 그림은 분석 결과와 따로 남긴다(IndexedDB). 남기지 못해도 그 학생부는 올린 지원자로 남는다(원문보기는 글만 보여 준다).
        const hasPages = pages !== null && (await saveRecordPages(recordPagesKey(code, now.toISOString()), pages));
        filesRef.current.delete(id);
        if (!isCurrent()) return;
        update(id, {
          status: "done",
          name: "",
          sizeText: "",
          done: {
            code,
            evidenceCount: result.evidences.length,
            assessed: assessmentFor(result, prep.elements) !== null,
            hasPages,
          },
        });
      } catch (error) {
        // 취소된 분석이나 더 이상 유효하지 않은 분석은 아무것도 바꾸지 않는다(오류 문구도 세우지 않는다).
        if (error instanceof RequestCanceledError || !isCurrent()) return;
        update(id, { status: "failed", error: error instanceof Error ? error.message : ANALYZE_ERROR });
      }
    }
    // 목록에서 빠진 올린 지원자(최근 것만 남는다)의 쪽 그림을 지운다.
    void pruneRecordPages(new Set(loadUploadedApplicants().map((item) => recordPagesKey(item.code, item.at))));
    if (!isCurrent()) return;
    focusDoneRef.current =
      filesRef.current.size === 0 && analyzeButtonRef.current !== null && document.activeElement === analyzeButtonRef.current;
    requestRef.current = null;
    setIsAnalyzing(false);
    setProgress(null);
  }

  const pending = entries.filter((entry) => entry.status === "waiting" || entry.status === "failed").length;
  const working = entries.some((entry) => entry.status === "working");
  const finished = entries.filter((entry) => entry.status === "done").length;
  const failed = entries.filter((entry) => entry.status === "failed").length;

  const rows: RecordUploadRow[] = entries.map((entry) => ({
    id: entry.id,
    title: entry.done === null ? entry.name : entry.done.code,
    sizeText: entry.sizeText,
    status: entry.status,
    statusLabel: STATUS_LABEL[entry.status],
    note:
      entry.status === "working"
        ? stageText(progress)
        : entry.status === "failed"
          ? (entry.error ?? ANALYZE_ERROR)
          : entry.done !== null
            ? doneNote(entry.done)
            : "",
    noteIsError: entry.status === "failed",
    removable: entry.status === "waiting" || entry.status === "failed",
    links:
      entry.done === null
        ? null
        : {
            evaluateHref: entry.done.assessed ? summaryPath(entry.done.code) : null,
            originalHref: applicantOriginalPath(entry.done.code),
          },
  }));

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
    rows,
    fileError,
    // 분석하는 동안에는 끌어다 놓은 파일을 받지 않으므로 상자를 강조하지 않는다.
    isDragOver: isDragOver && !isAnalyzing,
    isAnalyzing,
    /** "분석 시작" 줄을 보여 줄지: 분석할 학생부(대기·실패)가 있거나 분석하는 중일 때 */
    showAnalyze: pending > 0 || isAnalyzing,
    /** 버튼 오른쪽 상태 글 (분석하는 동안만): 몇 건 가운데 몇 건째인지 */
    statusText: isAnalyzing ? `${entries.length}건 가운데 ${Math.min(entries.length, finished + failed + (working ? 1 : 0))}건째 분석 중…` : "",
    storageNotice: unsaved ? STORAGE_NOTICE : "",
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
    /** 파일 입력란의 change: 들어온 파일을 모두 올려 둔다 (분석하는 동안에는 입력란이 막혀 있다) */
    onFileInputChange: () => {
      const picked = takeInputFiles(fileInputRef.current);
      if (requestRef.current === null) addFiles(picked);
    },
    /** 점선 상자에 끌어다 놓은 파일들을 모두 올려 둔다. 분석하는 동안에는 받지 않는다. 상자 강조는 끈다. */
    onDropFiles: (files: FileList) => {
      setIsDragOver(false);
      if (requestRef.current === null) addFiles(Array.from(files));
    },
    /** 파일을 끌고 점선 상자 위에 있음 (끄는 동안 되풀이해 불린다). 분석하는 동안에는 강조하지 않는다. */
    onDragOverBox: () => {
      if (requestRef.current === null) setIsDragOver(true);
    },
    /** 끌던 것이 점선 상자 밖으로 나감 */
    onDragLeaveBox: () => setIsDragOver(false),
    /** 줄의 "삭제". hadFocus 는 누른 버튼에 초점이 있었는지 */
    onRemoveRow: removeEntry,
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

/** 같은 파일을 두 번 올려 두지 않게 견주는 값: 이름·크기·고친 때 */
function fileIdentity(file: File): string {
  return `${file.name}\n${file.size}\n${file.lastModified}`;
}
