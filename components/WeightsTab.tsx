import { Fragment, type RefObject } from "react";
import {
  AccentTag,
  BUTTON_PRIMARY_CLASS,
  BUTTON_SECONDARY_CLASS,
  PANEL_CLASS,
  PANEL_HEAD_CLASS,
  PANEL_TITLE_CLASS,
} from "@/components/consoleUi";
import type { NumberedGroup } from "@/lib/prep/criteria";
import { FOCUS_FALLBACK_PROPS, prepBodyProps } from "@/lib/prep/focusMarks";
import { HOLD_REPEAT_ATTRIBUTE, HOLD_REPEAT_VALUE } from "@/lib/prep/keyRepeat";

type WeightElement = {
  id: string;
  /** 배점 −·+ 버튼의 id (0·100 에 닿을 때 상태 훅이 반대쪽 버튼으로 초점을 옮긴다) */
  decreaseButtonId: string;
  increaseButtonId: string;
  name: string;
  /** 요소 이름 아래 태그 줄 ("#교과성취 #학업발전 …") */
  tagsLine: string;
  /** 화면에 보이는 배점 (수정 상태에서는 고치는 중인 값) */
  weight: number;
  canDecrease: boolean;
  canIncrease: boolean;
};

type WeightsTabProps = {
  /** 탭이 준비됐는지 (준비 전에는 본문이 inert 라 초점을 받지 않고 눌리지 않는다. 모양은 그대로) */
  ready: boolean;
  /** 탭 본문의 두 단 상자 (준비 여부를 이 요소가 문서에 붙었는지로 정한다) */
  bodyRef: RefObject<HTMLDivElement | null>;
  /** 모집 단위 이름 (왼쪽 단 머리 줄의 제목 옆) */
  department: string;
  /** 모집요강 초안이 있을 때 탭 줄 아래에 보여 주는 안내 (없으면 null) */
  draftNotice: string | null;
  /** 수정하기·저장하기 왼쪽의 안내 한 줄 (보기 상태, 수정 상태, 방금 저장한 뒤) */
  modeNote: string;
  elements: WeightElement[];
  /** 고른 요소의 순서 (0 부터). 그 요소의 이름만 파란 글자다. */
  selectedIndex: number;
  /** 고른 요소의 세부 평가 항목 */
  detail: { name: string; groups: NumberedGroup[] };
  /** 배점 막대(range 입력란)의 눈금 */
  weightRange: { min: number; max: number; step: number };
  total: number;
  totalMax: number;
  editing: boolean;
  canSave: boolean;
  /** 합계 안내 (수정 상태에서 합계가 100 이 아닐 때) */
  totalNotice: string | null;
  /** 저장소에 저장하지 못했을 때의 안내 */
  storageNotice: string | null;
  /** 세부 평가 항목을 크게 보는 중인지 (왼쪽 단을 그리지 않고 패널이 상자 폭 전체를 쓴다) */
  big: boolean;
  /** 고른 요소의 이름 버튼 */
  selectedNameButtonRef: RefObject<HTMLButtonElement | null>;
  /** 수정하기·취소 버튼 (저장 뒤 초점을 여기로 옮긴다) */
  editButtonRef: RefObject<HTMLButtonElement | null>;
  /** 크게 보기·작게 보기 버튼 */
  bigButtonRef: RefObject<HTMLButtonElement | null>;
  /** 요소를 고른다. hadFocus 는 누른 이름 버튼에 초점이 있었는지 (있었으면 다시 그린 뒤 그 버튼이 보이게 한다) */
  onSelectElement: (id: string, hadFocus: boolean) => void;
  /** 배점 −·+. hadFocus 는 누른 버튼에 초점이 있었는지 */
  onDecrease: (id: string, hadFocus: boolean) => void;
  onIncrease: (id: string, hadFocus: boolean) => void;
  /** 배점 막대를 움직였을 때. value 는 막대의 새 값 */
  onSetWeight: (id: string, value: number) => void;
  /** 수정하기·취소. hadFocus 는 누른 버튼에 초점이 있었는지 */
  onToggleEditing: (hadFocus: boolean) => void;
  /** 저장하기. hadFocus 는 누른 버튼에 초점이 있었는지 (있었으면 저장 뒤 초점이 수정하기 버튼으로 간다) */
  onSave: (hadFocus: boolean) => void;
  /** 크게 보기·작게 보기. hadFocus 는 누른 버튼에 초점이 있었는지 */
  onToggleBig: (hadFocus: boolean) => void;
};

