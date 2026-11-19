"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { EvaluateMissing } from "@/components/EvaluateParts";
import { EvaluateSummaryScreen } from "@/components/EvaluateSummaryScreen";
import { PageTransition } from "@/components/PageTransition";
import { useEvaluateSummary } from "@/hooks/useEvaluateSummary";
import { useEvaluationData } from "@/hooks/useEvaluationData";
import { ADMISSION } from "@/lib/admission";
import { findEvaluationApplicant } from "@/lib/evaluate/evaluation";
import type { EvaluationApplicant } from "@/lib/evaluate/sampleEvaluations";

/**
 * 평가하기 · 총평 (/evaluate/summary?code=A-0187).
 * 지원자 코드는 주소의 ?code= 에 있어 브라우저에서만 알 수 있다. 사전 렌더링에서는 Suspense 안쪽을 비워 두고(fallback 없음)
 * 브라우저에서 그린다(껍데기인 사이드바·상단 바는 서버 HTML 에 있다).
 */
export default function EvaluateSummaryPage() {
  return (
    <PageTransition>
      <Suspense fallback={null}>
        <SummaryByCode />
      </Suspense>
    </PageTransition>
  );
}

function SummaryByCode() {
  // 평가할 지원자 목록(예시 지원자 + 지금 평가 기준으로 분석한 올린 지원자)에서 찾는다. 올린 지원자는 브라우저 저장소에 있다.
  const { applicants } = useEvaluationData();
  const applicant = findEvaluationApplicant(applicants, useSearchParams().get("code"));
  if (applicant === undefined) return <EvaluateMissing note={`${ADMISSION.trackFull} · ${ADMISSION.unit}`} />;
  // 지원자가 바뀌면 새로 그려서 고른 평가 요소·서류 구분·안내 글을 처음 상태로 시작한다(저장한 평가는 저장소에 있어 그대로다).
  return <Summary key={applicant.code} applicant={applicant} />;
}

function Summary({ applicant }: { applicant: EvaluationApplicant }) {
  const summary = useEvaluateSummary(applicant);
  return <EvaluateSummaryScreen {...summary} />;
}
