"use client";

import { PageTransition } from "@/components/PageTransition";
import { RecordUploadScreen } from "@/components/RecordUploadScreen";
import { useRecordUpload } from "@/hooks/useRecordUpload";

/** 지원자 관리 · 학생부 올리기 (/applicants/upload) */
export default function RecordUploadPage() {
  const upload = useRecordUpload();
  return (
    <PageTransition>
      <RecordUploadScreen {...upload} />
    </PageTransition>
  );
}