const DETAIL_GUIDE = "1~5점의 척도 평가로 진행됩니다.";

/**
 * 전형 준비 · 평가·배점 설정 탭(/prep/weights): 안내 한 줄과 수정하기·저장하기, 그 아래 테두리 상자 하나에 두 단
 * (왼쪽 평가 요소와 배점, 오른쪽 세부 평가 항목 패널). 치수·색·글자는 디자인 값 그대로다.
 * 두 단은 줄을 바꾸는 flex 라서(왼쪽 420px·오른쪽 440px 기준, 오른쪽은 480px 까지) 상자가 좁으면 오른쪽 단이 아래로 내려간다.
 * 상자는 본문(<main>)의 남는 높이를 채우고, 내용이 길면 문서가 세로로 스크롤된다(패널 안에서 따로 스크롤하지 않는다).
 * 배점은 수정 상태에서 −·+ (1 씩)와 배점 막대(range 입력란)로 바꾼다. 보기 상태에서는 셋 다 꺼져 있다.
 * 요소 이름은 버튼이고 누르면 그 요소의 세부 평가 항목이 오른쪽 패널에 나온다. 디자인은 첫 요소를 고른 모습뿐이고 고르는 컨트롤이
 * 없어, 고른 요소는 이름을 파란 글자(#001AD0)로 적고 패널 머리 줄의 꼬리표에도 그 이름을 적는다(색만으로 구분하지 않는다).
 * "크게 보기" 를 누르면 왼쪽 단을 그리지 않고 패널이 상자 폭 전체를 쓰며 질문 글자가 16px 이 된다(버튼 글자는 "작게 보기").
 * 디자인에 없어 정한 것: 모집요강 초안 안내(탭 줄 아래 16px, 옅은 파란 바탕), 저장소에 저장하지 못했을 때의 안내(버튼 줄 아래 8px, 빨간 글자).
 * 움직임: 요소를 고르거나 크게·작게 보기를 바꾸면 세부 평가 항목이 옅게 나타난다(opacity 만. 자리·크기는 바로 바뀐다:
 * hooks/usePrepFocusKeeper.ts 가 바뀐 직후의 자리를 잰다). 요소 이름은 마우스를 올리면 파란 글자가 된다.
 */
