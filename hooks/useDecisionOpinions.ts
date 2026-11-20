import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { rankAdjustedApplicants, useDecisionData } from "@/hooks/useDecisionData";
import {
  hasUnsavedDecisionAdjustments,
  loadDecisionAdjustments,
  saveDecisionAdjustments,
  subscribeDecisionAdjustments,
} from "@/lib/decision/adjustStorage";
import {
  adjustEffectText,
  adjustPreviewOf,
  adjustmentOf,
  draftOf,
  editDraft,
  parseScoreText,
  withAdjustment,
  withoutAdjustment,
  type AdjustDraft,
  type DecisionAdjustments,
} from "@/lib/decision/adjustments";
import { decisionMemberName, decisionSlotOf, standingText, tenthsText, type RankedApplicant } from "@/lib/decision/decision";
import { WIDE_ELEMENT_SPREAD, elementSpreadsOf, needsAdjustment } from "@/lib/decision/opinions";
import { DECISION_APPLICANTS } from "@/lib/decision/sampleDecision";
import type { PrepElement } from "@/lib/prep/criteria";

/** 걸러 보기: 조정이 필요한 지원자, 조정을 확정한 지원자, 전체 */
type OpinionFilter = "adjust" | "done" | "all";

const FILTER_LABEL: Record<OpinionFilter, string> = {
  adjust: "조정 필요",
  done: "조정 완료",
  all: "전체",
};

const FILTERS: readonly OpinionFilter[] = ["adjust", "done", "all"];

/** 저장소에 쓰지 못해 메모리에만 둔 조정이 있을 때의 안내 */
const STORAGE_NOTICE = "브라우저에 저장하지 못했습니다. 새로고침하면 방금 확정한 조정이 사라집니다.";

/** 지원자마다 고치는 중인 점수 (지원자 코드 → 입력 글). 고치지 않은 지원자는 없다. */
type Drafts = Readonly<Record<string, AdjustDraft>>;

const NO_DRAFTS: Drafts = Object.freeze({});

function withoutDraft(drafts: Drafts, code: string): Drafts {
  if (!(code in drafts)) return drafts;
  const rest = { ...drafts };
  delete rest[code];
  return rest;
}

/** 방금 확정하거나 취소한 지원자와 그때의 안내 (지원자 코드 → 글) */
type Recent = Readonly<Record<string, string>>;

const NO_RECENT: Recent = Object.freeze({});

/** 카드 제목(h2)의 id. 확정·취소한 뒤 초점을 그 카드의 제목으로 옮길 때 찾는다. */
export function opinionCardTitleId(code: string): string {
  return `opinions-card-${code}`;
}

/** 서버 렌더링에서는 저장하지 못한 조정이 없다. */
function getServerUnsaved(): boolean {
  return false;
}

/** 입력란에는 숫자만 세 자리까지 들어간다. */
function digitsOnly(text: string): string {
  return text.replace(/\D/g, "").slice(0, 3);
}

/** 원래 점수(예시 자료의 값)와 다를 때 점수 아래에 적는 글 */
function originalNote(score: number | null, original: number): string | null {
  return score === original ? null : `원래 ${original}`;
}

type CardHandlers = {
  onEdit: (code: string, base: AdjustDraft, memberIndex: number, slot: number, text: string) => void;
  onReset: (code: string) => void;
  onConfirm: (row: RankedApplicant, draft: AdjustDraft) => void;
  onCancel: (row: RankedApplicant) => void;
};

/**
 * 지원자 한 명의 카드: 위원 × 평가 요소의 점수 표, 크게 갈린 요소, 조정 상태와 할 수 있는 일.
 * - 조정 필요(needs): 저장된 점수에 크게 갈린 요소가 있다. 그 요소의 점수 칸이 입력란이 되고, 표의 종합·위원 간 차이·붉은 칸은 고치는
 *   중인 입력으로 다시 계산한 값이다(제목 줄의 붉은 글은 확정하기 전까지 저장된 점수 그대로다).
 * - 조정 완료(done): 조정을 확정했고 크게 갈린 요소가 남지 않았다. 고친 점수 아래에 원래 점수를 적는다.
 * - 해당 없음(none): 조정할 것이 없고 조정한 적도 없다.
 */
