import { Area } from "@/components/Area";
import type { CriteriaExample } from "@/lib/criteria/examples";

type CriteriaExamplesProps = {
  examples: readonly CriteriaExample[];
  /** 분석 중이거나 기준을 만드는 중이면 버튼을 막는다 */
  disabled: boolean;
  /** 예시를 "새 학과 기준 만들기" 입력란에 넣는다 */
  onUse: (example: CriteriaExample) => void;
};

/** 업로드 화면의 "기준 문장 예시" 영역. "평가 기준" 영역 오른쪽에 그린다. */
export function CriteriaExamples({ examples, disabled, onUse }: CriteriaExamplesProps) {
  return (
    <Area name="기준 문장 예시" className="min-w-0 flex-1">
      <p className="mb-3">
        예시를 넣으면 “새 학과 기준 만들기”의 학과 이름과 문장에 채워집니다. 고쳐 쓴 뒤 “기준 만들기”를 누르세요.
      </p>
      <ul className="flex flex-col">
        {examples.map((example) => (
          <li
            key={example.department}
            className="flex flex-col items-start gap-1 border-b border-neutral-300 py-3 first:pt-0 last:border-b-0 last:pb-0"
          >
            <span className="font-bold">{example.department}</span>
            <span className="[overflow-wrap:anywhere]">{example.sourceText}</span>
            <button
              type="button"
              className="border border-neutral-500 px-3 py-1 disabled:border-neutral-300 disabled:text-neutral-400"
              disabled={disabled}
              onClick={() => onUse(example)}
            >
              이 예시 넣기
            </button>
          </li>
        ))}
      </ul>
    </Area>
  );
}
