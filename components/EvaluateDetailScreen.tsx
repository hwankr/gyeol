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
import {
  ApplicantBar,
  DocumentPanel,
  EvaluateHead,
  MarkButtons,
  ToneSwatch,
  WORKBENCH_EXPANDED_CLASS,
  WORKBENCH_EXPANDED_HEIGHT_CLASS,
  WORKBENCH_HEIGHT_CLASS,
  WORKBENCH_SCROLL_CLASS,
} from "@/components/EvaluateParts";
import { SWAP_TRANSITION } from "@/lib/motion";

type DocumentView = Omit<
  ComponentProps<typeof DocumentPanel>,
  "className" | "headClassName" | "titleId" | "showLegend" | "showEvidenceNote"
>;

type EvaluateDetailScreenProps = {
  crumbs: readonly ConsoleCrumb[];
  /** 제목 옆의 글: 전형 · 모집 단위 */
  headNote: string;
  bar: ComponentProps<typeof ApplicantBar>;
  /** 넓은 배치인지 (올린 지원자) */
  wide: boolean;
  document: DocumentView;
  /** 평가 요소 목록. current 는 지금 응답하는 요소다. tone 은 그 요소의 형광펜 색 순번, progressText 는 "4 / 10" 꼴의 응답 수(없으면 null). */
  items: { id: string; name: string; tone: number; href: string; current: boolean; progressText: string | null }[];
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
 * 평가 요소를 바꾸는 링크는 같은 화면에서 내용만 바꾸는 이동이라 화면 전환 없이 바로 바뀐다(lib/motion.ts).
 * 지금 요소가 아닌 줄과 고르지 않은 점수는 마우스를 올리면 옅은 회색 바탕이 된다.
 * 평가 요소 이름 앞의 색 점은 그 요소의 형광펜 색이다(서류 원문의 근거 구절이 그 색으로 칠해진다).
 * 넓은 배치(올린 지원자): 평가하면서 원본을 계속 보도록 서류 원문 단이 넓고(실제 학생부 PDF), 세 단이 화면 높이 안에 놓여 세부 평가 항목만
 * 그 단 안에서 스크롤한다(응답 현황과 평가 완료 버튼은 단의 아래에 남는다). 평가 요소를 바꿔도 원본을 보던 자리는 그대로다.
 * 서류 원문 머리 줄의 "크게 보기" 를 켜면 세 단이 화면 전체를 덮어, 원본을 크게 읽으면서 그대로 응답한다("원래 크기" 나 Esc 로 돌아온다).
 */
export function EvaluateDetailScreen({ crumbs, headNote, bar, wide, document, items, rubric }: EvaluateDetailScreenProps) {
  /** 넓은 배치에서 서류 원문과 세부 평가 항목 단의 높이: 크게 보기를 켜면 화면 높이 그대로 */
  const benchHeightClass = document.expanded ? WORKBENCH_EXPANDED_HEIGHT_CLASS : WORKBENCH_HEIGHT_CLASS;
  return (
    <>
      <EvaluateHead crumbs={crumbs} note={headNote} />
      <ApplicantBar {...bar} />
      {/* 크게 보기(넓은 배치의 서류 원문 머리 줄)를 켜면 세 단이 든 이 상자가 화면 전체를 덮는다(테두리·둥근 모서리 없이, 단은 화면 높이를 채운다). */}
      <div
        data-workbench
        className={`flex flex-wrap items-stretch ${document.expanded ? WORKBENCH_EXPANDED_CLASS : `${PANEL_CLASS} mt-[16px] flex-[1_1_auto]`}`}
      >
        {/* 넓은 배치에서는 남는 폭을 서류 원문과 세부 평가 항목이 3:1 로 나눠 갖는다(원본이 넓게, 쪽은 880px 까지). */}
        <DocumentPanel
          {...document}
          titleId="doc-title"
          showLegend={false}
          showEvidenceNote="always"
          className={wide ? `box-border min-w-0 flex-[3_1_440px] ${benchHeightClass}` : "box-border max-w-[360px] min-w-0 flex-[1_1_300px]"}
          headClassName={document.expanded ? "" : "rounded-tl-[7px]"}
        />
        {/*
          디자인은 이 단이 늘지 않지만(flex-grow 0) 여기서는 1 로 둔다. 세 단이 한 줄일 때는 남는 폭을 오른쪽 단(999)이 거의 다 가져가
          이 단은 1px 도 늘지 않고, 좁은 화면에서 단이 한 줄에 하나씩 쌓일 때만 줄 폭을 채운다(머리 줄 바탕이 200px 에서 끊기지 않게).
        */}
        <section
          aria-labelledby="my-title"
          className={`box-border min-w-0 border-l border-l-[#E4E4E4] ${wide ? "flex-[0_1_200px]" : "flex-[1_1_200px]"}`}
        >
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
                  transitionTypes={SWAP_TRANSITION}
                  className={`motion-colors flex min-h-[40px] scroll-m-[8px] items-center justify-between gap-[8px] rounded-[6px] px-[10px] text-[14px] no-underline ${
                    item.current ? "bg-[#EEF0FF] font-semibold text-[#001AD0]" : "font-medium text-[#111111] hover-on:bg-[#F6F7FB]"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-[8px]">
                    <ToneSwatch tone={item.tone} />
                    <span className="[overflow-wrap:anywhere]">{item.name}</span>
                  </span>
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
          className={`box-border flex min-w-0 flex-col border-l border-l-[#E4E4E4] ${
            wide ? `flex-[1_1_380px] ${benchHeightClass}` : "flex-[999_1_380px]"
          }`}
        >
          <div
            className={`${PANEL_HEAD_CLASS} box-border flex min-h-[40px] flex-none flex-wrap items-center gap-x-[8px] gap-y-[4px] px-[16px] py-[4px] ${
              document.expanded ? "" : "rounded-tr-[7px]"
            }`}
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
          {/* 넓은 배치에서는 질문들만 이 안에서 스크롤한다(키보드로도 스크롤할 수 있게 초점을 받는다). */}
          <div
            role={wide ? "group" : undefined}
            aria-label={wide ? "세부 평가 항목 질문" : undefined}
            tabIndex={wide ? 0 : undefined}
            className={`px-[16px] pt-[4px] pb-[12px] ${wide ? WORKBENCH_SCROLL_CLASS : "flex-[1_1_auto]"}`}
          >
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
                            className={`motion-colors box-border flex h-[34px] items-center gap-[6px] rounded-[6px] border px-[10px] text-[13px] tabular-nums ${
                              on
                                ? "border-[#001AD0] bg-[#EEF0FF] font-semibold text-[#001AD0]"
                                : `border-[#CFCFCF] bg-white font-medium text-[#111111] ${rubric.locked ? "" : "hover-on:bg-[#F6F7FB]"}`
                            } ${rubric.locked ? "opacity-[0.6]" : "cursor-pointer"}`}
                          >
                            <input
                              type="radio"
                              name={question.name}
                              value={value}
                              checked={on}
                              disabled={rubric.locked}
                              onChange={() => question.onAnswer(value)}
                              className="m-0 scroll-m-[8px] cursor-[inherit] accent-[#001AD0]"
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
          <div className="flex flex-none flex-wrap items-center gap-[8px] border-t border-t-[#E4E4E4] px-[16px] py-[12px]">
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
