import Link from "next/link";
import type { RefObject } from "react";
import {
  AccentTag,
  BUTTON_PRIMARY_CLASS,
  BUTTON_SECONDARY_CLASS,
  PANEL_CLASS,
  PANEL_HEAD_CLASS,
  PANEL_TITLE_CLASS,
  Spinner,
  StatusChip,
  type ChipTone,
} from "@/components/consoleUi";
import { FOCUS_FALLBACK_PROPS, prepBodyProps } from "@/lib/prep/focusMarks";

type ConsensusMember = {
  number: number;
  /** 화면에 적는 위원 이름 ("홍길동 사정관") */
  label: string;
  /** AI 에 보내고 의견 정리에 적히는 이름 ("위원 1") */
  alias: string;
  /** 의견 입력란의 id (라벨과 잇는다) */
  inputId: string;
  /** 적은 의견 (없으면 빈 글) */
  text: string;
  /** 글자 수 글 ("12 / 1,000") */
  countText: string;
};

type ConsensusTabProps = {
  /** 탭이 준비됐는지 (준비 전에는 본문이 inert 라 초점을 받지 않고 눌리지 않는다. 모양은 그대로) */
  ready: boolean;
  /** 탭 본문 요소 (준비 여부를 이 요소가 문서에 붙었는지로 정한다) */
  bodyRef: RefObject<HTMLDivElement | null>;
  /** 모집 단위 이름 (왼쪽 단 머리 줄의 제목 옆) */
  department: string;
  members: ConsensusMember[];
  /** 의견 한 건의 최대 길이 */
  opinionLimit: number;
  /** 공통 기준 초안을 기다리는 중인지 (버튼은 aria-disabled, 입력란은 읽기 전용) */
  isGenerating: boolean;
  /** 초안을 만들 수 있는지 (의견을 적은 위원이 있고, 저장하지 않은 모집요강 초안이 없음) */
  canGenerate: boolean;
  /** 버튼 오른쪽 상태 글 (기다리는 동안에만 있다) */
  statusText: string;
  /** 저장하지 않은 모집요강 초안이 있을 때의 안내 */
  blockedNotice: string | null;
  /** 초안 만들기 실패 문구 */
  requestError: string | null;
  /** 의견을 저장소에 저장하지 못했을 때의 안내 */
  storageNotice: string | null;
  /** 공통 기준 초안이 있을 때의 안내에 딸린 경고. 초안이 없으면 null (안내를 그리지 않는다) */
  draftWarnings: readonly string[] | null;
  /** 의견 정리. 공통 기준 초안이 없으면 null (빈 목록 문장을 보여 준다) */
  points: { kindLabel: string; tone: ChipTone; title: string; body: string }[] | null;
  /** 의견 정리가 0건일 때 항목 대신 보여 주는 문장 */
  noPointsNotice: string | null;
  /** 안내의 링크가 가는 주소 (평가 · 배점 설정) */
  weightsPath: string;
  weightsLinkRef: RefObject<HTMLAnchorElement | null>;
  onOpinionChange: (number: number, text: string) => void;
  onGenerate: () => void;
  /** 안내의 링크로 같은 탭에서 이동할 때 (링크에 초점이 있었으면 이동 전에 초점을 머리의 탭 링크로 옮긴다) */
  onWeightsLinkNavigate: () => void;
};

/**
 * 전형 준비 · 공통 기준 협의 탭(/prep/consensus): 테두리 상자 하나를 둘로 나눠 왼쪽에 "위원 의견"(위원별 의견 입력란과
 * "공통 기준 초안 만들기"), 오른쪽에 "의견 정리"(초안이 있으면 모인 의견·협의할 점, 없으면 빈 목록 문장)를 둔다.
 * 디자인 시안에 없는 탭이라 모집요강 올리기 탭의 짜임(두 단 상자, 머리 줄, 버튼 줄과 상태 글, 실패 문구, 초안 안내)과
 * components/consoleUi.tsx 의 조각·색을 그대로 썼다. 상자는 본문의 남는 높이를 채우고, 폭이 모자라면 오른쪽 단이 아래로 내려간다.
 * 의견 입력란은 평가하기 총평의 글 입력란과 같은 모양이다. 기다리는 동안에는 읽기 전용이 된다(초점은 남는다).
 * 새로 나타나는 것(안내, 실패 문구, 의견 정리)은 제자리에서 옅게 나타난다.
 */
