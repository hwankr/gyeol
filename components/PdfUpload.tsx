import type { RefObject } from "react";
import { BUTTON_SECONDARY_CLASS, StatusChip } from "@/components/consoleUi";

// PDF 를 올리는 점선 상자와 고른 파일 줄. 전형 준비의 모집요강 올리기(components/GuidelineUploadTab.tsx)와 지원자 관리의
// 학생부 올리기(components/RecordUploadScreen.tsx)가 같이 쓴다. 치수·색·글자는 모집요강 올리기의 디자인 값 그대로다.

type PdfDropBoxProps = {
  /** 점선 상자(<label>). 상태 훅이 초점·스크롤에 쓴다. */
  boxRef: RefObject<HTMLLabelElement | null>;
  /** 숨긴 파일 입력란 (상태 훅이 입력란의 파일을 읽고 비운다) */
  inputRef: RefObject<HTMLInputElement | null>;
  /** 응답을 기다리는 중인지 (파일 선택이 막히고 버튼 모양 글자가 꺼진 모양이 된다) */
  busy: boolean;
  /** 파일을 끌고 상자 위에 있는지 (상자를 파란 테두리·옅은 파란 바탕으로 강조한다) */
  dragOver: boolean;
  /** 버튼 모양 글자 ("모집요강 올리기", "학생부 올리기") */
  buttonLabel: string;
  /** 그 아래 안내 문장 */
  hint: string;
  /** 걸린 파일의 오류 문구 */
  error: string | null;
  /** 숨긴 입력란에 더할 속성 (전형 준비의 초점 되돌릴 곳 표시 등) */
  inputProps?: Readonly<Record<string, string>>;
  onInputChange: () => void;
  /** 숨긴 입력란에 초점이 감 (키보드 초점이면 상태 훅이 상자가 보이게 한다) */
  onInputFocus: () => void;
  onDropFiles: (files: FileList) => void;
  /** 파일을 끌고 상자 위에 있음 (끄는 동안 되풀이해 불린다) / 상자 밖으로 나감 */
  onDragOverBox: () => void;
  onDragLeaveBox: () => void;
};

/**
 * 점선 상자: <label> 과 숨긴 파일 입력란이라 누르거나 키보드로 초점을 두고 Enter·Space 를 누르면 파일 선택 창이 열린다.
 * PDF 를 상자 위에 끌어다 놓아도 받고, 파일을 끌고 위에 있는 동안 상자가 파랗게 강조된다.
 * 상자 가운데의 그림(DropArt)과 테두리·바탕(boxToneClass)이 올려놓음·끌어다 놓기·기다리는 중에 따라 바뀐다(색은 150ms 에 걸쳐).
 *
 * 숨긴 입력란은 1px 이라 초점 표시가 보이지 않으므로, 입력란에 키보드 초점이 있을 때 상자에 전역 :focus-visible 과
 * 같은 모양(검정 2px 실선, 2px 띄움)을 그린다. 기다리는 동안에는 입력란을 막고(disabled) 끌어다 놓은 파일도 받지 않는다.
 * 그동안 입력란은 마우스 입력도 받지 않는다(pointer-events: none). disabled 입력란에 누름이 걸리면 상자의 mousedown 처리까지 가지 않고
 * 지금 초점이 body 로 빠지기 때문이다. 그러면 그 자리의 누름도 상자(또는 그 안의 글자)가 받는다.
 */
