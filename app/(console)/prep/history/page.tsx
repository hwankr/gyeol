"use client";

import { HistoryTab } from "@/components/HistoryTab";
import { usePrepHistory } from "@/hooks/usePrepHistory";

export default function PrepHistoryPage() {
  const history = usePrepHistory();
  return <HistoryTab {...history} />;
}
