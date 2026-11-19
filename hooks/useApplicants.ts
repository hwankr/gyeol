import { useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { useConsoleSearch } from "@/hooks/useConsoleSearch";
import { ADMISSION } from "@/lib/admission";
import {
  APPLICANT_FILTERS,
  NO_DECISIONS,
  NO_REVIEWS,
  applicantStatus,
  competitionRate,
  displayCode,
  maskSummary,
  matchesSearch,
  reviewPercent,
  statusCounts,
  type Applicant,
  type ApplicantDecisions,
  type ApplicantFilter,
  type ApplicantReviews,
  type ApplicantStatus,
  type MaskDecision,
} from "@/lib/applicants/applicants";
import { APPLICATION_DEADLINE, deadlineRemaining, type DeadlineRemaining } from "@/lib/applicants/deadline";
import {
  hasUnsavedApplicantReviews,
  loadApplicantReviews,
  saveApplicantReview,
  subscribeApplicantReviews,
} from "@/lib/applicants/reviewStorage";
import { SAMPLE_APPLICANTS } from "@/lib/applicants/sampleApplicants";
import { NO_UPLOADED_APPLICANTS, uploadedToApplicant, type UploadedApplicant } from "@/lib/applicants/uploaded";
import { loadUploadedApplicants, subscribeUploadedApplicants } from "@/lib/applicants/uploadedStorage";
import { APPLICANTS_PATH } from "@/lib/consoleMenu";
import { sampleResult } from "@/lib/mock/sampleResult";
import { saveResult } from "@/lib/resultStorage";

// 서버 렌더링과 hydration 중에는 저장한 결정이 없는 모습으로 그린다. 그래서 서버 HTML 과 첫 클라이언트 렌더링이 같아
// hydration 경고가 나지 않고, 브라우저에서 localStorage 를 읽은 뒤 저장한 결정에 따라 상태·숫자가 바뀐다(hooks/usePrepWeights.ts 와 같은 방식).
function getServerReviews(): ApplicantReviews {
  return NO_REVIEWS;
}

function getServerUnsaved(): boolean {
  return false;
}

// 올린 지원자(업로드 화면에서 분석한 학생부)도 같은 방식이다. 서버 렌더링과 hydration 중에는 없는 모습(예시 314명)으로 그리고,
// 브라우저에서 localStorage 를 읽은 뒤 예시 지원자 뒤에 코드 순서로 더해진다.
function getServerUploaded(): readonly UploadedApplicant[] {
  return NO_UPLOADED_APPLICANTS;
}

// 접수 마감의 남은 날은 브라우저에서 화면이 뜬 뒤에 채운다(hooks/usePrepHeader.ts 의 오늘 날짜와 같은 방식).
// 서버 렌더링과 hydration 중에는 null(비움)이라 사전 렌더링에 날짜가 굳지 않고 hydration 경고가 나지 않는다.
// 화면을 열었을 때(다시 그릴 때)의 날짜이고, 자정에 저절로 바뀌지는 않는다.
function subscribeNothing(): () => void {
  return () => {};
}

let lastRemaining: DeadlineRemaining | null = null;

/** 오늘(한국 날짜) 기준 남은 날. 내용이 같으면 같은 객체를 돌려준다(useSyncExternalStore 가 같은 값으로 알아보도록). */
function getRemaining(): DeadlineRemaining {
  const next = deadlineRemaining(new Date());
  if (lastRemaining === null || JSON.stringify(lastRemaining) !== JSON.stringify(next)) lastRemaining = next;
  return lastRemaining;
}

function getServerRemaining(): null {
  return null;
}

// 화면이 준비됐는지. 서버 HTML 과 hydration 중에는 false, 브라우저에서 다시 그릴 때부터 true 다(useSyncExternalStore 의 서버 값과
// 브라우저 값). hydration 뒤 브라우저 값으로 다시 그리는 바로 그 렌더링에서 저장소(가림 결정, 올린 지원자)도 다시 읽으므로, true 가 되는
// 화면에는 저장한 결정과 올린 지원자가 이미 반영돼 있다(저장된 결정 때문에 줄이 사라지거나 선택이 옮겨 가는 첫 갱신, 올린 지원자가 나타나
// 줄 수가 바뀌는 첫 갱신과 같은 렌더링). 준비 전에는 본문을 조작할 수 없게(inert) 한다. 브라우저에서는 늘 true 라 다른 화면에
// 다녀오거나(cacheComponents) 개발 모드 StrictMode 가 effect 를 다시 돌려도 다시 false 가 되지 않는다(다시 보일 때는 그 렌더링에서
// 저장소를 다시 읽어 그린다).
function getClientReady(): boolean {
  return true;
}

function getServerReady(): boolean {
  return false;
}

/** 상세 스크롤 영역을 다음에 보일 때 맨 위부터 보여 주라는 표시 (다른 화면에 다녀와 처음 상태로 돌아갈 때) */
const DETAIL_FROM_TOP = "";

/** 로그인한 사정관 (내 배정 보기) */
const MY_NAME = ADMISSION.reviewerName;

/** 처음 걸러 보기와 내 배정 보기 */
const INITIAL_FILTER: ApplicantFilter = "확인 필요";
const INITIAL_MINE_ONLY = true;

/** 상태·결정까지 붙인 지원자 한 줄 */
type ApplicantEntry = { applicant: Applicant; status: ApplicantStatus; decisions: ApplicantDecisions };

function toEntries(applicants: readonly Applicant[], reviews: ApplicantReviews): ApplicantEntry[] {
  return applicants.map((applicant) => {
    const decisions = reviews[applicant.code] ?? NO_DECISIONS;
    return { applicant, status: applicantStatus(applicant, decisions), decisions };
  });
}

/** 보이는 줄 = 걸러 보기 ∩ 내 배정 보기 ∩ 검색 (코드 순서) */
function visibleEntries(entries: readonly ApplicantEntry[], filter: ApplicantFilter, mineOnly: boolean, query: string) {
  return entries.filter(
    ({ applicant, status }) =>
      (filter === "전체" || status === filter) &&
      (!mineOnly || applicant.assignee === MY_NAME) &&
      matchesSearch(applicant.code, query),
  );
}

/**
 * 처음 선택: 저장한 결정과 올린 지원자가 없는 처음 상태에서 보이는 첫 줄 (서버 렌더링과 같은 값).
 * 올린 지원자는 상태가 "완료" 라 처음 걸러 보기("확인 필요")에는 보이지 않으므로 이 값을 바꾸지 않는다.
 */
const INITIAL_SELECTED: string | null =
  visibleEntries(toEntries(SAMPLE_APPLICANTS, NO_REVIEWS), INITIAL_FILTER, INITIAL_MINE_ONLY, "")[0]?.applicant.code ?? null;

/** 저장소에 쓰지 못해 메모리에만 둔 결정이 있을 때의 안내 */
const STORAGE_NOTICE = "브라우저에 저장하지 못했습니다. 새로고침하면 방금 정한 내용이 사라집니다.";
/** 원문보기에서 결과(예시 지원자는 샘플 결과, 올린 지원자는 그 결과)를 sessionStorage 에 저장하지 못했을 때의 안내 */
const ORIGINAL_NOTICE = "브라우저에 결과를 저장하지 못해 원문을 열 수 없습니다.";

/** 초점을 옮긴 요소의 위아래로 함께 보여야 하는 범위(px): 초점 표시(2px 띄움 + 2px 선) 4px 와 여유 (hooks/usePrepWeights.ts 와 같은 값) */
const FOCUS_REVEAL_MARGIN = 8;

/** 마우스로 누르면 초점을 받는 것 (이것이 아닌 곳을 누르면 사람이 초점을 뗀 것으로 본다) */
const FOCUSABLE_SELECTOR = "button, a[href], input, select, textarea, [tabindex]";

/** 초점을 스크롤 없이 주고, 초점 표시까지(위아래 8px) 화면 밖이면 벗어난 만큼만 세로로 스크롤한다. */
function focusAndReveal(element: HTMLElement) {
  element.focus({ preventScroll: true });
  revealVertically(element, FOCUS_REVEAL_MARGIN);
}

/** 초점을 받을 수 있는 채로 화면에 있는지 (문서에 붙어 있고, 꺼져 있지 않고, 그려져 있음) */
function isFocusUsable(element: HTMLElement): boolean {
  return element.isConnected && !element.matches(":disabled") && element.getClientRects().length > 0;
}

/**
 * element 의 위아래 margin 까지가 화면(뷰포트, 가로 스크롤바 제외) 안에 다 보이게 한다. 이미 다 보이면 스크롤하지 않고, 위나 아래로
 * 벗어났으면 벗어난 만큼만 문서를 세로로 바로 스크롤한다(화면보다 크면 위쪽 끝을 맞춘다). scrollIntoView 는 가로로도 움직일 수 있어 쓰지 않는다.
 * hooks/usePrepWeights.ts 의 같은 이름 함수와 같은 계산이다(그 파일은 전형 준비 화면 것이라 따로 둔다).
 */
function revealVertically(element: HTMLElement, margin: number) {
  const rect = element.getBoundingClientRect();
  const viewportHeight = document.documentElement.clientHeight;
  const overTop = rect.top - margin;
  const overBottom = rect.bottom + margin - viewportHeight;
  let delta = 0;
  if (overTop < 0) delta = overTop;
  else if (overBottom > 0) delta = Math.min(overBottom, overTop);
  if (delta !== 0) window.scrollBy({ top: delta, left: 0, behavior: "instant" });
}

/**
 * 지원자 관리 화면 상태: 예시 지원자(lib/applicants/sampleApplicants.ts)와 올린 지원자(업로드 화면에서 분석한 학생부,
 * lib/applicants/uploadedStorage.ts), 저장한 가림 결정(localStorage)으로 상태·숫자를 계산하고, 걸러 보기·내 배정 보기·검색(상단 바),
 * 지원자 선택, 저장하지 않은 가림 결정, 저장, 원문보기(예시 지원자는 샘플 결과, 올린 지원자는 그 결과로 이동)를 다룬다.
 */
export function useApplicants() {
  const router = useRouter();
  const search = useConsoleSearch();
  const reviews = useSyncExternalStore(subscribeApplicantReviews, loadApplicantReviews, getServerReviews);
  const hasUnsaved = useSyncExternalStore(subscribeApplicantReviews, hasUnsavedApplicantReviews, getServerUnsaved);
  const uploaded = useSyncExternalStore(subscribeUploadedApplicants, loadUploadedApplicants, getServerUploaded);
  const remaining = useSyncExternalStore(subscribeNothing, getRemaining, getServerRemaining);
  const ready = useSyncExternalStore(subscribeNothing, getClientReady, getServerReady);
  const [filter, setFilter] = useState<ApplicantFilter>(INITIAL_FILTER);
  const [mineOnly, setMineOnly] = useState(INITIAL_MINE_ONLY);
  /** 고른 지원자 코드 (null: 보이는 줄이 없어 선택이 없음) */
  const [selectedCode, setSelectedCode] = useState<string | null>(INITIAL_SELECTED);
  /** 고른 지원자에 대해 이 화면에서 정했지만 아직 저장하지 않은 결정 (표현 id → 결정) */
  const [draft, setDraft] = useState<ApplicantDecisions>(NO_DECISIONS);
  /** 원문보기에서 샘플 결과를 저장하지 못했는지 (안내를 보여 준다. 다른 지원자를 고르거나 다시 눌러 성공하면 지운다) */
  const [originalFailed, setOriginalFailed] = useState(false);
  /** 상단 바 검색 입력란의 글 (입력 이벤트로 받는다. 입력란의 값은 DOM 이 쥐고 있다: hooks/useConsoleSearch.ts) */
  const [query, setQuery] = useState("");
  /** 상세 영역의 스크롤 영역 */
  const detailScrollRef = useRef<HTMLDivElement>(null);
  /** 저장하기 버튼, 지금 눌려 있는 걸러 보기 버튼, 고른 지원자의 코드 버튼 (초점을 옮길 때 쓴다) */
  const saveButtonRef = useRef<HTMLButtonElement>(null);
  const pressedFilterRef = useRef<HTMLButtonElement>(null);
  const selectedCodeButtonRef = useRef<HTMLButtonElement>(null);
  /** 이 화면의 내용 (현재 위치 줄, 나머지 본문). 초점이 이 화면 안에 있는지 볼 때 쓴다(상단 바의 검색 입력란은 껍데기라 밖이다). */
  const crumbNavRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  /** 다시 그린 뒤 초점을 줄 곳이 정해진 조작: 저장하기(초점이 저장하기에 있었을 때), 지원자 고르기 */
  const pendingFocusRef = useRef<"save" | "select" | null>(null);
  /** 이 화면 안에서 마지막으로 초점을 받은 컨트롤 (초점이 화면 밖으로 가거나 사람이 컨트롤이 아닌 곳을 눌러 초점을 떼면 null) */
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  /** 상세 스크롤 영역이 지금 보여 주는 지원자 (undefined: 아직 그린 적 없음, DETAIL_FROM_TOP: 다시 보일 때 맨 위부터) */
  const detailCodeRef = useRef<string | null | undefined>(undefined);
  const { inputRef, listenerRef, setInputEnabled } = search;

  // 이 화면의 수명 관리 (hooks/useGuidelineUpload.ts 와 같은 방식).
  // - 검색: 상단 바의 검색 입력란은 기본이 꺼져(disabled) 있다. 이 화면이 브라우저에서 준비되면(이 effect 가 돌면) 입력 이벤트를 받기 시작하고
  //   입력란을 켠다. 준비 전에는 입력란에 글자를 넣을 수 없으므로 준비되는 순간 읽어 올 값이 없다(입력란은 비어 있다).
  // - cacheComponents 에서는 다른 화면으로 가도 이 화면이 숨겨질 뿐 상태가 남는다. 숨겨지거나 언마운트될 때 cleanup 에서 입력 이벤트를 그만 받고
  //   입력란을 끈다. 그리고 입력란의 실제 값을 비우고 처음 상태(걸러 보기 "확인 필요", 내 배정 보기 켜짐, 검색어 없음, 처음 선택,
  //   저장하지 않은 결정 없음)로 되돌린다. 켜고 끄기와 비우기를 모두 이 화면이 하므로, 한 번도 준비되지 않은 화면은 남길 것이 없다.
  // - 개발 모드 StrictMode 는 effect 를 한 번 더 돌린다(cleanup 바로 뒤에 같은 흐름 안에서 다시 setup). 그 다시 돌리기는 처음 setup 과
  //   다른 차례(passive effect 를 처리할 때)에 올 수 있어서, 그 사이 켜진 입력란에 사람이 적은 글자나 고른 것을 지우면 안 된다.
  //   그래서 비우기·되돌리기는 이 흐름이 끝난 직후(microtask)에 하고, 그 사이 이 화면이 다시 입력 이벤트를 받기 시작했으면(StrictMode 의
  //   다시 돌리기) 하지 않는다. 끄기는 cleanup 에서 바로 하고 다시 setup 이 바로 켜므로, 같은 흐름 안에서는 켜진 채로 남는다.
  //   진짜로 숨겨질 때는 다시 받기 시작하지 않으므로 화면이 바뀌어 그려지기 전에 꺼지고 비워진다.
  // - 상세 스크롤은 다시 보일 때 맨 위부터 보여 준다(아래 "지원자를 바꾸면 맨 위로" effect 가 다시 보일 때 다시 돌며 맨 위로 돌린다).
  //   저장한 결정과 메모리에만 둔 결정(lib/applicants/reviewStorage.ts)은 되돌리지 않는다.
  // - 브라우저의 뒤로 가기 캐시(bfcache): 주소창 입력 등으로 문서 자체를 떠났다가 뒤로 가면 브라우저가 떠날 때의 문서를 그대로 되살린다.
  //   이때는 effect 가 다시 돌지 않으므로 pageshow(persisted)에서 같은 처음 상태로 되돌린다(입력란은 켜진 채 비운다). 되살린 화면이
  //   그려지기 전에 바뀌도록 flushSync 로 바로 그리고, 상세 스크롤도 맨 위로 돌린다.
  useLayoutEffect(() => {
    // 입력란은 껍데기에 하나 있고 다시 만들어지지 않는다(화면이 다시 보일 때 effect 가 다시 돌면 그때의 것을 다시 잡는다).
    const input = inputRef.current;
    function resetToInitial() {
      if (input !== null) input.value = "";
      setFilter(INITIAL_FILTER);
      setMineOnly(INITIAL_MINE_ONLY);
      setSelectedCode(INITIAL_SELECTED);
      setDraft(NO_DECISIONS);
      setOriginalFailed(false);
      setQuery("");
    }
    function onPageShow(event: PageTransitionEvent) {
      if (!event.persisted) return;
      flushSync(resetToInitial);
      if (detailScrollRef.current !== null) detailScrollRef.current.scrollTop = 0;
    }
    listenerRef.current = setQuery;
    setInputEnabled(true);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      if (listenerRef.current === setQuery) listenerRef.current = null;
      setInputEnabled(false);
      queueMicrotask(() => {
        if (listenerRef.current === setQuery) return;
        resetToInitial();
        detailCodeRef.current = DETAIL_FROM_TOP;
      });
    };
  }, [inputRef, listenerRef, setInputEnabled]);

  /** 지원자 = 예시 314명 + 올린 지원자(코드 순서). 올린 지원자에게는 가릴지 확인이 필요한 표현이 없어 저장한 결정이 붙지 않는다. */
  const applicants = useMemo(
    () => (uploaded.length === 0 ? SAMPLE_APPLICANTS : [...SAMPLE_APPLICANTS, ...uploaded.map(uploadedToApplicant)]),
    [uploaded],
  );
  const entries = useMemo(() => toEntries(applicants, reviews), [applicants, reviews]);
  const counts = useMemo(() => statusCounts(entries.map((entry) => entry.status)), [entries]);
  const visible = useMemo(() => visibleEntries(entries, filter, mineOnly, query), [entries, filter, mineOnly, query]);

  // 선택 규칙: 걸러 보기·내 배정 보기·검색·저장으로 고른 지원자가 보이지 않게 되면 보이는 첫 줄로 옮기고, 보이는 줄이 없으면 선택이 없다
  // (줄이 다시 생기면 첫 줄). 선택이 옮겨 가면 저장하지 않은 결정은 버린다. 렌더링 중에 바로 고쳐 그린다(이전 선택이 한 번도 그려지지 않는다).
  const selectedEntry = visible.find((entry) => entry.applicant.code === selectedCode);
  const nextSelectedCode = selectedEntry !== undefined ? selectedCode : (visible[0]?.applicant.code ?? null);
  if (nextSelectedCode !== selectedCode) {
    setSelectedCode(nextSelectedCode);
    setDraft(NO_DECISIONS);
    setOriginalFailed(false);
  }
  const selected = selectedEntry ?? visible[0];

  // 고른 지원자가 다른 지원자로 바뀌면(그리고 다른 화면에 다녀와 처음 상태로 다시 보일 때) 상세 영역은 맨 위부터 보여 준다.
  // 화면이 처음 뜰 때나 같은 지원자인 채 다시 그려질 때(결정 고르기, 검색어 입력, 같은 지원자가 계속 보이는 걸러 보기 바꾸기 등)는
  // 스크롤을 건드리지 않는다(사람이나 브라우저가 맞춰 둔 위치가 그대로다. 예: Tab 으로 아래쪽 버튼에 들어가 브라우저가 스크롤해 둔 경우).
  // 개발 모드 StrictMode 가 effect 를 다시 돌려도 같은 지원자라 돌리지 않는다.
  const shownCode = selected?.applicant.code ?? null;
  useLayoutEffect(() => {
    const previous = detailCodeRef.current;
    detailCodeRef.current = shownCode;
    if (previous === undefined || previous === shownCode) return;
    if (detailScrollRef.current !== null) detailScrollRef.current.scrollTop = 0;
  }, [shownCode]);

  // 초점을 어디에 둘지 (화면이 다시 그려질 때마다 한 곳에서 정한다).
  // 이 화면의 조작이나 화면 갱신(다른 탭이 저장한 결정은 다시 그릴 때 저장소를 다시 읽으며 반영된다)으로 초점이 있던 컨트롤이 사라지거나
  // 꺼지면 브라우저는 초점을 문서(body)로 보낸다. 같은 화면에 머무는 한 그렇게 두지 않고, 다시 그린 뒤 다음 순서로 초점을 준다.
  // 1. 따로 정한 곳이 있는 조작
  //    - 저장하기(초점이 저장하기에 있었을 때): 저장하면 저장하기가 꺼지거나 줄이 사라져 상세 영역이 바뀌거나 없어진다 → 상세 스크롤 영역,
  //      고른 지원자가 없으면 지금 눌려 있는 걸러 보기 버튼.
  //    - 지원자 고르기(줄의 어느 칸을 눌렀든, 코드 버튼을 눌렀든): 실제로 고른 지원자의 코드 버튼. 누른 줄이 화면 갱신으로 사라져 선택이
  //      옮겨 갔으면 옮겨 간 지원자의 것, 선택이 없어졌으면 지금 눌려 있는 걸러 보기 버튼. 마우스로 줄의 다른 칸을 눌렀을 때도 초점이
  //      문서에 남지 않는다.
  // 2. 그 밖에(안전망): 이 화면 안에서 마지막으로 초점을 받은 컨트롤이 이제 없거나 꺼졌거나 그려지지 않고 초점이 문서에 있으면(브라우저가
  //    아직 꺼진 컨트롤에 초점을 두고 있는 경우 포함) 고른 지원자의 코드 버튼, 없으면 지금 눌려 있는 걸러 보기 버튼. 경로마다 따로 처리하지
  //    않으므로 아직 찾지 못한 경로도 막는다.
  // 되돌리지 않는 경우: 사람이 컨트롤이 아닌 곳을 마우스로 눌러 초점을 뗐을 때(아래 pointerdown), 초점이 화면 밖(상단 바의 검색 입력란 등)에
  // 있을 때, 다른 화면으로 이동할 때(이 화면이 숨겨지면 effect 가 돌지 않는다), 브라우저 창·탭이 초점을 잃었을 때(document.activeElement 는
  // 그대로라 문서로 빠진 것이 아니다).
  // 초점은 스크롤 없이 준 뒤, 초점 표시까지(위아래 8px) 화면 밖이면 벗어난 만큼만 세로로 스크롤한다(가로로는 움직이지 않는다).
  // 초점 표시는 :focus-visible 규칙대로 키보드로 조작했을 때 보인다. 의존성 없이 매번 그린 뒤 확인한다.
  useLayoutEffect(() => {
    const pending = pendingFocusRef.current;
    pendingFocusRef.current = null;
    const fallback = selectedCodeButtonRef.current ?? pressedFilterRef.current;
    let target: HTMLElement | null = null;
    if (pending === "save") target = detailScrollRef.current ?? pressedFilterRef.current;
    else if (pending === "select") target = fallback;
    else {
      const last = lastFocusedRef.current;
      const active = document.activeElement;
      if (last !== null && !isFocusUsable(last) && (active === null || active === document.body || active === last)) target = fallback;
    }
    if (target !== null) focusAndReveal(target);
  });

  // 이 화면 안에서 마지막으로 초점을 받은 컨트롤을 기억한다(위 안전망이 쓴다). 초점이 화면 밖으로 가면 잊는다.
  // 사람이 컨트롤이 아닌 곳(빈 곳, 글자, 요약 카드 등)을 마우스로 눌러 초점을 떼면 잊는다(그 뒤에는 되돌리지 않는다).
  // 표의 줄을 누른 것은 지원자 고르기가 초점을 정하므로 여기서는 따로 보지 않는다. 화면이 숨겨지면 기억과 정해 둔 초점을 지운다.
  useLayoutEffect(() => {
    const inScreen = (node: Node) => crumbNavRef.current?.contains(node) === true || contentRef.current?.contains(node) === true;
    function onFocusIn(event: FocusEvent) {
      const target = event.target;
      lastFocusedRef.current = target instanceof HTMLElement && inScreen(target) ? target : null;
    }
    function onPointerDown(event: PointerEvent) {
      const control = event.target instanceof Element ? event.target.closest(FOCUSABLE_SELECTOR) : null;
      if (control === null || control.matches(":disabled")) lastFocusedRef.current = null;
    }
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("pointerdown", onPointerDown, true);
      lastFocusedRef.current = null;
      pendingFocusRef.current = null;
    };
  }, []);

  /** 표현마다 화면에 보이는 결정: 저장하지 않은 결정 → 저장한 결정 → 정하지 않음 */
  function decisionOf(entry: ApplicantEntry, expressionId: string): MaskDecision | null {
    return draft[expressionId] ?? entry.decisions[expressionId] ?? null;
  }

  const canSave =
    selected !== undefined &&
    selected.applicant.expressions.some((expression) => {
      const decision = draft[expression.id];
      return decision !== undefined && decision !== selected.decisions[expression.id];
    });

  /** 지원자 고르기 (줄의 어느 칸을 마우스로 누르거나, 코드 버튼을 키보드·마우스로 누름). 고른 뒤 초점은 고른 지원자의 코드 버튼이다. */
  function selectApplicant(code: string) {
    if (code === selected?.applicant.code) {
      // 이미 고른 지원자: 다시 그릴 것이 없으므로 바로 그 코드 버튼에 초점을 준다(줄의 다른 칸을 눌렀을 때 초점이 문서에 남지 않게).
      if (selectedCodeButtonRef.current !== null) focusAndReveal(selectedCodeButtonRef.current);
      return;
    }
    pendingFocusRef.current = "select";
    setSelectedCode(code);
    setDraft(NO_DECISIONS);
    setOriginalFailed(false);
  }

  function decide(expressionId: string, decision: MaskDecision) {
    if (selected === undefined || !selected.applicant.expressions.some((expression) => expression.id === expressionId)) return;
    setDraft((current) => ({ ...current, [expressionId]: decision }));
  }

  /** 저장하기: 저장한 결정 위에 이 화면에서 정한 결정을 덮어써 그 지원자의 결정으로 저장한다(lib/applicants/reviewStorage.ts). */
  function save() {
    if (!canSave || selected === undefined) return;
    const decisions: Record<string, MaskDecision> = {};
    for (const expression of selected.applicant.expressions) {
      const decision = draft[expression.id] ?? selected.decisions[expression.id];
      if (decision !== undefined) decisions[expression.id] = decision;
    }
    // 저장하기에 초점이 있었는지(키보드로 눌렀거나, 마우스로 누르면서 초점이 간 경우). 있었으면 저장 뒤 초점을 줄 곳이 정해진다.
    if (saveButtonRef.current !== null && document.activeElement === saveButtonRef.current) pendingFocusRef.current = "save";
    saveApplicantReview(selected.applicant.code, decisions);
    setDraft(NO_DECISIONS);
  }

  /**
   * 원문보기: 올린 지원자는 그 지원자의 분석 결과를, 예시 지원자는 학생부 원문이 없으므로 업로드 화면의 "샘플 데이터로 보기" 와 똑같이
   * 미리 만든 샘플 결과를 저장하고 결과 화면으로 간다(AI 를 부르지 않는다). 저장하지 못하면(sessionStorage 막힘 등) 빈 결과 화면으로
   * 가지 않도록 이동하지 않고 상세 영역에 안내를 보여 준다.
   */
  function openOriginal() {
    if (selected === undefined) return;
    try {
      saveResult(selected.applicant.original ?? sampleResult);
    } catch {
      setOriginalFailed(true);
      return;
    }
    setOriginalFailed(false);
    router.push("/result");
  }

  const total = entries.length;
  const done = counts["완료"];
  const percent = reviewPercent(done, total);

  return {
    applicantsPath: APPLICANTS_PATH,
    ready,
    filter,
    selectedCode: selected?.applicant.code ?? null,
    subtitle: `${ADMISSION.trackFull} · ${ADMISSION.unit} · 접수 ${total}건`,
    deadline: { label: APPLICATION_DEADLINE.label, dateText: APPLICATION_DEADLINE.dateText, remaining },
    applications: { total, quota: ADMISSION.quota, rate: competitionRate(total, ADMISSION.quota) },
    review: { percent, done, total, waiting: total - done },
    filters: APPLICANT_FILTERS.map((item) => ({ filter: item, count: counts[item], pressed: item === filter })),
    mineOnly,
    rows: visible.map(({ applicant, status, decisions }) => {
      const mask = maskSummary(applicant, decisions);
      return {
        code: applicant.code,
        displayCode: displayCode(applicant.code),
        documentSummary: applicant.documentSummary,
        documentProblem: applicant.documentProblem,
        maskText: mask.text,
        maskNeedsCheck: mask.needsCheck,
        assignee: applicant.assignee,
        status,
        selected: applicant.code === selected?.applicant.code,
      };
    }),
    detail:
      selected === undefined
        ? null
        : {
            code: selected.applicant.code,
            displayCode: displayCode(selected.applicant.code),
            status: selected.status,
            documentCounts: selected.applicant.documentCounts,
            documentNotice: selected.applicant.documentProblem
              ? `${selected.applicant.documentSummary} · 원문과 대조해 확인이 필요합니다.`
              : null,
            maskCounts: selected.applicant.maskCounts,
            expressions: selected.applicant.expressions.map((expression) => ({
              ...expression,
              decision: decisionOf(selected, expression.id),
            })),
            canSave,
          },
    // 상세 영역의 머리 아래 안내(role="alert"). 결정 저장 실패와 원문보기 실패가 함께면 두 줄이다.
    notices: [...(hasUnsaved ? [STORAGE_NOTICE] : []), ...(originalFailed && selected !== undefined ? [ORIGINAL_NOTICE] : [])],
    detailScrollRef,
    saveButtonRef,
    pressedFilterRef,
    selectedCodeButtonRef,
    crumbNavRef,
    contentRef,
    onSelectFilter: (next: ApplicantFilter) => setFilter(next),
    onToggleMine: () => setMineOnly((current) => !current),
    onSelectApplicant: selectApplicant,
    onDecide: decide,
    onSave: save,
    onOpenOriginal: openOriginal,
  };
}
