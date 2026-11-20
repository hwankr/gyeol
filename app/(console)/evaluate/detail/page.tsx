"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { EvaluateDetailScreen } from "@/components/EvaluateDetailScreen";
import { EvaluateMissing } from "@/components/EvaluateParts";
import { PageTransition } from "@/components/PageTransition";
import { useEvaluateDetail } from "@/hooks/useEvaluateDetail";
import { useEvaluationData } from "@/hooks/useEvaluationData";
import { ADMISSION } from "@/lib/admission";
import { findEvaluationApplicant } from "@/lib/evaluate/evaluation";
import type { EvaluationApplicant } from "@/lib/evaluate/sampleEvaluations";

/**
 * 평가하기 · 세부 항목 평가 (/evaluate/detail?code=A-0187&item=e1).
 * 지원자 코드와 평가 요소는 주소의 ?code= · &item= 에 있어 브라우저에서만 알 수 있다. 사전 렌더링에서는 Suspense 안쪽을 비워 두고
 * 브라우저에서 그린다(총평 화면과 같은 방식).
 */
export default function EvaluateDetailPage() {
  return (
    <PageTransition>
      <Suspense fallback={null}>
        <DetailByCode />
      </Suspense>
    </PageTransition>
  );
}

function DetailByCode() {
  const params = useSearchParams();
  // 평가할 지원자 목록(예시 지원자 + 지금 평가 기준으로 분석한 올린 지원자)에서 찾는다(총평 화면과 같다).
  const { applicants } = useEvaluationData();
  const applicant = findEvaluationApplicant(applicants, params.get("code"));
  if (applicant === undefined) return <EvaluateMissing note={`${ADMISSION.trackFull} · ${ADMISSION.unit}`} />;
  const itemId = params.get("item");
  // 지원자(올린 지원자는 그 분석)가 바뀌면 새로 그려서 서류 원문·안내 글을 처음 상태로 시작한다(응답은 저장소에 있어 그대로다).
  // 평가 요소만 바뀔 때에는 새로 그리지 않는다: 서류 원문에서 보던 자리(원본 PDF 의 스크롤·배율)가 그대로 남아야 한다.
  return <Detail key={`${applicant.code}@${applicant.stamp ?? ""}`} applicant={applicant} itemId={itemId} />;
}

function Detail({ applicant, itemId }: { applicant: EvaluationApplicant; itemId: string | null }) {
  const detail = useEvaluateDetail(applicant, itemId);
  return <EvaluateDetailScreen {...detail} />;
}
