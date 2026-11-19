import Link from "next/link";
import { Fragment, type RefObject } from "react";
import { FOCUS_FALLBACK_PROPS, prepBodyProps } from "@/lib/prep/focusMarks";
import type { GuidelineChange } from "@/lib/prep/guidelineChanges";

type GuidelineUploadTabProps = {
  /** 탭이 준비됐는지 (준비 전에는 본문이 inert 라 초점을 받지 않고 눌리지 않는다. 모양은 그대로) */
  ready: boolean;
  /** 탭 본문 요소 (준비 여부를 이 요소가 문서에 붙었는지로 정한다) */
  bodyRef: RefObject<HTMLDivElement | null>;
  /** 숨긴 파일 입력란 (상태 훅이 입력란의 파일을 읽고 비운다) */
  fileInputRef: RefObject<HTMLInputElement | null>;
  /** 고른 파일 이름 (확인을 통과한 파일만). 있을 때만 "기준 초안 만들기" 줄이 나타난다. */
  fileName: string | null;
  /** 걸린 파일의 오류 문구 */
  fileError: string | null;
  /** 기준 초안을 기다리는 중인지 (버튼은 aria-disabled, 파일 선택은 막힌다) */
  isGenerating: boolean;
  /** 버튼 오른쪽 상태 글 (기다리는 동안 "모집요강을 읽는 중…", 아니면 빈 글) */
  statusText: string;
  /** 초안 만들기 실패 문구 (요소 0개 포함) */
  requestError: string | null;
  /** 요소 0개일 때 받은 경고 */
  requestWarnings: readonly string[];
  /** 초안이 있을 때의 안내 (요소 수, 경고) */
  draftNotice: { elementCount: number; warnings: readonly string[] } | null;
  /** 전년 대비 주요 변경 사항 */
  changes: readonly GuidelineChange[];
  /** 모집요강에서 온 변경 사항이 0건일 때 항목 대신 보여 주는 문장 */
  noChangesNotice: string | null;
  /** 변경 사항 목록을 접었는지 */
  changesCollapsed: boolean;
  onFileInputChange: () => void;
  onDropFiles: (files: FileList) => void;
  onGenerate: () => void;
  /** 점선 상자(<label>), 접기·펼치기 버튼, 초안 안내의 링크 (상태 훅이 초점·스크롤에 쓴다) */
  dropBoxRef: RefObject<HTMLLabelElement | null>;
  collapseButtonRef: RefObject<HTMLButtonElement | null>;
  weightsLinkRef: RefObject<HTMLAnchorElement | null>;
  /** 초안 안내의 링크로 같은 탭에서 이동할 때 (링크에 초점이 있었으면 이동 전에 초점을 머리의 탭 링크로 옮긴다) */
  onWeightsLinkNavigate: () => void;
  /** 숨긴 파일 입력란에 초점이 감 (키보드 초점이면 점선 상자가 보이게 한다) */
  onFileInputFocus: () => void;
  /** 접기·펼치기. hadFocus 는 누른 버튼에 초점이 있었는지 */
  onToggleChanges: (hadFocus: boolean) => void;
};

/** 변경 사항 목록의 id (접기 버튼의 aria-controls) */
const CHANGES_LIST_ID = "guideline-changes-list";

/**
 * 전형 준비 · 모집요강 올리기 탭(/prep): 왼쪽 "2027년 모집요강 올리기" 점선 상자, 오른쪽 "전년 대비 주요 변경 사항".
 * 치수·색·글자는 디자인 값 그대로다. 점선 상자는 <label> 과 숨긴 파일 입력란이라 누르거나(JS 준비 전에도) 키보드로 초점을 두고
 * Enter·Space 를 누르면 파일 선택 창이 열린다. PDF 를 상자 위에 끌어다 놓아도 받는다.
 * 디자인에 없어 정한 것: 파일을 고른 뒤의 "기준 초안 만들기" 줄과 상태 글, 실패 문구, 초안 안내와 경고 목록,
 * 변경 사항이 0건일 때의 문장. 처음 모습(고른 파일·초안 없음)에는 아무것도 더해지지 않는다.
 */
