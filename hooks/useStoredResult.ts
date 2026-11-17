import { useSyncExternalStore } from "react";
import { loadResult, subscribeResult, type StoredResult } from "@/lib/resultStorage";

// 서버 렌더링과 hydration 중에는 "아직 모름"(undefined) 으로 그린다.
// 그래서 서버 HTML 과 첫 클라이언트 렌더링이 같아 hydration 경고가 나지 않고,
// "결과 없음" 안내가 잠깐 보였다가 사라지는 일도 없다.
function getServerSnapshot(): undefined {
  return undefined;
}

/**
 * sessionStorage 에 저장된 분석 결과.
 * - undefined: 아직 브라우저 값을 읽기 전(서버 렌더링·hydration 중)
 * - null: 저장된 결과가 없거나 형식이 깨짐
 * 같은 탭에서 새 결과를 저장하면(saveResult) 숨겨져 있던 결과 화면도 새 값으로 다시 그려진다.
 */
export function useStoredResult(): StoredResult | null | undefined {
  return useSyncExternalStore(subscribeResult, loadResult, getServerSnapshot);
}
