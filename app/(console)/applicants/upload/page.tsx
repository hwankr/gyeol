"use client";

import { RecordUploadScreen } from "@/components/RecordUploadScreen";
import { useRecordUpload } from "@/hooks/useRecordUpload";

/** 지원자 관리 · 학생부 올리기 (/applicants/upload) */
export default function RecordUploadPage() {
  const upload = useRecordUpload();
  return <RecordUploadScreen {...upload} />;
}
