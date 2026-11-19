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
  Spinner,
  StatusChip,
  type ChipTone,
  type ConsoleCrumb,
} from "@/components/consoleUi";
import { BUSY_PRIMARY_BUTTON_CLASS, PdfDropBox } from "@/components/PdfUpload";
import type { RecordUploadRow } from "@/hooks/useRecordUpload";

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
  /** 올려 둔 학생부 (올려 둔 순서). 한 줄이 한 건이다 */
  rows: readonly RecordUploadRow[];
  /** 방금 고른 파일 가운데 받지 못한 것이 있을 때의 문구 */
  fileError: string | null;
  isDragOver: boolean;
  /** 분석하는 중인지 (버튼은 aria-disabled, 파일 선택과 줄의 "삭제" 는 막힌다) */
  isAnalyzing: boolean;
  /** "분석 시작" 줄을 보여 줄지 (분석할 학생부가 있거나 분석하는 중) */
  showAnalyze: boolean;
  /** 버튼 오른쪽 상태 글 (분석하는 동안만) */
  statusText: string;
  /** 저장소에 쓰지 못했을 때의 안내 (없으면 빈 글) */
  storageNotice: string;
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
  onRemoveRow: (id: number, hadFocus: boolean) => void;
  onAnalyze: () => void;
  onFileInputFocus: () => void;
};

const STATUS_TONE: Record<RecordUploadRow["status"], ChipTone> = {
  waiting: "gray",
  working: "blue",
  done: "green",
  failed: "red",
};

