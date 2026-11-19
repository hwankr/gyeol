import Link from "next/link";
import type { RefObject } from "react";
import { BUTTON_SECONDARY_CLASS, PANEL_CLASS, PANEL_HEAD_CLASS } from "@/components/consoleUi";
import { prepBodyProps } from "@/lib/prep/focusMarks";

type HistoryTabProps = {
  /** 탭이 준비됐는지 (준비 전에는 본문이 inert. 모양은 그대로) */
  ready: boolean;
  /** 탭 본문 요소 (준비 여부를 이 요소가 문서에 붙었는지로 정한다) */
  bodyRef: RefObject<HTMLElement | null>;
  /**
   * 최신순 기록. versionText 는 그 변경으로 생긴 기준 버전("v3").
   * 브라우저 저장소를 읽기 전(서버 렌더링·hydration 중)에는 undefined 라 표 머리 줄만 그린다.
   */
  entries: { id: string; at: string; timeText: string; actor: string; summary: string; versionText: string }[] | undefined;
  /** 기록이 없을 때의 링크가 가는 주소 (평가 · 배점 설정 탭) */
  weightsPath: string;
  /** 그 링크 (상태 훅이 초점을 넘길 때 쓴다) */
  weightsLinkRef: RefObject<HTMLAnchorElement | null>;
  /** 그 링크로 같은 탭에서 이동할 때 (링크에 초점이 있었으면 이동 전에 초점을 머리의 탭 링크로 옮긴다) */
  onWeightsLinkNavigate: () => void;
};

/** 표의 줄(머리 줄·기록 줄)이 같이 쓰는 칸 나눔: 변경 일시 160px, 변경한 사람 120px, 변경 내용(남는 폭), 기준 버전 120px */
const ROW_GRID_CLASS = "grid grid-cols-[160px_120px_minmax(0,1fr)_120px] gap-x-[12px] px-[20px]";

/**
 * 전형 준비 · 기준 변경 기록 탭(/prep/history): 테두리 상자 하나에 네 칸짜리 표(변경 일시, 변경한 사람, 변경 내용, 기준 버전).
 * 상자는 본문의 남는 높이를 채운다. 표 머리 줄과 기록이 없을 때의 안내(문장 둘과 "평가 · 배점 설정으로 가기" 링크)는 디자인 값 그대로다.
 * 디자인은 기록이 없는 모습뿐이라 기록 줄은 다른 화면의 표와 같은 모양새로 정했다: 줄마다 아래 선, 글자 14px, 한 줄일 때 높이 48px,
 * 변경 내용과 기준 버전은 검은 글자(버전은 굵게). 내용이 길면 그 칸 안에서 줄을 바꾸고 나머지 칸은 위에 맞춘다.
 * 표는 div 에 역할(role)을 붙여 만들었다(칸 나눔이 grid 라서). 좁은 화면에서는 표(머리 줄과 기록 줄)가 상자 안에서 가로로 스크롤되고,
 * 기록이 없을 때의 안내는 스크롤 영역 밖에 있어 늘 상자 가운데에 보인다.
 */
export function HistoryTab({ ready, bodyRef, entries, weightsPath, weightsLinkRef, onWeightsLinkNavigate }: HistoryTabProps) {
  const hasRows = entries !== undefined && entries.length > 0;
  return (
    <section
      ref={bodyRef}
      {...prepBodyProps(ready)}
      aria-label="기준 변경 기록"
      className={`mt-[16px] flex flex-[1_1_auto] flex-col ${PANEL_CLASS}`}
    >
      {/* 가로 스크롤 영역. 위쪽 모서리를 상자에 맞춰 둥글려 머리 줄 바탕이 상자 모서리 밖으로 비치지 않게 한다. */}
      <div className="flex-none overflow-x-auto rounded-t-[7px]">
        <div role="table" className="min-w-[720px]">
          <div role="rowgroup">
            <div
              role="row"
              className={`${ROW_GRID_CLASS} h-[40px] items-center rounded-t-[7px] text-[12px] leading-[16px] font-semibold text-[#505050] ${PANEL_HEAD_CLASS}`}
            >
              <span role="columnheader">변경 일시</span>
              <span role="columnheader">변경한 사람</span>
              <span role="columnheader">변경 내용</span>
              <span role="columnheader">기준 버전</span>
            </div>
          </div>
          {hasRows && (
            <div role="rowgroup">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  role="row"
                  className={`${ROW_GRID_CLASS} min-h-[48px] items-start border-b border-b-[#E4E4E4] py-[14px] text-[14px] leading-[20px] text-[#505050]`}
                >
                  <span role="cell" className="tabular-nums">
                    <time dateTime={entry.at}>{entry.timeText}</time>
                  </span>
                  <span role="cell" className="[overflow-wrap:anywhere]">
                    {entry.actor}
                  </span>
                  <span role="cell" className="text-[#111111] [overflow-wrap:anywhere]">
                    {entry.summary}
                  </span>
                  <span role="cell" className="font-semibold text-[#111111] tabular-nums">
                    {entry.versionText}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* 기록이 없을 때의 안내 자리. 저장소를 읽기 전에는 같은 크기로 비워 두어 안내가 나타날 때 상자 높이가 바뀌지 않는다. */}
      {!hasRows && (
        <div className="flex min-h-[280px] flex-[1_1_auto] flex-col items-center justify-center gap-[6px] px-[20px] py-[32px] text-center">
          {entries !== undefined && (
            <>
              <p className="text-[15px] leading-[22px] font-semibold">아직 변경 기록이 없습니다.</p>
              <p className="text-[14px] leading-[20px] text-[#505050]">
                평가 · 배점 설정을 저장하면 바꾸기 전과 후의 값이 이곳에 남습니다.
              </p>
              <Link
                ref={weightsLinkRef}
                href={weightsPath}
                onNavigate={onWeightsLinkNavigate}
                className={`${BUTTON_SECONDARY_CLASS} mt-[10px] h-[36px] scroll-m-[8px] px-[14px]`}
              >
                평가 · 배점 설정으로 가기
              </Link>
            </>
          )}
        </div>
      )}
    </section>
  );
}
