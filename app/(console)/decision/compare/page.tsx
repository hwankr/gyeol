"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { DecisionCompareEmpty, DecisionComparePending, DecisionCompareTab } from "@/components/DecisionCompareTab";
import { PageTransition } from "@/components/PageTransition";
import { useDecisionCompare } from "@/hooks/useDecisionCompare";
import { DECISION_PAIR_CUTLINE, DECISION_PAIR_PARAM, DECISION_PATH } from "@/lib/consoleMenu";

/**
 * 선발 결정 · 지원자 비교 (/decision/compare, /decision/compare?pair=cutline).
 * 주소의 ?pair= 는 브라우저에서만 알 수 있다. 사전 렌더링에서는 Suspense 안쪽 대신 두 사람의 빈 자리(DecisionComparePending)를 그린다
 * (고른 지원자를 읽기 전의 모습과 같다).
 */
export default function DecisionComparePage() {
  return (
    <PageTransition>
      <Suspense fallback={<DecisionComparePending />}>
        <Compare />
      </Suspense>
    </PageTransition>
  );
}

function Compare() {
  const cutlineOnly = useSearchParams().get(DECISION_PAIR_PARAM) === DECISION_PAIR_CUTLINE;
  const compare = useDecisionCompare(cutlineOnly);
  if (compare === undefined) return <DecisionComparePending />;
  if (compare === null) return <DecisionCompareEmpty recommendHref={DECISION_PATH} />;
  return <DecisionCompareTab {...compare} />;
}
