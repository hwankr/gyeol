import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { handOverFocusToPrepTab } from "@/hooks/usePrepHeader";
import { usePrepTabReady } from "@/hooks/usePrepTabReady";
import { RequestCanceledError } from "@/lib/apiClient";
import { requestConsensusDraft } from "@/lib/consensusClient";
import { COMMITTEE_MEMBERS, memberAlias, memberLabel } from "@/lib/prep/committee";
import { CONSENSUS_LIMITS, type ConsensusOpinion } from "@/lib/prep/consensusDraft";
import type { PrepCriteria } from "@/lib/prep/criteria";
import { DEFAULT_PREP_CRITERIA } from "@/lib/prep/defaultCriteria";
import {
  NO_OPINIONS,
  hasUnsavedPrepOpinions,
  loadPrepOpinions,
  setPrepOpinion,
  subscribePrepOpinions,
  type PrepOpinions,
} from "@/lib/prep/opinionStorage";
import { loadPrepCriteria, loadPrepDraft, setPrepDraft, subscribePrepStorage, type PrepDraft } from "@/lib/prep/storage";

/** 초안을 기다리는 동안의 상태 글 */
const GENERATING_STATUS = "위원 의견을 모으는 중…";

/** 예상하지 못한 실패 (lib/consensusClient.ts 가 문구를 담아 던지지 않은 경우) */
const GENERATE_ERROR = "공통 기준 초안을 만들지 못했습니다. 다시 시도해 주세요.";

/** 모집요강 초안이 저장되지 않은 채 남아 있을 때의 안내 (공통 기준은 저장한 평가 기준에서 시작한다) */
const BLOCKED_NOTICE = "저장하지 않은 모집요강 초안이 있습니다. 먼저 저장하거나 취소해 주세요.";

/** 저장소에 쓰지 못해 메모리에만 둔 의견이 있을 때의 안내 */
const STORAGE_NOTICE = "의견을 브라우저에 저장하지 못했습니다. 새로고침하면 방금 적은 의견이 사라집니다.";

/** 의견 정리가 0건일 때의 문장 */
const NO_POINTS_NOTICE = "정리할 점이 없습니다.";

/** 안내의 링크가 가는 탭: 평가 · 배점 설정 (components/ConsensusTab.tsx 의 링크 주소와 같다) */
const WEIGHTS_PATH = "/prep/weights";

/** 의견 정리 한 건의 종류 글과 상태 표시 색 (색만으로 구분하지 않도록 글을 같이 적는다) */
const POINT_KINDS = {
  agreed: { label: "모인 의견", tone: "green" },
  open: { label: "협의 필요", tone: "amber" },
} as const;

// 서버 렌더링과 hydration 중에는 초안·의견이 없고(브라우저 메모리·저장소의 값이다) 저장한 평가 기준은 기본값이다.
// 그래서 서버 HTML 과 첫 클라이언트 렌더링이 같아 hydration 경고가 나지 않는다(hooks/useGuidelineUpload.ts 와 같은 방식).
function getServerDraft(): PrepDraft | null {
  return null;
}

function getServerCriteria(): PrepCriteria {
  return DEFAULT_PREP_CRITERIA;
}

function getServerOpinions(): PrepOpinions {
  return NO_OPINIONS;
}

function getServerUnsaved(): boolean {
  return false;
}

/** 위원 의견 입력란의 id (라벨과 잇는다) */
function opinionInputId(number: number): string {
  return `prep-opinion-${number}`;
}

/** 글자 수 글: "12 / 1,000" */
function countText(length: number): string {
  return `${length.toLocaleString("ko-KR")} / ${CONSENSUS_LIMITS.opinionLength.toLocaleString("ko-KR")}`;
}

/**
 * 전형 준비 · 공통 기준 협의 탭 상태: 위원별 의견(localStorage), 공통 기준 초안 만들기(POST /api/consensus), 초안 안내, 의견 정리.
 * 같은 모집 단위를 평가하는 위원들이 평가 기준과 적용 방향에 대한 의견을 자연어로 적으면, AI 가 저장한 평가 기준을 바탕으로
 * 의견을 모은 공통 기준 초안(세부 평가 항목과 배점 제안)과 의견 정리(모인 의견, 더 협의할 점)를 만든다.
 * 받은 초안은 lib/prep/storage.ts 의 메모리에 둔다(탭을 오가도 남고 새로고침하면 사라진다). 위원들이 다시 협의해 배점을 정하고
 * 저장하는 것은 평가·배점 설정에서 한다. 저장한 기준은 그 뒤에 올리는 학생부의 분석과 평가에 쓰인다.
 * 로그인이 모양뿐이라 위원마다 따로 들어와 적지 않고 이 화면의 위원별 칸에 적는다. AI 에는 위원 이름 대신 번호("위원 1")만 보낸다.
 */