export function WeightsTab({
  ready,
  bodyRef,
  department,
  draftNotice,
  modeNote,
  elements,
  selectedIndex,
  detail,
  weightRange,
  total,
  totalMax,
  editing,
  canSave,
  totalNotice,
  storageNotice,
  big,
  selectedNameButtonRef,
  editButtonRef,
  bigButtonRef,
  onSelectElement,
  onDecrease,
  onIncrease,
  onSetWeight,
  onToggleEditing,
  onSave,
  onToggleBig,
}: WeightsTabProps) {
  return (
    <>
      {draftNotice !== null && (
        <p
          {...prepBodyProps(ready)}
          className="mt-[16px] animate-fade-in rounded-[6px] bg-[#EEF0FF] px-[12px] py-[8px] text-[13px] leading-[18px] font-medium text-[#001AD0] [overflow-wrap:anywhere]"
        >
          {draftNotice}
        </p>
      )}
      <div {...prepBodyProps(ready)} className={draftNotice === null ? "mt-[16px]" : "mt-[12px]"}>
        <div className="flex flex-wrap items-center justify-between gap-x-[16px] gap-y-[8px]">
          {/* 알림 영역은 처음부터 있어, 수정 상태에 들어가거나 저장한 뒤 글자가 바뀔 때 읽힌다. */}
          <p aria-live="polite" className="text-[13px] leading-[18px] text-[#505050]">
            {modeNote}
          </p>
          <div className="flex gap-[8px]">
            <button
              ref={editButtonRef}
              type="button"
              onClick={(event) => onToggleEditing(event.currentTarget === document.activeElement)}
              className={`${BUTTON_SECONDARY_CLASS} ${TOOL_BUTTON_CLASS}`}
            >
              {editing ? "취소" : "수정하기"}
            </button>
            <button
              type="button"
              disabled={!canSave}
              onClick={(event) => onSave(event.currentTarget === document.activeElement)}
              className={`${BUTTON_PRIMARY_CLASS} ${TOOL_BUTTON_CLASS}`}
            >
              저장하기
            </button>
          </div>
        </div>
        {/* 크게 보는 중에도(왼쪽 단이 없어도) 보이도록 두 단 상자 밖에 둔다. */}
        {storageNotice !== null && (
          <p role="alert" className="mt-[8px] animate-fade-in text-[13px] leading-[18px] font-medium text-[#BA1A1A]">
            {storageNotice}
          </p>
        )}
      </div>
      <div
        ref={bodyRef}
        {...prepBodyProps(ready)}
        className={`${PANEL_CLASS} mt-[12px] flex flex-[1_1_auto] flex-wrap items-stretch`}
      >
        {!big && (
          <section
            aria-labelledby="weights-title"
            className="box-border min-w-0 flex-[999_1_420px] border-r border-r-[#E4E4E4]"
          >
            {/*
              머리 줄: 높이 40px 에 아래 선 1px(합쳐 41px). 모집 단위 이름이 길어 줄이 바뀌면 늘어나도록 높이 대신 최소 높이와
              위아래 여백(11 + 18 + 11)으로 맞췄다. 한 줄일 때의 모양은 디자인과 같다.
            */}
            <div
              className={`${PANEL_HEAD_CLASS} box-border flex min-h-[41px] flex-wrap items-center gap-x-[10px] rounded-[7px_0_0_0] px-[20px] py-[11px]`}
            >
              <h2 id="weights-title" className={PANEL_TITLE_CLASS}>
                평가 · 배점 설정
              </h2>
              <span className="min-w-0 text-[13px] leading-[18px] text-[#505050] [overflow-wrap:anywhere]">
                {department}
              </span>
            </div>
            <div className="px-[20px]">
              {elements.map((element, index) => (
                <ElementRow
                  key={element.id}
                  element={element}
                  selected={index === selectedIndex}
                  editing={editing}
                  weightRange={weightRange}
                  selectedNameButtonRef={selectedNameButtonRef}
                  onSelectElement={onSelectElement}
                  onDecrease={onDecrease}
                  onIncrease={onIncrease}
                  onSetWeight={onSetWeight}
                />
              ))}
              <div className="flex flex-wrap items-baseline justify-end gap-x-[12px] gap-y-[4px] pt-[14px] pb-[16px]">
                {/* 안내가 없을 때는 빈 칸(너비 0)으로 두어 모양이 디자인과 같고, 알림 영역은 처음부터 있어 바뀔 때 읽힌다. */}
                <p aria-live="polite" className="mr-auto text-[13px] leading-[18px] font-medium text-[#BA1A1A]">
                  {totalNotice}
                </p>
                <span className="text-[13px] leading-[18px] font-medium text-[#505050]">합계</span>
                <p
                  className={`motion-colors text-[22px] leading-[30px] font-bold tabular-nums ${
                    total === totalMax ? "text-[#111111]" : "text-[#BA1A1A]"
                  }`}
                >
                  {total} <span className="text-[14px] font-medium text-[#505050]">/ {totalMax}</span>
                </p>
              </div>
            </div>
          </section>
        )}

        <section
          aria-labelledby="detail-title"
          className={`box-border min-w-0 flex-[1_1_440px] ${big ? "" : "max-w-[480px]"}`}
        >
          {/*
            머리 줄: 높이 40px 에 아래 선 1px(합쳐 41px). 요소 이름이 길어 줄이 바뀌면 늘어나도록 높이 대신 최소 높이와
            위아래 여백(6 + 버튼 28 + 6)으로 맞췄다. 한 줄일 때의 모양은 디자인과 같다.
          */}
          <div
            className={`${PANEL_HEAD_CLASS} box-border flex min-h-[41px] flex-wrap items-center gap-x-[10px] gap-y-[4px] rounded-[0_7px_0_0] py-[6px] pr-[12px] pl-[20px]`}
          >
            <h2 id="detail-title" className={PANEL_TITLE_CLASS}>
              세부 평가 항목
            </h2>
            <AccentTag>{detail.name}</AccentTag>
            {/*
              크게 보는 중에는 왼쪽 단(고른 요소의 이름 버튼)이 없으므로, 초점이 있던 컨트롤이 사라졌을 때 되돌릴 곳이 이 버튼이다
              (hooks/usePrepFocusKeeper.ts).
            */}
            <button
              ref={bigButtonRef}
              type="button"
              aria-pressed={big}
              {...(big ? FOCUS_FALLBACK_PROPS : {})}
              onClick={(event) => onToggleBig(event.currentTarget === document.activeElement)}
              className="motion-colors ml-auto box-border inline-flex h-[28px] scroll-m-[8px] cursor-pointer items-center gap-[4px] rounded-[6px] border border-[#CFCFCF] bg-white px-[8px] text-[12px] leading-[normal] font-medium text-[#111111] hover-on:bg-[#F6F7FB] press-on:bg-[#ECEEF5]"
            >
              {big ? "작게 보기" : "크게 보기"}
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                fill="none"
                stroke="#505050"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-[12px] w-[12px]"
              >
                <path d="M9.5 2.5h4v4M13.5 2.5 9 7M6.5 13.5h-4v-4M2.5 13.5 7 9" />
              </svg>
            </button>
          </div>
          <div className="px-[20px] pt-[16px] pb-[20px] break-keep">
            <p className="text-[13px] leading-[18px] text-[#505050]">{DETAIL_GUIDE}</p>
            {/* 고른 요소나 크기가 바뀌면 새로 그려(key) 옅게 나타난다. 누를 것은 이 안에 없다. */}
            <div key={`${elements[selectedIndex]?.id ?? ""}:${big ? "big" : "small"}`} className="animate-fade-in">
              <DetailGroups groups={detail.groups} big={big} />
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

/**
 * 수정하기·취소, 저장하기 버튼의 크기 (모양은 components/consoleUi.tsx 의 보조·주 버튼).
 * 줄 높이는 디자인의 버튼처럼 글꼴 기본값(normal)이라 글자의 세로 위치가 디자인과 같다.
 */
const TOOL_BUTTON_CLASS = "h-[32px] scroll-m-[8px] cursor-pointer px-[12px] leading-[normal]";

/** 배점 −·+: Enter 를 길게 누르면 계속 바뀐다(그 버튼에서 시작한 누름의 반복만. hooks/useKeyRepeatGuard.ts) */
const HOLD_REPEAT_PROPS = { [HOLD_REPEAT_ATTRIBUTE]: HOLD_REPEAT_VALUE };

/** 배점 −·+ 버튼: 36px 정사각형, 회색 테두리. 꺼지면(보기 상태, 0·100 에 닿음) 흐려진다. 바깥쪽 모서리는 쓰는 쪽이 정한다. */
const STEP_BUTTON_CLASS =
  "motion-colors box-border flex h-[36px] w-[36px] flex-none scroll-m-[8px] cursor-pointer items-center justify-center border border-[#CFCFCF] bg-white p-0 hover-on:bg-[#F6F7FB] press-on:bg-[#ECEEF5] disabled:cursor-default disabled:opacity-[0.4]";

type ElementRowProps = Pick<
  WeightsTabProps,
  "editing" | "weightRange" | "selectedNameButtonRef" | "onSelectElement" | "onDecrease" | "onIncrease" | "onSetWeight"
> & {
  element: WeightElement;
  selected: boolean;
};

/**
 * 평가 요소 한 줄: 이름·태그 줄, 배점 조절(−, 숫자, +), 그 아래 배점 막대. 아래에 선이 하나 있다.
 * 이름은 버튼이다(모양은 디자인의 이름 글자 그대로). 누르면 그 요소를 고르고, 고른 요소의 버튼은 눌린 상태(aria-pressed)·파란 글자다.
 * 고른 요소의 이름 버튼은 늘 있고 꺼지지 않아, 초점이 있던 컨트롤이 사라지거나 꺼졌을 때 되돌릴 곳이다(data-focus-fallback).
 * 이름·태그가 길어 배점 조절과 한 줄에 들어가지 않으면 배점 조절이 다음 줄로 내려가고, 한 낱말이 상자보다 길면 낱말 안에서 줄을 바꾼다.
 * 배점 막대는 눈금 끝(weightRange.max)까지만 움직인다. 배점이 그보다 크면(−·+ 로 올린 값) 손잡이는 끝에 머물고, 읽어 주는 값은
 * 실제 배점이다(aria-valuetext).
 */
function ElementRow({
  element,
  selected,
  editing,
  weightRange,
  selectedNameButtonRef,
  onSelectElement,
  onDecrease,
  onIncrease,
  onSetWeight,
}: ElementRowProps) {
  return (
    <div className="border-b border-b-[#E4E4E4] py-[16px]">
      <div className="flex flex-wrap items-center justify-between gap-x-[16px] gap-y-[8px]">
        <div className="min-w-0">
          <h3 className="text-[15px] leading-[22px] font-semibold [overflow-wrap:anywhere]">
            <button
              ref={selected ? selectedNameButtonRef : undefined}
              type="button"
              {...(selected ? FOCUS_FALLBACK_PROPS : {})}
              aria-label={`${element.name} 세부 평가 항목 보기`}
              aria-pressed={selected}
              onClick={(event) => onSelectElement(element.id, event.currentTarget === document.activeElement)}
              className={`motion-colors scroll-m-[8px] cursor-pointer text-left ${selected ? "text-[#001AD0]" : "hover-on:text-[#001AD0]"}`}
            >
              {element.name}
            </button>
          </h3>
          <p className="mt-[2px] text-[13px] leading-[18px] text-[#505050] [overflow-wrap:anywhere]">
            {element.tagsLine}
          </p>
        </div>
        <div className="flex items-center">
          <button
            type="button"
            aria-label={`${element.name} 배점 줄이기`}
            disabled={!element.canDecrease}
            id={element.decreaseButtonId}
            {...HOLD_REPEAT_PROPS}
            onClick={(event) => onDecrease(element.id, event.currentTarget === document.activeElement)}
            className={`${STEP_BUTTON_CLASS} rounded-l-[6px]`}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              fill="none"
              stroke="#111111"
              strokeWidth="1.6"
              strokeLinecap="round"
              className="h-[14px] w-[14px]"
            >
              <path d="M3.5 8h9" />
            </svg>
          </button>
          <span className="box-border flex h-[36px] w-[52px] flex-none items-center justify-center border-y border-y-[#CFCFCF] text-[15px] font-semibold tabular-nums">
            {element.weight}
          </span>
          <button
            type="button"
            aria-label={`${element.name} 배점 늘리기`}
            disabled={!element.canIncrease}
            id={element.increaseButtonId}
            {...HOLD_REPEAT_PROPS}
            onClick={(event) => onIncrease(element.id, event.currentTarget === document.activeElement)}
            className={`${STEP_BUTTON_CLASS} rounded-r-[6px]`}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              fill="none"
              stroke="#111111"
              strokeWidth="1.6"
              strokeLinecap="round"
              className="h-[14px] w-[14px]"
            >
              <path d="M3.5 8h9M8 3.5v9" />
            </svg>
          </button>
        </div>
      </div>
      <input
        type="range"
        min={weightRange.min}
        max={weightRange.max}
        step={weightRange.step}
        aria-label={`${element.name} 배점`}
        aria-valuetext={element.weight > weightRange.max ? String(element.weight) : undefined}
        value={element.weight}
        disabled={!editing}
        onChange={(event) => onSetWeight(element.id, event.currentTarget.valueAsNumber)}
        className="mt-[12px] block w-full scroll-m-[8px] accent-[#001AD0]"
      />
    </div>
  );
}

/**
 * 묶음별 제목과 번호 붙은 질문 목록. 질문 글자는 14px, 크게 보는 중에는 16px 이다(줄 높이 1.55 배).
 * 번호 칸은 20px 로 고정이라 두 자리 번호("10.")여도 질문 글의 왼쪽 끝이 다른 줄과 같다(번호가 칸보다 넓으면 8px 간격 쪽으로 조금 넘친다).
 */
function DetailGroups({ groups, big }: { groups: NumberedGroup[]; big: boolean }) {
  return groups.map((group, index) => (
    <Fragment key={index}>
      <h3 className="mt-[16px] text-[14px] leading-[20px] font-semibold [overflow-wrap:anywhere]">{group.name}</h3>
      <ol className={`mt-[8px] flex flex-col leading-[1.55] ${big ? "text-[16px]" : "text-[14px]"}`}>
        {group.questions.map((question) => (
          <li key={question.number} className="flex gap-[8px] border-t border-t-[#E4E4E4] py-[8px]">
            <span className="min-w-0 flex-[0_0_20px] whitespace-nowrap text-[#505050] tabular-nums">
              {question.number}.
            </span>
            <span className="min-w-0 [overflow-wrap:anywhere]">{question.text}</span>
          </li>
        ))}
      </ol>
    </Fragment>
  ));
}
