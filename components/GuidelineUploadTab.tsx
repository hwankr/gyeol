import Link from "next/link";
import { Fragment, type RefObject } from "react";
import {
  BUTTON_PRIMARY_CLASS,
  BUTTON_SECONDARY_CLASS,
  PANEL_CLASS,
  PANEL_HEAD_CLASS,
  PANEL_TITLE_CLASS,
  StatusChip,
} from "@/components/consoleUi";
import { FOCUS_FALLBACK_PROPS, prepBodyProps } from "@/lib/prep/focusMarks";
import type { GuidelineChange } from "@/lib/prep/guidelineChanges";

type GuidelineUploadTabProps = {
  /** 탭이 준비됐는지 (준비 전에는 본문이 inert 라 초점을 받지 않고 눌리지 않는다. 모양은 그대로) */
  ready: boolean;
  /** 탭 본문 요소 (준비 여부를 이 요소가 문서에 붙었는지로 정한다) */
  bodyRef: RefObject<HTMLDivElement | null>;
  /** 숨긴 파일 입력란 (상태 훅이 입력란의 파일을 읽고 비운다) */
  fileInputRef: RefObject<HTMLInputElement | null>;
  /** 고른 파일 이름 (확인을 통과한 파일만). 있을 때만 파일 줄과 "기준 초안 만들기" 줄이 나타난다. */
  fileName: string | null;
  /** 고른 파일의 크기 글 ("2.4 MB", "380 KB"). 고른 파일이 없으면 빈 글 */
  fileSizeText: string;
  /** 걸린 파일의 오류 문구 */
  fileError: string | null;
  /** 파일을 끌고 점선 상자 위에 있는지 (상자를 파란 테두리·옅은 파란 바탕으로 강조한다) */
  isDragOver: boolean;
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
  /** 파일을 끌고 점선 상자 위에 있음 (끄는 동안 되풀이해 불린다) / 상자 밖으로 나감 */
  onDragOverBox: () => void;
  onDragLeaveBox: () => void;
  /** 파일 줄의 "삭제". hadFocus 는 누른 버튼에 초점이 있었는지 (있었으면 초점이 파일 입력란으로 간다) */
  onClearFile: (hadFocus: boolean) => void;
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
 * 전형 준비 · 모집요강 올리기 탭(/prep): 테두리 상자 하나를 둘로 나눠 왼쪽에 "2027년 모집요강 올리기"(점선 상자와 고른 파일 줄),
 * 오른쪽에 "전년 대비 주요 변경 사항"(접기·펼치기)을 둔다. 치수·색·글자는 디자인 값 그대로다. 상자는 본문의 남는 높이를 채우고,
 * 폭이 모자라면 오른쪽 단이 아래로 내려간다(flex-wrap).
 * 점선 상자는 <label> 과 숨긴 파일 입력란이라 누르거나 키보드로 초점을 두고 Enter·Space 를 누르면 파일 선택 창이 열린다.
 * PDF 를 상자 위에 끌어다 놓아도 받고, 파일을 끌고 위에 있는 동안 상자가 파랗게 강조된다. 고른 파일은 상자 아래 파일 줄
 * (이름·크기·"올리기 완료"·삭제)에 보인다. "올리기 완료" 는 파일을 이 화면에 올려 두었다는 뜻이고, 서버로 보내는 것은 "기준 초안 만들기" 다.
 * 디자인에 없어 같은 모양새로 정한 것: 파일 줄 아래의 "기준 초안 만들기" 줄과 상태 글, 실패 문구, 초안 안내와 경고 목록,
 * 기다리는 동안의 꺼진 모양(상자 안 버튼 모양·기준 초안 만들기·삭제), 변경 사항이 0건일 때의 문장.
 * 처음 모습(고른 파일·초안 없음)에는 아무것도 더해지지 않는다.
 */
export function GuidelineUploadTab({
  ready,
  bodyRef,
  fileInputRef,
  fileName,
  fileSizeText,
  fileError,
  isDragOver,
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
  onDragOverBox,
  onDragLeaveBox,
  onClearFile,
  onGenerate,
  dropBoxRef,
  collapseButtonRef,
  weightsLinkRef,
  onWeightsLinkNavigate,
  onFileInputFocus,
  onToggleChanges,
}: GuidelineUploadTabProps) {
  return (
    <div
      ref={bodyRef}
      {...prepBodyProps(ready)}
      className={`mt-[16px] flex flex-[1_1_auto] flex-wrap items-stretch ${PANEL_CLASS}`}
    >
      <section aria-labelledby="upload-title" className="flex min-w-0 flex-[999_1_420px] flex-col">
        <div className={`flex h-[40px] items-center rounded-tl-[7px] px-[20px] ${PANEL_HEAD_CLASS}`}>
          <h2 id="upload-title" className={PANEL_TITLE_CLASS}>
            2027년 모집요강 올리기
          </h2>
        </div>
        <div className="flex flex-[1_1_auto] flex-col p-[20px]">
          {/*
            숨긴 입력란은 1px 이라 초점 표시가 보이지 않으므로, 입력란에 키보드 초점이 있을 때 상자에 전역 :focus-visible 과
            같은 모양(검정 2px 실선, 2px 띄움)을 그린다. 초안을 기다리는 동안에는 입력란을 막고(disabled) 끌어다 놓은 파일도 받지 않는다.
            그동안 입력란은 마우스 입력도 받지 않는다(pointer-events: none). disabled 입력란에 누름이 걸리면 상자의 mousedown 처리까지 가지 않고
            지금 초점이 body 로 빠지기 때문이다. 그러면 그 자리의 누름도 상자(또는 그 안의 글자)가 받는다.
          */}
          <label
            ref={dropBoxRef}
            className={`relative box-border flex min-h-[280px] flex-[1_1_auto] flex-col items-center justify-center gap-[8px] rounded-[8px] border-[1.5px] border-dashed p-[24px] text-center ${
              isDragOver ? "border-[#001AD0] bg-[#EEF0FF]" : "border-[#AEAEAE] bg-white"
            } ${
              isGenerating ? "cursor-default" : "cursor-pointer"
            } has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-[#000] has-[input:focus-visible]:outline-solid`}
            // 기다리는 동안 꺼져 있는 상자를 눌러도 지금 초점(예: 기준 초안 만들기)을 빼앗지 않는다(누름의 기본 동작 가운데 초점 옮기기만 막는다.
            // 입력란이 disabled 라 파일 선택 창은 열리지 않는다).
            onMouseDown={(event) => {
              if (isGenerating) event.preventDefault();
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
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              disabled={isGenerating}
              className={`absolute h-[1px] w-[1px] opacity-0${isGenerating ? " pointer-events-none" : ""}`}
              onChange={onFileInputChange}
              onFocus={onFileInputFocus}
              {...FOCUS_FALLBACK_PROPS}
            />
            <svg
              aria-hidden="true"
              viewBox="0 0 32 32"
              fill="none"
              stroke="#001AD0"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-[32px] w-[32px]"
            >
              <path d="M16 21V6M10 11.5 16 5.5l6 6M5 20v5.5h22V20" />
            </svg>
            {/* 버튼 모양의 글자다(누르는 것은 상자 전체). 기다리는 동안에는 꺼진 주 버튼 모양(옅은 회색 바탕, 회색 글자)이다. */}
            <span
              className={`mt-[4px] inline-flex h-[36px] items-center rounded-[6px] border px-[16px] text-[14px] font-semibold ${
                isGenerating ? "border-[#E4E6EE] bg-[#E4E6EE] text-[#505050]" : "border-[#000947] bg-[#000947] text-white"
              }`}
            >
              모집요강 올리기
            </span>
            <span className="text-[14px] leading-[20px] text-[#505050]">모집요강 PDF 파일을 이곳에 올리세요.</span>
            {/* 걸린 파일의 오류 문구 자리. 문구가 없어도 한 줄 높이를 차지해 문구가 나타날 때 상자 안이 움직이지 않는다. */}
            <span
              role="alert"
              className="min-h-[18px] text-[13px] leading-[18px] font-medium text-[#BA1A1A] [overflow-wrap:anywhere]"
            >
              {fileError}
            </span>
          </label>

          {fileName !== null && (
            <>
              <div
                role="group"
                aria-label="올린 파일"
                className="mt-[12px] flex flex-wrap items-center gap-x-[12px] gap-y-[8px] rounded-[6px] border border-[#E4E4E4] px-[12px] py-[10px]"
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
                {/* 긴 이름은 한 줄에서 말줄임표로 자른다. 전체 이름은 title 로 볼 수 있다. */}
                <span
                  title={fileName}
                  className="min-w-0 flex-[1_1_160px] overflow-hidden font-medium text-ellipsis whitespace-nowrap"
                >
                  {fileName}
                </span>
                <span className="text-[13px] text-[#505050] tabular-nums">{fileSizeText}</span>
                <StatusChip tone="green">올리기 완료</StatusChip>
                {/*
                  누르면 이 줄이 사라진다(초점은 상태 훅이 파일 입력란으로 옮긴다). 기다리는 동안에는 "기준 초안 만들기" 와 같이
                  disabled 대신 aria-disabled 로 두어 초점이 남게 하고, 눌러도 상태 훅이 아무것도 하지 않는다(흐린 모양, 기본 화살표 커서).
                */}
                <button
                  type="button"
                  aria-disabled={isGenerating ? "true" : undefined}
                  onClick={(event) => onClearFile(event.currentTarget === document.activeElement)}
                  className={`${BUTTON_SECONDARY_CLASS} h-[28px] scroll-m-[8px] cursor-pointer px-[10px] aria-disabled:cursor-default aria-disabled:opacity-[0.45]`}
                >
                  삭제
                </button>
              </div>

              <div className="mt-[12px] flex flex-wrap items-center gap-x-[12px] gap-y-[8px]">
                {/*
                  기다리는 동안 disabled 대신 aria-disabled 로 두어(누르면 상태 훅이 아무것도 하지 않는다) 초점이 버튼에 남게 한다.
                  모양은 주 버튼이고, 기다리는 동안에는 꺼진 주 버튼 모양(옅은 회색 바탕, 회색 글자)에 기본 화살표 커서다.
                */}
                <button
                  type="button"
                  aria-disabled={isGenerating ? "true" : undefined}
                  onClick={onGenerate}
                  className={`${BUTTON_PRIMARY_CLASS} h-[36px] scroll-m-[8px] cursor-pointer px-[14px] aria-disabled:cursor-default aria-disabled:border-[#E4E6EE] aria-disabled:bg-[#E4E6EE] aria-disabled:text-[#505050]`}
                >
                  기준 초안 만들기
                </button>
                <p aria-live="polite" className="text-[13px] leading-[18px] text-[#505050]">
                  {statusText}
                </p>
              </div>
            </>
          )}

          {requestError !== null && (
            <div
              role="alert"
              className="mt-[8px] text-[13px] leading-[18px] font-medium text-[#BA1A1A] [overflow-wrap:anywhere]"
            >
              <p>{requestError}</p>
              <WarningList warnings={requestWarnings} />
            </div>
          )}

          {/* 초안 안내는 늘 있는 알림 영역 안에 그려 초안이 생길 때 읽히게 한다(초안이 없으면 빈 영역이라 모양에 영향이 없다). */}
          <div aria-live="polite">
            {draftNotice !== null && (
              <div className="mt-[12px] rounded-[6px] border border-[#E4E4E4] px-[12px] py-[10px] text-[13px] leading-[18px] [overflow-wrap:anywhere]">
                <div className="flex flex-wrap items-center gap-x-[12px] gap-y-[8px]">
                  <p className="min-w-0 flex-[1_1_240px] font-medium text-[#111111]">
                    기준 초안을 만들었습니다 (평가 요소 {draftNotice.elementCount}개). 평가·배점 설정에서 확인하고 저장해 주세요.
                  </p>
                  <Link
                    ref={weightsLinkRef}
                    href="/prep/weights"
                    onNavigate={onWeightsLinkNavigate}
                    className={`${BUTTON_SECONDARY_CLASS} h-[28px] flex-none scroll-m-[8px] px-[10px]`}
                  >
                    평가 · 배점 설정으로 이동
                  </Link>
                </div>
                <WarningList warnings={draftNotice.warnings} />
              </div>
            )}
          </div>
        </div>
      </section>

      <section
        aria-labelledby="changes-title"
        className="box-border flex max-w-[400px] min-w-0 flex-[1_1_400px] flex-col border-l border-l-[#E4E4E4]"
      >
        <div className={`flex h-[40px] items-center rounded-tr-[7px] px-[20px] ${PANEL_HEAD_CLASS}`}>
          <h2 id="changes-title" className={PANEL_TITLE_CLASS}>
            전년 대비 주요 변경 사항
          </h2>
        </div>
        {/* 낱말 가운데에서 줄을 바꾸지 않되(keep-all), 빈칸 없이 아주 긴 글은 상자를 넘지 않게 끊는다(anywhere). */}
        <div
          id={CHANGES_LIST_ID}
          hidden={changesCollapsed}
          className="px-[20px] pt-[4px] pb-[8px] [overflow-wrap:anywhere] [word-break:keep-all]"
        >
          {noChangesNotice !== null && (
            <p className="py-[12px] text-[13px] leading-[20px] text-[#505050]">{noChangesNotice}</p>
          )}
          {/* 모집요강에서 온 변경 사항은 제목이 겹칠 수 있어 순서를 key 로 쓴다(목록은 통째로 바뀔 뿐 항목을 옮기지 않는다). */}
          {changes.map((change, index) => (
            <div key={index} className={`py-[12px]${index === 0 ? "" : " border-t border-t-[#E4E4E4]"}`}>
              <h3 className="text-[14px] leading-[20px] font-semibold">{change.title}</h3>
              <p className="mt-[4px] text-[13px] leading-[20px] text-[#505050]">
                {change.body.split("\n").map((line, lineIndex) => (
                  <Fragment key={lineIndex}>
                    {lineIndex > 0 && <br />}
                    {line}
                  </Fragment>
                ))}
              </p>
            </div>
          ))}
        </div>
        {/* 버튼의 이름은 보이는 글자("접기"·"펼치기")다. 접힌 동안에는 같은 화살표를 180도 돌려 아래를 향하게 한다. */}
        <button
          type="button"
          aria-expanded={!changesCollapsed}
          aria-controls={CHANGES_LIST_ID}
          ref={collapseButtonRef}
          onClick={(event) => onToggleChanges(event.currentTarget === document.activeElement)}
          className={`${BUTTON_SECONDARY_CLASS} mx-[20px] mb-[12px] h-[40px] scroll-m-[8px] cursor-pointer gap-[6px]`}
        >
          {changesCollapsed ? "펼치기" : "접기"}
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            fill="none"
            stroke="#505050"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`h-[14px] w-[14px] ${changesCollapsed ? "rotate-180" : ""}`}
          >
            <path d="M4 10l4-4 4 4" />
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
    <ul className="mt-[6px] text-[13px] leading-[18px] font-normal text-[#505050] [overflow-wrap:anywhere]">
      {warnings.map((warning, index) => (
        <li key={index}>{warning}</li>
      ))}
    </ul>
  );
}
