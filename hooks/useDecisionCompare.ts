import { useDecisionData } from "@/hooks/useDecisionData";
import { ADMISSION } from "@/lib/admission";
import { DECISION_PATH } from "@/lib/consoleMenu";
import {
  WIDE_SPREAD10,
  comparePairOf,
  decisionMemberName,
  elementGapsOf,
  standingText,
  tenthsText,
  trimmedTenthsText,
  widestGapOf,
  type ElementGap,
  type RankedApplicant,
} from "@/lib/decision/decision";

/** 막대 그래프의 세로 눈금 (점수 0~100) */
const CHART_TICKS = [0, 20, 40, 60, 80, 100] as const;

/** 두 사람 가운데 누구인지: 0 은 왼쪽, 1 은 오른쪽 (그래프의 막대 색 순번이기도 하다) */
type Side = 0 | 1;

/** 한 지원자의 정보 (그래프 옆의 단) */
function sideView(row: RankedApplicant, side: Side) {
  return {
    side,
    code: row.applicant.code,
    rankText: `${row.rank}위`,
    standing: { text: standingText(row), admitted: row.admitted },
    finalText: tenthsText(row.final10),
    summary: row.applicant.summary,
    strength: row.applicant.strength,
    weakness: row.applicant.weakness,
    aiText: String(row.aiTotal),
    members: row.memberTotal10.map((total, index) => ({ name: decisionMemberName(index), totalText: tenthsText(total) })),
    spreadText: tenthsText(row.spread10),
    spreadWide: row.spread10 >= WIDE_SPREAD10,
  };
}

/** 차이를 적는 글: 앞선 지원자의 코드와 차이("A-0147 +18"), 같으면 "같음" */
function leadText(diff10: number, leftCode: string, rightCode: string, format: (tenths: number) => string): string {
  if (diff10 === 0) return "같음";
  return `${diff10 > 0 ? leftCode : rightCode} +${format(Math.abs(diff10))}`;
}

/** 그 지원자가 앞선 요소들: "잠재역량 +4 · 학업역량 +6" (없으면 "앞선 요소 없음") */
function leadsText(gaps: readonly ElementGap[], side: Side): string {
  const leads = gaps.filter((gap) => (side === 0 ? gap.diff10 > 0 : gap.diff10 < 0));
  if (leads.length === 0) return "앞선 요소 없음";
  return leads.map((gap) => `${gap.name} +${trimmedTenthsText(Math.abs(gap.diff10))}`).join(" · ");
}

/**
 * 선발 결정 · 지원자 비교 탭 상태: 비교할 두 사람(인재상 적합 추천 탭에서 고른 두 사람. 둘을 고르지 않았으면 합격선 바로 위·아래 두 사람),
 * 두 사람의 정보, 평가 요소별 점수(위원 평균)의 막대 그래프와 표, 어디서 갈렸는지 풀어 쓴 글.
 * 순위가 높은 사람이 왼쪽이다. 비교할 사람이 없으면(지원자가 둘보다 적으면) null 이다.
 * 고른 지원자를 브라우저에서 읽기 전(서버 렌더링·hydration 중)에는 "아직 모름"(undefined)이라 화면이 두 사람 자리를 비워 둔다.
 */
export function useDecisionCompare() {
  const { elements, ranked, cutline, picks, picksReady } = useDecisionData();
  if (!picksReady) return undefined;
  const pair = comparePairOf(ranked, picks, ADMISSION.quota);
  if (pair === null) return null;

  const { left, right } = pair;
  const leftCode = left.applicant.code;
  const rightCode = right.applicant.code;
  const gaps = elementGapsOf(pair, elements);
  const widest = widestGapOf(gaps);
  const finalDiff10 = left.final10 - right.final10;

  /** 두 사람이 어떤 사이인지 (작은 꼬리표로 적는다) */
  const facts = [`최종 평가 ${tenthsText(Math.abs(finalDiff10))}점 차`];
  if (left.admitted !== right.admitted) facts.push("합격선을 사이에 둠");
  else facts.push(left.admitted ? "둘 다 합격권" : "둘 다 예비");
  if (left.applicant.theme !== null && left.applicant.theme === right.applicant.theme) facts.push(`요약이 비슷함 · ${left.applicant.theme}`);

  return {
    /** 이 두 사람이 나온 까닭 */
    note: pair.chosen
      ? "인재상 적합 추천에서 고른 두 지원자입니다."
      : cutline === null
        ? "순위가 가장 높은 두 지원자입니다."
        : picks.length === 0
          ? "고른 지원자가 없어 합격선 바로 위·아래의 두 지원자를 보여 줍니다."
          : `${picks[0]} 한 명만 골라 합격선 바로 위·아래의 두 지원자를 보여 줍니다. 한 명을 더 골라 주세요.`,
    facts,
    recommendHref: DECISION_PATH,
    sides: [sideView(left, 0), sideView(right, 1)] as const,
    /** 어디서 갈렸는지: 가장 크게 갈린 요소와, 지원자마다 앞선 요소 */
    headline:
      widest === null
        ? "모든 평가 요소에서 두 지원자의 점수가 같습니다."
        : `가장 크게 갈린 요소는 ${widest.name}입니다 (${leadText(widest.diff10, leftCode, rightCode, trimmedTenthsText)}점).`,
    leads: [
      { side: 0 as Side, code: leftCode, text: leadsText(gaps, 0) },
      { side: 1 as Side, code: rightCode, text: leadsText(gaps, 1) },
    ],
    chart: {
      /** 그림을 글로 풀어 쓴 이름 */
      label: `평가 요소별 점수 막대 그래프. ${gaps
        .map((gap) => `${gap.name}: ${leftCode} ${trimmedTenthsText(gap.left10)}점, ${rightCode} ${trimmedTenthsText(gap.right10)}점`)
        .join(". ")}.`,
      ticks: CHART_TICKS,
      groups: gaps.map((gap) => ({
        id: gap.id,
        name: gap.name,
        bars: [
          { side: 0 as Side, code: leftCode, tenths: gap.left10 },
          { side: 1 as Side, code: rightCode, tenths: gap.right10 },
        ].map((bar) => ({
          side: bar.side,
          /** 막대의 높이 (0~100. 점수가 곧 눈금이다) */
          percent: Math.min(100, Math.max(0, bar.tenths / 10)),
          /** 막대 위에 적는 점수 (정수로 반올림. 표에는 소수 첫째 자리까지 적는다) */
          valueText: String(Math.round(bar.tenths / 10)),
          /** 마우스를 올리면 보이는 글 */
          title: `${bar.code} · ${gap.name} ${trimmedTenthsText(bar.tenths)}점`,
        })),
      })),
    },
    table: {
      rows: gaps.map((gap) => ({
        id: gap.id,
        name: gap.name,
        weightText: String(gap.weight),
        leftText: trimmedTenthsText(gap.left10),
        rightText: trimmedTenthsText(gap.right10),
        diffText: leadText(gap.diff10, leftCode, rightCode, trimmedTenthsText),
        /** 가장 크게 갈린 요소인지 */
        widest: widest !== null && gap.id === widest.id,
      })),
      total: {
        weightText: String(gaps.reduce((sum, gap) => sum + gap.weight, 0)),
        leftText: tenthsText(left.final10),
        rightText: tenthsText(right.final10),
        diffText: leadText(finalDiff10, leftCode, rightCode, tenthsText),
      },
    },
  };
}

/** 지원자 비교 탭이 그리는 값 */
export type DecisionCompareView = NonNullable<ReturnType<typeof useDecisionCompare>>;
