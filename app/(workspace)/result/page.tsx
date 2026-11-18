"use client";

import { NoResultScreen, ResultScreen } from "@/components/ResultScreen";
import { useResultView } from "@/hooks/useResultView";
import { useStoredResult } from "@/hooks/useStoredResult";
import type { AnalysisResult } from "@/types/analysis";

export default function ResultPage() {
  const stored = useStoredResult();
  // 브라우저 값을 읽기 전(서버 렌더링·hydration 중)에는 아무것도 그리지 않는다.
  if (stored === undefined) return null;
  if (stored === null) return <NoResultScreen />;
  // 새로 저장한 결과(saveId 가 바뀜)마다 새로 그려서 탭·선택·두 단 스크롤을 처음 상태로 시작한다.
  return <LoadedResult key={stored.saveId} result={stored.result} />;
}

function LoadedResult({ result }: { result: AnalysisResult }) {
  const view = useResultView(result);
  return <ResultScreen {...view} />;
}
