"use client";

import { DecisionOpinionsTab } from "@/components/DecisionOpinionsTab";
import { PageTransition } from "@/components/PageTransition";
import { useDecisionOpinions } from "@/hooks/useDecisionOpinions";

export default function DecisionOpinionsPage() {
  const opinions = useDecisionOpinions();
  return (
    <PageTransition>
      <DecisionOpinionsTab {...opinions} />
    </PageTransition>
  );
}
