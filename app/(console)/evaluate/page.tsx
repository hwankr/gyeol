"use client";

import { EvaluateListScreen } from "@/components/EvaluateListScreen";
import { useEvaluateList } from "@/hooks/useEvaluateList";

export default function EvaluateListPage() {
  const list = useEvaluateList();
  return <EvaluateListScreen {...list} />;
}
