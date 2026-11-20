"use client";

import { DecisionRecommendTab } from "@/components/DecisionRecommendTab";
import { PageTransition } from "@/components/PageTransition";
import { useDecisionRecommend } from "@/hooks/useDecisionRecommend";

export default function DecisionRecommendPage() {
  const recommend = useDecisionRecommend();
  return (
    <PageTransition>
      <DecisionRecommendTab {...recommend} />
    </PageTransition>
  );
}
