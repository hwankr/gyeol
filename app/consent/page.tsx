"use client";

import { ConsentScreen } from "@/components/ConsentScreen";
import { PageTransition } from "@/components/PageTransition";
import { useConsent } from "@/hooks/useConsent";

export default function ConsentPage() {
  const consent = useConsent();
  return (
    <PageTransition cover>
      <ConsentScreen {...consent} />
    </PageTransition>
  );
}
