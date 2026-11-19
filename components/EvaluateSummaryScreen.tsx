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
import type { EvidenceItem } from "@/lib/evaluate/evaluation";
import type { GrowthPoint, PeerOpinion } from "@/lib/evaluate/sampleEvaluations";

type DocumentView = Omit<ComponentProps<typeof DocumentPanel>, "className" | "headClassName" | "titleId" | "showLegend">;

type EvaluateSummaryScreenProps = {
  crumbs: readonly ConsoleCrumb[];
  /** 제목 옆의 글: 전형 · 모집 단위 */
  headNote: string;
  bar: ComponentProps<typeof ApplicantBar>;
  /** 학생 성장 요약: 학년별 성장 지수·활동 건수와 그림을 글로 풀어 쓴 이름 */
  growth: { points: readonly GrowthPoint[]; label: string };
  document: DocumentView;
  /** 항목별 점수와 근거 (AI 제안) */
  basis: {
    aiTotal: number;
    /** 평가 기준의 버전과 배점 줄: "v3 30·20·25·25" */
    weightsText: string;
    criteria: { id: string; name: string; aiScore: number; flag: string | null; on: boolean; onPick: () => void }[];
    /** 고른 평가 요소의 이름과 근거 문장 */
    selectedName: string;
    evidences: EvidenceItem[];
    confidenceText: string;
    tagsText: string;
    aiScore: number;
  };
  /** 내 평가 입력 */
  mine: {
    /** 제출한 평가인지 (입력이 모두 꺼진다) */
    locked: boolean;
    details: { id: string; name: string; href: string; progressText: string | null }[];
    scores: {
      id: string;
      name: string;
      aiScore: number;
      my: number;
      /** 내 점수가 AI 점수와 다른지 (파란 글자) */
      changed: boolean;
      atMin: boolean;
      atMax: boolean;
      onMinus: () => void;
      onPlus: () => void;
    }[];
    aiTotal: number;
    myTotal: number;
    /** AI 점수와 다른 요소의 수정 사유 입력란 */
    reasons: { id: string; name: string; diffText: string; value: string; missing: boolean; onChange: (value: string) => void }[];
    reasonLimit: number;
    opinion: string;
    opinionLimit: number;
    onOpinionChange: (value: string) => void;
    /** 제출할 수 없는 까닭 (없으면 빈 글) */
    submitHint: string;
    canSubmit: boolean;
    submitLabel: string;
    onSubmit: () => void;
    marks: ComponentProps<typeof MarkButtons>["marks"];
    /** 다른 위원 의견. 내 평가를 제출하기 전에는 null 이다. */
    peers: readonly PeerOpinion[] | null;
  };
};

/** 내 평가 입력의 점수 표 칸 너비: 항목, AI, 내 점수 */
const SCORE_GRID_CLASS = "grid grid-cols-[minmax(0,1fr)_36px_104px] items-center gap-x-[8px]";

const STEPPER_BUTTON_CLASS =
  "box-border flex h-[32px] w-[32px] scroll-m-[8px] items-center justify-center border border-[#CFCFCF] bg-white p-0 text-[16px] leading-[normal] text-[#111111] disabled:cursor-default disabled:opacity-[0.45] aria-disabled:cursor-default aria-disabled:text-[#AEAEAE]";

/**
 * 평가하기 · 총평 화면(/evaluate/summary?code=…). 왼쪽 위는 학생 성장 요약과 서류 원문, 그 아래는 항목별 AI 점수와 근거
 * (평가 요소를 고르면 원문의 그 근거가 색 면으로 강조된다), 오른쪽은 내 평가 입력이다.
 * 좁은 화면에서는 상자들이 아래로 내려가 한 줄에 하나씩 쌓인다.
 */
