"use client";

import { HistoryTab } from "@/components/HistoryTab";
import { PageTransition } from "@/components/PageTransition";
import { usePrepHistory } from "@/hooks/usePrepHistory";

export default function PrepHistoryPage() {
  const history = usePrepHistory();
  return (
    <PageTransition>
      <HistoryTab {...history} />
    </PageTransition>
  );
}
