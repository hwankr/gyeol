import { useRef, useSyncExternalStore } from "react";
import { handOverFocusToPrepTab } from "@/hooks/usePrepHeader";
import { usePrepTabReady } from "@/hooks/usePrepTabReady";
import { formatSeoulDateTime } from "@/lib/koreanTime";
import { criteriaVersionLabel, type PrepHistoryEntry } from "@/lib/prep/history";
import { loadPrepHistory, subscribePrepStorage } from "@/lib/prep/storage";

/** 기록이 없을 때의 링크가 가는 탭: 평가 · 배점 설정 */
const WEIGHTS_PATH = "/prep/weights";

// 서버 렌더링과 hydration 중에는 "아직 모름"(undefined)으로 그린다. 기록과 시각은 브라우저 저장소의 값이라 서버 HTML 에 없고,
// 서버 HTML 과 첫 클라이언트 렌더링이 같아 hydration 경고가 나지 않는다. "기록 없음" 안내가 잠깐 보였다가 사라지는 일도 없다.
function getServerSnapshot(): undefined {
  return undefined;
}

/**
 * 전형 준비 · 기준 변경 기록 탭 상태: 최신순 기록(50건까지). 시각은 한국 시간 글로, 기준 버전은 "v3" 같은 글로 바꿔 둔다.
 * 기준 버전은 그 변경을 저장해 생긴 평가 기준의 버전이다(처음 기준이 v1, 저장할 때마다 1 씩 는다. lib/prep/history.ts).
 * 기록이 없을 때 보여 주는 "평가 · 배점 설정으로 가기" 링크의 주소와 초점 넘기기도 여기서 준다.
 */
export function usePrepHistory() {
  const { ready, bodyRef } = usePrepTabReady<HTMLElement>();
  const entries = useSyncExternalStore<readonly PrepHistoryEntry[] | undefined>(
    subscribePrepStorage,
    loadPrepHistory,
    getServerSnapshot,
  );
  /** 기록이 없을 때의 "평가 · 배점 설정으로 가기" 링크 */
  const weightsLinkRef = useRef<HTMLAnchorElement>(null);
  return {
    ready,
    bodyRef,
    entries: entries?.map((entry) => ({
      id: entry.id,
      at: entry.at,
      timeText: formatSeoulDateTime(entry.at),
      actor: entry.actor,
      summary: entry.summary,
      // 화면이 읽는 목록은 정리된 목록이라 버전이 늘 있다. 없으면 빈 글로 둔다.
      versionText: entry.version === undefined ? "" : criteriaVersionLabel(entry.version),
    })),
    weightsPath: WEIGHTS_PATH,
    weightsLinkRef,
    /**
     * "평가 · 배점 설정으로 가기" 링크로 같은 탭에서 실제로 이동할 때(next/link 의 onNavigate). 이 링크는 이 화면 안에 있어 이동하면
     * 화면과 함께 숨겨지므로, 링크에 초점이 있었으면 이동하기 전에 초점을 머리의 같은 주소 탭 링크로 옮긴다
     * (hooks/usePrepHeader.ts 의 handOverFocusToPrepTab. 모집요강 올리기의 초안 안내 링크와 같은 처리다).
     */
    onWeightsLinkNavigate: () => handOverFocusToPrepTab(weightsLinkRef.current, WEIGHTS_PATH),
  };
}
