import Link from "next/link";
import type { ComponentProps } from "react";
import {
  AccentTag,
  BUTTON_PRIMARY_CLASS,
  PANEL_CLASS,
  PANEL_HEAD_CLASS,
  PANEL_TITLE_CLASS,
  type ConsoleCrumb,
} from "@/components/consoleUi";
import { ApplicantBar, DocumentPanel, EvaluateHead, MarkButtons } from "@/components/EvaluateParts";

type DocumentView = Omit<ComponentProps<typeof DocumentPanel>, "className" | "headClassName" | "titleId" | "showLegend">;

type EvaluateDetailScreenProps = {
  crumbs: readonly ConsoleCrumb[];
  /** 제목 옆의 글: 전형 · 모집 단위 */
  headNote: string;
  bar: ComponentProps<typeof ApplicantBar>;
  document: DocumentView;
  /** 평가 요소 목록. current 는 지금 응답하는 요소다. progressText 는 "4 / 10" 꼴의 응답 수(없으면 null). */
  items: { id: string; name: string; href: string; current: boolean; progressText: string | null }[];
  /** 세부 평가 항목 */
  rubric: {
    elementName: string;
    groupCount: number;
    questionCount: number;
    /** 척도 (높은 점수부터) */
    scale: readonly number[];
    /** 제출한 평가인지 (응답이 꺼진다) */
    locked: boolean;
    groups: {
      name: string;
      countText: string;
      questions: {
        key: string;
        /** 라디오 묶음의 이름 */
        name: string;
        numberText: string;
        text: string;
        /** 고른 점수 (아직 응답하지 않았으면 null) */
        value: number | null;
        onAnswer: (value: number) => void;
      }[];
    }[];
    progressText: string;
    /** 모두 응답했을 때 내 점수로 가져갈 값 (아직 다 응답하지 않았으면 null) */
    scoreToApply: number | null;
    remaining: number;
    canFinish: boolean;
    finishLabel: string;
    onFinish: () => void;
    marks: ComponentProps<typeof MarkButtons>["marks"];
  };
};

/**
 * 평가하기 · 세부 항목 평가 화면(/evaluate/detail?code=…&item=…). 왼쪽은 서류 원문(지금 요소의 근거가 강조된다), 가운데는 평가 요소 목록,
 * 오른쪽은 그 요소의 세부 평가 항목(질문마다 1~5점 가운데 하나를 고른다). 모두 응답하면 "평가 완료" 로 응답 평균을 내 점수로 가져가고
 * 총평 화면으로 돌아간다. 좁은 화면에서는 세 단이 아래로 내려가 쌓인다.
 */