export function PdfDropBox({
  boxRef,
  inputRef,
  busy,
  dragOver,
  buttonLabel,
  hint,
  error,
  inputProps,
  onInputChange,
  onInputFocus,
  onDropFiles,
  onDragOverBox,
  onDragLeaveBox,
}: PdfDropBoxProps) {
  return (
    <label
      ref={boxRef}
      className={`group/drop motion-colors relative box-border flex min-h-[280px] flex-[1_1_auto] flex-col items-center justify-center gap-[8px] rounded-[8px] border-[1.5px] border-dashed p-[24px] text-center ${boxToneClass(
        busy,
        dragOver,
      )} ${
        busy ? "cursor-default" : "cursor-pointer"
      } has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-[#000] has-[input:focus-visible]:outline-solid`}
      // 기다리는 동안 꺼져 있는 상자를 눌러도 지금 초점(예: 기준 초안 만들기)을 빼앗지 않는다(누름의 기본 동작 가운데 초점 옮기기만 막는다.
      // 입력란이 disabled 라 파일 선택 창은 열리지 않는다).
      onMouseDown={(event) => {
        if (busy) event.preventDefault();
      }}
      onDragOver={(event) => {
        event.preventDefault();
        // 파일을 끌 때만 강조한다(글자나 링크를 끄는 것은 놓아도 받지 않는다).
        if (event.dataTransfer.types.includes("Files")) onDragOverBox();
      }}
      onDragLeave={(event) => {
        // 상자 안의 글자·그림 사이를 지날 때도 dragleave 가 온다. 상자 밖으로 나갈 때만 강조를 끈다.
        const next = event.relatedTarget;
        if (!(next instanceof Node && event.currentTarget.contains(next))) onDragLeaveBox();
      }}
      onDrop={(event) => {
        // 기다리는 동안에도 기본 동작(브라우저가 파일을 여는 것)은 막는다. 그때 파일은 상태 훅이 받지 않는다.
        event.preventDefault();
        onDropFiles(event.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        disabled={busy}
        className={`absolute h-[1px] w-[1px] opacity-0${busy ? " pointer-events-none" : ""}`}
        onChange={onInputChange}
        onFocus={onInputFocus}
        {...inputProps}
      />
      <DropArt busy={busy} dragOver={dragOver} />
      {/*
        버튼 모양의 글자다(누르는 것은 상자 전체). 기다리는 동안에는 꺼진 주 버튼 모양(옅은 회색 바탕, 회색 글자)이다.
        상자에 마우스를 올리면 주 버튼을 올려놓았을 때의 색이 된다.
      */}
      <span
        className={`motion-colors mt-[4px] inline-flex h-[36px] items-center rounded-[6px] border px-[16px] text-[14px] font-semibold ${
          busy
            ? "border-[#E4E6EE] bg-[#E4E6EE] text-[#505050]"
            : "border-[#000947] bg-[#000947] text-white group-hover/drop:border-[#1A2259] group-hover/drop:bg-[#1A2259]"
        }`}
      >
        {buttonLabel}
      </span>
      <span className="text-[14px] leading-[20px] text-[#505050]">{hint}</span>
      {/* 걸린 파일의 오류 문구 자리. 문구가 없어도 한 줄 높이를 차지해 문구가 나타날 때 상자 안이 움직이지 않는다. */}
      <span role="alert" className="min-h-[18px] text-[13px] leading-[18px] font-medium text-[#BA1A1A] [overflow-wrap:anywhere]">
        {error}
      </span>
    </label>
  );
}

/**
 * 점선 상자의 테두리·바탕. 바탕색은 --drop-bg 에도 적어 그림의 올리기 표시 둘레가 바탕과 같은 색이 되게 한다.
 * - 보통: 회색 점선, 흰 바탕. 마우스를 올리면 파란 점선에 아주 옅은 파란 바탕이 된다(누를 수 있다는 표시).
 * - 파일을 끌고 위에 있음: 파란 점선, 옅은 파란 바탕.
 * - 기다리는 중: 보통과 같고 올려도 바뀌지 않는다.
 */
function boxToneClass(busy: boolean, dragOver: boolean): string {
  if (dragOver) return "border-[#001AD0] bg-[#EEF0FF] [--drop-bg:#EEF0FF]";
  if (busy) return "border-[#AEAEAE] bg-white [--drop-bg:#FFFFFF]";
  return "border-[#AEAEAE] bg-white [--drop-bg:#FFFFFF] hover-on:border-[#001AD0] hover-on:bg-[#F8F9FF] hover-on:[--drop-bg:#F8F9FF]";
}

/** 그림 조각이 자리를 옮기는 빠르기 (올려놓음·끌어다 놓기) */
const ART_MOVE_CLASS = "transition-[translate,rotate] duration-200 ease-soft";

/**
 * 점선 상자의 그림: 겹쳐 놓인 종이 두 장과 오른쪽 아래의 올리기 표시(파란 동그라미 안의 위쪽 화살표). 장식이라 화면 낭독기에는 숨긴다.
 * - 상자에 마우스를 올리면 앞의 종이와 화살표가 조금 올라간다.
 * - 파일을 끌고 위에 있는 동안에는 앞의 종이가 더 올라가고 뒤의 종이가 더 기울며, 화살표가 위로 까딱인다(놓으면 올라간다는 표시).
 * - 기다리는 동안에는 흐려지고 움직이지 않는다.
 * 그림은 초점을 받지 않아 자리를 옮겨도 초점·스크롤 계산과 부딪히지 않는다.
 */
function DropArt({ busy, dragOver }: { busy: boolean; dragOver: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 64 64"
      fill="none"
      className={`motion-colors h-[56px] w-[56px] overflow-visible ${busy ? "opacity-[0.45]" : ""}`}
    >
      {/* 뒤의 종이: 제 가운데를 축으로 왼쪽으로 기울어 있다. */}
      <rect
        x="14"
        y="12"
        width="30"
        height="40"
        rx="4"
        fill="#EEF0FF"
        stroke="#BAC3FF"
        strokeWidth="1.5"
        className={`origin-center [transform-box:fill-box] ${ART_MOVE_CLASS} ${
          dragOver ? "-translate-x-[3px] -rotate-[15deg]" : "-rotate-[9deg]"
        }`}
      />
      {/* 앞의 종이: 오른쪽 위 귀퉁이가 접혀 있고 글 세 줄이 있다. */}
      <g className={`${ART_MOVE_CLASS} ${dragOver ? "-translate-y-[3px]" : busy ? "" : "group-hover/drop:-translate-y-[2px]"}`}>
        <path
          d="M22 8h15l11 11v29a4 4 0 0 1-4 4H22a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4z"
          fill="#FFFFFF"
          stroke="#001AD0"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path d="M37 8v7a4 4 0 0 0 4 4h7" stroke="#001AD0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M24 29h14M24 35h17M24 41h9" stroke="#BAC3FF" strokeWidth="1.8" strokeLinecap="round" />
      </g>
      {/* 올리기 표시. 둘레는 상자 바탕색이라 종이와 떨어져 보인다. */}
      <circle cx="46" cy="47" r="11" fill="#001AD0" strokeWidth="2.5" className="motion-colors stroke-(color:--drop-bg)" />
      <path
        d="M46 52v-9.5M41.8 46.6 46 42.4l4.2 4.2"
        stroke="#FFFFFF"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={dragOver ? "animate-drop-arrow" : busy ? "" : `${ART_MOVE_CLASS} group-hover/drop:-translate-y-[1.5px]`}
      />
    </svg>
  );
}

type PickedFileRowProps = {
  fileName: string;
  /** 크기 글 ("2.4 MB", "380 KB") */
  sizeText: string;
  /** 응답을 기다리는 중인지 ("삭제" 가 aria-disabled 가 된다) */
  busy: boolean;
  /** "삭제". hadFocus 는 누른 버튼에 초점이 있었는지 (있었으면 상태 훅이 초점을 파일 입력란으로 옮긴다) */
  onClear: (hadFocus: boolean) => void;
};

/**
 * 고른 파일 줄(이름·크기·"올리기 완료"·삭제). "올리기 완료" 는 파일을 이 화면에 올려 두었다는 뜻이고 서버로 보낸 것이 아니다.
 * 긴 이름은 한 줄에서 말줄임표로 자른다(전체 이름은 title 로 볼 수 있다).
 */
export function PickedFileRow({ fileName, sizeText, busy, onClear }: PickedFileRowProps) {
  return (
    <div
      role="group"
      aria-label="올린 파일"
      className="mt-[12px] flex animate-fade-in flex-wrap items-center gap-x-[12px] gap-y-[8px] rounded-[6px] border border-[#E4E4E4] px-[12px] py-[10px]"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        stroke="#505050"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-[20px] w-[20px] flex-none"
      >
        <path d="M5 2.5h6.5L15.5 6.5V17.5H5z" />
        <path d="M11.5 2.5v4h4" />
      </svg>
      <span title={fileName} className="min-w-0 flex-[1_1_160px] overflow-hidden font-medium text-ellipsis whitespace-nowrap">
        {fileName}
      </span>
      <span className="text-[13px] text-[#505050] tabular-nums">{sizeText}</span>
      <StatusChip tone="green">올리기 완료</StatusChip>
      {/*
        누르면 이 줄이 사라진다(초점은 상태 훅이 파일 입력란으로 옮긴다). 기다리는 동안에는 disabled 대신 aria-disabled 로 두어
        초점이 남게 하고, 눌러도 상태 훅이 아무것도 하지 않는다(흐린 모양, 기본 화살표 커서).
      */}
      <button
        type="button"
        aria-disabled={busy ? "true" : undefined}
        onClick={(event) => onClear(event.currentTarget === document.activeElement)}
        className={`${BUTTON_SECONDARY_CLASS} h-[28px] scroll-m-[8px] cursor-pointer px-[10px] aria-disabled:cursor-default aria-disabled:opacity-[0.45]`}
      >
        삭제
      </button>
    </div>
  );
}

/** 응답을 기다리는 동안에도 초점이 남는 주 버튼의 클래스: disabled 대신 aria-disabled 로 끈다(꺼진 주 버튼 모양, 기본 화살표 커서). */
export const BUSY_PRIMARY_BUTTON_CLASS =
  "h-[36px] scroll-m-[8px] cursor-pointer px-[14px] aria-disabled:cursor-default aria-disabled:border-[#E4E6EE] aria-disabled:bg-[#E4E6EE] aria-disabled:text-[#505050]";
