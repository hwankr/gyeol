import { Fragment, type KeyboardEvent, type RefObject } from "react";
import type { NumberedGroup } from "@/lib/prep/criteria";

type WeightElement = {
  id: string;
  name: string;
  /** 요소 이름 아래 태그 줄 ("#교과성취 #학업발전 …") */
  tagsLine: string;
  /** 화면에 보이는 배점 (수정 상태에서는 고치는 중인 값) */
  weight: number;
  /** 배점 막대의 채움 너비·손잡이 위치(%) */
  barPercent: number;
  canDecrease: boolean;
  canIncrease: boolean;
};

type WeightsTabProps = {
  /** 모집 단위 이름 (제목 줄 오른쪽) */
  department: string;
  elements: WeightElement[];
  /** 고른 요소의 순서 (0 부터). 그 요소만 "떠 있는 카드" 모양이다. */
  selectedIndex: number;
  /** 고른 요소의 세부 평가 항목 */
  detail: { name: string; groups: NumberedGroup[] };
  total: number;
  totalMax: number;
  editing: boolean;
  canSave: boolean;
  /** 합계 안내 (수정 상태에서 합계가 100 이 아닐 때) */
  totalNotice: string | null;
  /** 저장소에 저장하지 못했을 때의 안내 */
  storageNotice: string | null;
  scrollAreaRef: RefObject<HTMLDivElement | null>;
  dialogRef: RefObject<HTMLDialogElement | null>;
  expandButtonRef: RefObject<HTMLButtonElement | null>;
  closeButtonRef: RefObject<HTMLButtonElement | null>;
  /** "크게 보기" 창의 제목 (창을 열면 초점이 여기로 온다) */
  dialogTitleRef: RefObject<HTMLHeadingElement | null>;
  /** 고른 요소(떠 있는 카드)의 화살표 버튼 */
  selectedArrowRef: RefObject<HTMLButtonElement | null>;
  /** 요소를 고른다. hadFocus 는 누른 이름 버튼에 초점이 있었는지 (있었으면 새 카드의 화살표 버튼으로 초점을 옮긴다) */
  onSelectElement: (id: string, hadFocus: boolean) => void;
  onDecrease: (id: string) => void;
  onIncrease: (id: string) => void;
  onToggleEditing: () => void;
  onSave: () => void;
  onOpenDialog: () => void;
  onCloseDialog: () => void;
  onDialogClose: () => void;
  onDialogKeyDown: (event: KeyboardEvent<HTMLDialogElement>) => void;
};

/**
 * 글자가 없는 버튼의 글자 크기. 디자인은 이 버튼들에 글꼴을 정하지 않아 브라우저 기본 버튼 글자(13.333px)가 쓰였다.
 * 보이는 모양에는 영향이 없지만 계산된 값을 디자인과 맞춘다.
 */
const ICON_BUTTON_FONT = "text-[13.3333px] font-normal text-black";

const DETAIL_GUIDE = "1~5점의 척도 평가로 진행됩니다.";

/**
 * 전형 준비 · 평가·배점 설정 탭(/prep/weights): 왼쪽 평가 요소와 배점, 오른쪽 수정하기·저장하기와 세부 평가 항목 패널.
 * 치수·색·글자는 디자인 값 그대로다. 고른 요소 하나만 오른쪽 패널 쪽으로 뻗어 붙는 "떠 있는 카드" 모양이다.
 * 디자인은 첫 요소를 고른 모습뿐이라, 다른 요소를 고르면 순서는 그대로 두고 그 자리에서 카드 모양만 입힌다
 * (카드 위아래 32px, 일반 모양끼리 24px, 첫 요소가 일반 모양이면 제목 줄과 35px, 패널 왼쪽 위 모서리는 첫 요소일 때만 각짐).
 * 배점 막대는 표시일 뿐이고(aria-hidden) 끌 수 없다. 배점은 수정 상태에서 −·+ 로 1 씩 바꾼다.
 */
