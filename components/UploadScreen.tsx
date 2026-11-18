import { useRef } from "react";
import { Area } from "@/components/Area";
import { SERVICE_NAME } from "@/lib/constants";

type UploadScreenProps = {
  fileName: string | null;
  fileError: string | null;
  requestError: string | null;
  isAnalyzing: boolean;
  /** 바뀌면 파일 입력을 새로 만들어 비운다 */
  fileInputKey: number;
  canStart: boolean;
  onSelectFile: (file: File | null) => void;
  onStart: () => void;
  onViewSample: () => void;
};

/** 업로드 화면 (/) */
export function UploadScreen({
  fileName,
  fileError,
  requestError,
  isAnalyzing,
  fileInputKey,
  canStart,
  onSelectFile,
  onStart,
  onViewSample,
}: UploadScreenProps) {
  /** 숨겨 둔 파일 입력. "파일 업로드" 버튼이 이 입력의 파일 선택 창을 연다. */
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <main className="flex flex-col gap-3 p-3">
      <Area name="상단">
        <h1 className="text-lg font-bold">{SERVICE_NAME}</h1>
      </Area>

      <Area name="학생부 PDF 업로드" className="w-[720px]">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span>학생부 PDF 파일</span>
            <button
              type="button"
              className="border border-neutral-500 px-3 py-1 disabled:border-neutral-300 disabled:text-neutral-400"
              disabled={isAnalyzing}
              onClick={() => fileInputRef.current?.click()}
            >
              파일 업로드
            </button>
            {/* 브라우저 기본 파일 입력은 숨기고 위 버튼으로 연다. 고른 파일은 아래 "선택한 파일"에 표시한다. */}
            <input
              key={fileInputKey}
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              hidden
              disabled={isAnalyzing}
              onChange={(event) => onSelectFile(event.target.files?.[0] ?? null)}
            />
          </div>

          <p>선택한 파일: {fileName ?? "없음"}</p>
          {fileError && <p role="alert">{fileError}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              className="border border-neutral-500 px-3 py-1 font-bold disabled:border-neutral-300 disabled:text-neutral-400"
              disabled={!canStart}
              onClick={onStart}
            >
              분석 시작
            </button>
            <button
              type="button"
              className="border border-neutral-500 px-3 py-1 disabled:border-neutral-300 disabled:text-neutral-400"
              disabled={isAnalyzing}
              onClick={onViewSample}
            >
              샘플 데이터로 보기
            </button>
          </div>

          <p aria-live="polite">{isAnalyzing ? "분석 중…" : ""}</p>
          {requestError && <p role="alert">{requestError}</p>}
        </div>
      </Area>
    </main>
  );
}