export function EvaluateDetailScreen({ crumbs, headNote, bar, document, items, rubric }: EvaluateDetailScreenProps) {
  return (
    <>
      <EvaluateHead crumbs={crumbs} note={headNote} />
      <ApplicantBar {...bar} />
      <div className={`${PANEL_CLASS} mt-[16px] flex flex-[1_1_auto] flex-wrap items-stretch`}>
        <DocumentPanel
          {...document}
          titleId="doc-title"
          showLegend={false}
          className="box-border max-w-[360px] min-w-0 flex-[1_1_300px]"
          headClassName="rounded-tl-[7px]"
        />
        {/*
          디자인은 이 단이 늘지 않지만(flex-grow 0) 여기서는 1 로 둔다. 세 단이 한 줄일 때는 남는 폭을 오른쪽 단(999)이 거의 다 가져가
          이 단은 1px 도 늘지 않고, 좁은 화면에서 단이 한 줄에 하나씩 쌓일 때만 줄 폭을 채운다(머리 줄 바탕이 200px 에서 끊기지 않게).
        */}
        <section aria-labelledby="my-title" className="box-border min-w-0 flex-[1_1_200px] border-l border-l-[#E4E4E4]">
          <div className={`${PANEL_HEAD_CLASS} flex h-[40px] items-center px-[16px]`}>
            <h3 id="my-title" className={PANEL_TITLE_CLASS}>
              내 평가 입력
            </h3>
          </div>
          <ul className="p-[8px]">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  aria-current={item.current ? "true" : undefined}
                  className={`flex min-h-[40px] scroll-m-[8px] items-center justify-between gap-[8px] rounded-[6px] px-[10px] text-[14px] no-underline ${
                    item.current ? "bg-[#EEF0FF] font-semibold text-[#001AD0]" : "font-medium text-[#111111]"
                  }`}
                >
                  <span className="[overflow-wrap:anywhere]">{item.name}</span>
                  {item.progressText !== null && (
                    <span className={`flex-none text-[12px] tabular-nums ${item.current ? "" : "font-normal text-[#505050]"}`}>
                      {item.progressText}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section
          aria-labelledby="items-title"
          className="box-border flex min-w-0 flex-[999_1_380px] flex-col border-l border-l-[#E4E4E4]"
        >
          <div
            className={`${PANEL_HEAD_CLASS} box-border flex min-h-[40px] flex-wrap items-center gap-x-[8px] gap-y-[4px] rounded-tr-[7px] px-[16px] py-[4px]`}
          >
            <h2 id="items-title" className={PANEL_TITLE_CLASS}>
              세부 평가 항목
            </h2>
            <AccentTag>{rubric.elementName}</AccentTag>
            <p className="ml-auto flex flex-wrap gap-x-[12px] text-[12px] leading-[16px] text-[#505050]">
              <span>1~5점의 척도 평가로 진행됩니다.</span>
              <span>
                총 <strong className="font-semibold text-[#111111] tabular-nums">{rubric.groupCount}</strong> 항목{" "}
                <strong className="font-semibold text-[#111111] tabular-nums">{rubric.questionCount}</strong> 문
              </span>
            </p>
          </div>
          <div className="flex-[1_1_auto] px-[16px] pt-[4px] pb-[12px]">
            {rubric.groups.map((group) => (
              <div key={group.name} className="mt-[12px]">
                <div className="flex items-baseline justify-between gap-[12px]">
                  <h3 className="text-[14px] leading-[20px] font-semibold">{group.name}</h3>
                  <span className="text-[12px] leading-[16px] text-[#505050] tabular-nums">{group.countText}</span>
                </div>
                {group.questions.map((question) => (
                  <div
                    key={question.key}
                    role="radiogroup"
                    aria-labelledby={`${question.name}-label`}
                    className="mt-[8px] flex flex-wrap items-center justify-between gap-x-[16px] gap-y-[8px] border-t border-t-[#E4E4E4] pt-[10px]"
                  >
                    <p
                      id={`${question.name}-label`}
                      className="min-w-0 flex-[1_1_280px] text-[14px] leading-[22px] [overflow-wrap:anywhere] break-keep"
                    >
                      <span className="inline-block w-[24px] text-[#505050] tabular-nums">{question.numberText}</span>
                      {question.text}
                    </p>
                    <div className="flex gap-[6px]">
                      {rubric.scale.map((value) => {
                        const on = question.value === value;
                        return (
                          <label
                            key={value}
                            className={`box-border flex h-[34px] items-center gap-[6px] rounded-[6px] border px-[10px] text-[13px] tabular-nums ${
                              on
                                ? "border-[#001AD0] bg-[#EEF0FF] font-semibold text-[#001AD0]"
                                : "border-[#CFCFCF] bg-white font-medium text-[#111111]"
                            } ${rubric.locked ? "opacity-[0.6]" : ""}`}
                          >
                            <input
                              type="radio"
                              name={question.name}
                              value={value}
                              checked={on}
                              disabled={rubric.locked}
                              onChange={() => question.onAnswer(value)}
                              className="m-0 scroll-m-[8px] accent-[#001AD0]"
                            />
                            {value}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-[8px] border-t border-t-[#E4E4E4] px-[16px] py-[12px]">
            <p role="status" className="mr-auto text-[13px] leading-[18px] text-[#505050]">
              {rubric.progressText}
              {!rubric.locked && (
                <span className="block text-[12px] leading-[16px] text-[#767676]">
                  {rubric.scoreToApply === null
                    ? `남은 ${rubric.remaining}문에 모두 응답하면 응답 평균을 내 점수로 가져갈 수 있습니다.`
                    : `평가 완료를 누르면 내 점수 ${rubric.scoreToApply}점으로 가져가고 총평으로 돌아갑니다.`}
                </span>
              )}
            </p>
            <MarkButtons marks={rubric.marks} locked={rubric.locked} />
            <button
              type="button"
              disabled={!rubric.canFinish}
              onClick={rubric.onFinish}
              className={`${BUTTON_PRIMARY_CLASS} h-[34px] scroll-m-[8px] px-[14px]`}
            >
              {rubric.finishLabel}
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
