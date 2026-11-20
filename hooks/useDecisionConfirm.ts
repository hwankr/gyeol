import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useDecisionData } from "@/hooks/useDecisionData";
import { ADMISSION, REVIEWER_LABEL } from "@/lib/admission";
import { DECISION_CUTLINE_COMPARE_PATH, DECISION_OPINIONS_PATH, DECISION_PATH } from "@/lib/consoleMenu";
import {
  adjustCheckParts,
  adjustProgressOf,
  confirmRowsKey,
  confirmRowsOf,
  confirmStandingOf,
  cutlineCheckParts,
  evaluationCheckParts,
  sameConfirmRows,
  type DecisionConfirmation,
} from "@/lib/decision/confirm";
import {
  hasUnsavedDecisionConfirmation,
  loadDecisionConfirmation,
  saveDecisionConfirmation,
  subscribeDecisionConfirmation,
} from "@/lib/decision/confirmStorage";
import { tenthsText } from "@/lib/decision/decision";
import { DECISION_APPLICANTS, DECISION_EVALUATED_COUNT } from "@/lib/decision/sampleDecision";
import { formatSeoulDateTime } from "@/lib/koreanTime";

/** 평가를 제출한 위원 수 (예시 자료의 위원은 지원자마다 세 명이다) */
const MEMBER_COUNT = DECISION_APPLICANTS[0]?.members.length ?? 0;

/** 저장소에 쓰지 못해 메모리에만 둔 확정(또는 취소)이 있을 때의 안내 */
const STORAGE_NOTICE = "브라우저에 저장하지 못했습니다. 새로고침하면 방금 한 확정이나 취소가 사라집니다.";

/** 확정한 뒤 최종 평가나 순위가 달라졌을 때의 안내 */
const CHANGED_NOTICE =
  "확정한 뒤 최종 평가나 순위가 달라졌습니다. 명단은 확정한 때의 기록입니다. 달라진 결과로 다시 확정하려면 확정을 취소해 주세요.";

/** `확정 전 확인` 제목의 id. 확정을 취소하면 누른 버튼이 사라지므로 초점을 이 제목으로 옮긴다. */
export const CONFIRM_CHECKS_TITLE_ID = "decision-confirm-checks";

/** 확정한 기록 상자의 제목 id. 확정하면 누른 버튼이 사라지므로 초점을 이 제목으로 옮긴다. */
export const CONFIRM_RECORD_TITLE_ID = "decision-confirm-record";

/** 확정한 기록은 브라우저 저장소의 값이라 서버에서는 "아직 모름"(undefined)이다. */
function getServerConfirmation(): undefined {
  return undefined;
}

/** 서버 렌더링에서는 저장하지 못한 확정이 없다. */
function getServerUnsaved(): boolean {
  return false;
}

/** 확정한 기록의 합격선: "모집 30명 · 합격선 30위 A-0147 82.0점 · 예비 1번 A-0171 81.8점" (합격선의 두 사람이 명단에 없으면 모집 인원만) */
function recordSummary(confirmation: DecisionConfirmation): string {
  const { quota, rows } = confirmation;
  const last = rows.find((row) => row.rank === quota);
  const first = rows.find((row) => row.rank === quota + 1);
  const head = `모집 ${quota}명`;
  if (last === undefined || first === undefined) return head;
  return `${head} · 합격선 ${last.rank}위 ${last.code} ${tenthsText(last.final10)}점 · 예비 1번 ${first.code} ${tenthsText(first.final10)}점`;
}

