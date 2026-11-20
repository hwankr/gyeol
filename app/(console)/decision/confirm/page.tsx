"use client";

import { DecisionConfirmTab } from "@/components/DecisionConfirmTab";
import { PageTransition } from "@/components/PageTransition";
import { useDecisionConfirm } from "@/hooks/useDecisionConfirm";

export default function DecisionConfirmPage() {
  const confirm = useDecisionConfirm();
  return (
    <PageTransition>
      <DecisionConfirmTab {...confirm} />
    </PageTransition>
  );
}
