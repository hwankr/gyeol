import { useRef, useState } from "react";
import { useEvaluationData } from "@/hooks/useEvaluationData";
import { ADMISSION } from "@/lib/admission";
import {
  EMPTY_EVALUATION,
  documentAreasOf,
  effectiveRecord,
  evaluateOriginalPath,
  evaluationBasis,
  evaluationStatus,
  evidenceSlotCount,
  evidenceSlotsOf,
  passageSource,
  passagesIn,
  queuePosition,
  slotOf,
  type EvaluationMark,
  type EvaluationRecord,
} from "@/lib/evaluate/evaluation";
import { updateEvaluation } from "@/lib/evaluate/evaluationStorage";
import { INITIAL_DOCUMENT_AREA, type DocumentArea, type EvaluationApplicant } from "@/lib/evaluate/sampleEvaluations";

/** 저장소에 쓰지 못했을 때의 안내 (이 페이지의 메모리에는 남아 있다) */
const UNSAVED_NOTE = "브라우저 저장소에 쓰지 못했습니다. 이 탭을 닫으면 지금 내용이 사라집니다.";

const MARKS: readonly { key: EvaluationMark; label: string; onNote: string; offNote: string }[] = [
  { key: "hold", label: "보류", onNote: "보류로 표시했습니다.", offNote: "보류 표시를 풀었습니다." },
  { key: "recheck", label: "재검토 요청", onNote: "재검토를 요청했습니다.", offNote: "재검토 요청을 거두었습니다." },
];

/** 원문의 조각이 어떻게 보이는지: 지금 고른 평가 요소의 근거 / 다른 요소의 근거 / 근거 아님 */
export type SegmentEmphasis = "selected" | "other" | "none";

/**
 * 총평 화면과 세부 항목 평가 화면이 같이 쓰는 지원자 한 명의 평가 상태: 지금 평가(저장한 평가 또는 처음 상태), 고치기(쓸 때마다 저장),
 * 임시저장, 보류·재검토 요청 표시, 가림 누락 신고, 서류 원문(서류 구분 고르기, 근거 강조), 원문보기 화면의 주소, 평가 순서의 앞뒤 지원자.
 * 지원자가 바뀌면 이 훅을 쓰는 컴포넌트를 새로 그린다(key). 그래서 안내 글·서류 구분은 지원자마다 처음 상태로 시작한다.
 * pathOf 는 앞뒤 지원자로 갈 주소를 만든다(총평은 총평으로, 세부 항목 평가는 같은 평가 요소의 세부 항목 평가로).
 */
