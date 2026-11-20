"use client";

import { DecisionCompareEmpty, DecisionComparePending, DecisionCompareTab } from "@/components/DecisionCompareTab";
import { PageTransition } from "@/components/PageTransition";
import { useDecisionCompare } from "@/hooks/useDecisionCompare";
import { DECISION_PATH } from "@/lib/consoleMenu";

export default function DecisionComparePage() {
  const compare = useDecisionCompare();
  return (
    <PageTransition>
      {compare === undefined ? (
        <DecisionComparePending />
      ) : compare === null ? (
        <DecisionCompareEmpty recommendHref={DECISION_PATH} />
      ) : (
        <DecisionCompareTab {...compare} />
      )}
    </PageTransition>
  );
}
