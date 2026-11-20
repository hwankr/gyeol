import { useLayoutEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useDecisionData } from "@/hooks/useDecisionData";
import { useEvaluationData } from "@/hooks/useEvaluationData";
import { ADMISSION } from "@/lib/admission";
import { NO_DECISIONS, NO_REVIEWS, applicantStatus, assignedTo, type ApplicantReviews } from "@/lib/applicants/applicants";
import { loadApplicantReviews, subscribeApplicantReviews } from "@/lib/applicants/reviewStorage";
import { SAMPLE_APPLICANTS } from "@/lib/applicants/sampleApplicants";
import { NO_UPLOADED_APPLICANTS, uploadedToApplicant, type UploadedApplicant } from "@/lib/applicants/uploaded";
import { loadUploadedApplicants, subscribeUploadedApplicants } from "@/lib/applicants/uploadedStorage";
import {
  APPLICANTS_PATH,
  DECISION_OPINIONS_PATH,
  EVALUATE_PATH,
  PREP_HISTORY_PATH,
  applicantOriginalPath,
} from "@/lib/consoleMenu";
import { elementSpreadsOf, needsAdjustment } from "@/lib/decision/opinions";
import { departmentProgressOf, effectiveRecord } from "@/lib/evaluate/evaluation";
import {
  STAGE_PROGRESS_KEYS,
  currentStageIndex,
  latestWorks,
  reachedStageIndex,
  remainingUntil,
  stageDateText,
  stagePeriodText,
  stageStatuses,
  todayTextOf,
  wholePercent,
  type RecentWork,
  type StageProgressKey,
} from "@/lib/home/home";
import {
  FIRST_EVALUATION_DEADLINE,
  HOME_HEADING,
  HOME_NOTICES,
  HOME_RECENT_SEEDS,
  HOME_SCHEDULE,
  HOME_TRACKS,
  MY_TRACK_KEY,
} from "@/lib/home/sampleHome";
import { formatSeoulDateTime, seoulDateKey } from "@/lib/koreanTime";
import { NO_HISTORY, criteriaVersionLabel, type PrepHistoryEntry } from "@/lib/prep/history";
import { loadPrepHistory, subscribePrepStorage } from "@/lib/prep/storage";

// 서버 렌더링과 hydration 중에는 저장한 값이 없는 모습으로 그린다(hooks/useEvaluationData.ts 와 같은 방식). 그래서 서버 HTML 과
// 첫 클라이언트 렌더링이 같아 hydration 경고가 나지 않고, 브라우저에서 localStorage 를 읽은 뒤 저장한 값이 반영된다.
function getServerReviews(): ApplicantReviews {
  return NO_REVIEWS;
}

function getServerUploaded(): readonly UploadedApplicant[] {
  return NO_UPLOADED_APPLICANTS;
}

function getServerHistory(): readonly PrepHistoryEntry[] {
  return NO_HISTORY;
}

// 오늘 날짜는 브라우저에서 화면이 뜬 뒤에 채운다(hooks/usePrepHeader.ts 와 같은 방식). 서버 렌더링과 hydration 중에는 null 이라
// 사전 렌더링 결과에 날짜가 굳지 않는다. 화면을 열었을 때(다시 그릴 때)의 날짜이고, 자정에 저절로 바뀌지는 않는다.
function subscribeNothing(): () => void {
  return () => {};
}

/** 오늘의 한국 날짜 ("2026-11-14"). 오늘 날짜 글·일정의 상태·남은 날을 모두 이 값 하나로 만든다. */
function getTodayKey(): string {
  return seoulDateKey(new Date());
}

function getServerToday(): null {
  return null;
}

/** 로그인한 사정관 (오늘 할 일은 이 사정관의 담당 기준이다) */
const MY_NAME = ADMISSION.reviewerName;

/** 최근 작업을 몇 건까지 보여 주는지 */
const RECENT_LIMIT = 4;

/** 단계별 진행률 그래프의 막대 이름 */
const STAGE_LABEL: Record<StageProgressKey, string> = {
  arrange: "서류 정리",
  mask: "가림 확인",
  evaluate: "평가",
};

/** 그래프의 세로 눈금 (%) */
const CHART_TICKS: readonly number[] = [0, 20, 40, 60, 80, 100];

/** 지원 건수의 글: 세 자리마다 쉼표 ("3,184"). 서버와 브라우저가 같은 글을 내도록 지역을 정해 둔다. */
const COUNT_FORMAT = new Intl.NumberFormat("en-US");

/** 오늘 할 일의 건수 글: 남은 것이 없으면 "없음" */
function todoCountText(count: number): string {
  return count > 0 ? `${count}건` : "없음";
}