export function useEvaluationSession(applicant: EvaluationApplicant, pathOf: (code: string) => string) {
  const { elements, criteriaVersion, stored, unsaved, applicants } = useEvaluationData();
  const record = effectiveRecord(applicant, stored, elements);
  const locked = record?.status === "submitted";
  /** 방금 한 일의 안내 ("방금 임시 저장했습니다." 등). 다른 것을 고치면 지운다. */
  const [note, setNote] = useState("");
  const [area, setArea] = useState<DocumentArea>(INITIAL_DOCUMENT_AREA);
  /** 앞뒤 지원자로 가는 링크 (제출한 뒤 초점을 옮길 곳) */
  const nextLinkRef = useRef<HTMLAnchorElement>(null);
  const backLinkRef = useRef<HTMLAnchorElement>(null);

  /**
   * 평가를 고쳐 쓴다. 제출한 평가는 잠겨 있어 고치지 않는다(false). 고치면 상태는 "평가 중" 이 된다(changes 에 상태가 있으면 그 상태).
   * 평가가 아직 없는 지원자("대기")는 이때 평가가 생긴다. 안내 글은 nextNote 로 바꾼다(없으면 지운다).
   */
  function write(changes: Partial<EvaluationRecord>, nextNote = ""): boolean {
    if (locked) return false;
    updateEvaluation(applicant.code, {
      ...(record ?? EMPTY_EVALUATION),
      status: "editing",
      ...changes,
      basis: evaluationBasis(applicant, elements),
    });
    setNote(nextNote);
    return true;
  }

  function saveDraft() {
    write({ status: "draft" }, "방금 임시 저장했습니다.");
  }

  /** 보류·재검토 요청: 같은 것을 다시 누르면 풀리고, 다른 것을 누르면 그것으로 바뀐다. */
  function toggleMark(mark: EvaluationMark) {
    const definition = MARKS.find((item) => item.key === mark);
    if (definition === undefined) return;
    const on = record?.mark === mark;
    write({ mark: on ? null : mark }, on ? definition.offNote : definition.onNote);
  }

  /**
   * 가림 누락 신고: 제출한 뒤에도 할 수 있어야 하므로 잠금과 상관없이 쓰고 상태는 그대로 둔다.
   * 평가가 아직 없는 지원자("대기")는 신고를 적어 둘 평가가 이때 생기므로 "평가 중" 이 된다.
   */
  function toggleMaskReport() {
    const base = record ?? EMPTY_EVALUATION;
    const reported = !base.maskReported;
    updateEvaluation(applicant.code, { ...base, maskReported: reported, basis: evaluationBasis(applicant, elements) });
    setNote(reported ? "가림 누락을 신고했습니다." : "가림 누락 신고를 거두었습니다.");
  }

  const queue = queuePosition(applicants, applicant.code);
  const mark = MARKS.find((item) => item.key === record?.mark);

  /**
   * 서류 원문: 고른 서류 구분의 원문과 조각마다의 강조. highlightIndex 는 근거를 강조할 평가 요소의 순번이다.
   * 조각이 여러 요소의 근거면(올린 지원자의 겹친 구절) 지금 요소가 그 가운데 있을 때 "selected", 없으면 "other" 다.
   */
  function documentView(highlightIndex: number) {
    const selectedSlot = slotOf(applicant, highlightIndex);
    const slotLimit = evidenceSlotCount(applicant, elements.length);
    return {
      areas: documentAreasOf(applicant).map((item) => ({ area: item, on: item === area, onPick: () => setArea(item) })),
      passages: passagesIn(applicant, area).map((passage) => ({
        id: passage.id,
        source: passageSource(passage),
        segments: passage.segments.map((segment, index) => {
          const slots = evidenceSlotsOf(segment, slotLimit);
          const emphasis: SegmentEmphasis = slots.length === 0 ? "none" : slots.includes(selectedSlot) ? "selected" : "other";
          return { key: `${passage.id}-${index}`, text: segment.text, emphasis };
        }),
      })),
      maskReported: record?.maskReported === true,
      onToggleMaskReport: toggleMaskReport,
      // 원문보기 화면(/evaluate/original). 올린 지원자는 그 학생부의 분석 결과를, 예시 지원자는 미리 만든 샘플 결과를 보여 준다.
      originalHref: evaluateOriginalPath(applicant.code),
    };
  }

  return {
    elements,
    criteriaVersion,
    record,
    locked,
    note,
    write,
    nextLinkRef,
    backLinkRef,
    /** 제목 옆의 글: 전형 · 모집 단위 */
    headNote: `${ADMISSION.trackFull} · ${ADMISSION.unit}`,
    /** 지원자 줄: 코드, 한 줄 요약, 상태, 표시, 안내 글, 평가 순서, 앞뒤 지원자, 임시저장 */
    bar: {
      code: applicant.code,
      summary: applicant.summary,
      status: evaluationStatus(record),
      markLabel: mark?.label ?? null,
      note: unsaved ? UNSAVED_NOTE : note,
      noteIsWarning: unsaved,
      positionText: `${queue.position} / ${queue.total}`,
      previousHref: queue.previous === null ? null : pathOf(queue.previous),
      nextHref: queue.next === null ? null : pathOf(queue.next),
      nextLinkRef,
      backLinkRef,
      locked,
      onSaveDraft: saveDraft,
    },
    /** 보류·재검토 요청 버튼 */
    marks: MARKS.map((item) => ({
      key: item.key,
      label: item.label,
      on: record?.mark === item.key,
      onToggle: () => toggleMark(item.key),
    })),
    documentView,
  };
}
