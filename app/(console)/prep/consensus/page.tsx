"use client";

import { ConsensusTab } from "@/components/ConsensusTab";
import { PageTransition } from "@/components/PageTransition";
import { usePrepConsensus } from "@/hooks/usePrepConsensus";

export default function PrepConsensusPage() {
  const consensus = usePrepConsensus();
  return (
    <PageTransition>
      <ConsensusTab {...consensus} />
    </PageTransition>
  );
}
