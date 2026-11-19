"use client";

import { EvaluateListScreen } from "@/components/EvaluateListScreen";
import { PageTransition } from "@/components/PageTransition";
import { useEvaluateList } from "@/hooks/useEvaluateList";

export default function EvaluateListPage() {
  const list = useEvaluateList();
  return (
    <PageTransition>
      <EvaluateListScreen {...list} />
    </PageTransition>
  );
}
