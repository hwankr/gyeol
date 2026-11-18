import {
  MAX_CRITERION_DESCRIPTION_LENGTH,
  MAX_CRITERION_NAME_LENGTH,
  MAX_DEPARTMENT_NAME_LENGTH,
  MAX_SOURCE_TEXT_LENGTH,
} from "@/lib/criteria/limits";

/** 입력 요소 공통 모양 (지금 화면의 입력란과 같다) */
const INPUT_CLASS = "border border-neutral-500 px-2 py-1 disabled:border-neutral-300 disabled:text-neutral-400";
const BUTTON_CLASS = "border border-neutral-500 px-3 py-1 disabled:border-neutral-300 disabled:text-neutral-400";

export type NewDepartmentFormProps = {
  departmentName: string;
  sourceText: string;
  isGenerating: boolean;
  /** 기준 만들기의 안내·오류 문구 */
  generateError: string | null;
  /** 기준 만들기가 한 번이라도 성공한 뒤의 초안. 그 전에는 null(목록·기준 추가·확정이 없다). */
  draft: {
    items: { key: string; name: string; description: string }[];
    /** 받은 경고 (그대로 보여 준다) */
    warnings: string[];
    /** 기준을 더할 수 있는지 (6개 미만) */
    canAddItem: boolean;
  } | null;
  /** 확정할 수 없는 이유 */
  confirmError: string | null;
  onChangeDepartmentName: (value: string) => void;
  onChangeSourceText: (value: string) => void;
  onGenerate: () => void;
  onChangeItemName: (key: string, value: string) => void;
  onChangeItemDescription: (key: string, value: string) => void;
  onRemoveItem: (key: string) => void;
  onAddItem: () => void;
  onConfirm: () => void;
};

/** "새 학과 기준 만들기": 학과 이름·문장 입력, 기준 만들기, 초안 고치기, 확정. 업로드 화면의 "평가 기준" 영역 안에 그린다. */
export function NewDepartmentForm({
  departmentName,
  sourceText,
  isGenerating,
  generateError,
  draft,
  confirmError,
  disabled,
  onChangeDepartmentName,
  onChangeSourceText,
  onGenerate,
  onChangeItemName,
  onChangeItemDescription,
  onRemoveItem,
  onAddItem,
  onConfirm,
}: NewDepartmentFormProps & {
  /** 분석 중이면 모든 입력 요소·버튼을 막는다 */
  disabled: boolean;
}) {
  const isLocked = disabled || isGenerating;

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-3">
        <span>학과 이름</span>
        <input
          type="text"
          className={`w-60 ${INPUT_CLASS}`}
          maxLength={MAX_DEPARTMENT_NAME_LENGTH}
          value={departmentName}
          disabled={isLocked}
          onChange={(event) => onChangeDepartmentName(event.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span>학과가 보고 싶은 점 (2,000자 이하)</span>
        <textarea
          className={`w-full ${INPUT_CLASS}`}
          rows={5}
          maxLength={MAX_SOURCE_TEXT_LENGTH}
          value={sourceText}
          disabled={isLocked}
          onChange={(event) => onChangeSourceText(event.target.value)}
        />
      </label>

      <div>
        <button type="button" className={BUTTON_CLASS} disabled={isLocked} onClick={onGenerate}>
          기준 만들기
        </button>
      </div>

      <p aria-live="polite">{isGenerating ? "기준 만드는 중…" : ""}</p>
      {generateError && (
        <p role="alert" className="[overflow-wrap:anywhere]">
          {generateError}
        </p>
      )}

      {draft !== null && (
        <div className="flex flex-col gap-3">
          <p>생성된 기준 (확정 전. 고칠 수 있습니다)</p>

          {draft.warnings.length > 0 && (
            <div>
              <p className="mb-1">경고</p>
              <ul className="flex flex-col gap-1 [overflow-wrap:anywhere]">
                {draft.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {draft.items.length === 0 ? (
            <p className="text-neutral-500">
              만들어진 기준이 없습니다. 문장을 고쳐 다시 만들거나 기준을 직접 추가해 주세요.
            </p>
          ) : (
            <ol className="flex flex-col gap-3">
              {draft.items.map((item, index) => (
                <li key={item.key} className="flex flex-col gap-1">
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-3">
                      <span>기준 {index + 1} 이름</span>
                      <input
                        type="text"
                        className={`w-60 ${INPUT_CLASS}`}
                        maxLength={MAX_CRITERION_NAME_LENGTH}
                        value={item.name}
                        disabled={isLocked}
                        onChange={(event) => onChangeItemName(item.key, event.target.value)}
                      />
                    </label>
                    <button
                      type="button"
                      className={BUTTON_CLASS}
                      disabled={isLocked}
                      onClick={() => onRemoveItem(item.key)}
                    >
                      삭제
                    </button>
                  </div>
                  <label className="flex flex-col gap-1">
                    <span>설명 (300자 이하)</span>
                    <textarea
                      className={`w-full ${INPUT_CLASS}`}
                      rows={2}
                      maxLength={MAX_CRITERION_DESCRIPTION_LENGTH}
                      value={item.description}
                      disabled={isLocked}
                      onChange={(event) => onChangeItemDescription(item.key, event.target.value)}
                    />
                  </label>
                </li>
              ))}
            </ol>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              className={BUTTON_CLASS}
              disabled={isLocked || !draft.canAddItem}
              onClick={onAddItem}
            >
              기준 추가
            </button>
            {!draft.canAddItem && <span>기준은 6개까지 만들 수 있습니다.</span>}
          </div>

          <div>
            <button type="button" className={`${BUTTON_CLASS} font-bold`} disabled={isLocked} onClick={onConfirm}>
              이 기준으로 확정
            </button>
          </div>
          {confirmError && (
            <p role="alert" className="[overflow-wrap:anywhere]">
              {confirmError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
