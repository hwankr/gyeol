import Link from "next/link";
import type { RefObject } from "react";
import {
  BUTTON_PRIMARY_CLASS,
  BUTTON_SECONDARY_CLASS,
  ConsoleCrumbs,
  ConsoleTitle,
  PANEL_CLASS,
  PANEL_HEAD_CLASS,
  PANEL_TITLE_CLASS,
  type ConsoleCrumb,
} from "@/components/consoleUi";
import { BUSY_PRIMARY_BUTTON_CLASS, PdfDropBox, PickedFileRow } from "@/components/PdfUpload";

type RecordUploadScreenProps = {
  /** 화면이 준비됐는지 (준비 전에는 본문이 inert 라 초점을 받지 않고 눌리지 않는다. 모양은 그대로) */
  ready: boolean;
  bodyRef: RefObject<HTMLDivElement | null>;
  crumbs: readonly ConsoleCrumb[];
  /** 제목 옆의 글: 전형 · 모집 단위 */
  headNote: string;
  /** 지원자 관리로 돌아가는 주소 */
  backHref: string;
  fileInputRef: RefObject<HTMLInputElement | null>;
  dropBoxRef: RefObject<HTMLLabelElement | null>;
  analyzeButtonRef: RefObject<HTMLButtonElement | null>;
  doneLinkRef: RefObject<HTMLAnchorElement | null>;
  /** 고른 파일 이름 (확인을 통과한 파일만). 있을 때만 파일 줄과 "분석 시작" 줄이 나타난다. */
  fileName: string | null;
  fileSizeText: string;
  fileError: string | null;
  isDragOver: boolean;
  /** 분석을 기다리는 중인지 (버튼은 aria-disabled, 파일 선택은 막힌다) */
  isAnalyzing: boolean;
  /** 버튼 오른쪽 상태 글 (기다리는 동안만) */
  statusText: string;
  requestError: string | null;
  /** 저장소에 쓰지 못했을 때의 안내 (없으면 빈 글) */
  storageNotice: string;
  /** 방금 올린 학생부의 안내. evaluateHref 가 null 이면 평가 대기 목록에 나오지 않는 학생부다. */
  done: { text: string; evaluateHref: string | null; originalHref: string } | null;
  /** 이 브라우저에 남아 있는 올린 학생부 수와 한도 */
  keptText: string;
  /** 분석에 쓰는 평가 기준 */
  criteria: {
    department: string;
    elements: { id: string; name: string; weight: number; tags: string }[];
    weightsHref: string;
  };
  onFileInputChange: () => void;
  onDropFiles: (files: FileList) => void;
  onDragOverBox: () => void;
  onDragLeaveBox: () => void;
  onClearFile: (hadFocus: boolean) => void;
  onAnalyze: () => void;
  onFileInputFocus: () => void;
};

/**
 * 지원자 관리 · 학생부 올리기 화면(/applicants/upload). 디자인 시안에는 없는 화면이라 전형 준비의 모집요강 올리기와 같은 조각
 * (점선 상자, 파일 줄, 주 버튼과 상태 글, 실패 문구, 안내 상자)과 같은 두 단 상자로 만들었다. 왼쪽은 "학생부 올리기",
 * 오른쪽(400px 까지)은 "분석에 쓰는 평가 기준"(전형 준비에서 저장한 요소·배점·태그와 고치러 가는 링크)이다. 폭이 모자라면 오른쪽 단이 아래로 내려간다.
 * 분석이 끝나면 파일 줄과 "분석 시작" 이 사라지고 방금 올린 학생부의 안내(평가하기·원문보기 링크)가 나타난다. 다른 화면으로 가지 않는다.
 */