function cardView(
  row: RankedApplicant,
  elements: readonly PrepElement[],
  adjustments: DecisionAdjustments,
  draft: AdjustDraft | undefined,
  /** 이 걸러 보기에서 방금 확정하거나 취소했을 때의 안내 (없으면 undefined) */
  recent: string | undefined,
  handlers: CardHandlers,
) {
  const { applicant } = row;
  const { code } = applicant;
  // 원래 점수: 조정을 덮어쓰기 전의 예시 자료. (row 의 applicant.members 는 조정을 확정했으면 조정한 값이다.)
  const original = DECISION_APPLICANTS.find((candidate) => candidate.code === code)?.members ?? applicant.members;
  const adjusted = adjustmentOf(adjustments, code) !== undefined;
  const spreads = elementSpreadsOf(row, elements);
  const needs = needsAdjustment(spreads);
  const slots = elements.map((_, index) => decisionSlotOf(applicant, index));
  const wide = spreads.filter((item) => item.wide);
  // 고칠 수 있는 자리: 저장된 점수에서 크게 갈린 요소의 자리. 고치는 동안 차이가 줄어도 입력란은 그대로 있다.
  const editableSlots = new Set(spreads.flatMap((item, index) => (item.wide ? [slots[index]] : [])));

  const stored = draftOf(applicant.members);
  // 고치는 중인 입력은 고칠 수 있는 자리의 것만 쓴다. 고치다가 평가 요소의 수가 바뀌어 입력란이 다른 요소로 옮겨 가도,
  // 입력란이 아닌 칸은 저장된 점수 그대로 계산한다(보이는 점수와 계산에 쓰는 점수가 어긋나지 않게).
  const texts =
    needs && draft !== undefined
      ? stored.map((line, memberIndex) => line.map((text, slot) => (editableSlots.has(slot) ? (draft[memberIndex]?.[slot] ?? text) : text)))
      : stored;
  const dirty = JSON.stringify(texts) !== JSON.stringify(stored);
  const preview = adjustPreviewOf(applicant, texts, elements);
  const invalid = needs && texts.some((line) => line.some((text) => parseScoreText(text) === null));
  // 고친 요소: 원래 점수와 다른 칸이 하나라도 있는 요소 (조정을 확정한 지원자의 제목 줄에 적는다)
  const changedNames = spreads.flatMap((item, index) =>
    applicant.members.some((scores, memberIndex) => scores[slots[index]] !== original[memberIndex]?.[slots[index]]) ? [item.name] : [],
  );

  return {
    code,
    titleId: opinionCardTitleId(code),
    /** 방금 확정하거나 취소한 카드인지: 걸러 보기를 바꾸기 전까지는 걸러 본 조건에서 벗어나도 그 자리에 남는다 */
    kept: recent !== undefined,
    rankText: `${row.rank}위`,
    standingText: standingText(row),
    state: needs ? ("needs" as const) : adjusted ? ("done" as const) : ("none" as const),
    /** 크게 갈린 요소와 그 차이(저장된 점수): "잠재역량 12점 · 학업역량 14점 차이" (없으면 빈 글) */
    wideText: wide.length === 0 ? "" : `${wide.map((item) => `${item.name} ${item.spread}점`).join(" · ")} 차이`,
    /** 조정을 확정한 지원자의 고친 요소: "잠재역량 · 학업역량 점수를 고침" (없으면 빈 글) */
    adjustedText: adjusted && !needs && changedNames.length > 0 ? `${changedNames.join(" · ")} 점수를 고침` : "",
    /** 표의 요소 칸 (지금 평가 기준의 요소 순서). wide 면 그 칸을 붉게 칠한다. spreadText 는 마지막 줄의 위원 간 차이(모르면 "–") */
    columns: spreads.map((item, index) => {
      const column = preview.columns[index];
      return { id: item.id, name: item.name, wide: column.wide, spreadText: column.spread === null ? "–" : String(column.spread) };
    }),
    /** 위원 한 명씩: 이름, 종합 의견, 요소별 칸(columns 와 같은 순서), 종합 점수(모르면 "–") */
    members: applicant.members.map((scores, memberIndex) => {
      const name = decisionMemberName(memberIndex);
      const total10 = preview.memberTotal10[memberIndex];
      return {
        name,
        opinion: applicant.opinions[memberIndex] ?? "",
        cells: spreads.map((item, index) => {
          const slot = slots[index];
          const originalScore = original[memberIndex]?.[slot] ?? scores[slot];
          if (needs && editableSlots.has(slot)) {
            const value = texts[memberIndex]?.[slot] ?? "";
            const score = parseScoreText(value);
            return {
              kind: "input" as const,
              value,
              invalid: score === null,
              label: `${name} ${item.name} 점수`,
              note: originalNote(score, originalScore),
              onChange: (text: string) => handlers.onEdit(code, texts, memberIndex, slot, digitsOnly(text)),
            };
          }
          const score = scores[slot];
          return { kind: "text" as const, text: String(score), changed: score !== originalScore, note: originalNote(score, originalScore) };
        }),
        totalText: total10 === null ? "–" : tenthsText(total10),
      };
    }),
    /** 위원별 종합 점수의 차이 (모르면 "–") */
    totalSpreadText: preview.spread10 === null ? "–" : tenthsText(preview.spread10),
    /** 카드 아래의 줄: 안내 글과 버튼. 조정할 것도 조정한 것도 없으면 null 이다. */
    action:
      needs || adjusted
        ? {
            // 방금 확정·취소한 카드는 달라진 최종 평가와 순위를 알린다(다시 고치기 시작하면 고치는 법의 안내로 돌아간다).
            hint: !needs
              ? (recent ?? "조정을 확정한 지원자입니다. 취소하면 원래 점수로 돌아갑니다.")
              : invalid
                ? "점수는 0~100 사이의 정수로 적어 주세요."
                : preview.members !== null
                  ? "확정하면 고친 점수로 최종 평가와 순위를 다시 계산합니다."
                  : !dirty && recent !== undefined
                    ? recent
                    : `붉은 칸의 점수를 고쳐 위원 간 차이를 모두 ${WIDE_ELEMENT_SPREAD}점 미만으로 맞추면 확정할 수 있습니다.`,
            /** 조정 확정 (조정이 필요한 지원자만. 크게 갈린 요소가 남았거나 입력이 틀리면 꺼져 있다) */
            confirm: needs ? { enabled: preview.members !== null, onConfirm: () => handlers.onConfirm(row, texts) } : null,
            /** 되돌리기: 고치는 중인 입력을 버린다 (고친 것이 있을 때만) */
            reset: dirty ? { onReset: () => handlers.onReset(code) } : null,
            /** 조정 취소: 확정한 조정을 지우고 원래 점수로 돌아간다 (확정한 조정이 있을 때만) */
            cancel: adjusted ? { onCancel: () => handlers.onCancel(row) } : null,
          }
        : null,
  };
}