export function EvaluateSummaryScreen({ crumbs, headNote, bar, growth, document, basis, mine }: EvaluateSummaryScreenProps) {
  return (
    <>
      <EvaluateHead crumbs={crumbs} note={headNote} />
      <ApplicantBar {...bar} />
      <div className="mt-[16px] flex flex-wrap items-start gap-[16px]">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-[16px]">
          <div className={`${PANEL_CLASS} flex flex-wrap`}>
            <section aria-labelledby="growth-title" className="box-border max-w-[280px] min-w-0 flex-[1_1_240px]">
              <div className={`${PANEL_HEAD_CLASS} flex h-[40px] items-center gap-[8px] rounded-tl-[7px] px-[16px]`}>
                <h3 id="growth-title" className={PANEL_TITLE_CLASS}>
                  학생 성장 요약
                </h3>
                <AccentTag>AI 제안</AccentTag>
              </div>
              <div className="p-[16px]">
                <GrowthChart points={growth.points} label={growth.label} />
                <ul className="mt-[8px]">
                  {growth.points.map((point, index) => (
                    <li
                      key={point.grade}
                      className={`flex items-center justify-between gap-[12px] border-t border-t-[#E4E4E4] pt-[8px] ${
                        index === growth.points.length - 1 ? "" : "pb-[8px]"
                      }`}
                    >
                      <span>
                        <span className="text-[12px] text-[#505050]">{point.grade}학년</span>{" "}
                        <strong className="font-semibold">{point.label}</strong>
                      </span>
                      <span className="text-[13px] font-semibold tabular-nums">{point.count}건</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
            <DocumentPanel
              {...document}
              titleId="doc-title"
              showLegend
              className="box-border min-w-0 flex-[999_1_320px] border-l border-l-[#E4E4E4]"
              headClassName="rounded-tr-[7px]"
            />
          </div>
          <section aria-labelledby="basis-title" className={PANEL_CLASS}>
            <div
              className={`${PANEL_HEAD_CLASS} box-border flex min-h-[40px] flex-wrap items-center gap-x-[8px] gap-y-[4px] rounded-t-[7px] px-[16px] py-[4px]`}
            >
              <h3 id="basis-title" className={PANEL_TITLE_CLASS}>
                항목별 점수와 근거
              </h3>
              <AccentTag>AI 제안</AccentTag>
              <p className="ml-auto flex flex-wrap items-baseline gap-x-[8px] text-[12px] leading-[16px] text-[#505050]">
                <span>평가 기준</span>
                <span>
                  인재상 적합도 <strong className="text-[14px] font-bold text-[#111111] tabular-nums">{basis.aiTotal}</strong>
                </span>
                <span className="tabular-nums">배점 {basis.weightsText}</span>
              </p>
            </div>
            <div className="flex flex-wrap">
              <ul className="box-border max-w-[240px] flex-[1_1_200px] p-[8px]">
                {basis.criteria.map((criterion) => (
                  <li key={criterion.id}>
                    <button
                      type="button"
                      aria-pressed={criterion.on}
                      onClick={criterion.onPick}
                      className={`box-border flex min-h-[40px] w-full scroll-m-[8px] items-center justify-between gap-[8px] rounded-[6px] border-0 px-[10px] py-[6px] text-left text-[14px] leading-[normal] ${
                        criterion.on ? "bg-[#EEF0FF] font-semibold text-[#001AD0]" : "bg-white font-medium text-[#111111]"
                      }`}
                    >
                      <span className="[overflow-wrap:anywhere]">
                        {criterion.name}
                        {criterion.flag !== null && (
                          <span className="mt-[2px] block text-[11px] leading-[14px] font-semibold text-[#8A4B00]">
                            {criterion.flag}
                          </span>
                        )}
                      </span>
                      <span className="font-semibold tabular-nums">{criterion.aiScore}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <div
                aria-label={`${basis.selectedName} 근거`}
                role="group"
                className="box-border min-w-0 flex-[999_1_320px] border-l border-l-[#E4E4E4] px-[16px] pt-[12px] pb-[16px]"
              >
                {basis.evidences.map((evidence) => (
                  <div key={evidence.id} className="mb-[10px]">
                    <p className="text-[12px] leading-[16px] text-[#505050]">{evidence.source}</p>
                    <p className="mt-[4px] rounded-[6px] bg-[#F6F7FB] px-[12px] py-[8px] text-[14px] leading-[22px] [overflow-wrap:anywhere] break-keep">
                      {evidence.text}
                    </p>
                  </div>
                ))}
                {basis.evidences.length === 0 && (
                  <p className="mb-[10px] text-[13px] leading-[18px] text-[#505050]">이 항목에 연결된 근거 문장이 없습니다.</p>
                )}
                <div className="flex flex-wrap items-center gap-x-[16px] gap-y-[4px] border-t border-t-[#E4E4E4] pt-[10px] text-[13px] leading-[18px] text-[#505050]">
                  <span>{basis.confidenceText}</span>
                  <span>{basis.tagsText}</span>
                  <span className="ml-auto inline-flex items-baseline gap-[6px]">
                    AI 점수{" "}
                    <strong className="text-[22px] leading-[30px] font-bold text-[#111111] tabular-nums">{basis.aiScore}</strong>
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>
        <section aria-labelledby="my-title" className={`${PANEL_CLASS} box-border max-w-[340px] min-w-0 flex-[1_1_300px]`}>
          <div className={`${PANEL_HEAD_CLASS} flex h-[40px] items-center rounded-t-[7px] px-[16px]`}>
            <h3 id="my-title" className={PANEL_TITLE_CLASS}>
              내 평가 입력
            </h3>
          </div>
          <div className="px-[16px] pt-[12px] pb-[16px]">
            <p className="text-[12px] leading-[16px] font-semibold text-[#505050]">세부 평가 항목 가져오기</p>
            <ul className="mt-[6px] rounded-[6px] border border-[#E4E4E4]">
              {mine.details.map((detail, index) => (
                <li key={detail.id} className={index === 0 ? "" : "border-t border-t-[#E4E4E4]"}>
                  <Link
                    href={detail.href}
                    className="flex min-h-[34px] scroll-m-[8px] items-center justify-between gap-[8px] px-[10px] text-[13px] font-medium text-[#111111] no-underline"
                  >
                    <span className="[overflow-wrap:anywhere]">{detail.name}</span>
                    <span className="flex flex-none items-center gap-[6px]">
                      {detail.progressText !== null && (
                        <span className="text-[12px] font-normal text-[#505050] tabular-nums">{detail.progressText}</span>
                      )}
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="#505050"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-[14px] w-[14px]"
                      >
                        <path d="M6 3.5 10.5 8 6 12.5" />
                      </svg>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <div
              className={`${SCORE_GRID_CLASS} mt-[16px] border-b border-b-[#E4E4E4] pb-[6px] text-[12px] leading-[16px] font-semibold text-[#505050]`}
            >
              <span>항목</span>
              <span className="text-right">AI</span>
              <span className="text-center">내 점수</span>
            </div>
            {mine.scores.map((score) => (
              <div key={score.id} className={`${SCORE_GRID_CLASS} border-b border-b-[#E4E4E4] py-[6px]`}>
                <span className="text-[13px] font-medium [overflow-wrap:anywhere]">{score.name}</span>
                <span className="text-right text-[13px] text-[#505050] tabular-nums">{score.aiScore}</span>
                <span className="flex items-center">
                  <button
                    type="button"
                    aria-label={`${score.name} 점수 줄이기`}
                    aria-disabled={score.atMin || undefined}
                    disabled={mine.locked}
                    onClick={score.onMinus}
                    className={`${STEPPER_BUTTON_CLASS} rounded-l-[6px]`}
                  >
                    −
                  </button>
                  <output
                    aria-label={`${score.name} 내 점수`}
                    className={`box-border flex h-[32px] w-[40px] items-center justify-center border-y border-y-[#CFCFCF] text-[14px] font-semibold tabular-nums ${
                      score.changed ? "text-[#001AD0]" : "text-[#111111]"
                    }`}
                  >
                    {score.my}
                  </output>
                  <button
                    type="button"
                    aria-label={`${score.name} 점수 늘리기`}
                    aria-disabled={score.atMax || undefined}
                    disabled={mine.locked}
                    onClick={score.onPlus}
                    className={`${STEPPER_BUTTON_CLASS} rounded-r-[6px]`}
                  >
                    +
                  </button>
                </span>
              </div>
            ))}
            <p className="mt-[10px] flex items-baseline gap-[8px]">
              <strong className="flex-[1_1_auto] text-[14px] font-semibold">내 종합 점수</strong>
              <span className="text-[13px] text-[#505050] tabular-nums">AI {mine.aiTotal}</span>
              <strong className="text-[22px] leading-[30px] font-bold tabular-nums">{mine.myTotal}</strong>
            </p>
            <p className="mt-[14px] flex flex-wrap items-baseline gap-x-[8px] gap-y-[2px] border-t border-t-[#E4E4E4] pt-[12px] text-[13px] leading-[18px] font-semibold">
              수정 사유<span className="text-[12px] font-normal text-[#505050]">AI 점수와 다르면 필수 작성</span>
            </p>
            {mine.reasons.map((reason) => (
              <div key={reason.id} className="mt-[8px]">
                <p className="text-[13px] leading-[18px]">
                  <strong className="font-semibold">{reason.name}</strong> <span className="tabular-nums">{reason.diffText}</span>
                </p>
                <input
                  type="text"
                  aria-label={`${reason.name} 수정 사유`}
                  aria-invalid={reason.missing || undefined}
                  placeholder="수정 사유를 입력하세요."
                  autoComplete="off"
                  maxLength={mine.reasonLimit}
                  value={reason.value}
                  disabled={mine.locked}
                  onChange={(event) => reason.onChange(event.currentTarget.value)}
                  className={`mt-[4px] box-border h-[34px] w-full scroll-m-[8px] rounded-[6px] border bg-white px-[10px] text-[13px] text-[#111111] placeholder:text-[#767676] disabled:bg-[#F6F7FB] disabled:text-[#505050] ${
                    reason.missing ? "border-[#BA1A1A]" : "border-[#CFCFCF]"
                  }`}
                />
              </div>
            ))}
            {mine.reasons.length === 0 && (
              <p className="mt-[8px] text-[13px] leading-[18px] text-[#505050]">AI 점수와 다른 항목이 없습니다.</p>
            )}
            <label htmlFor="overall-opinion" className="mt-[14px] block text-[13px] leading-[18px] font-semibold">
              종합 의견
            </label>
            <textarea
              id="overall-opinion"
              placeholder="의견을 입력하세요."
              maxLength={mine.opinionLimit}
              value={mine.opinion}
              disabled={mine.locked}
              onChange={(event) => mine.onOpinionChange(event.currentTarget.value)}
              className="mt-[6px] box-border block h-[76px] w-full scroll-m-[8px] resize-y rounded-[6px] border border-[#CFCFCF] bg-white px-[10px] py-[8px] text-[13px] leading-[20px] text-[#111111] placeholder:text-[#767676] disabled:bg-[#F6F7FB] disabled:text-[#505050]"
            />
            <p role="status" className="mt-[8px] min-h-[18px] text-[12px] leading-[18px] text-[#BA1A1A]">
              {mine.submitHint}
            </p>
            <div className="mt-[4px] flex flex-wrap gap-[8px]">
              <MarkButtons marks={mine.marks} locked={mine.locked} />
              <button
                type="button"
                disabled={!mine.canSubmit}
                onClick={mine.onSubmit}
                className={`${BUTTON_PRIMARY_CLASS} h-[34px] flex-[1_1_auto] scroll-m-[8px] px-[12px] leading-[normal]`}
              >
                {mine.submitLabel}
              </button>
            </div>
            <p className="mt-[14px] flex items-baseline justify-between gap-[8px] border-t border-t-[#E4E4E4] pt-[12px] text-[13px] leading-[18px]">
              <strong className="font-semibold">다른 위원 의견</strong>
              {mine.peers === null && <span className="text-[12px] text-[#505050]">제출 후 공개</span>}
            </p>
            {mine.peers !== null && (
              <ul className="mt-[8px] flex flex-col gap-[10px]">
                {mine.peers.map((peer) => (
                  <li key={peer.reviewer}>
                    <p className="flex items-baseline justify-between gap-[8px] text-[13px] leading-[18px]">
                      <span className="font-medium">{peer.reviewer}</span>
                      <span className="font-semibold tabular-nums">{peer.total === null ? "–" : peer.total}</span>
                    </p>
                    <p className="mt-[2px] text-[13px] leading-[18px] text-[#505050] [overflow-wrap:anywhere]">{peer.comment}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

/** 성장 그림의 자리 값 (viewBox 240 × 184. 디자인의 좌표 그대로다) */
const CHART = {
  left: 28,
  right: 212,
  /** 지수 100 의 y 와 0 의 y */
  top: 12,
  bottom: 150,
  /** 학년 셋의 가운데 x */
  centers: [62, 120, 178],
  barWidth: 28,
  /** 활동 건수 눈금의 끝 */
  maxCount: 5,
} as const;

const CHART_HEIGHT = CHART.bottom - CHART.top;

/**
 * 학생 성장 요약 그림: 막대는 학년별 활동 건수(오른쪽 눈금 0~5), 꺾은선은 학년별 성장 지수(왼쪽 눈금 0~100).
 * 값은 꺾은선의 점 위에 숫자로도 적는다. 그림 전체는 글로 풀어 쓴 이름(label)을 가진 그림 하나다.
 */
function GrowthChart({ points, label }: { points: readonly GrowthPoint[]; label: string }) {
  const dots = points.map((point, index) => ({
    grade: point.grade,
    index: point.index,
    x: CHART.centers[index] ?? CHART.centers[0],
    y: CHART.bottom - (Math.min(100, Math.max(0, point.index)) / 100) * CHART_HEIGHT,
    barHeight: (Math.min(CHART.maxCount, Math.max(0, point.count)) / CHART.maxCount) * CHART_HEIGHT,
  }));
  /** 가로 눈금선 다섯 줄 (100, 80, 60, 40, 20) */
  const gridLines = [0, 1, 2, 3, 4].map((step) => CHART.top + (step * CHART_HEIGHT) / 5);
  return (
    <svg role="img" aria-label={label} viewBox="0 0 240 184" className="block h-auto w-full">
      <path
        fill="none"
        stroke="#E4E4E4"
        strokeWidth="1"
        d={gridLines.map((y) => `M${CHART.left} ${y.toFixed(1)}H${CHART.right}`).join("")}
      />
      {dots.map((dot) => (
        <rect
          key={`bar-${dot.grade}`}
          x={dot.x - CHART.barWidth / 2}
          y={(CHART.bottom - dot.barHeight).toFixed(1)}
          width={CHART.barWidth}
          height={dot.barHeight.toFixed(1)}
          fill="#BAC3FF"
        />
      ))}
      <path fill="none" stroke="#767676" strokeWidth="1" d={`M${CHART.left} ${CHART.bottom}H${CHART.right}`} />
      <path
        fill="none"
        stroke="#000947"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d={dots.map((dot, index) => `${index === 0 ? "M" : "L"}${dot.x} ${dot.y.toFixed(1)}`).join(" ")}
      />
      {dots.map((dot) => (
        <circle key={`dot-${dot.grade}`} cx={dot.x} cy={dot.y.toFixed(1)} r="4.5" fill="#FFFFFF" stroke="#000947" strokeWidth="2" />
      ))}
      {dots.map((dot) => (
        <text
          key={`value-${dot.grade}`}
          x={dot.x}
          y={Math.max(10, dot.y - 12).toFixed(1)}
          textAnchor="middle"
          fontSize="12"
          fontWeight="700"
          fill="#000947"
        >
          {dot.index}
        </text>
      ))}
      <text x="22" y="16" textAnchor="end" fontSize="10" fill="#505050">
        100
      </text>
      <text x="22" y="85" textAnchor="end" fontSize="10" fill="#505050">
        50
      </text>
      <text x="22" y="154" textAnchor="end" fontSize="10" fill="#505050">
        0
      </text>
      <text x="218" y="16" fontSize="10" fill="#505050">
        {CHART.maxCount}
      </text>
      <text x="218" y="154" fontSize="10" fill="#505050">
        0
      </text>
      {dots.map((dot) => (
        <text key={`grade-${dot.grade}`} x={dot.x} y="170" textAnchor="middle" fontSize="11" fill="#505050">
          {dot.grade}학년
        </text>
      ))}
    </svg>
  );
}