export function GuidelineUploadTab({
  ready,
  bodyRef,
  fileInputRef,
  fileName,
  fileError,
  isGenerating,
  statusText,
  requestError,
  requestWarnings,
  draftNotice,
  changes,
  noChangesNotice,
  changesCollapsed,
  onFileInputChange,
  onDropFiles,
  onGenerate,
  dropBoxRef,
  collapseButtonRef,
  weightsLinkRef,
  onWeightsLinkNavigate,
  onFileInputFocus,
  onToggleChanges,
}: GuidelineUploadTabProps) {
  return (
    <div ref={bodyRef} {...prepBodyProps(ready)} className="mt-[18px] -mr-[10px] flex flex-wrap items-start gap-[18px]">
      <section
        aria-labelledby="upload-title"
        className="box-border min-w-0 flex-[1_1_420px] rounded-[6px] bg-white pt-[16px] px-[15px] pb-[21px]"
      >
        <h2 id="upload-title" className="text-[20px] leading-[28px] font-extrabold">
          2027년 모집요강 올리기
        </h2>
        {/*
          숨긴 입력란은 1px 이라 초점 표시가 보이지 않으므로, 입력란에 키보드 초점이 있을 때 상자에 전역 :focus-visible 과
          같은 모양(검정 2px 실선, 2px 띄움)을 그린다. 초안을 기다리는 동안에는 입력란을 막고(disabled) 끌어다 놓은 파일도 받지 않는다.
          그동안 입력란은 마우스 입력도 받지 않는다(pointer-events: none). disabled 입력란에 누름이 걸리면 상자의 mousedown 처리까지 가지 않고
          지금 초점이 body 로 빠지기 때문이다. 그러면 그 자리의 누름도 상자(또는 그 안의 글자)가 받는다.
        */}
        <label
          ref={dropBoxRef}
          className={`relative mt-[19px] box-border flex min-h-[500px] ${
            isGenerating ? "cursor-default" : "cursor-pointer"
          } flex-col items-center justify-center rounded-[10px] border-2 border-dashed border-[#999999] pt-[46px] px-[16px] pb-[24px] text-center has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-[#000] has-[input:focus-visible]:outline-solid`}
          // 기다리는 동안 꺼져 있는 상자를 눌러도 지금 초점(예: 기준 초안 만들기)을 빼앗지 않는다(누름의 기본 동작 가운데 초점 옮기기만 막는다.
          // 입력란이 disabled 라 파일 선택 창은 열리지 않는다).
          onMouseDown={(event) => {
            if (isGenerating) event.preventDefault();
          }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            // 기다리는 동안에도 기본 동작(브라우저가 파일을 여는 것)은 막는다. 그때 파일은 상태 훅이 받지 않는다.
            event.preventDefault();
            onDropFiles(event.dataTransfer.files);
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            disabled={isGenerating}
            className={`absolute h-[1px] w-[1px] opacity-0${isGenerating ? " pointer-events-none" : ""}`}
            onChange={onFileInputChange}
            onFocus={onFileInputFocus}
            {...FOCUS_FALLBACK_PROPS}
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

        {fileName !== null && (
          <div className="mt-[12px] flex flex-wrap items-center gap-[12px]">
            {/*
              기다리는 동안 disabled 대신 aria-disabled 로 두어(누르면 상태 훅이 아무것도 하지 않는다) 초점이 버튼에 남게 한다.
              모양은 디자인의 "저장하기" 버튼 그대로이고 커서만 기본 화살표다.
            */}
            <button
              type="button"
              aria-disabled={isGenerating ? "true" : undefined}
              onClick={onGenerate}
              className={`h-[35px] scroll-m-[8px] rounded-[6px] border-0 bg-[#000947] px-[16px] text-[13px] font-semibold text-white ${
                isGenerating ? "cursor-default" : "cursor-pointer"
              }`}
            >
              기준 초안 만들기
            </button>
            <p aria-live="polite" className="text-[14px] leading-[20px] font-medium text-[#505050]">
              {statusText}
            </p>
          </div>
        )}

        {requestError !== null && (
          <div
            role="alert"
            className="mt-[8px] text-[14px] leading-[20px] font-medium text-[#BA1A1A] [overflow-wrap:anywhere]"
          >
            <p>{requestError}</p>
            <WarningList warnings={requestWarnings} />
          </div>
        )}

        {/* 초안 안내는 늘 있는 알림 영역 안에 그려 초안이 생길 때 읽히게 한다(초안이 없으면 빈 영역이라 모양에 영향이 없다). */}
        <div aria-live="polite">
          {draftNotice !== null && (
            <div
              className={`${
                fileName !== null ? "mt-[8px]" : "mt-[12px]"
              } text-[14px] leading-[20px] font-medium text-[#111111] [overflow-wrap:anywhere]`}
            >
              <p>
                기준 초안을 만들었습니다 (평가 요소 {draftNotice.elementCount}개). 평가·배점 설정에서 확인하고 저장해 주세요.{" "}
                <Link
                  ref={weightsLinkRef}
                  href="/prep/weights"
                  onNavigate={onWeightsLinkNavigate}
                  className="scroll-m-[8px] text-[#001AD0] underline"
                >
                  평가 · 배점 설정으로 이동
                </Link>
              </p>
              <WarningList warnings={draftNotice.warnings} />
            </div>
          )}
        </div>
      </section>

      <section
        aria-labelledby="changes-title"
        className="box-border min-w-0 flex-[0_1_345px] rounded-[6px] bg-white pt-[19px] px-[25px] pb-[22px]"
      >
        <h2 id="changes-title" className="text-[20px] leading-[28px] font-extrabold">
          전년 대비 주요 변경 사항
        </h2>
        <div id={CHANGES_LIST_ID} hidden={changesCollapsed}>
          {noChangesNotice !== null && (
            <p className="mt-[22px] text-[14px] leading-[20px] font-medium text-[#505050]">{noChangesNotice}</p>
          )}
          {/* 모집요강에서 온 변경 사항은 제목이 겹칠 수 있어 순서를 key 로 쓴다(목록은 통째로 바뀔 뿐 항목을 옮기지 않는다). */}
          {changes.map((change, index) => (
            <Fragment key={index}>
              <h3
                className={`${index === 0 ? "mt-[22px]" : "mt-[23px]"} text-[14px] leading-[20px] font-extrabold [overflow-wrap:anywhere]`}
              >
                {change.title}
              </h3>
              <p className="mt-[6px] text-[14px] leading-[20px] font-medium text-[#505050] [overflow-wrap:anywhere]">
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
          ref={collapseButtonRef}
          onClick={(event) => onToggleChanges(event.currentTarget === document.activeElement)}
          className="mx-auto mt-[24px] flex h-[24px] w-[44px] scroll-m-[8px] cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-[13.3333px] font-normal text-black"
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

/** 경고 목록 (받은 문장 그대로, 항목마다 한 줄). 경고가 없으면 그리지 않는다. */
function WarningList({ warnings }: { warnings: readonly string[] }) {
  if (warnings.length === 0) return null;
  return (
    <ul className="mt-[6px] text-[13px] leading-[18px] font-medium text-[#505050] [overflow-wrap:anywhere]">
      {warnings.map((warning, index) => (
        <li key={index}>{warning}</li>
      ))}
    </ul>
  );
}

/** 고른 파일 이름·오류 문구 한 줄. 긴 이름은 상자 안에서 줄을 바꾼다. */
const FILE_LINE_CLASS = "mt-[12px] text-[14px] leading-[20px] font-medium [overflow-wrap:anywhere]";