/**
 * 홈 화면 상태. 한 화면에서 지금 무엇을 해야 하는지와 전형이 어디까지 왔는지를 보여 준다.
 * - 제목 줄: 오늘 날짜(한국 시간)와 1차 평가 마감까지 남은 날.
 * - 전형 일정: 단계마다 오늘 기준의 상태(완료·마무리 중·진행 중·예정)와 지금 단계.
 * - 오늘 할 일: 다른 화면이 쓰는 자료 그대로 센 수다. 남은 평가(평가하기), 가림 확인이 필요한 내 담당 지원자(지원자 관리),
 *   위원 점수가 크게 갈려 조정이 필요한 지원자(선발 결정), 보류·재검토 요청을 표시해 두고 아직 제출하지 않은 평가.
 * - 최근 작업: 저장소에 시각이 남는 작업(평가 기준 저장, 학생부 분석)과 예시 작업을 최신 순으로.
 * - 진행 현황: 전형을 고르면 그 전형의 단계별 진행률과 모집 단위별 평가 진행을 보여 준다(예시 자료). 로그인한 사정관의 전형에서는
 *   내 모집 단위 줄이 평가하기의 진행 현황과 같은 값이다(내가 제출하면 같이 오른다).
 * 다른 화면에 다녀오면 고른 전형은 처음(내 전형)으로 돌아간다.
 */
