"use client";

import { UploadScreen } from "@/components/UploadScreen";
import { useUpload } from "@/hooks/useUpload";

export default function UploadPage() {
  const upload = useUpload();
  return <UploadScreen {...upload} />;
}