export function WeightsTab({
  department,
  elements,
  selectedIndex,
  detail,
  total,
  totalMax,
  editing,
  canSave,
  totalNotice,
  storageNotice,
  scrollAreaRef,
  dialogRef,
  expandButtonRef,
  closeButtonRef,
  dialogTitleRef,
  selectedArrowRef,
  onSelectElement,
  onDecrease,
  onIncrease,
  onToggleEditing,
  onSave,
  onOpenDialog,
  onCloseDialog,
  onDialogClose,
  onDialogKeyDown,
}: WeightsTabProps) {
  const before = elements.slice(0, selectedIndex);
  const selected = elements[selectedIndex];
  const after = elements.slice(selectedIndex + 1);

  return (
    <div className="mt-[13px] -mr-[13px] -ml-[6px] flex flex-wrap items-start gap-[16.7px]">
      <section
        aria-labelledby="weights-title"
        className="box-border min-w-0 flex-[0_1_518px] rounded-[8px] bg-white pt-[17px] pb-[16px]"
      >
        <div className="flex flex-wrap items-baseline gap-x-[24px] gap-y-0 px-[27px]">
          <h2 id="weights-title" className="text-[20px] leading-[28px] font-extrabold tracking-[-0.02em]">
            평가 · 배점 설정
          </h2>
          <p className="min-w-0 text-[20px] leading-[28px] font-medium [overflow-wrap:anywhere]">{department}</p>
        </div>

        {before.length > 0 && (
          <div className="mt-[35px] flex flex-col gap-[24px] pr-[39px] pl-[31px]">
            {before.map((element) => (
              <div key={element.id}>
                <ElementRow
                  element={element}
                  selected={false}
                  onSelectElement={onSelectElement}
                  onDecrease={onDecrease}
                  onIncrease={onIncrease}
                />
              </div>
            ))}
          </div>
        )}

        {selected !== undefined && (
          <div
            className={`${selectedIndex === 0 ? "mt-[19px]" : "mt-[32px]"} relative z-2 -mr-[16.7px] ml-[10px] rounded-[8px_0_0_8px] bg-white pt-[16px] pr-[56px] pb-[15px] pl-[21px] [box-shadow:0_2px_10px_rgba(0,9,71,0.09)] [clip-path:inset(-14px_0_-14px_-14px)]`}
          >
            <ElementRow
              element={selected}
              selected
              onSelectElement={onSelectElement}
              onDecrease={onDecrease}
              onIncrease={onIncrease}
            />
            <button
              ref={selectedArrowRef}
              type="button"
              aria-label={`${selected.name} 세부 평가 항목 보기`}
              aria-pressed="true"
              className={`${ICON_BUTTON_FONT} absolute top-[51px] right-[5px] flex h-[24px] w-[24px] cursor-pointer items-center justify-center border-0 bg-transparent p-0`}
            >
              <svg aria-hidden="true" viewBox="0 0 7 12" className="h-[12px] w-[7px]">
                <path
                  fill="none"
                  stroke="#131927"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M1 1l5 5-5 5"
                />
              </svg>
            </button>
          </div>
        )}

        {after.length > 0 && (
          <div className="mt-[32px] flex flex-col gap-[24px] pr-[39px] pl-[31px]">
            {after.map((element) => (
              <div key={element.id}>
                <ElementRow
                  element={element}
                  selected={false}
                  onSelectElement={onSelectElement}
                  onDecrease={onDecrease}
                  onIncrease={onIncrease}
                />
              </div>
            ))}
          </div>
        )}

        <p className="mt-[16px] mr-[27px] flex items-baseline justify-end gap-[19px] font-extrabold">
          <span className="text-[16px] leading-[28px]">합계</span>
          <span className="text-[20px] leading-[28px] tracking-[-0.02em]">
            {total === totalMax ? total : <span className="text-[#BA1A1A]">{total}</span>}
            <span className="text-[16px]">/ {totalMax}</span>
          </span>
        </p>
        {/* 안내가 없을 때는 빈 줄(높이 0)로 두어 모양이 디자인과 같고, 알림 영역은 처음부터 있어 바뀔 때 읽힌다. */}
        <p aria-live="polite" className={`${totalNotice !== null ? "mt-[4px]" : ""} ${NOTICE_CLASS}`}>
          {totalNotice}
        </p>
        {storageNotice !== null && (
          <p role="alert" className={`mt-[4px] ${NOTICE_CLASS}`}>
            {storageNotice}
          </p>
        )}
      </section>

      <div className="flex min-w-0 flex-[1_1_360px] flex-col">
        <div className="mt-[6px] flex justify-end gap-[15px] pr-[19px]">
          <button
            type="button"
            onClick={onToggleEditing}
            className="h-[35px] cursor-pointer rounded-[6px] border-0 bg-[#001AD0] px-[16px] text-[13px] font-semibold text-white"
          >
            {editing ? "취소" : "수정하기"}
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={onSave}
            className={`${DARK_BUTTON_CLASS} disabled:cursor-default`}
          >
            저장하기
          </button>
        </div>
        <section
          aria-labelledby="detail-title"
          className={`relative z-1 mt-[23px] box-border flex h-[544px] flex-col bg-white pt-[20px] px-[23px] pb-[11px] [box-shadow:0_2px_10px_rgba(0,9,71,0.09)] ${
            selectedIndex === 0 ? "rounded-[0_12px_12px_12px]" : "rounded-[12px]"
          }`}
        >
          <div className="flex flex-wrap items-baseline gap-x-[19px] gap-y-0">
            <h2 id="detail-title" className="text-[20px] leading-[28px] font-extrabold">
              세부 평가 항목
            </h2>
            <p className={GUIDE_CLASS}>{DETAIL_GUIDE}</p>
          </div>
          {/*
            묶음·질문 영역만 패널 안에서 세로로 스크롤한다(패널 높이 544px 고정, "크게 보기" 는 늘 아래에 보인다).
            스크롤바는 브라우저 스크롤바를 가늘게 꾸민 것(globals.css 의 .prep-scrollbar, 굵기 6px)이고 자리를 늘 비워 둔다
            (scrollbar-gutter: stable). 오른쪽으로 4px 내밀고 안쪽 여백을 줄여, 스크롤바가 패널 오른쪽 안쪽 19px 에 오고
            글자 폭은 디자인과 같다(23 + 28 = 19 + 6 + 26).
          */}
          <div
            ref={scrollAreaRef}
            tabIndex={0}
            aria-label="세부 평가 항목 목록"
            className="prep-scrollbar mt-[22px] -mr-[4px] min-h-0 flex-[0_1_auto] overflow-y-auto pr-[26px] pl-[7px] [scrollbar-gutter:stable]"
          >
            <DetailGroups groups={detail.groups} questionClass="text-[14px] leading-[20px]" />
          </div>
          <button
            ref={expandButtonRef}
            type="button"
            onClick={onOpenDialog}
            className="mt-auto mr-[12px] ml-auto flex cursor-pointer items-center gap-[16px] border-0 bg-transparent py-[4px] px-0 text-[14px] leading-[20px] font-extrabold tracking-[-0.02em] text-[#000947]"
          >
            크게 보기
            <svg
              aria-hidden="true"
              viewBox="0 0 18 18"
              fill="none"
              stroke="#000947"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-[18px] w-[18px]"
            >
              <path d="M11 2h5v5M16 2l-5.5 5.5M7 16H2v-5M2 16l5.5-5.5" />
            </svg>
          </button>
        </section>
      </div>

      {/* "크게 보기" 창: 고른 요소의 묶음·질문 전체. 열린 동안 뒤 화면은 조작되지 않는다(<dialog> 의 showModal). 닫기·Esc 로 닫힌다. */}
      <dialog
        ref={dialogRef}
        aria-labelledby="detail-dialog-title"
        onClose={onDialogClose}
        onKeyDown={onDialogKeyDown}
        className="m-auto box-border max-h-[calc(100vh_-_64px)] w-[min(880px,calc(100vw_-_32px))] max-w-none overflow-y-auto rounded-[12px] border-0 bg-white p-[24px] text-[#111111] [box-shadow:0_2px_10px_rgba(0,9,71,0.09)] backdrop:bg-[rgba(0,0,0,0.4)]"
      >
        <div className="flex flex-wrap items-baseline gap-x-[19px] gap-y-0">
          {/*
            창을 열면 이 제목에 초점을 두어(tabIndex -1, Tab 순서에는 없음) 맨 위부터 읽게 한다. 컨트롤이 아니라 초점 표시는 그리지 않는다
            (키보드로 열면 :focus-visible 이 걸리므로 전역 규칙보다 앞서게 !important 로 끈다).
          */}
          <h2
            ref={dialogTitleRef}
            id="detail-dialog-title"
            tabIndex={-1}
            className="text-[20px] leading-[28px] font-extrabold outline-none! [overflow-wrap:anywhere]"
          >
            {detail.name} 세부 평가 항목
          </h2>
          <p className={GUIDE_CLASS}>{DETAIL_GUIDE}</p>
        </div>
        <div className="mt-[22px]">
          <DetailGroups groups={detail.groups} questionClass="text-[16px] leading-[24px]" />
        </div>
        <div className="mt-[24px] flex justify-end">
          <button ref={closeButtonRef} type="button" onClick={onCloseDialog} className={DARK_BUTTON_CLASS}>
            닫기
          </button>
        </div>
      </dialog>
    </div>
  );
}

