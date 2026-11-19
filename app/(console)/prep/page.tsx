"use client";

import { GuidelineUploadTab } from "@/components/GuidelineUploadTab";
import { PageTransition } from "@/components/PageTransition";
import { useGuidelineUpload } from "@/hooks/useGuidelineUpload";

export default function PrepUploadPage() {
  const upload = useGuidelineUpload();
  return (
    <PageTransition>
      <GuidelineUploadTab {...upload} />
    </PageTransition>
  );
}
