"use client";

import { ApplicantsScreen } from "@/components/ApplicantsScreen";
import { useApplicants } from "@/hooks/useApplicants";

export default function ApplicantsPage() {
  const applicants = useApplicants();
  return <ApplicantsScreen {...applicants} />;
}
