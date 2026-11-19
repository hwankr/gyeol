"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { EvaluateMissing } from "@/components/EvaluateParts";
import { OriginalScreen } from "@/components/OriginalScreen";
import { useEvaluationData } from "@/hooks/useEvaluationData";
import { useOriginalView } from "@/hooks/useOriginalView";
import { ADMISSION } from "@/lib/admission";
import { SAMPLE_ORIGINAL_NOTE } from "@/lib/applicants/original";
import { EVALUATE_PATH } from "@/lib/consoleMenu";
import { findEvaluationApplicant, summaryPath } from "@/lib/evaluate/evaluation";
import type { EvaluationApplicant } from "@/lib/evaluate/sampleEvaluations";
import { sampleResult } from "@/lib/mock/sampleResult";

const HEAD_NOTE = `${ADMISSION.trackFull} · ${ADMISSION.unit}`;

/**
 * 평가하기 · 원문보기 (/evaluate/original?code=A-0187). 총평·세부 항목 평가의 "원문보기" 가 여기로 온다.
 * 지원자는 평가할 지원자 목록에서 찾는다(총평 화면과 같다). 올린 지원자는 그 학생부의 분석 결과를, 예시 지원자는 미리 만든 샘플 결과를 보여 준다.
 * 지원자 코드는 주소의 ?code= 에 있어 Suspense 안쪽은 브라우저에서만 그린다.
 */
export default function EvaluateOriginalPage() {
  return (
    <Suspense fallback={null}>
      <OriginalByCode />
    </Suspense>
  );
}

function OriginalByCode() {
  const { applicants } = useEvaluationData();
  const applicant = findEvaluationApplicant(applicants, useSearchParams().get("code"));
  if (applicant === undefined) return <EvaluateMissing note={HEAD_NOTE} />;
  // 지원자나 그 분석이 바뀌면 새로 그려서 고른 기준·근거·스크롤을 처음 상태로 시작한다.
  return <Original key={`${applicant.code}@${applicant.stamp ?? ""}`} applicant={applicant} />;
}

function Original({ applicant }: { applicant: EvaluationApplicant }) {
  const view = useOriginalView(applicant.original ?? sampleResult);
  const summaryHref = summaryPath(applicant.code);
  return (
    <OriginalScreen
      {...view}
      crumbs={[
        { label: "홈" },
        { label: "평가하기", href: EVALUATE_PATH },
        { label: "평가 대기 목록", href: EVALUATE_PATH },
        { label: applicant.code, href: summaryHref },
        { label: "원문보기" },
      ]}
      title="평가하기"
      headNote={HEAD_NOTE}
      back={{ href: summaryHref, label: "총평" }}
      code={applicant.code}
      sampleNote={applicant.original === undefined ? SAMPLE_ORIGINAL_NOTE : null}
    />
  );
}