/**
 * 선발 결정 · 위원 의견 모아보기 탭 상태: 합격선 주변 지원자마다 위원들의 요소별 점수·종합 점수·종합 의견을 표 하나로 모으고,
 * 위원 점수가 크게 갈린 요소(차이 10점 이상)를 가려 표시한다. 그 요소의 점수를 고쳐 차이를 줄이고 조정을 확정한다. 카드는 순위 순서다.
 * - 걸러 보기: `조정 필요`(크게 갈린 요소가 있는 지원자. 머리의 `조정 N` 과 같은 수), `조정 완료`(조정을 확정한 지원자), `전체`.
 *   처음에는 `조정 필요` 다.
 * - 조정: 조정이 필요한 지원자의 카드에서 크게 갈린 요소의 점수 칸이 입력란이다(0~100 정수). 고치는 동안 표의 종합·위원 간 차이·
 *   붉은 칸이 바로 다시 계산된다. 크게 갈린 요소가 남지 않으면 `조정 확정` 이 켜지고, 누르면 조정한 위원 점수를 저장한다
 *   (lib/decision/adjustStorage.ts). 선발 결정의 최종 평가·순위·`조정 N` 이 조정한 점수로 다시 계산된다(hooks/useDecisionData.ts).
 *   `되돌리기` 는 고치는 중인 입력을 버리고, `조정 취소` 는 확정한 조정을 지워 원래 점수로 돌아간다.
 * - 확정하거나 취소하면 무엇이 달라졌는지(최종 평가, 순위)를 그 카드의 안내 글에 적고 화면 낭독기에 알린다. 그 카드는 걸러 본 조건에서
 *   벗어나도 걸러 보기를 바꾸기 전까지 그 자리에 남는다(누르자마자 사라지지 않게. 순위가 바뀌면 자리는 순위를 따라 옮겨 간다).
 *   누른 버튼이 사라지므로 초점은 그 카드의 제목으로 옮긴다.
 * - 조정을 저장소에 쓰지 못하면 이 페이지의 메모리에만 남고(새로고침하면 사라진다) 위 줄 아래에 안내가 나온다.
 * 걸러 보기와 고치는 중인 입력은 이 화면의 상태라 다른 탭에 다녀와도 남고(cacheComponents) 새로고침하면 사라진다. 확정한 조정은 남는다.
 */
