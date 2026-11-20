import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useEvaluationDocument } from "@/hooks/useEvaluationDocument";
import { useEvaluationSession } from "@/hooks/useEvaluationSession";
import { EVALUATE_PATH, HOME_CRUMB } from "@/lib/consoleMenu";
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

/** 학생 성장 요약 그림에서 건수 막대 눈금의 끝 (디자인 값) */
const GROWTH_COUNT_MAX = 5;

/** 근거 문장 목록을 스크롤할 때 고른 근거 문장 위에 남기는 여백(px): 그 문장의 출처 줄이 보일 만큼 */
const EVIDENCE_LIST_MARGIN = 32;

/**
 * 평가하기 · 총평 화면 상태: 지원자 한 명의 학생 성장 요약, 서류 원문, 항목별 AI 점수와 근거(평가 요소 고르기), 내 평가 입력
 * (요소별 내 점수, AI 점수와 다른 요소의 수정 사유, 종합 의견, 보류·재검토 요청, 제출), 제출한 뒤의 다른 위원 의견.
 * 고친 값은 그때마다 저장된다(hooks/useEvaluationSession.ts). 제출한 평가는 잠겨 고칠 수 없다.
 * 근거 문장을 누르면 서류 원문(올린 지원자는 실제 PDF)이 그 자리로 스크롤되고 그 구절이 짙게 표시된다(hooks/useEvaluationDocument.ts).
 * 원본의 형광펜을 눌러 근거를 고르면 그 근거 문장이 목록에서 보이게 목록이 스크롤된다.
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
  const document = useEvaluationDocument({
    applicant,
    elements,
    highlightIndex: selectedIndex,
    maskReported: session.maskReported,
    onToggleMaskReport: session.onToggleMaskReport,
    // 원본 PDF 에서 다른 평가 요소의 형광펜을 누르면 그 요소의 근거를 보여 준다.
    onPickElement: (index) => setSelectedId(elements[index]?.id ?? null),
  });
  /** 근거 문장 목록의 스크롤 영역(넓은 배치에서만 안에서 스크롤한다)과 고른 근거 문장 */
  const evidenceListRef = useRef<HTMLDivElement>(null);
  const focusedEvidenceRef = useRef<HTMLButtonElement>(null);

  // 근거를 고를 때마다(원본의 형광펜이나 서류 원문의 이전·다음으로 고른 것 포함) 그 근거 문장이 목록 안에서 보이게 목록만 스크롤한다.
  // 목록이 안에서 스크롤하지 않는 배치(좁은 배치)에서는 아무것도 하지 않는다(문서를 움직이지 않는다).
  const { focusRequest } = document;
  useEffect(() => {
    const container = evidenceListRef.current;
    const card = focusedEvidenceRef.current;
    if (focusRequest === 0 || container === null || card === null || container.scrollHeight <= container.clientHeight) return;
    const containerRect = container.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    if (cardRect.top >= containerRect.top && cardRect.bottom <= containerRect.bottom) return;
    const top = cardRect.top - containerRect.top + container.scrollTop - EVIDENCE_LIST_MARGIN;
    container.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }, [focusRequest]);

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
      HOME_CRUMB,
      { label: "평가하기", href: EVALUATE_PATH },
      { label: "평가 대기 목록", href: EVALUATE_PATH },
      { label: applicant.code },
    ],
    headNote: session.headNote,
    bar: { ...session.bar, backHref: EVALUATE_PATH, backLabel: "목록" },
    growth: {
      points: applicant.growth,
      // 막대 눈금의 끝: 보통 5 건이고, 건수가 그보다 많으면(올린 지원자의 근거 건수) 가장 큰 건수에 맞춘다.
      countMax: Math.max(GROWTH_COUNT_MAX, ...applicant.growth.map((point) => point.count)),
      // 건수는 예시 지원자는 활동 건수(예시 값), 올린 지원자는 그 학년 기록에서 나온 근거 구절의 수다.
      label: `학년별 성장 추이: ${applicant.growth.map((point) => `${point.grade}학년 ${point.index}`).join(", ")}. ${
        applicant.original === undefined ? "활동 건수" : "근거 건수"
      }: ${applicant.growth.map((point) => `${point.grade}학년 ${point.count}건`).join(", ")}`,
    },
    /** 넓은 배치인지 (올린 지원자: 원본을 크게 보고, 근거 문장이 그 옆에 놓인다) */
    wide: document.view.wide,
    document: document.view,
    basis: {
      aiTotal: aiTotalOf(applicant, elements),
      weightsText: `${session.criteriaVersion} ${weightsLine(elements)}`,
      criteria: items.map((item) => ({
        id: item.element.id,
        name: item.element.name,
        /** 그 요소의 형광펜 색 순번 (원문의 근거 구절이 이 색으로 칠해진다) */
        tone: item.index,
        aiScore: item.assessment.score,
        flag: item.assessment.confidence <= LOW_CONFIDENCE ? "사람 확인 권장" : null,
        on: item.index === selectedIndex,
        onPick: () => setSelectedId(item.element.id),
      })),
      selectedName: selected.name,
      /** 고른 평가 요소의 근거 문장. 누르면 서류 원문이 그 자리로 간다(on: 지금 고른 근거) */
      evidences: evidences.map((evidence) => ({
        id: evidence.id,
        source: evidence.source,
        text: evidence.text,
        reason: evidence.reason,
        on: evidence.id === document.focusedEvidenceId,
        onPick: () => document.onSelectEvidence(evidence.id),
      })),
      confidenceText: `신뢰도 ${selectedAssessment.confidence} / ${MAX_CONFIDENCE} · 근거 ${evidences.length}건`,
      tagsText: assessmentTags(selectedAssessment, selected),
      aiScore: selectedAssessment.score,
    },
    evidenceListRef,
    focusedEvidenceRef,
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
      /** 다른 위원 의견: 내 평가를 제출한 뒤에만 보인다. 올린 지원자는 다른 위원이 없어 빈 목록이다. */
      peers: locked ? applicant.peers : null,
    },
  };
}