export function usePrepConsensus() {
  const { ready, bodyRef } = usePrepTabReady<HTMLDivElement>();
  const draft = useSyncExternalStore(subscribePrepStorage, loadPrepDraft, getServerDraft);
  const saved = useSyncExternalStore(subscribePrepStorage, loadPrepCriteria, getServerCriteria);
  const opinions = useSyncExternalStore(subscribePrepOpinions, loadPrepOpinions, getServerOpinions);
  const opinionsUnsaved = useSyncExternalStore(subscribePrepOpinions, hasUnsavedPrepOpinions, getServerUnsaved);
  const [isGenerating, setIsGenerating] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  /** 안내의 "평가 · 배점 설정으로 이동" 링크 (모집요강 초안 안내와 공통 기준 초안 안내 가운데 하나만 보인다) */
  const weightsLinkRef = useRef<HTMLAnchorElement>(null);
  /** 진행 중인 요청을 취소하는 컨트롤러. 진행 중인 요청이 없으면 null(요청은 한 번에 하나). */
  const requestRef = useRef<AbortController | null>(null);
  /** 요청 세대 번호. 새 요청을 시작할 때와 이 화면이 숨겨지거나 언마운트될 때 늘린다(늦게 온 응답은 버린다). */
  const generationRef = useRef(0);

  // 이 화면의 수명 관리 (hooks/useGuidelineUpload.ts 와 같은 방식). 숨겨지거나 언마운트될 때 진행 중인 요청을 취소하고
  // 세대 번호를 올려 늦게 오는 응답이 아무것도 바꾸지 못하게 한 뒤 기다림 표시와 실패 문구를 지운다.
  // 위원 의견(저장소)과 초안(메모리)은 되돌리지 않는다.
  useLayoutEffect(() => {
    return () => {
      generationRef.current += 1;
      requestRef.current?.abort();
      requestRef.current = null;
      setIsGenerating(false);
      setRequestError(null);
    };
  }, []);

  /** 의견을 적은 위원의 의견 (앞뒤 공백을 뺀 글이 비지 않은 것만, 위원 순서대로) */
  const written: ConsensusOpinion[] = COMMITTEE_MEMBERS.flatMap((member) => {
    const text = (opinions[member.number] ?? "").trim();
    return text === "" ? [] : [{ member: member.number, role: member.role, text }];
  });
  const consensusDraft = draft?.source === "consensus" ? draft : null;
  // 공통 기준은 저장한 평가 기준에서 시작한다. 저장하지 않은 모집요강 초안이 있으면 먼저 그 초안을 저장하거나 취소해야 한다
  // (초안은 한 번에 하나라서, 그대로 만들면 모집요강 초안이 사라진다).
  const blocked = draft?.source === "guideline";
  const canGenerate = written.length > 0 && !blocked;

  async function generate() {
    // 기다리는 동안이나 만들 수 없는 동안에는 눌러도 아무 일도 하지 않는다(버튼은 aria-disabled).
    if (!canGenerate || requestRef.current !== null) return;
    generationRef.current += 1;
    const generation = generationRef.current;
    const controller = new AbortController();
    requestRef.current = controller;
    /** 이 요청이 아직 유효한지: 취소되지 않았고, 그 뒤로 새 요청이나 화면 숨김이 없었는지 */
    const isCurrent = () => !controller.signal.aborted && generationRef.current === generation;

    setIsGenerating(true);
    setRequestError(null);

    try {
      const result = await requestConsensusDraft({ criteria: saved, opinions: written }, controller.signal);
      if (!isCurrent()) return;
      setPrepDraft({
        source: "consensus",
        criteria: result.criteria,
        memberCount: written.length,
        points: result.points,
        warnings: result.warnings,
      });
    } catch (error) {
      // 취소된 요청이나 더 이상 유효하지 않은 요청은 아무것도 바꾸지 않는다(오류 문구도 세우지 않는다).
      if (error instanceof RequestCanceledError || !isCurrent()) return;
      setRequestError(error instanceof Error ? error.message : GENERATE_ERROR);
    }
    requestRef.current = null;
    setIsGenerating(false);
  }

  return {
    ready,
    bodyRef,
    department: saved.department,
    members: COMMITTEE_MEMBERS.map((member) => {
      const text = opinions[member.number] ?? "";
      return {
        number: member.number,
        label: memberLabel(member),
        alias: memberAlias(member.number),
        inputId: opinionInputId(member.number),
        text,
        countText: countText(text.length),
      };
    }),
    opinionLimit: CONSENSUS_LIMITS.opinionLength,
    isGenerating,
    canGenerate,
    /** 버튼 오른쪽 상태 글 (기다리는 동안에만 있다) */
    statusText: isGenerating ? GENERATING_STATUS : "",
    blockedNotice: blocked ? BLOCKED_NOTICE : null,
    requestError,
    storageNotice: opinionsUnsaved ? STORAGE_NOTICE : null,
    /** 공통 기준 초안이 있을 때의 안내에 딸린 경고. 초안이 없으면 null */
    draftWarnings: consensusDraft === null ? null : consensusDraft.warnings,
    /** 의견 정리. 공통 기준 초안이 없으면 null (화면은 빈 목록 문장을 보여 준다) */
    points:
      consensusDraft === null
        ? null
        : consensusDraft.points.map((point) => ({
            kindLabel: POINT_KINDS[point.kind].label,
            tone: POINT_KINDS[point.kind].tone,
            title: point.title,
            body: point.body,
          })),
    noPointsNotice: consensusDraft !== null && consensusDraft.points.length === 0 ? NO_POINTS_NOTICE : null,
    weightsPath: WEIGHTS_PATH,
    weightsLinkRef,
    /** 위원 의견 입력란의 글이 바뀜 (기다리는 동안에는 입력란이 읽기 전용이라 불리지 않는다) */
    onOpinionChange: (number: number, text: string) => {
      if (requestRef.current === null) setPrepOpinion(number, text);
    },
    onGenerate: () => void generate(),
    /**
     * 안내의 "평가 · 배점 설정으로 이동" 링크로 같은 탭에서 실제로 이동할 때(next/link 의 onNavigate). 링크에 초점이 있었으면
     * 이동하기 전에 초점을 머리의 같은 주소 탭 링크로 옮긴다(hooks/usePrepHeader.ts 의 handOverFocusToPrepTab).
     */
    onWeightsLinkNavigate: () => handOverFocusToPrepTab(weightsLinkRef.current, WEIGHTS_PATH),
  };
}