export function useDecisionOpinions() {
  const { elements, ranked, adjustments } = useDecisionData();
  const hasUnsaved = useSyncExternalStore(subscribeDecisionAdjustments, hasUnsavedDecisionAdjustments, getServerUnsaved);
  const [filter, setFilter] = useState<OpinionFilter>("adjust");
  const [drafts, setDrafts] = useState<Drafts>(NO_DRAFTS);
  // 이 걸러 보기에서 방금 확정하거나 취소한 지원자와 그때의 안내(지원자 코드 → 글). 걸러 보기를 바꾸면 비운다.
  const [recent, setRecent] = useState<Recent>(NO_RECENT);
  // 화면 낭독기에 알릴 글과, 확정·취소한 뒤 초점을 옮길 카드(누른 버튼이 사라지므로 그 카드의 제목으로 옮긴다)
  const [announcement, setAnnouncement] = useState("");
  const [focusTarget, setFocusTarget] = useState<{ code: string; turn: number } | null>(null);

  useEffect(() => {
    if (focusTarget !== null) document.getElementById(opinionCardTitleId(focusTarget.code))?.focus();
  }, [focusTarget]);

  const handlers = useMemo<CardHandlers>(() => {
    // 고치던 입력을 버리고 초점을 그 카드의 제목으로 옮긴다(되돌리기·조정 확정·조정 취소는 누르면 그 버튼이 사라진다).
    const leaveDraft = (code: string) => {
      setDrafts((current) => withoutDraft(current, code));
      setFocusTarget((current) => ({ code, turn: (current?.turn ?? 0) + 1 }));
    };
    // 확정·취소는 누르는 순간의 저장 값에서 고친다(이 화면을 그릴 때의 값이 아니라). 다른 탭에서 확정한 조정을 지우지 않는다.
    const store = (row: RankedApplicant, next: DecisionAdjustments, done: string) => {
      const { code } = row.applicant;
      saveDecisionAdjustments(next);
      const after = rankAdjustedApplicants(next, elements).find((candidate) => candidate.applicant.code === code);
      const text = after === undefined ? done : `${done} ${adjustEffectText(row, after)}`;
      setRecent((current) => ({ ...current, [code]: text }));
      setAnnouncement(`${code} ${text}`);
      leaveDraft(code);
    };
    return {
      onEdit: (code, base, memberIndex, slot, text) =>
        setDrafts((current) => ({ ...current, [code]: editDraft(current[code] ?? base, memberIndex, slot, text) })),
      onReset: leaveDraft,
      onConfirm: (row, draft) => {
        const members = adjustPreviewOf(row.applicant, draft, elements).members;
        if (members === null) return;
        store(row, withAdjustment(loadDecisionAdjustments(), { code: row.applicant.code, members }), "조정을 확정했습니다.");
      },
      onCancel: (row) => {
        const current = loadDecisionAdjustments();
        const next = withoutAdjustment(current, row.applicant.code);
        if (next !== current) store(row, next, "조정을 취소해 원래 점수로 되돌렸습니다.");
      },
    };
  }, [elements]);

  const cards = useMemo(
    () => ranked.map((row) => cardView(row, elements, adjustments, drafts[row.applicant.code], recent[row.applicant.code], handlers)),
    [ranked, elements, adjustments, drafts, recent, handlers],
  );
  const counts: Record<OpinionFilter, number> = {
    adjust: cards.filter((card) => card.state === "needs").length,
    done: cards.filter((card) => card.state === "done").length,
    all: cards.length,
  };
  // 방금 확정·취소한 카드는 걸러 본 조건에서 벗어나도 그 자리에 남긴다(누르자마자 사라지지 않게). 옆의 수는 조건에 맞는 지원자만 센다.
  const shown =
    filter === "all" ? cards : cards.filter((card) => card.kept || card.state === (filter === "adjust" ? "needs" : "done"));

  return {
    filters: FILTERS.map((key) => ({
      key,
      label: FILTER_LABEL[key],
      count: counts[key],
      on: key === filter,
      onPick: () => {
        setFilter(key);
        setRecent(NO_RECENT);
      },
    })),
    /** 붉게 칠한 칸의 뜻과 조정이 필요하다고 보는 기준 */
    note: `위원 점수가 ${WIDE_ELEMENT_SPREAD}점 이상 갈린 평가 요소입니다. 하나라도 있으면 조정이 필요한 지원자입니다.`,
    /** 화면 낭독기에 알리는 글: 방금 확정하거나 취소한 조정과 달라진 최종 평가·순위 (없으면 빈 글. 화면에는 그 카드에 적는다) */
    announcement,
    /** 저장소에 쓰지 못했을 때의 안내 (없으면 빈 글) */
    alert: hasUnsaved ? STORAGE_NOTICE : "",
    /** 평가 요소의 수 (표의 요소 칸 수. 카드의 가장 좁은 폭을 정하는 데 쓴다) */
    columnCount: elements.length,
    cards: shown,
    /** 카드가 없을 때의 안내 (걸러 본 목록이 비었을 때) */
    empty: emptyView(filter, cards.length, counts.done),
  };
}

/** 걸러 본 목록이 비었을 때의 안내 */
function emptyView(filter: OpinionFilter, total: number, doneCount: number): { title: string; text: string } {
  if (total === 0) return { title: "지원자가 없습니다.", text: "평가를 마친 지원자가 생기면 위원 의견이 여기에 모입니다." };
  if (filter === "done") {
    return { title: "확정한 조정이 없습니다.", text: "조정 필요에서 붉은 칸의 점수를 고쳐 조정을 확정하면 여기에 모입니다." };
  }
  return {
    title: "조정이 필요한 지원자가 없습니다.",
    text:
      doneCount > 0
        ? "조정을 모두 확정했습니다. 조정 완료를 누르면 확정한 조정을 볼 수 있습니다."
        : `위원 점수가 ${WIDE_ELEMENT_SPREAD}점 이상 갈린 평가 요소가 없습니다. 전체를 누르면 모든 지원자의 위원 의견을 볼 수 있습니다.`,
  };
}

/** 위원 의견 모아보기 탭이 그리는 값 */
export type DecisionOpinionsView = ReturnType<typeof useDecisionOpinions>;

/** 지원자 한 명의 카드 */
export type DecisionOpinionsCard = DecisionOpinionsView["cards"][number];