export function ConsensusTab({
  ready,
  bodyRef,
  department,
  members,
  opinionLimit,
  isGenerating,
  canGenerate,
  statusText,
  blockedNotice,
  requestError,
  storageNotice,
  draftWarnings,
  points,
  noPointsNotice,
  weightsPath,
  weightsLinkRef,
  onOpinionChange,
  onGenerate,
  onWeightsLinkNavigate,
}: ConsensusTabProps) {
  const buttonOff = isGenerating || !canGenerate;
  return (
    <div
      ref={bodyRef}
      {...prepBodyProps(ready)}
      className={`mt-[16px] flex flex-[1_1_auto] flex-wrap items-stretch ${PANEL_CLASS}`}
    >
      <section aria-labelledby="opinions-title" className="flex min-w-0 flex-[999_1_420px] flex-col">
        {/* 머리 줄: 평가·배점 설정의 왼쪽 머리 줄과 같다(높이 40px 에 아래 선 1px, 모집 단위 이름이 길면 늘어난다). */}
        <div
          className={`${PANEL_HEAD_CLASS} box-border flex min-h-[41px] flex-wrap items-center gap-x-[10px] rounded-tl-[7px] px-[20px] py-[11px]`}
        >
          <h2 id="opinions-title" className={PANEL_TITLE_CLASS}>
            위원 의견
          </h2>
          <span className="min-w-0 text-[13px] leading-[18px] text-[#505050] [overflow-wrap:anywhere]">{department}</span>
        </div>
        <div className="flex flex-[1_1_auto] flex-col p-[20px]">
          {members.map((member, index) => (
            <div key={member.number} className={index === 0 ? "" : "mt-[16px]"}>
              <div className="flex flex-wrap items-center gap-x-[8px] gap-y-[2px]">
                <label htmlFor={member.inputId} className="text-[14px] leading-[20px] font-semibold [overflow-wrap:anywhere]">
                  {member.label}
                </label>
                <AccentTag>{member.alias}</AccentTag>
                <span className="ml-auto text-[12px] leading-[18px] text-[#767676] tabular-nums">{member.countText}</span>
              </div>
              {/*
                첫 입력란은 늘 있고 꺼지지 않아, 초점이 있던 컨트롤이 사라졌을 때 되돌릴 곳이다(hooks/usePrepFocusKeeper.ts).
                기다리는 동안 disabled 대신 읽기 전용으로 두어 초점이 입력란에 남게 한다.
              */}
              <textarea
                id={member.inputId}
                placeholder="의견을 입력하세요."
                maxLength={opinionLimit}
                value={member.text}
                readOnly={isGenerating}
                {...(index === 0 ? FOCUS_FALLBACK_PROPS : {})}
                onChange={(event) => onOpinionChange(member.number, event.currentTarget.value)}
                className="motion-colors mt-[6px] box-border block h-[96px] w-full scroll-m-[8px] resize-y rounded-[6px] border border-[#CFCFCF] bg-white px-[10px] py-[8px] text-[13px] leading-[20px] text-[#111111] placeholder:text-[#767676] read-only:bg-[#F6F7FB] read-only:text-[#505050] hover:border-[#AEAEAE]"
              />
            </div>
          ))}

          <div className="mt-[16px] flex flex-wrap items-center gap-x-[12px] gap-y-[8px]">
            {/*
              만들 수 없는 동안과 기다리는 동안 disabled 대신 aria-disabled 로 두어(누르면 상태 훅이 아무것도 하지 않는다) 초점이 버튼에
              남게 한다. 모양은 모집요강 올리기의 "기준 초안 만들기" 와 같다(꺼지면 옅은 회색 바탕, 회색 글자, 기본 화살표 커서).
            */}
            <button
              type="button"
              aria-disabled={buttonOff ? "true" : undefined}
              onClick={onGenerate}
              className={`${BUTTON_PRIMARY_CLASS} h-[36px] scroll-m-[8px] cursor-pointer px-[14px] aria-disabled:cursor-default aria-disabled:border-[#E4E6EE] aria-disabled:bg-[#E4E6EE] aria-disabled:text-[#505050]`}
            >
              공통 기준 초안 만들기
            </button>
            <p aria-live="polite" className="flex items-center gap-[6px] text-[13px] leading-[18px] text-[#505050]">
              {isGenerating && <Spinner />}
              {statusText}
            </p>
          </div>

          {requestError !== null && (
            <p
              role="alert"
              className="mt-[8px] animate-fade-in text-[13px] leading-[18px] font-medium text-[#BA1A1A] [overflow-wrap:anywhere]"
            >
              {requestError}
            </p>
          )}
          {storageNotice !== null && (
            <p role="alert" className="mt-[8px] animate-fade-in text-[13px] leading-[18px] font-medium text-[#BA1A1A]">
              {storageNotice}
            </p>
          )}

          {/* 안내는 늘 있는 알림 영역 안에 그려 나타날 때 읽히게 한다(없으면 빈 영역이라 모양에 영향이 없다). */}
          <div aria-live="polite">
            {blockedNotice !== null && (
              <NoticeBox
                text={blockedNotice}
                href={weightsPath}
                linkRef={weightsLinkRef}
                onNavigate={onWeightsLinkNavigate}
                warnings={[]}
              />
            )}
            {draftWarnings !== null && (
              <NoticeBox
                text="공통 기준 초안을 만들었습니다."
                href={weightsPath}
                linkRef={weightsLinkRef}
                onNavigate={onWeightsLinkNavigate}
                warnings={draftWarnings}
              />
            )}
          </div>
        </div>
      </section>

      <section
        aria-labelledby="points-title"
        className="box-border flex max-w-[400px] min-w-0 flex-[1_1_400px] flex-col border-l border-l-[#E4E4E4]"
      >
        <div className={`flex h-[40px] items-center rounded-tr-[7px] px-[20px] ${PANEL_HEAD_CLASS}`}>
          <h2 id="points-title" className={PANEL_TITLE_CLASS}>
            의견 정리
          </h2>
        </div>
        {/* 낱말 가운데에서 줄을 바꾸지 않되(keep-all), 빈칸 없이 아주 긴 글은 상자를 넘지 않게 끊는다(anywhere). */}
        <div aria-live="polite" className="px-[20px] pt-[4px] pb-[8px] [overflow-wrap:anywhere] [word-break:keep-all]">
          {points === null ? (
            <p className="py-[12px] text-[13px] leading-[20px] text-[#505050]">아직 정리된 의견이 없습니다.</p>
          ) : (
            <div className="animate-fade-in">
              {noPointsNotice !== null && (
                <p className="py-[12px] text-[13px] leading-[20px] text-[#505050]">{noPointsNotice}</p>
              )}
              {/* 의견 정리는 제목이 겹칠 수 있어 순서를 key 로 쓴다(목록은 통째로 바뀔 뿐 항목을 옮기지 않는다). */}
              {points.map((point, index) => (
                <div key={index} className={`py-[12px]${index === 0 ? "" : " border-t border-t-[#E4E4E4]"}`}>
                  <div className="flex flex-wrap items-center gap-x-[8px] gap-y-[4px]">
                    <StatusChip tone={point.tone}>{point.kindLabel}</StatusChip>
                    <h3 className="min-w-0 text-[14px] leading-[20px] font-semibold">{point.title}</h3>
                  </div>
                  <p className="mt-[6px] text-[13px] leading-[20px] text-[#505050]">{point.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

type NoticeBoxProps = {
  text: string;
  href: string;
  linkRef: RefObject<HTMLAnchorElement | null>;
  onNavigate: () => void;
  warnings: readonly string[];
};

/**
 * 안내 상자: 문장과 "평가 · 배점 설정으로 이동" 링크(버튼 모양의 보통 링크), 그 아래 경고 목록(받은 문장 그대로).
 * 모집요강 올리기의 초안 안내와 같은 모양이다.
 */
function NoticeBox({ text, href, linkRef, onNavigate, warnings }: NoticeBoxProps) {
  return (
    <div className="mt-[12px] animate-fade-in rounded-[6px] border border-[#E4E4E4] px-[12px] py-[10px] text-[13px] leading-[18px] [overflow-wrap:anywhere]">
      <div className="flex flex-wrap items-center gap-x-[12px] gap-y-[8px]">
        <p className="min-w-0 flex-[1_1_240px] font-medium text-[#111111]">{text}</p>
        <Link
          ref={linkRef}
          href={href}
          onNavigate={onNavigate}
          className={`${BUTTON_SECONDARY_CLASS} h-[28px] flex-none scroll-m-[8px] px-[10px]`}
        >
          평가 · 배점 설정으로 이동
        </Link>
      </div>
      {warnings.length > 0 && (
        <ul className="mt-[6px] text-[13px] leading-[18px] font-normal text-[#505050] [overflow-wrap:anywhere]">
          {warnings.map((warning, index) => (
            <li key={index}>{warning}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
