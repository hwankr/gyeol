"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { EvaluateMissing } from "@/components/EvaluateParts";
import { OriginalScreen } from "@/components/OriginalScreen";
import { PageTransition } from "@/components/PageTransition";
import { useEvaluationData } from "@/hooks/useEvaluationData";
import { useOriginalView } from "@/hooks/useOriginalView";
import { ADMISSION } from "@/lib/admission";
import { SAMPLE_ORIGINAL_NOTE } from "@/lib/applicants/original";
import { EVALUATE_PATH } from "@/lib/consoleMenu";
import { findEvaluationApplicant, summaryPath } from "@/lib/evaluate/evaluation";
import type { EvaluationApplicant } from "@/lib/evaluate/sampleEvaluations";
import { sampleResult } from "@/lib/mock/sampleResult";
import { recordPagesKey } from "@/lib/recordPagesStorage";

const HEAD_NOTE = `${ADMISSION.trackFull} · ${ADMISSION.unit}`;

/**
 * 평가하기 · 원문보기 (/evaluate/original?code=A-0187). 총평·세부 항목 평가의 "원문보기" 가 여기로 온다.
 * 지원자는 평가할 지원자 목록에서 찾는다(총평 화면과 같다). 올린 지원자는 그 학생부의 분석 결과를, 예시 지원자는 미리 만든 샘플 결과를 보여 준다.
 * 지원자 코드는 주소의 ?code= 에 있어 Suspense 안쪽은 브라우저에서만 그린다.
 * 주소에 &section=<항목 id> 가 있으면 그 항목을 고른 채로 연다(서류 원문의 "PDF n쪽" 이 여기로 온다. 쪽 그림이 있으면 PDF 보기로 연다).
 */
export default function EvaluateOriginalPage() {
  return (
    <PageTransition>
      <Suspense fallback={null}>
        <OriginalByCode />
      </Suspense>
    </PageTransition>
  );
}

function OriginalByCode() {
  const { applicants } = useEvaluationData();
  const params = useSearchParams();
  const applicant = findEvaluationApplicant(applicants, params.get("code"));
  const section = params.get("section");
  if (applicant === undefined) return <EvaluateMissing note={HEAD_NOTE} />;
  // 지원자나 그 분석, 처음 고를 항목이 바뀌면 새로 그려서 고른 기준·근거·스크롤을 처음 상태로 시작한다.
  return <Original key={`${applicant.code}@${applicant.stamp ?? ""}#${section ?? ""}`} applicant={applicant} section={section} />;
}

function Original({ applicant, section }: { applicant: EvaluationApplicant; section: string | null }) {
  // 올린 지원자만 가린 쪽 그림이 있다(그 분석을 남긴 때로 찾는다).
  const pagesKey =
    applicant.original !== undefined && applicant.stamp !== undefined ? recordPagesKey(applicant.code, applicant.stamp) : null;
  const view = useOriginalView(applicant.original ?? sampleResult, pagesKey, section);
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
