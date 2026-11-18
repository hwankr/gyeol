"use client";

import { WeightsTab } from "@/components/WeightsTab";
import { usePrepWeights } from "@/hooks/usePrepWeights";

export default function PrepWeightsPage() {
  const weights = usePrepWeights();
  return <WeightsTab {...weights} />;
}