export function RecordUploadScreen({
  ready,
  bodyRef,
  crumbs,
  headNote,
  backHref,
  fileInputRef,
  dropBoxRef,
  analyzeButtonRef,
  doneLinkRef,
  fileName,
  fileSizeText,
  fileError,
  isDragOver,
  isAnalyzing,
  statusText,
  requestError,
  storageNotice,
  done,
  keptText,
  criteria,
  onFileInputChange,
  onDropFiles,
  onDragOverBox,
  onDragLeaveBox,
  onClearFile,
  onAnalyze,
  onFileInputFocus,
}: RecordUploadScreenProps) {
  return (
    <>
      <ConsoleCrumbs items={crumbs} />
      <ConsoleTitle title="지원자 관리" note={headNote} />
      <div ref={bodyRef} inert={!ready} className={`mt-[20px] flex flex-[1_1_auto] flex-wrap items-stretch ${PANEL_CLASS}`}>
        <section aria-labelledby="record-upload-title" className="flex min-w-0 flex-[999_1_420px] flex-col">
          <div className={`flex h-[40px] items-center justify-between gap-[8px] rounded-tl-[7px] px-[20px] ${PANEL_HEAD_CLASS}`}>
            <h2 id="record-upload-title" className={PANEL_TITLE_CLASS}>
              학생부 올리기
            </h2>
            <Link href={backHref} className="scroll-m-[8px] text-[13px] leading-[18px] font-medium text-[#505050] no-underline">
              지원자 목록으로
            </Link>
          </div>
          <div className="flex flex-[1_1_auto] flex-col p-[20px]">
            <PdfDropBox
              boxRef={dropBoxRef}
              inputRef={fileInputRef}
              busy={isAnalyzing}
              dragOver={isDragOver}
              buttonLabel="학생부 올리기"
              hint="학생부 PDF 파일을 이곳에 올리세요."
              error={fileError}
              onInputChange={onFileInputChange}
              onInputFocus={onFileInputFocus}
              onDropFiles={onDropFiles}
              onDragOverBox={onDragOverBox}
              onDragLeaveBox={onDragLeaveBox}
            />

            {fileName !== null && (
              <>
                <PickedFileRow fileName={fileName} sizeText={fileSizeText} busy={isAnalyzing} onClear={onClearFile} />

                <div className="mt-[12px] flex flex-wrap items-center gap-x-[12px] gap-y-[8px]">
                  {/* 기다리는 동안 disabled 대신 aria-disabled 로 두어(누르면 상태 훅이 아무것도 하지 않는다) 초점이 버튼에 남게 한다. */}
                  <button
                    ref={analyzeButtonRef}
                    type="button"
                    aria-disabled={isAnalyzing ? "true" : undefined}
                    onClick={onAnalyze}
                    className={`${BUTTON_PRIMARY_CLASS} ${BUSY_PRIMARY_BUTTON_CLASS}`}
                  >
                    분석 시작
                  </button>
                  <p aria-live="polite" className="text-[13px] leading-[18px] text-[#505050]">
                    {statusText}
                  </p>
                </div>
              </>
            )}

            {requestError !== null && (
              <p role="alert" className="mt-[8px] text-[13px] leading-[18px] font-medium text-[#BA1A1A] [overflow-wrap:anywhere]">
                {requestError}
              </p>
            )}
            {storageNotice !== "" && (
              <p role="alert" className="mt-[8px] text-[13px] leading-[18px] font-medium text-[#BA1A1A] [overflow-wrap:anywhere]">
                {storageNotice}
              </p>
            )}

            {/* 방금 올린 학생부의 안내는 늘 있는 알림 영역 안에 그려 생길 때 읽히게 한다(없으면 빈 영역이라 모양에 영향이 없다). */}
            <div aria-live="polite">
              {done !== null && (
                <div className="mt-[12px] flex flex-wrap items-center gap-x-[12px] gap-y-[8px] rounded-[6px] border border-[#E4E4E4] px-[12px] py-[10px] text-[13px] leading-[18px] [overflow-wrap:anywhere]">
                  <p className="min-w-0 flex-[1_1_240px] font-medium text-[#111111]">{done.text}</p>
                  <div className="flex flex-none flex-wrap gap-[8px]">
                    {done.evaluateHref !== null && (
                      <Link
                        ref={doneLinkRef}
                        href={done.evaluateHref}
                        className={`${BUTTON_PRIMARY_CLASS} h-[28px] scroll-m-[8px] px-[10px]`}
                      >
                        평가하기
                      </Link>
                    )}
                    <Link
                      ref={done.evaluateHref === null ? doneLinkRef : undefined}
                      href={done.originalHref}
                      className={`${BUTTON_SECONDARY_CLASS} h-[28px] scroll-m-[8px] px-[10px]`}
                    >
                      원문보기
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <p className="mt-[12px] text-[12px] leading-[16px] text-[#767676]">{keptText}</p>
          </div>
        </section>

        <section
          aria-labelledby="record-criteria-title"
          className="box-border flex max-w-[400px] min-w-0 flex-[1_1_400px] flex-col border-l border-l-[#E4E4E4]"
        >
          <div className={`flex h-[40px] items-center rounded-tr-[7px] px-[20px] ${PANEL_HEAD_CLASS}`}>
            <h2 id="record-criteria-title" className={PANEL_TITLE_CLASS}>
              분석에 쓰는 평가 기준
            </h2>
          </div>
          <div className="px-[20px] pt-[4px] pb-[8px] [overflow-wrap:anywhere] [word-break:keep-all]">
            <p className="py-[12px] text-[13px] leading-[20px] text-[#505050]">
              전형 준비에서 저장한 {criteria.department} 평가 기준으로 근거를 찾고 AI 점수 제안을 만듭니다. 식별 정보는 분석하기 전에 가립니다.
            </p>
            <ul>
              {criteria.elements.map((element) => (
                <li key={element.id} className="border-t border-t-[#E4E4E4] py-[12px]">
                  <p className="flex items-baseline justify-between gap-[12px]">
                    <strong className="text-[14px] leading-[20px] font-semibold">{element.name}</strong>
                    <span className="flex-none text-[13px] leading-[18px] text-[#505050] tabular-nums">배점 {element.weight}</span>
                  </p>
                  <p className="mt-[4px] text-[13px] leading-[20px] text-[#505050]">{element.tags}</p>
                </li>
              ))}
            </ul>
            <p className="border-t border-t-[#E4E4E4] py-[12px] text-[13px] leading-[20px] text-[#505050]">
              요소나 질문을 바꾸면 그 전에 올린 학생부는 다시 올려야 평가할 수 있습니다. 배점만 바꾸면 그대로 평가할 수 있습니다.
            </p>
          </div>
          <Link
            href={criteria.weightsHref}
            className={`${BUTTON_SECONDARY_CLASS} mx-[20px] mb-[12px] h-[40px] scroll-m-[8px]`}
          >
            평가 · 배점 설정으로 이동
          </Link>
        </section>
      </div>
    </>
  );
}
