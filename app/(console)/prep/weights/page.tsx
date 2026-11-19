"use client";

import { PageTransition } from "@/components/PageTransition";
import { WeightsTab } from "@/components/WeightsTab";
import { usePrepWeights } from "@/hooks/usePrepWeights";

export default function PrepWeightsPage() {
  const weights = usePrepWeights();
  return (
    <PageTransition>
      <WeightsTab {...weights} />
    </PageTransition>
  );
}
