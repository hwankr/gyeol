import { useRouter } from "next/navigation";
import { useEvaluationDocument } from "@/hooks/useEvaluationDocument";
import { useEvaluationSession } from "@/hooks/useEvaluationSession";
import { EVALUATE_PATH, HOME_CRUMB } from "@/lib/consoleMenu";
import {
  ANSWER_SCALE,
  answerAverage,
  answersWith,
  assessmentOf,
  detailPath,
  questionCount,
  rubricGroups,
  rubricScore,
  summaryPath,
  validAnswers,
} from "@/lib/evaluate/evaluation";
import type { EvaluationApplicant } from "@/lib/evaluate/sampleEvaluations";

/**
 * 평가하기 · 세부 항목 평가 화면 상태: 지원자 한 명의 평가 요소 하나에 대한 세부 평가 항목(전형 준비에서 저장한 묶음·질문)을
 * 1~5점 척도로 응답한다. 응답은 누를 때마다 저장된다. 모든 질문에 응답하고 "평가 완료" 를 누르면 응답 평균을 100점 척도로 바꾼 값
 * (평균 × 20)을 그 요소의 내 점수로 가져가고 총평 화면으로 돌아간다. 그 점수가 AI 점수와 다르고 수정 사유가 비어 있으면
 * 사유에 "세부 평가 항목 N문 평균 X점 반영" 을 채워 둔다(총평 화면에서 고칠 수 있다).
 * itemId 가 지금 평가 기준에 없는 요소면 첫 요소를 보여 준다.
 * 평가 요소를 바꿔도 이 훅을 쓰는 컴포넌트는 새로 그려지지 않는다(지원자가 바뀔 때만 새로 그린다). 그래서 서류 원문에서 보던 자리·보기·배율이
 * 그대로 남고, 방금 한 일의 안내 글만 요소마다 따로다(hooks/useEvaluationSession.ts 의 noteScope).
 */
export function useEvaluateDetail(applicant: EvaluationApplicant, itemId: string | null) {
  const router = useRouter();
  // 앞뒤 지원자로 갈 때도 같은 평가 요소의 세부 항목 평가로 간다.
  const session = useEvaluationSession(applicant, (code) => detailPath(code, itemId ?? ""), itemId ?? "");
  const { elements, record, locked, write } = session;
  const elementIndex = Math.max(
    0,
    elements.findIndex((element) => element.id === itemId),
  );
  // 서류 원문: 지금 응답하는 요소의 근거가 짙게 칠해지고, 근거 줄(이전·다음)로 그 근거를 원본에서 차례로 본다.
  const document = useEvaluationDocument({
    applicant,
    elements,
    highlightIndex: elementIndex,
    maskReported: session.maskReported,
    onToggleMaskReport: session.onToggleMaskReport,
  });
  const element = elements[elementIndex];
  const answers = validAnswers(record, element);
  const total = questionCount(element);
  const answered = Object.keys(answers).length;
  const average = answerAverage(answers);
  const complete = total > 0 && answered === total;
  const summaryHref = summaryPath(applicant.code);

  function answer(key: string, value: number) {
    write(answersWith(record, element, key, value));
  }

  /** 평가 완료: 응답 평균을 내 점수로 가져가고 총평으로 돌아간다. */
  function finish() {
    if (locked || !complete || average === null) return;
    const score = rubricScore(average);
    const aiScore = assessmentOf(applicant, elementIndex).score;
    const reason = record?.reasons[element.id] ?? "";
    write({
      scores: { ...record?.scores, [element.id]: score },
      reasons:
        score !== aiScore && reason.trim() === ""
          ? { ...record?.reasons, [element.id]: `세부 평가 항목 ${total}문 평균 ${average.toFixed(1)}점 반영` }
          : (record?.reasons ?? {}),
    });
    router.push(summaryHref);
  }

  const groups = rubricGroups(element);

  return {
    crumbs: [
      HOME_CRUMB,
      { label: "평가하기", href: EVALUATE_PATH },
      { label: "평가 대기 목록", href: EVALUATE_PATH },
      { label: applicant.code, href: summaryHref },
      { label: "세부 항목 평가" },
    ],
    headNote: session.headNote,
    bar: { ...session.bar, backHref: summaryHref, backLabel: "총평" },
    /** 넓은 배치인지 (올린 지원자: 원본을 크게 보고, 세 단이 화면 높이 안에서 각자 스크롤한다) */
    wide: document.view.wide,
    document: document.view,
    /** 가운데 단: 평가 요소 목록. 지금 요소가 선택된 모양이고, 응답이 있는 요소에는 응답 수를 붙인다. */
    items: elements.map((item, index) => {
      const count = Object.keys(validAnswers(record, item)).length;
      return {
        id: item.id,
        name: item.name,
        /** 그 요소의 형광펜 색 순번 */
        tone: index,
        href: detailPath(applicant.code, item.id),
        current: index === elementIndex,
        progressText: index === elementIndex || count > 0 ? `${count} / ${questionCount(item)}` : null,
      };
    }),
    rubric: {
      elementName: element.name,
      groupCount: groups.length,
      questionCount: total,
      scale: ANSWER_SCALE,
      locked,
      groups: groups.map((group) => ({
        name: group.name,
        countText: `${group.questions.filter((question) => answers[question.key] !== undefined).length} / ${group.questions.length} 응답`,
        questions: group.questions.map((question) => ({
          key: question.key,
          /** 라디오 묶음의 이름: 지원자·요소·질문마다 다르다 */
          name: `${applicant.code}-${element.id}-${question.key}`,
          numberText: `${question.number}.`,
          text: question.text,
          value: answers[question.key] ?? null,
          onAnswer: (value: number) => answer(question.key, value),
        })),
      })),
      progressText:
        average === null
          ? `이 화면 ${total}문 중 아직 응답한 문항이 없습니다.`
          : `이 화면 ${total}문 중 ${answered}문 응답 · 평균 ${average.toFixed(1)}점`,
      /** 모두 응답했을 때 내 점수로 가져갈 값 (아직 다 응답하지 않았으면 null) */
      scoreToApply: complete && average !== null ? rubricScore(average) : null,
      remaining: total - answered,
      canFinish: !locked && complete,
      finishLabel: locked ? "제출됨" : "평가 완료",
      onFinish: finish,
      marks: session.marks,
    },
  };
}
