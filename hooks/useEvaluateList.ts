import { useLayoutEffect, useMemo, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { useConsoleSearch } from "@/hooks/useConsoleSearch";
import { useEvaluationData } from "@/hooks/useEvaluationData";
import { ADMISSION } from "@/lib/admission";
import { SAMPLE_APPLICANT_COUNT } from "@/lib/applicants/sampleApplicants";
import { NO_UPLOADED_APPLICANTS, type UploadedApplicant } from "@/lib/applicants/uploaded";
import { loadUploadedApplicants, subscribeUploadedApplicants } from "@/lib/applicants/uploadedStorage";
import { EVALUATE_PATH } from "@/lib/consoleMenu";
import {
  effectiveRecord,
  evaluationStatus,
  matchesEvaluationSearch,
  myTotalOf,
  percentText,
  summaryPath,
  type EvaluationStatus,
} from "@/lib/evaluate/evaluation";
import {
  DEPARTMENT_PROGRESS,
  EVALUATION_APPLICANTS,
  EVALUATION_DEADLINE_TEXT,
  PEER_PROGRESS,
} from "@/lib/evaluate/sampleEvaluations";

/** 목록 구분: 평가 대기 목록(배정된 전체, 남은 평가가 먼저) / 남은 평가 / 제출 완료 */
export type EvaluateListTab = "queue" | "left" | "done";

const TABS: readonly { key: EvaluateListTab; label: string }[] = [
  { key: "queue", label: "평가 대기 목록" },
  { key: "left", label: "남은 평가" },
  { key: "done", label: "제출 완료" },
];

/** 내 점수 정렬: 안 함 → 높은 순 → 낮은 순 → 안 함 */
type SortMode = "none" | "desc" | "asc";

const NEXT_SORT: Record<SortMode, SortMode> = { none: "desc", desc: "asc", asc: "none" };
const SORT_MARK: Record<SortMode, string> = { none: "↕", desc: "↓", asc: "↑" };
const SORT_TEXT: Record<SortMode, string> = { none: "정렬 안 함", desc: "높은 순", asc: "낮은 순" };

const INITIAL_TAB: EvaluateListTab = "queue";
const INITIAL_SORT: SortMode = "none";

/** 상단 바 검색 입력란의 안내 글자 (디자인 그대로) */
const SEARCH_LABEL = "지원자 코드 또는 요약 검색";

/** 학생부를 올려 분석하는 화면 (디자인에는 없지만 그 화면으로 가는 길이 여기뿐이라 목록 구분 줄 끝에 링크를 둔다) */
const UPLOAD_PATH = "/upload";

function getServerUploaded(): readonly UploadedApplicant[] {
  return NO_UPLOADED_APPLICANTS;
}

/** 목록 한 줄 */
type Row = {
  code: string;
  summary: string;
  /** 내 종합 점수 (평가를 시작하지 않았으면 null) */
  score: number | null;
  status: EvaluationStatus;
  submitted: boolean;
};

/**
 * 평가하기 · 평가 대기 목록 화면 상태: 배정된 지원자 24명(lib/evaluate/sampleEvaluations.ts)과 저장한 내 평가(localStorage)로 상태·내 점수·
 * 진행 현황을 계산하고, 목록 구분·내 점수 정렬·검색(상단 바)·진행 현황에서 볼 사람 고르기를 다룬다.
 * 내 점수는 전형 준비에서 저장한 배점으로 가중 평균한 값이라 배점을 바꾸면 같이 바뀐다.
 */
export function useEvaluateList() {
  const search = useConsoleSearch();
  const { elements, stored } = useEvaluationData();
  const uploaded = useSyncExternalStore(subscribeUploadedApplicants, loadUploadedApplicants, getServerUploaded);
  const [tab, setTab] = useState<EvaluateListTab>(INITIAL_TAB);
  const [sort, setSort] = useState<SortMode>(INITIAL_SORT);
  /** 진행 현황에서 고른 사람의 순번 (null: 모집 단위 전체) */
  const [who, setWho] = useState<number | null>(null);
  /** 상단 바 검색 입력란의 글 (입력 이벤트로 받는다. 입력란의 값은 DOM 이 쥐고 있다: hooks/useConsoleSearch.ts) */
  const [query, setQuery] = useState("");
  const { inputRef, listenerRef, setInputEnabled } = search;

  // 이 화면의 수명 관리 (hooks/useApplicants.ts 와 같은 방식. 자세한 까닭은 그 파일의 설명을 본다).
  // - 화면이 브라우저에서 준비되면 상단 바의 검색 입력란을 켜고 입력 이벤트를 받는다.
  // - cacheComponents 에서는 다른 화면으로 가도 이 화면이 숨겨질 뿐 상태가 남는다. 숨겨지거나 없어질 때 입력란을 끄고 실제 값을 비우며
  //   처음 상태(평가 대기 목록, 정렬 안 함, 전체 진행 현황, 검색어 없음)로 되돌린다. 비우기·되돌리기는 이 흐름이 끝난 직후(microtask)에 하고,
  //   그 사이 다시 입력 이벤트를 받기 시작했으면(개발 모드 StrictMode 의 다시 돌리기) 하지 않는다.
  // - 브라우저의 뒤로 가기 캐시(bfcache)로 되살아난 문서는 effect 가 다시 돌지 않으므로 pageshow(persisted)에서 같은 처음 상태로 되돌린다.
  useLayoutEffect(() => {
    const input = inputRef.current;
    function resetToInitial() {
      if (input !== null) input.value = "";
      setTab(INITIAL_TAB);
      setSort(INITIAL_SORT);
      setWho(null);
      setQuery("");
    }
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) flushSync(resetToInitial);
    }
    listenerRef.current = setQuery;
    setInputEnabled(true, SEARCH_LABEL);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      if (listenerRef.current === setQuery) listenerRef.current = null;
      setInputEnabled(false);
      queueMicrotask(() => {
        if (listenerRef.current === setQuery) return;
        resetToInitial();
      });
    };
  }, [inputRef, listenerRef, setInputEnabled]);

  /** 배정된 지원자 전체 (평가 순서 = 코드 순서) */
  const all = useMemo<Row[]>(
    () =>
      EVALUATION_APPLICANTS.map((applicant) => {
        const record = effectiveRecord(applicant, stored, elements);
        return {
          code: applicant.code,
          summary: applicant.summary,
          score: record === null ? null : myTotalOf(applicant, record, elements),
          status: evaluationStatus(record),
          submitted: record?.status === "submitted",
        };
      }),
    [stored, elements],
  );
  const left = useMemo(() => all.filter((row) => !row.submitted), [all]);
  const done = useMemo(() => all.filter((row) => row.submitted), [all]);

  const rows = useMemo(() => {
    // 평가 대기 목록은 남은 평가를 먼저, 제출을 마친 것을 그 뒤에 둔다(각각 코드 순서).
    const base = tab === "left" ? left : tab === "done" ? done : [...left, ...done];
    const matched = base.filter((row) => matchesEvaluationSearch(row, query));
    if (sort === "none") return matched;
    const direction = sort === "desc" ? -1 : 1;
    // 점수가 없는 줄("대기")은 어느 쪽으로 정렬하든 맨 뒤다. 점수가 같으면 원래 순서를 지킨다(Array.prototype.sort 는 안정 정렬이다).
    return [...matched].sort((a, b) => {
      if (a.score === null || b.score === null) return Number(a.score === null) - Number(b.score === null);
      return direction * (a.score - b.score);
    });
  }, [tab, left, done, query, sort]);

  /** 진행 현황: 나, 다른 위원 둘, 모집 단위 전체 */
  const people = [
    { name: `${ADMISSION.reviewerName} ${ADMISSION.reviewerRole} (나)`, ringName: `${ADMISSION.reviewerName} ${ADMISSION.reviewerRole}`, done: done.length, total: all.length },
    ...PEER_PROGRESS.map((peer) => ({ ...peer, ringName: peer.name })),
  ];
  const department = {
    name: `${ADMISSION.unit} 전체`,
    done: DEPARTMENT_PROGRESS.othersDone + done.length,
    total: DEPARTMENT_PROGRESS.total,
  };
  const shown = who === null ? department : (people[who] ?? department);
  const shownPercent = percentText(shown.done, shown.total);

  const counts: Record<EvaluateListTab, number | null> = { queue: null, left: left.length, done: done.length };
  const currentTab = TABS.find((item) => item.key === tab) ?? TABS[0];

  return {
    crumbs: [{ label: "홈" }, { label: "평가하기", href: EVALUATE_PATH }, { label: currentTab.label }],
    /** 제목 옆의 글: 전형 · 모집 단위 · 접수 건수 (예시 지원자 + 올린 지원자) */
    note: `${ADMISSION.trackFull} · ${ADMISSION.unit} · 접수 ${SAMPLE_APPLICANT_COUNT + uploaded.length}건`,
    tabs: TABS.map((item) => ({
      key: item.key,
      label: item.label,
      count: counts[item.key],
      on: item.key === tab,
      onPick: () => setTab(item.key),
    })),
    uploadPath: UPLOAD_PATH,
    sort: {
      mark: SORT_MARK[sort],
      active: sort !== "none",
      label: `내 점수로 정렬, 현재 ${SORT_TEXT[sort]}`,
      onToggle: () => setSort(NEXT_SORT[sort]),
    },
    rows: rows.map((row) => ({
      code: row.code,
      href: summaryPath(row.code),
      summary: row.summary,
      scoreText: row.score === null ? "–" : String(row.score),
      status: row.status,
    })),
    progress: {
      /** 고리 그림: 고른 사람(또는 전체)의 완료 비율 */
      ringLabel: who === null || people[who] === undefined ? "전체 평가 완료" : `${people[who].ringName} 평가 완료`,
      ringPercentText: `${shownPercent}%`,
      ringAriaLabel: `${shown.name} 평가 완료 ${shownPercent}%`,
      ringFraction: shown.total > 0 ? shown.done / shown.total : 0,
      people: [
        ...people.map((person, index) => ({ ...person, key: `person-${index}`, on: who === index, onPick: () => setWho(index) })),
        { ...department, key: "department", on: who === null || people[who] === undefined, onPick: () => setWho(null) },
      ].map((person) => ({
        key: person.key,
        name: person.name,
        countText: `${person.done} / ${person.total}`,
        percent: person.total > 0 ? (person.done / person.total) * 100 : 0,
        on: person.on,
        onPick: person.onPick,
      })),
      deadlineText: EVALUATION_DEADLINE_TEXT,
    },
  };
}
