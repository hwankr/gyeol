import { useEffect, useMemo, useRef, useState } from "react";
import { buildResultView } from "@/lib/resultView";
import type { AnalysisResult } from "@/types/analysis";

/** 원문 단 위쪽 가장자리와 스크롤 대상 사이 여백(px) */
const SCROLL_MARGIN = 12;

type Selection = {
  evidenceId: string;
  /** 카드를 누를 때마다 새 번호. 같은 카드를 다시 눌러도 다시 스크롤하게 한다. */
  request: number;
};

/**
 * 결과 화면 상태: 현재 탭(기준 id), 선택한 근거, 원문 단 스크롤.
 * 새로 저장한 결과마다 이 훅을 쓰는 컴포넌트가 새로 그려지므로(app/(workspace)/result/page.tsx 의 key) 처음 상태로 시작한다.
 */
export function useResultView(result: AnalysisResult) {
  /** 현재 탭의 기준 id. 처음에는 첫 번째 기준. 기준이 하나도 없으면 null. */
  const [activeCriterionId, setActiveCriterionId] = useState<string | null>(
    result.criteria.criteria[0]?.id ?? null,
  );
  const [selection, setSelection] = useState<Selection | null>(null);

  const sourceScrollRef = useRef<HTMLDivElement>(null);
  const selectedSectionRef = useRef<HTMLElement>(null);
  const highlightRef = useRef<HTMLElement>(null);
  /** 마지막으로 발급한 선택 요청 번호 (탭을 바꿔도 줄지 않는다) */
  const lastRequestRef = useRef(0);
  /** 마지막으로 스크롤까지 처리한 선택 요청 번호 */
  const handledRequestRef = useRef(0);

  const view = useMemo(
    () => buildResultView(result, activeCriterionId, selection?.evidenceId ?? null),
    [result, activeCriterionId, selection?.evidenceId],
  );

  // 근거를 고를 때마다(같은 근거를 다시 골라도) 원문 단만 해당 위치로 스크롤한다.
  // 다른 화면에 갔다가 돌아와 이 화면이 다시 보일 때도(Activity) effect 가 다시 실행되는데,
  // 이미 처리한 요청이면 스크롤하지 않아 원하지 않는 스크롤이 생기지 않게 한다.
  useEffect(() => {
    if (selection === null || selection.request === handledRequestRef.current) return;
    handledRequestRef.current = selection.request;
    const container = sourceScrollRef.current;
    if (container === null) return;
    scrollSourceTo(container, selectedSectionRef.current, highlightRef.current);
  }, [selection]);

  function selectTab(criterionId: string) {
    setActiveCriterionId(criterionId);
    setSelection(null);
  }

  function selectEvidence(evidenceId: string) {
    lastRequestRef.current += 1;
    setSelection({ evidenceId, request: lastRequestRef.current });
  }

  return {
    ...view,
    sourceScrollRef,
    selectedSectionRef,
    highlightRef,
    onSelectTab: selectTab,
    onSelectEvidence: selectEvidence,
  };
}

/**
 * 원문 단(container)만 스크롤한다. scrollIntoView 는 바깥 요소까지 움직일 수 있어 쓰지 않는다.
 * 항목 제목부터 보이게 하되, 그러면 강조한 인용 문장이 아래로 잘리는 경우에는 인용 문장을 기준으로 맞춘다.
 */
function scrollSourceTo(
  container: HTMLElement,
  section: HTMLElement | null,
  quote: HTMLElement | null,
) {
  const containerTop = container.getBoundingClientRect().top;
  const offsetOf = (element: HTMLElement) =>
    element.getBoundingClientRect().top - containerTop + container.scrollTop;

  let top: number | null = section ? offsetOf(section) - SCROLL_MARGIN : null;
  if (quote) {
    const quoteTop = offsetOf(quote);
    const quoteBottom = quoteTop + quote.getBoundingClientRect().height;
    if (top === null || quoteBottom + SCROLL_MARGIN - top > container.clientHeight) {
      top = quoteTop - SCROLL_MARGIN;
    }
  }
  if (top === null) return;
  container.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}
