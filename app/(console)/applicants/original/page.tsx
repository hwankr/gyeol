"use client";

import { Suspense, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { OriginalMissing, OriginalScreen } from "@/components/OriginalScreen";
import { useOriginalView } from "@/hooks/useOriginalView";
import { ADMISSION } from "@/lib/admission";
import { SAMPLE_ORIGINAL_NOTE, originalRecordOf, type OriginalRecord } from "@/lib/applicants/original";
import { NO_UPLOADED_APPLICANTS, type UploadedApplicant } from "@/lib/applicants/uploaded";
import { loadUploadedApplicants, subscribeUploadedApplicants } from "@/lib/applicants/uploadedStorage";
import { APPLICANTS_PATH } from "@/lib/consoleMenu";

const HEAD_NOTE = `${ADMISSION.trackFull} · ${ADMISSION.unit}`;
const BACK = { href: APPLICANTS_PATH, label: "목록" };

// 서버 렌더링과 hydration 중에는 올린 지원자가 없는 모습이다(브라우저에서 저장소를 읽은 뒤 나타난다).
function getServerUploaded(): readonly UploadedApplicant[] {
  return NO_UPLOADED_APPLICANTS;
}

/**
 * 지원자 관리 · 원문보기 (/applicants/original?code=A-0315).
 * 지원자 코드는 주소의 ?code= 에 있어 브라우저에서만 알 수 있다. 사전 렌더링에서는 Suspense 안쪽을 비워 두고(fallback 없음)
 * 브라우저에서 그린다(평가하기의 총평 화면과 같은 방식. 껍데기인 사이드바·상단 바는 서버 HTML 에 있다).
 */
export default function ApplicantOriginalPage() {
  return (
    <Suspense fallback={null}>
      <OriginalByCode />
    </Suspense>
  );
}

function OriginalByCode() {
  const code = useSearchParams().get("code");
  const uploaded = useSyncExternalStore(subscribeUploadedApplicants, loadUploadedApplicants, getServerUploaded);
  const record = originalRecordOf(code, uploaded);
  if (record === null) {
    return (
      <OriginalMissing
        crumbs={[{ label: "홈" }, { label: "지원자 관리", href: APPLICANTS_PATH }, { label: "원문 없음" }]}
        title="지원자 관리"
        headNote={HEAD_NOTE}
        back={{ href: APPLICANTS_PATH, label: "지원자 관리로 가기" }}
      />
    );
  }
  // 지원자나 그 분석이 바뀌면 새로 그려서 고른 기준·근거·스크롤을 처음 상태로 시작한다.
  return <Original key={record.key} record={record} />;
}

function Original({ record }: { record: OriginalRecord }) {
  const view = useOriginalView(record.result);
  return (
    <OriginalScreen
      {...view}
      crumbs={[{ label: "홈" }, { label: "지원자 관리", href: APPLICANTS_PATH }, { label: record.code }, { label: "원문보기" }]}
      title="지원자 관리"
      headNote={HEAD_NOTE}
      back={BACK}
      code={record.code}
      sampleNote={record.sample ? SAMPLE_ORIGINAL_NOTE : null}
    />
  );
}