/** 디자인의 "저장하기" 버튼 모양 (저장하기, 창의 닫기) */
const DARK_BUTTON_CLASS =
  "h-[35px] cursor-pointer rounded-[6px] border-0 bg-[#000947] px-[16px] text-[13px] font-semibold text-white";

const GUIDE_CLASS = "text-[15px] leading-[20px] font-medium text-[#767676]";

/** 합계 줄 아래 안내 (합계 줄과 같은 오른쪽 여백, 오른쪽 정렬) */
const NOTICE_CLASS = "mr-[27px] text-right text-[13px] leading-[18px] font-medium text-[#BA1A1A]";

type ElementRowProps = Pick<WeightsTabProps, "onSelectElement" | "onDecrease" | "onIncrease"> & {
  element: WeightElement;
  selected: boolean;
};

/**
 * 평가 요소 한 줄: 이름·태그 줄, 배점 조절(−, 숫자, +), 배점 막대.
 * 고르지 않은 요소의 이름은 버튼이다(모양은 디자인의 이름 글자 그대로). 누르면 그 요소를 고른다.
 * 긴 이름·태그는 줄을 바꿔 배점 조절 상자와 겹치지 않는다.
 */
function ElementRow({ element, selected, onSelectElement, onDecrease, onIncrease }: ElementRowProps) {
  return (
    <>
      <div className="flex items-start justify-between gap-[12px] pr-[18px]">
        <div className="min-w-0">
          <h3 className="text-[20px] leading-[28px] font-extrabold [overflow-wrap:anywhere]">
            {selected ? (
              element.name
            ) : (
              <button
                type="button"
                aria-label={`${element.name} 세부 평가 항목 보기`}
                onClick={(event) => onSelectElement(element.id, event.currentTarget === document.activeElement)}
                className="cursor-pointer text-left"
              >
                {element.name}
              </button>
            )}
          </h3>
          <p className="mt-[3px] min-h-[36px] max-w-[200px] text-[14px] leading-[18px] font-medium break-keep text-[#767676] [overflow-wrap:anywhere]">
            {element.tagsLine}
          </p>
        </div>
        <div className="mt-[16px] flex h-[42px] flex-none rounded-[8px] bg-white [box-shadow:0_1px_8px_rgba(0,9,71,0.1)]">
          <button
            type="button"
            aria-label={`${element.name} 배점 줄이기`}
            disabled={!element.canDecrease}
            onClick={() => onDecrease(element.id)}
            className={`${ICON_BUTTON_FONT} flex w-[42px] cursor-pointer items-center justify-center rounded-[8px_0_0_8px] border-0 bg-transparent p-0 disabled:cursor-default`}
          >
            <svg aria-hidden="true" viewBox="0 0 12 12" className="h-[12px] w-[12px]">
              <path fill="none" stroke="#000000" strokeWidth="2" d="M0 6h12" />
            </svg>
          </button>
          {/* 너비 50px 에 좌우 테두리 1px 이 더해진다(디자인은 box-sizing 을 정하지 않음). */}
          <span className="box-content flex w-[50px] items-center justify-center border-x border-x-[#ECECEC] text-[20px] font-medium text-black">
            {element.weight}
          </span>
          <button
            type="button"
            aria-label={`${element.name} 배점 늘리기`}
            disabled={!element.canIncrease}
            onClick={() => onIncrease(element.id)}
            className={`${ICON_BUTTON_FONT} flex w-[40px] cursor-pointer items-center justify-center rounded-[0_8px_8px_0] border-0 bg-transparent p-0 disabled:cursor-default`}
          >
            <svg aria-hidden="true" viewBox="0 0 10 10" className="h-[10px] w-[10px]">
              <path fill="none" stroke="#000000" strokeWidth="2" d="M0 5h10M5 0v10" />
            </svg>
          </button>
        </div>
      </div>
      <div aria-hidden="true" className="relative mt-[10px] h-[20px]">
        <div className="absolute top-[6px] right-0 left-0 h-[8px] rounded-[4px] bg-[#D9D9D9]" />
        <div
          className="absolute top-[5px] left-0 h-[10px] rounded-[5px] bg-[linear-gradient(90deg,#1820EF_0,#227BF1_158px)]"
          style={{ width: `${element.barPercent}%` }}
        />
        <div
          className="absolute top-0 -ml-[10px] box-border h-[20px] w-[20px] rounded-[50%] border-[3px] border-[#000947] bg-white"
          style={{ left: `${element.barPercent}%` }}
        />
      </div>
    </>
  );
}

/** 묶음별 알약 모양 제목과 번호 붙은 질문 목록 (패널과 "크게 보기" 창이 같이 쓴다. 질문 글자 크기만 다르다). */
function DetailGroups({ groups, questionClass }: { groups: NumberedGroup[]; questionClass: string }) {
  return groups.map((group, index) => (
    <Fragment key={index}>
      <h3
        className={`${index === 0 ? "" : "mt-[20px]"} inline-block rounded-[13px] px-[9px] text-[12px] leading-[26px] font-bold text-[#000947] [overflow-wrap:anywhere] ${
          group.tone === "light" ? "bg-[#E0E1F9]" : "bg-[#C3C5DD]"
        }`}
      >
        {group.name}
      </h3>
      <ol className={`mt-[17px] flex flex-col gap-[26px] font-medium ${questionClass}`}>
        {group.questions.map((question) => (
          <li key={question.number} className="flex">
            <span className="flex-[0_0_28px] font-bold">{question.number}.</span>
            <span className="min-w-0 [overflow-wrap:anywhere]">{question.text}</span>
          </li>
        ))}
      </ol>
    </Fragment>
  ));
}