/**
 * 선발 결정 · 기록 확정 탭 상태: 확정하기 전에 확인할 세 가지, 확인란, 확정과 확정 취소, 합격선 주변 명단.
 * - 확정 전 확인: `서류평가`(평가를 마친 지원자 수와 제출한 위원 수. 예시 자료라 늘 끝나 있다), `위원 간 점수 조정`(조정이 필요했던
 *   지원자 가운데 몇 건을 확정했는지. 위원 의견 모아보기의 수와 같다), `합격선 확인`(합격권 마지막 지원자의 순위·점수와 예비 1번과의 차이).
 *   항목마다 그것을 볼 수 있는 탭으로 가는 링크가 있다.
 * - 확인란(`선발위원 전원이 …확인했습니다`)은 조정이 남았으면 꺼져 있다. 표시는 그때의 명단(순위와 최종 평가)에 대한 것이라,
 *   표시한 뒤 조정이나 배점이 바뀌어 명단이 달라지면 풀린다.
 * - `금일 기록 최종 확정` 은 확인란에 표시했을 때만 켜진다. 누르면 화면에 보이는 명단(지원자·순위·최종 평가)을 확정한 시각·사람과 함께
 *   저장한다(lib/decision/confirmStorage.ts). 확정한 뒤에는 확정한 기록 상자(시각, 사람, 합격선, `확정 취소`)가 그 자리를 대신하고
 *   머리의 `기록 확정` 옆에 `완료` 가 붙는다(hooks/useDecisionHeader.ts).
 * - 확정한 뒤의 명단은 확정한 때의 기록이다. 그 뒤 조정이나 배점이 바뀌어 지금의 결과와 달라지면 안내가 나온다(기록은 그대로다).
 *   `확정 취소` 는 기록을 지워 다시 확인하고 확정할 수 있게 한다.
 * - 확정한 기록을 브라우저에서 읽기 전(서버 렌더링·hydration 중)에는 확인란·버튼 자리를 비워 둔다(action 이 null).
 * 확인란의 표시는 이 화면의 상태라 다른 탭에 다녀와도 남고(cacheComponents) 새로고침하면 사라진다. 확정한 기록은 남는다.
 */
