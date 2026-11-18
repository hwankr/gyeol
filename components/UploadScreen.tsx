import { useRef } from "react";
import { Area } from "@/components/Area";
import { SERVICE_NAME } from "@/lib/constants";
import type { Criterion } from "@/types/analysis";

type UploadScreenProps = {
  /** 학과 선택 목록 */
  departments: { id: string; department: string }[];
  /** 선택한 학과 기준 id */
  criteriaId: string;
  /** 선택한 학과의 기준 목록 (읽기 전용으로 표시) */
  criteriaItems: Criterion[];
  accessCode: string;
  fileName: string | null;
  fileError: string | null;
  requestError: string | null;
  isAnalyzing: boolean;
  /** 바뀌면 파일 입력을 새로 만들어 비운다 */
  fileInputKey: number;
  canStart: boolean;
  onSelectCriteria: (criteriaId: string) => void;
  onChangeAccessCode: (accessCode: string) => void;
  onSelectFile: (file: File | null) => void;
  onStart: () => void;
  onViewSample: () => void;
};

/** 업로드 화면 (/) */
export function UploadScreen({
  departments,
  criteriaId,
  criteriaItems,
  accessCode,
  fileName,
  fileError,
  requestError,
  isAnalyzing,
  fileInputKey,
  canStart,
  onSelectCriteria,
  onChangeAccessCode,
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

      <Area name="평가 기준" className="w-[720px]">
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-3">
            <span>학과 선택</span>
            <select
              className="border border-neutral-500 bg-white px-2 py-1 disabled:border-neutral-300 disabled:text-neutral-400"
              value={criteriaId}
              disabled={isAnalyzing}
              onChange={(event) => onSelectCriteria(event.target.value)}
            >
              {departments.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.department}
                </option>
              ))}
            </select>
          </label>

          <div>
            <p className="mb-1">기준 목록</p>
            {criteriaItems.length === 0 ? (
              <p className="text-neutral-500">선택한 학과의 기준이 없습니다.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {criteriaItems.map((criterion) => (
                  <li key={criterion.id}>
                    <span className="font-bold">{criterion.name}</span>: {criterion.description}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
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

          <label className="flex items-center gap-3">
            <span>접속 코드</span>
            <input
              type="password"
              autoComplete="off"
              className="w-60 border border-neutral-500 px-2 py-1 disabled:border-neutral-300 disabled:text-neutral-400"
              value={accessCode}
              disabled={isAnalyzing}
              onChange={(event) => onChangeAccessCode(event.target.value)}
            />
          </label>

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
