"use client";

import { ApplicantsScreen } from "@/components/ApplicantsScreen";
import { PageTransition } from "@/components/PageTransition";
import { useApplicants } from "@/hooks/useApplicants";

export default function ApplicantsPage() {
  const applicants = useApplicants();
  return (
    <PageTransition>
      <ApplicantsScreen {...applicants} />
    </PageTransition>
  );
}