/**
 * 지원자 관리 · 학생부 올리기 화면(/applicants/upload). 디자인 시안에는 없는 화면이라 전형 준비의 모집요강 올리기와 같은 조각
 * (점선 상자, 파일 줄, 주 버튼과 상태 글, 실패 문구)과 같은 두 단 상자로 만들었다. 왼쪽은 "학생부 올리기",
 * 오른쪽(400px 까지)은 "분석에 쓰는 평가 기준"(전형 준비에서 저장한 요소·배점·태그와 고치러 가는 링크)이다. 폭이 모자라면 오른쪽 단이 아래로 내려간다.
 * 학생부는 여러 건을 한꺼번에 올려 둘 수 있다. 올려 둔 학생부는 한 줄씩 보이고(이름·크기·상태), "분석 시작" 을 누르면 올려 둔 순서대로
 * 한 건씩 분석한다. 끝난 줄은 파일 이름 대신 지원자 코드와 평가하기·원문보기 링크를 보여 준다. 다른 화면으로 가지 않는다.
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
  rows,
  fileError,
  isDragOver,
  isAnalyzing,
  showAnalyze,
  statusText,
  storageNotice,
  keptText,
  criteria,
  onFileInputChange,
  onDropFiles,
  onDragOverBox,
  onDragLeaveBox,
  onRemoveRow,
  onAnalyze,
  onFileInputFocus,
}: RecordUploadScreenProps) {
  /** 끝난 줄 가운데 가장 나중 것: 그 줄의 첫 링크가 "분석 시작" 이 사라질 때 초점을 받는다. */
  const lastDoneId = rows.findLast((row) => row.links !== null)?.id;
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
            <Link
              href={backHref}
              className="motion-colors scroll-m-[8px] text-[13px] leading-[18px] font-medium text-[#505050] no-underline hover-on:text-[#111111]"
            >
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
              multiple
              onInputChange={onFileInputChange}
              onInputFocus={onFileInputFocus}
              onDropFiles={onDropFiles}
              onDragOverBox={onDragOverBox}
              onDragLeaveBox={onDragLeaveBox}
            />

            {rows.length > 0 && (
              <ul aria-label="올려 둔 학생부" className="mt-[12px] flex flex-col gap-[8px]">
                {rows.map((row) => (
                  <li key={row.id} className="animate-fade-in rounded-[6px] border border-[#E4E4E4] px-[12px] py-[10px]">
                    <div className="flex flex-wrap items-center gap-x-[12px] gap-y-[8px]">
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
                      {/* 긴 이름은 한 줄에서 말줄임표로 자른다(전체 이름은 title 로 볼 수 있다). 끝난 줄은 지원자 코드다. */}
                      <span
                        title={row.title}
                        className="min-w-0 flex-[1_1_160px] overflow-hidden font-medium text-ellipsis whitespace-nowrap tabular-nums"
                      >
                        {row.title}
                      </span>
                      {row.sizeText !== "" && <span className="text-[13px] text-[#505050] tabular-nums">{row.sizeText}</span>}
                      <StatusChip tone={STATUS_TONE[row.status]}>{row.statusLabel}</StatusChip>
                      {/*
                        누르면 이 줄이 사라진다(초점은 상태 훅이 파일 입력란으로 옮긴다). 분석하는 동안에는 disabled 대신 aria-disabled 로 두어
                        초점이 남게 하고, 눌러도 상태 훅이 아무것도 하지 않는다(흐린 모양, 기본 화살표 커서).
                      */}
                      {row.removable && (
                        <button
                          type="button"
                          aria-disabled={isAnalyzing ? "true" : undefined}
                          onClick={(event) => onRemoveRow(row.id, event.currentTarget === document.activeElement)}
                          className={`${BUTTON_SECONDARY_CLASS} h-[28px] scroll-m-[8px] cursor-pointer px-[10px] aria-disabled:cursor-default aria-disabled:opacity-[0.45]`}
                        >
                          삭제
                        </button>
                      )}
                      {row.links !== null && (
                        <div className="flex flex-none flex-wrap gap-[8px]">
                          {row.links.evaluateHref !== null && (
                            <Link
                              ref={row.id === lastDoneId ? doneLinkRef : undefined}
                              href={row.links.evaluateHref}
                              className={`${BUTTON_PRIMARY_CLASS} h-[28px] scroll-m-[8px] px-[10px]`}
                            >
                              평가하기
                            </Link>
                          )}
                          <Link
                            ref={row.id === lastDoneId && row.links.evaluateHref === null ? doneLinkRef : undefined}
                            href={row.links.originalHref}
                            className={`${BUTTON_SECONDARY_CLASS} h-[28px] scroll-m-[8px] px-[10px]`}
                          >
                            원문보기
                          </Link>
                        </div>
                      )}
                    </div>
                    {row.note !== "" && (
                      <p
                        role={row.noteIsError ? "alert" : undefined}
                        className={`mt-[6px] flex items-center gap-[6px] text-[13px] leading-[18px] [overflow-wrap:anywhere] ${
                          row.noteIsError ? "font-medium text-[#BA1A1A]" : "text-[#505050]"
                        }`}
                      >
                        {row.status === "working" && <Spinner />}
                        {row.note}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {showAnalyze && (
              <div className="mt-[12px] flex animate-fade-in flex-wrap items-center gap-x-[12px] gap-y-[8px]">
                {/* 분석하는 동안 disabled 대신 aria-disabled 로 두어(누르면 상태 훅이 아무것도 하지 않는다) 초점이 버튼에 남게 한다. */}
                <button
                  ref={analyzeButtonRef}
                  type="button"
                  aria-disabled={isAnalyzing ? "true" : undefined}
                  onClick={onAnalyze}
                  className={`${BUTTON_PRIMARY_CLASS} ${BUSY_PRIMARY_BUTTON_CLASS}`}
                >
                  분석 시작
                </button>
                {/* 분석하는 동안 몇 건째인지 알린다. 건마다의 단계는 그 줄에 적힌다. */}
                <p aria-live="polite" className="text-[13px] leading-[18px] text-[#505050]">
                  {statusText}
                </p>
              </div>
            )}

            {storageNotice !== "" && (
              <p role="alert" className="mt-[8px] animate-fade-in text-[13px] leading-[18px] font-medium text-[#BA1A1A] [overflow-wrap:anywhere]">
                {storageNotice}
              </p>
            )}

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
              전형 준비에서 저장한 {criteria.department} 평가 기준으로 근거를 찾고 AI 점수 제안을 만듭니다. 식별 정보는 분석하기 전에 가립니다. 스캔본처럼 글자를 바로 읽을 수 없는 학생부는 AI 가 가리기 전의 쪽 그림을 읽어 글로 옮긴 뒤에 가립니다.
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
