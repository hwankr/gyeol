import { useLayoutEffect, useRef, useState } from "react";
import { useEvaluationSession } from "@/hooks/useEvaluationSession";
import { EVALUATE_PATH } from "@/lib/consoleMenu";
import {
  EVALUATION_LIMITS,
  LOW_CONFIDENCE,
  MAX_CONFIDENCE,
  aiTotalOf,
  assessmentOf,
  assessmentTags,
  clampScore,
  detailPath,
  evidencesOf,
  myScoreOf,
  myTotalOf,
  questionCount,
  summaryPath,
  validAnswers,
  weightsLine,
} from "@/lib/evaluate/evaluation";
import type { EvaluationApplicant } from "@/lib/evaluate/sampleEvaluations";

/**
 * 평가하기 · 총평 화면 상태: 지원자 한 명의 학생 성장 요약, 서류 원문, 항목별 AI 점수와 근거(평가 요소 고르기), 내 평가 입력
 * (요소별 내 점수, AI 점수와 다른 요소의 수정 사유, 종합 의견, 보류·재검토 요청, 제출), 제출한 뒤의 다른 위원 의견.
 * 고친 값은 그때마다 저장된다(hooks/useEvaluationSession.ts). 제출한 평가는 잠겨 고칠 수 없다.
 */
export function useEvaluateSummary(applicant: EvaluationApplicant) {
  const session = useEvaluationSession(applicant, summaryPath);
  const { elements, record, locked, write, nextLinkRef, backLinkRef } = session;
  /** 근거를 볼 평가 요소 (없는 id 면 첫 요소) */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** 제출한 뒤 초점을 옮길 차례인지 (제출 버튼이 꺼지면서 초점이 문서로 빠지지 않게 다음 지원자 링크로 옮긴다) */
  const focusAfterSubmitRef = useRef(false);

  useLayoutEffect(() => {
    if (!focusAfterSubmitRef.current) return;
    focusAfterSubmitRef.current = false;
    (nextLinkRef.current ?? backLinkRef.current)?.focus();
  });

  const selectedIndex = Math.max(
    0,
    elements.findIndex((element) => element.id === selectedId),
  );
  const selected = elements[selectedIndex];
  const selectedAssessment = assessmentOf(applicant, selectedIndex);
  const evidences = evidencesOf(applicant, selectedIndex, elements.length);

  /** 요소마다: AI 점수, 내 점수, 수정 사유 */
  const items = elements.map((element, index) => {
    const assessment = assessmentOf(applicant, index);
    const my = myScoreOf(record, element.id, assessment.score);
    return {
      element,
      index,
      assessment,
      my,
      changed: my !== assessment.score,
      reason: record?.reasons[element.id] ?? "",
    };
  });
  const changed = items.filter((item) => item.changed);
  const missing = changed.filter((item) => item.reason.trim() === "");
  const canSubmit = !locked && missing.length === 0;

  function bump(elementId: string, current: number, delta: number) {
    const next = clampScore(current + delta);
    if (next === current) return;
    write({ scores: { ...record?.scores, [elementId]: next } });
  }

  function setReason(elementId: string, value: string) {
    write({ reasons: { ...record?.reasons, [elementId]: value.slice(0, EVALUATION_LIMITS.reasonLength) } });
  }

  function setOpinion(value: string) {
    write({ opinion: value.slice(0, EVALUATION_LIMITS.opinionLength) });
  }

  function submit() {
    if (!canSubmit) return;
    focusAfterSubmitRef.current = true;
    write({ status: "submitted" }, "평가를 제출했습니다.");
  }

  return {
    crumbs: [
      { label: "홈" },
      { label: "평가하기", href: EVALUATE_PATH },
      { label: "평가 대기 목록", href: EVALUATE_PATH },
      { label: applicant.code },
    ],
    headNote: session.headNote,
    bar: { ...session.bar, backHref: EVALUATE_PATH, backLabel: "목록" },
    growth: {
      points: applicant.growth,
      label: `학년별 성장 추이: ${applicant.growth.map((point) => `${point.grade}학년 ${point.index}`).join(", ")}. 활동 건수: ${applicant.growth
        .map((point) => `${point.grade}학년 ${point.count}건`)
        .join(", ")}`,
    },
    document: session.documentView(selectedIndex),
    basis: {
      aiTotal: aiTotalOf(applicant, elements),
      weightsText: `${session.criteriaVersion} ${weightsLine(elements)}`,
      criteria: items.map((item) => ({
        id: item.element.id,
        name: item.element.name,
        aiScore: item.assessment.score,
        flag: item.assessment.confidence <= LOW_CONFIDENCE ? "사람 확인 권장" : null,
        on: item.index === selectedIndex,
        onPick: () => setSelectedId(item.element.id),
      })),
      selectedName: selected.name,
      evidences,
      confidenceText: `신뢰도 ${selectedAssessment.confidence} / ${MAX_CONFIDENCE} · 근거 ${evidences.length}건`,
      tagsText: assessmentTags(selectedAssessment, selected),
      aiScore: selectedAssessment.score,
    },
    mine: {
      locked,
      /** 세부 평가 항목 가져오기: 요소마다 세부 항목 평가 화면으로 가는 링크와 응답 수 */
      details: items.map((item) => {
        const answered = Object.keys(validAnswers(record, item.element)).length;
        return {
          id: item.element.id,
          name: item.element.name,
          href: detailPath(applicant.code, item.element.id),
          progressText: answered === 0 ? null : `${answered} / ${questionCount(item.element)}`,
        };
      }),
      scores: items.map((item) => ({
        id: item.element.id,
        name: item.element.name,
        aiScore: item.assessment.score,
        my: item.my,
        changed: item.changed,
        // 범위 끝에서는 버튼을 끄지 않고(초점이 문서로 빠지지 않게) 눌러도 바뀌지 않게만 한다.
        atMin: item.my <= EVALUATION_LIMITS.minScore,
        atMax: item.my >= EVALUATION_LIMITS.maxScore,
        onMinus: () => bump(item.element.id, item.my, -1),
        onPlus: () => bump(item.element.id, item.my, 1),
      })),
      aiTotal: aiTotalOf(applicant, elements),
      myTotal: myTotalOf(applicant, record, elements),
      reasons: changed.map((item) => ({
        id: item.element.id,
        name: item.element.name,
        diffText: `AI ${item.assessment.score} → 내 점수 ${item.my}`,
        value: item.reason,
        missing: item.reason.trim() === "",
        onChange: (value: string) => setReason(item.element.id, value),
      })),
      reasonLimit: EVALUATION_LIMITS.reasonLength,
      opinion: record?.opinion ?? "",
      opinionLimit: EVALUATION_LIMITS.opinionLength,
      onOpinionChange: setOpinion,
      submitHint:
        locked || missing.length === 0
          ? ""
          : `${missing.map((item) => item.element.name).join(", ")} 수정 사유를 적어야 제출할 수 있습니다.`,
      canSubmit,
      submitLabel: locked ? "제출됨" : "평가 완료 제출",
      onSubmit: submit,
      marks: session.marks,
      /** 다른 위원 의견: 내 평가를 제출한 뒤에만 보인다 */
      peers: locked ? applicant.peers : null,
    },
  };
}
