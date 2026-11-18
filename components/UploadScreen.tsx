import { useRef } from "react";
import { Area } from "@/components/Area";
import { CriteriaExamples } from "@/components/CriteriaExamples";
import { NewDepartmentForm, type NewDepartmentFormProps } from "@/components/NewDepartmentForm";
import { SERVICE_NAME } from "@/lib/constants";
import type { CriteriaExample } from "@/lib/criteria/examples";
import type { Criterion } from "@/types/analysis";

type UploadScreenProps = {
  /** 학과 선택 목록: 코드에 적힌 학과 → 저장한 학과 → "새 학과 기준 만들기" */
  departments: { id: string; department: string }[];
  /** 선택한 항목의 값 (학과 기준 id. "새 학과 기준 만들기"는 그 항목의 값) */
  criteriaId: string;
  /** "새 학과 기준 만들기"를 골랐는지 */
  isNewDepartment: boolean;
  /** 선택한 학과의 기준 목록 (읽기 전용으로 표시) */
  criteriaItems: Criterion[];
  /** 저장한 학과를 골랐을 때만 true (이 학과 삭제 버튼을 보여 준다) */
  canDeleteDepartment: boolean;
  /** 저장한 학과를 브라우저에 저장·삭제하지 못했을 때의 안내 문구 */
  storageNotice: string | null;
  /** "새 학과 기준 만들기" 영역 */
  newDepartment: NewDepartmentFormProps;
  /** "기준 문장 예시" 영역에 보여 줄 예시 */
  examples: readonly CriteriaExample[];
  fileName: string | null;
  fileError: string | null;
  requestError: string | null;
  isAnalyzing: boolean;
  /** 바뀌면 파일 입력을 새로 만들어 비운다 */
  fileInputKey: number;
  canStart: boolean;
  /** 분석 시작을 누를 수 없는 이유 (확정하지 않은 기준). 없으면 null */
  startBlockedReason: string | null;
  onSelectCriteria: (criteriaId: string) => void;
  onDeleteDepartment: () => void;
  /** 예시를 "새 학과 기준 만들기" 입력란에 넣는다 */
  onUseExample: (example: CriteriaExample) => void;
  onSelectFile: (file: File | null) => void;
  onStart: () => void;
  onViewSample: () => void;
};

/** 업로드 화면 (/upload) */
export function UploadScreen({
  departments,
  criteriaId,
  isNewDepartment,
  criteriaItems,
  canDeleteDepartment,
  storageNotice,
  newDepartment,
  examples,
  fileName,
  fileError,
  requestError,
  isAnalyzing,
  fileInputKey,
  canStart,
  startBlockedReason,
  onSelectCriteria,
  onDeleteDepartment,
  onUseExample,
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

      {/* 왼쪽 단(평가 기준, 학생부 PDF 업로드) 오른쪽에 예시를 나란히 둔다. 왼쪽 단은 720px, 예시 영역은 남은 폭을 쓴다. */}
      <div className="flex items-start gap-3">
        <div className="flex w-[720px] shrink-0 flex-col gap-3">
          <Area name="평가 기준">
            <div className="flex flex-col gap-3">
              {/* 공백 없는 긴 학과 이름이 있어도 영역 밖으로 넘치지 않게 선택 목록만 줄어들 수 있게 한다(min-w-0). */}
              <div className="flex items-center gap-3">
                <label className="flex min-w-0 items-center gap-3">
                  <span className="shrink-0">학과 선택</span>
                  <select
                    className="min-w-0 border border-neutral-500 bg-white px-2 py-1 disabled:border-neutral-300 disabled:text-neutral-400"
                    value={criteriaId}
                    disabled={isAnalyzing || newDepartment.isGenerating}
                    onChange={(event) => onSelectCriteria(event.target.value)}
                  >
                    {departments.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.department}
                      </option>
                    ))}
                  </select>
                </label>
                {canDeleteDepartment && (
                  <button
                    type="button"
                    className="shrink-0 border border-neutral-500 px-3 py-1 disabled:border-neutral-300 disabled:text-neutral-400"
                    disabled={isAnalyzing}
                    onClick={onDeleteDepartment}
                  >
                    이 학과 삭제
                  </button>
                )}
              </div>
              {storageNotice && <p role="alert">{storageNotice}</p>}

              {isNewDepartment ? (
                <NewDepartmentForm {...newDepartment} disabled={isAnalyzing} />
              ) : (
                <div>
                  <p className="mb-1">기준 목록</p>
                  {criteriaItems.length === 0 ? (
                    <p className="text-neutral-500">선택한 학과의 기준이 없습니다.</p>
                  ) : (
                    <ul className="flex flex-col gap-1 [overflow-wrap:anywhere]">
                      {criteriaItems.map((criterion) => (
                        <li key={criterion.id}>
                          <span className="font-bold">{criterion.name}</span>: {criterion.description}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </Area>

          <Area name="학생부 PDF 업로드">
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

              {startBlockedReason && <p>{startBlockedReason}</p>}
              <p aria-live="polite">{isAnalyzing ? "분석 중…" : ""}</p>
              {requestError && <p role="alert">{requestError}</p>}
            </div>
          </Area>
        </div>

        <CriteriaExamples
          examples={examples}
          disabled={isAnalyzing || newDepartment.isGenerating}
          onUse={onUseExample}
        />
      </div>
    </main>
  );
}