export function useDecisionConfirm() {
  const { elements, ranked, cutline, adjustments } = useDecisionData();
  const stored = useSyncExternalStore<DecisionConfirmation | null | undefined>(
    subscribeDecisionConfirmation,
    loadDecisionConfirmation,
    getServerConfirmation,
  );
  const hasUnsaved = useSyncExternalStore(subscribeDecisionConfirmation, hasUnsavedDecisionConfirmation, getServerUnsaved);
  // 확인란에 표시했을 때의 명단(confirmRowsKey). 지금의 명단과 같을 때만 표시한 것으로 본다.
  const [checkedKey, setCheckedKey] = useState<string | null>(null);
  // 화면 낭독기에 알릴 글과, 확정·취소한 뒤 초점을 옮길 제목(누른 버튼이 사라진다)
  const [announcement, setAnnouncement] = useState("");
  const [focusTarget, setFocusTarget] = useState<{ id: string; turn: number } | null>(null);

  // 초점은 확정·취소한 그때 한 번만 옮긴다. 다른 화면에 다녀오면 이 화면의 effect 가 다시 돌기 때문에(cacheComponents) 이미 옮긴
  // 차례인지 적어 둔다. 그러지 않으면 돌아올 때마다 초점이 그 제목으로 다시 튄다.
  const focusedTurn = useRef(0);
  useEffect(() => {
    if (focusTarget === null || focusTarget.turn === focusedTurn.current) return;
    focusedTurn.current = focusTarget.turn;
    document.getElementById(focusTarget.id)?.focus();
  }, [focusTarget]);

  const progress = useMemo(() => adjustProgressOf(ranked, elements, adjustments), [ranked, elements, adjustments]);
  const liveRows = useMemo(() => confirmRowsOf(ranked), [ranked]);
  const liveKey = confirmRowsKey(liveRows);

  /** 확정할 수 없는 까닭 (없으면 null) */
  const blocked =
    progress.left > 0
      ? `조정이 필요한 지원자가 ${progress.left}건 남았습니다. 위원 의견 모아보기에서 조정을 확정하면 확인란에 표시할 수 있습니다.`
      : cutline === null
        ? "합격선 주변의 지원자가 없어 확정할 수 없습니다."
        : null;
  const checked = blocked === null && checkedKey === liveKey;

  const moveFocus = (id: string) => setFocusTarget((current) => ({ id, turn: (current?.turn ?? 0) + 1 }));

  const onConfirm = () => {
    if (!checked) return;
    // 다른 창에서 이미 확정했으면 그 기록을 둔다(다시 그리면서 확정한 모습이 된다).
    if (loadDecisionConfirmation() !== null) {
      setAnnouncement("이미 확정한 기록이 있습니다.");
      return;
    }
    const at = new Date().toISOString();
    saveDecisionConfirmation({ at, actor: REVIEWER_LABEL, quota: ADMISSION.quota, rows: liveRows });
    setCheckedKey(null);
    setAnnouncement(`기록을 확정했습니다. ${formatSeoulDateTime(at)} ${REVIEWER_LABEL}`);
    moveFocus(CONFIRM_RECORD_TITLE_ID);
  };

  const onCancel = () => {
    // 다른 창에서 이미 취소했으면 지울 것이 없다(알리지 않는다). 초점을 옮기면서 다시 그려 취소된 모습이 된다.
    if (loadDecisionConfirmation() !== null) {
      saveDecisionConfirmation(null);
      setAnnouncement("확정을 취소했습니다. 다시 확인하고 확정할 수 있습니다.");
    }
    moveFocus(CONFIRM_CHECKS_TITLE_ID);
  };

  // 명단: 확정했으면 확정한 때의 기록, 아니면 지금의 순위
  const listRows = stored?.rows ?? liveRows;
  const listQuota = stored?.quota ?? ADMISSION.quota;
  const standings = listRows.map((row) => confirmStandingOf(row, listQuota));

  return {
    checks: [
      {
        key: "evaluation",
        title: "서류평가",
        parts: evaluationCheckParts(DECISION_EVALUATED_COUNT, MEMBER_COUNT),
        done: true,
        link: { label: "순위 보기", href: DECISION_PATH },
      },
      {
        key: "adjust",
        title: "위원 간 점수 조정",
        parts: adjustCheckParts(progress),
        done: progress.left === 0,
        link: { label: "위원 의견 보기", href: DECISION_OPINIONS_PATH },
      },
      {
        key: "cutline",
        title: "합격선 확인",
        parts: cutlineCheckParts(cutline),
        done: cutline !== null,
        link: { label: "두 지원자 비교", href: DECISION_CUTLINE_COMPARE_PATH },
      },
    ],
    /** 확인란과 확정 버튼(open), 또는 확정한 기록(confirmed). 확정한 기록을 아직 읽지 못했으면 null 이다. */
    action:
      stored === undefined
        ? null
        : stored === null
          ? {
              kind: "open" as const,
              checked,
              /** 조정이 남았으면 확인란이 꺼져 있다 */
              checkEnabled: blocked === null,
              onCheck: (next: boolean) => setCheckedKey(next ? liveKey : null),
              canConfirm: checked,
              hint:
                blocked ??
                (checked
                  ? "확정하면 지금의 순위와 최종 평가가 기록으로 남습니다. 확정한 뒤에도 취소할 수 있습니다."
                  : "확인란에 표시하면 확정할 수 있습니다."),
              onConfirm,
            }
          : {
              kind: "confirmed" as const,
              /** "2026. 11. 21. 14:05" */
              whenText: formatSeoulDateTime(stored.at),
              actor: stored.actor,
              summary: recordSummary(stored),
              /** 확정한 뒤 결과가 달라졌을 때의 안내 (그대로면 빈 글) */
              changed: sameConfirmRows(stored.rows, liveRows) && stored.quota === ADMISSION.quota ? "" : CHANGED_NOTICE,
              onCancel,
            },
    list: {
      /** 제목 옆의 글: 줄 세운 기준, 확정했으면 확정한 기록임을 같이 적는다 */
      note: stored ? "확정한 기록 · 위원 평균 순" : "위원 평균 순",
      rows: listRows.map((row, index) => ({
        code: row.code,
        rankText: String(row.rank),
        finalText: tenthsText(row.final10),
        standing: standings[index],
        /** 이 줄 위가 합격선인지: 바로 앞 줄이 합격권이고 이 줄부터 예비다 */
        cutBefore: index > 0 && standings[index - 1].admitted && !standings[index].admitted,
      })),
      /** 합격선을 풀어 쓴 글 (화면 낭독기가 합격선 자리에서 읽는다) */
      cutlineText: `합격선 · 모집 ${listQuota}명`,
    },
    /** 화면 낭독기에 알리는 글: 방금 한 확정이나 취소 (없으면 빈 글) */
    announcement,
    /** 저장소에 쓰지 못했을 때의 안내 (없으면 빈 글) */
    alert: hasUnsaved ? STORAGE_NOTICE : "",
  };
}

/** 기록 확정 탭이 그리는 값 */
export type DecisionConfirmView = ReturnType<typeof useDecisionConfirm>;
