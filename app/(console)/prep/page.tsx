"use client";

import { GuidelineUploadTab } from "@/components/GuidelineUploadTab";
import { useGuidelineUpload } from "@/hooks/useGuidelineUpload";

export default function PrepUploadPage() {
  const upload = useGuidelineUpload();
  return <GuidelineUploadTab {...upload} />;
}
