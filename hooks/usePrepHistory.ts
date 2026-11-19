import { useSyncExternalStore } from "react";
import { usePrepTabReady } from "@/hooks/usePrepTabReady";
import { formatSeoulDateTime } from "@/lib/koreanTime";
import type { PrepHistoryEntry } from "@/lib/prep/history";
import { loadPrepHistory, subscribePrepStorage } from "@/lib/prep/storage";

// 서버 렌더링과 hydration 중에는 "아직 모름"(undefined)으로 그린다. 기록과 시각은 브라우저 저장소의 값이라 서버 HTML 에 없고,
// 서버 HTML 과 첫 클라이언트 렌더링이 같아 hydration 경고가 나지 않는다. "기록 없음" 안내가 잠깐 보였다가 사라지는 일도 없다.
function getServerSnapshot(): undefined {
  return undefined;
}

/** 전형 준비 · 기준 변경 기록 탭 상태: 최신순 기록(50건까지). 시각은 한국 시간 글로 바꿔 둔다. */
export function usePrepHistory() {
  const { ready, bodyRef } = usePrepTabReady<HTMLElement>();
  const entries = useSyncExternalStore<readonly PrepHistoryEntry[] | undefined>(
    subscribePrepStorage,
    loadPrepHistory,
    getServerSnapshot,
  );
  return {
    ready,
    bodyRef,
    entries: entries?.map((entry) => ({
      id: entry.id,
      at: entry.at,
      timeText: formatSeoulDateTime(entry.at),
      actor: entry.actor,
      summary: entry.summary,
    })),
  };
}