export function useHome() {
  const { elements, stored, applicants, uploadedCount } = useEvaluationData();
  const { ranked, elements: decisionElements } = useDecisionData();
  const reviews = useSyncExternalStore(subscribeApplicantReviews, loadApplicantReviews, getServerReviews);
  const uploaded = useSyncExternalStore(subscribeUploadedApplicants, loadUploadedApplicants, getServerUploaded);
  const history = useSyncExternalStore(subscribePrepStorage, loadPrepHistory, getServerHistory);
  const todayKey = useSyncExternalStore(subscribeNothing, getTodayKey, getServerToday);
  const [trackKey, setTrackKey] = useState<string>(MY_TRACK_KEY);

  // cacheComponents 에서는 다른 화면으로 가도 이 화면이 숨겨질 뿐 상태가 남는다. 숨겨질 때 고른 전형을 처음으로 되돌려,
  // 돌아왔을 때 다른 화면들처럼 처음 모습이게 한다.
  useLayoutEffect(() => () => setTrackKey(MY_TRACK_KEY), []);

  /** 내 평가의 수: 배정된 전체, 제출을 마친 것, 표시(보류·재검토 요청)를 해 두고 아직 제출하지 않은 것 */
  const evaluation = useMemo(() => {
    let done = 0;
    let marked = 0;
    for (const applicant of applicants) {
      const record = effectiveRecord(applicant, stored, elements);
      if (record?.status === "submitted") done += 1;
      else if (record !== null && record.mark !== null) marked += 1;
    }
    return { total: applicants.length, done, marked };
  }, [applicants, stored, elements]);

  /** 가림 확인이 필요한 내 담당 지원자 수 (지원자 관리의 `확인 필요` 와 같은 수) */
  const maskCheckCount = useMemo(() => {
    const all = uploaded.length === 0 ? SAMPLE_APPLICANTS : [...SAMPLE_APPLICANTS, ...uploaded.map(uploadedToApplicant)];
    return assignedTo(all, MY_NAME).filter(
      (applicant) => applicantStatus(applicant, reviews[applicant.code] ?? NO_DECISIONS) === "확인 필요",
    ).length;
  }, [uploaded, reviews]);

  /** 위원 점수가 크게 갈려 조정이 필요한 지원자 수 (선발 결정의 `조정 N` 과 같은 수) */
  const adjustCount = useMemo(
    () => ranked.filter((row) => needsAdjustment(elementSpreadsOf(row, decisionElements))).length,
    [ranked, decisionElements],
  );

  const recent = useMemo(() => {
    const saved: RecentWork[] = history.map((entry) => ({
      id: `history-${entry.id}`,
      at: entry.at,
      title:
        entry.version === undefined
          ? `${ADMISSION.unit} 평가 기준 저장`
          : `${ADMISSION.unit} 평가 기준 ${criteriaVersionLabel(entry.version)} 저장`,
      href: PREP_HISTORY_PATH,
    }));
    const analyzed: RecentWork[] = uploaded.map((item) => ({
      id: `upload-${item.code}`,
      at: item.at,
      title: `${item.code} 학생부 분석`,
      href: applicantOriginalPath(item.code),
    }));
    return latestWorks([...saved, ...analyzed, ...HOME_RECENT_SEEDS], RECENT_LIMIT);
  }, [history, uploaded]);

  const statuses = todayKey === null ? null : stageStatuses(HOME_SCHEDULE, HOME_TRACKS, todayKey);
  const currentStage = statuses === null ? -1 : currentStageIndex(statuses);
  const reachedStage = statuses === null ? -1 : reachedStageIndex(statuses);

  const track = HOME_TRACKS.find((item) => item.key === trackKey) ?? HOME_TRACKS[0];
  const myTrack = track.key === MY_TRACK_KEY;
  const leftCount = evaluation.total - evaluation.done;
  const deadlineDateText = stageDateText(FIRST_EVALUATION_DEADLINE.date);

  /** 모집 단위 줄. 내 전형에서는 내 모집 단위가 맨 앞이고, 그 값은 평가하기의 "모집 단위 전체" 와 같다. */
  const units = [
    ...(myTrack
      ? [
          {
            name: ADMISSION.unit,
            ...departmentProgressOf(evaluation.done, evaluation.total),
            mineText: `내 담당 ${evaluation.total}명`,
          },
        ]
      : []),
    ...track.units.map((unit) => ({ ...unit, mineText: null })),
  ];

  const bars = STAGE_PROGRESS_KEYS.map((key) => ({ key, name: STAGE_LABEL[key], percent: track.stages[key] }));

  return {
    heading: HOME_HEADING,
    /** "오늘 2026. 11. 14. (토)". 브라우저에서 읽기 전에는 null. */
    today: todayKey === null ? null : todayTextOf(todayKey),
    deadline: {
      label: FIRST_EVALUATION_DEADLINE.label,
      remaining: todayKey === null ? null : remainingUntil(todayKey, FIRST_EVALUATION_DEADLINE.date),
    },
    stages: HOME_SCHEDULE.map((stage, index) => {
      const status = statuses?.[index] ?? null;
      return {
        key: stage.key,
        name: stage.name,
        period: stagePeriodText(stage),
        status,
        /** 기간 뒤에 적는 글: 진행 중인 단계에 마감 같은 날이 있으면 그 날, 아니면 상태. 오늘을 읽기 전에는 없다. */
        note:
          status === "진행 중" && stage.milestone !== undefined
            ? `${stage.milestone.label} ${stageDateText(stage.milestone.date)}`
            : status,
        current: index === currentStage,
        /** 다음 단계로 이어지는 줄을 짙게 그리는지 (다음 단계가 이미 시작했는지) */
        passed: index < reachedStage,
      };
    }),
    todos: [
      {
        key: "evaluate",
        title: "평가 대기",
        note: `${ADMISSION.unit} · 1차 마감 ${deadlineDateText}`,
        count: leftCount,
        href: EVALUATE_PATH,
      },
      { key: "mask", title: "가림 확인 필요", note: ADMISSION.unit, count: maskCheckCount, href: APPLICANTS_PATH },
      {
        key: "adjust",
        title: "위원 간 점수 조정",
        note: `${ADMISSION.unit} · 합격선 주변`,
        count: adjustCount,
        href: DECISION_OPINIONS_PATH,
      },
      {
        key: "marked",
        title: "보류 · 재검토 요청",
        note: `${ADMISSION.unit} · 표시해 둔 평가`,
        count: evaluation.marked,
        href: EVALUATE_PATH,
      },
    ].map(({ count, ...todo }) => ({ ...todo, countText: todoCountText(count), empty: count === 0 })),
    recent: recent.map((work) => ({
      key: work.id,
      title: work.title,
      timeText: formatSeoulDateTime(work.at),
      href: work.href,
    })),
    notices: HOME_NOTICES.map((notice) => ({
      key: notice.id,
      dateText: stageDateText(notice.date),
      title: notice.title,
      body: notice.body,
    })),
    tracks: HOME_TRACKS.map((item) => ({
      key: item.key,
      name: item.name,
      quotaText: `모집 ${item.quota}명`,
      /** 내 전형의 지원 건수에는 올린 지원자가 더해진다(다른 화면의 접수 건수와 같은 방식). */
      appliedText: COUNT_FORMAT.format(item.applied + (item.key === MY_TRACK_KEY ? uploadedCount : 0)),
      on: item.key === track.key,
      onPick: () => setTrackKey(item.key),
    })),
    chart: {
      title: `${track.name} · 단계별 진행률`,
      /** 그림의 이름: 값을 글로 풀어 쓴 것 */
      label: `${track.name} 단계별 진행률: ${bars.map((bar) => `${bar.name} ${bar.percent}%`).join(", ")}`,
      ticks: CHART_TICKS,
      bars: bars.map((bar) => ({ ...bar, valueText: `${bar.percent}%`, title: `${bar.name} ${bar.percent}%` })),
    },
    units: {
      title: `${track.name} · 모집 단위별 평가 진행`,
      rows: units.map((unit) => {
        const percent = wholePercent(unit.done, unit.total);
        return {
          key: `${track.key}-${unit.name}`,
          name: unit.name,
          mineText: unit.mineText,
          percent,
          remainText: `남은 ${unit.total - unit.done}건`,
          percentText: `${percent}%`,
        };
      }),
    },
  };
}
