import { Fragment, type RefObject } from "react";
import type { GuidelineChange } from "@/lib/prep/guidelineChanges";

type GuidelineUploadTabProps = {
  /** 숨긴 파일 입력란 (상태 훅이 입력란의 파일을 읽고 비운다) */
  fileInputRef: RefObject<HTMLInputElement | null>;
  /** 고른 파일 이름 (확인을 통과한 파일만) */
  fileName: string | null;
  /** 걸린 파일의 오류 문구 */
  fileError: string | null;
  /** 전년 대비 주요 변경 사항 */
  changes: readonly GuidelineChange[];
  /** 변경 사항 목록을 접었는지 */
  changesCollapsed: boolean;
  onFileInputChange: () => void;
  onDropFiles: (files: FileList) => void;
  onToggleChanges: () => void;
};

/** 변경 사항 목록의 id (접기 버튼의 aria-controls) */
const CHANGES_LIST_ID = "guideline-changes-list";

/**
 * 전형 준비 · 모집요강 올리기 탭(/prep): 왼쪽 "2027년 모집요강 올리기" 점선 상자, 오른쪽 "전년 대비 주요 변경 사항".
 * 치수·색·글자는 디자인 값 그대로다. 점선 상자는 <label> 과 숨긴 파일 입력란이라 누르거나(JS 준비 전에도) 키보드로 초점을 두고
 * Enter·Space 를 누르면 파일 선택 창이 열린다. PDF 를 상자 위에 끌어다 놓아도 받는다.
 */
export function GuidelineUploadTab({
  fileInputRef,
  fileName,
  fileError,
  changes,
  changesCollapsed,
  onFileInputChange,
  onDropFiles,
  onToggleChanges,
}: GuidelineUploadTabProps) {
  return (
    <div className="mt-[18px] -mr-[10px] flex flex-wrap items-start gap-[18px]">
      <section
        aria-labelledby="upload-title"
        className="box-border min-w-0 flex-[1_1_420px] rounded-[6px] bg-white pt-[16px] px-[15px] pb-[21px]"
      >
        <h2 id="upload-title" className="text-[20px] leading-[28px] font-extrabold">
          2027년 모집요강 올리기
        </h2>
        {/*
          숨긴 입력란은 1px 이라 초점 표시가 보이지 않으므로, 입력란에 키보드 초점이 있을 때 상자에 전역 :focus-visible 과
          같은 모양(검정 2px 실선, 2px 띄움)을 그린다.
        */}
        <label
          className="relative mt-[19px] box-border flex min-h-[500px] cursor-pointer flex-col items-center justify-center rounded-[10px] border-2 border-dashed border-[#999999] pt-[46px] px-[16px] pb-[24px] text-center has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-[#000] has-[input:focus-visible]:outline-solid"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            onDropFiles(event.dataTransfer.files);
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="absolute h-[1px] w-[1px] opacity-0"
            onChange={onFileInputChange}
          />
          <svg
            aria-hidden="true"
            viewBox="0 0 32 37"
            fill="none"
            stroke="#767676"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-[37px] w-[32px]"
          >
            <path d="M16 26V2M7 11l9-9 9 9M2 22v13h28V22" />
          </svg>
          <span className="mt-[14px] text-[20px] leading-[28px] font-extrabold text-[#767676]">모집요강 올리기</span>
          <span className="mt-[3px] text-[16px] leading-[24px] font-semibold text-[#505050]">
            모집요강 PDF 파일을 이곳에 올리세요.
          </span>
          {fileError !== null ? (
            <span role="alert" className={`${FILE_LINE_CLASS} text-[#BA1A1A]`}>
              {fileError}
            </span>
          ) : (
            fileName !== null && <span className={`${FILE_LINE_CLASS} text-[#111111]`}>선택한 파일: {fileName}</span>
          )}
        </label>
      </section>

      <section
        aria-labelledby="changes-title"
        className="box-border min-w-0 flex-[0_1_345px] rounded-[6px] bg-white pt-[19px] px-[25px] pb-[22px]"
      >
        <h2 id="changes-title" className="text-[20px] leading-[28px] font-extrabold">
          전년 대비 주요 변경 사항
        </h2>
        <div id={CHANGES_LIST_ID} hidden={changesCollapsed}>
          {changes.map((change, index) => (
            <Fragment key={change.title}>
              <h3
                className={`${index === 0 ? "mt-[22px]" : "mt-[23px]"} text-[14px] leading-[20px] font-extrabold`}
              >
                {change.title}
              </h3>
              <p className="mt-[6px] text-[14px] leading-[20px] font-medium text-[#505050]">
                {change.body.split("\n").map((line, lineIndex) => (
                  <Fragment key={lineIndex}>
                    {lineIndex > 0 && <br />}
                    {line}
                  </Fragment>
                ))}
              </p>
            </Fragment>
          ))}
        </div>
        <button
          type="button"
          aria-label={changesCollapsed ? "펼치기" : "접기"}
          aria-expanded={!changesCollapsed}
          aria-controls={CHANGES_LIST_ID}
          onClick={onToggleChanges}
          className="mx-auto mt-[24px] flex h-[24px] w-[44px] cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-[13.3333px] font-normal text-black"
        >
          {/* 접힌 동안에는 같은 화살표를 180도 돌려 아래를 향하게 한다. */}
          <svg aria-hidden="true" viewBox="0 0 14 9" className={`h-[9px] w-[14px] ${changesCollapsed ? "rotate-180" : ""}`}>
            <path
              fill="none"
              stroke="#111111"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M1 7.5l6-6 6 6"
            />
          </svg>
        </button>
      </section>
    </div>
  );
}

/** 고른 파일 이름·오류 문구 한 줄. 긴 이름은 상자 안에서 줄을 바꾼다. */
const FILE_LINE_CLASS = "mt-[12px] text-[14px] leading-[20px] font-medium [overflow-wrap:anywhere]";
