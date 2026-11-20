import { ADMISSION } from "../admission.ts";
import { sampleApplicantCode } from "../applicants/sampleApplicants.ts";

// 선발 결정 화면의 예시 자료: 합격선 주변(접전 구간)의 지원자 12명.
// 실제 지원자가 아니다. 모집 단위가 경영학과라 요약·강점·약점·점수는 경영학과 지원자의 모습으로 지어낸 임시 값이다. 값은 모두 손으로
// 적었고(난수·현재 시각을 쓰지 않는다) AI 가 만든 것이 아니다.
// - A-0147·A-0171 은 시안의 두 지원자다. 최종 평가(82.0점·81.8점)와 A-0147 의 요약·강점·약점은 시안에 적힌 그대로이고, A-0171 의
//   요약은 시안의 "수학 과학 성취가 높고 실험 보고서가 탄탄한 학생." 을 경영학과의 전공 관련 교과(영어·사회)에 맞게 고쳤다.
// - 시안의 모집 인원은 38명이지만 이 프로젝트의 모집 인원은 30명이라(lib/admission.ts) 합격선은 30위다. 시안의 38위·39위가 30위·31위다.
// - 지원자는 평가하기에 배정된 24명(lib/evaluate/sampleEvaluations.ts)과 겹치지 않는다. 모집 단위 전체의 순위에서 합격선 근처만 떼어 온 것이다.
// - 점수는 평가 요소 자리(0~2: 기본 평가 기준의 잠재역량·학업역량·공동체역량 순서)별로 적는다. 화면이 지금 평가 기준의 요소에
//   차례로 맞추고(요소가 셋보다 많으면 자리를 돌려 쓴다), 전형 준비에서 저장한 배점으로 가중 평균한다(lib/decision/decision.ts).
// - 위원 세 명의 요소 점수는 자리마다 평균이 정수가 되게 적었다(막대 그래프와 표의 요소 점수가 정수로 떨어진다).
// - 기본 배점(50·30·20)에서 최종 평가는 순서대로 83.7 · 83.2 · 83.0 · 82.4 · 82.1 · 82.0 | 81.8 · 81.5 · 81.1 · 80.8 · 80.4 · 80.1 이고,
//   위원 간 차이가 큰 지원자는 넷(A-0090, A-0118, A-0196, A-0240)이다(scripts/check-decision.ts 가 확인한다).

/** 평가 요소 자리 셋의 점수 (0~100 정수) */
export type DecisionSlotScores = readonly [number, number, number];

/** 합격선 주변의 지원자 한 명 */
export type DecisionApplicant = {
  /** "A-0147" 꼴 */
  code: string;
  /** AI 한 줄 요약 */
  summary: string;
  /**
   * 요약의 갈래. 갈래가 같은 지원자끼리 "요약이 비슷한 지원자" 다(갈래가 없으면 null).
   * 실제로는 요약 문장을 견주어 정할 값이고, 예시 자료에서는 손으로 적어 두었다.
   */
  theme: string | null;
  /** 학생부에서 읽은 강점과 약점 (한 줄씩) */
  strength: string;
  weakness: string;
  /** 자리별 AI 점수 (가중 평균한 것이 "인재상 적합도" 다) */
  ai: DecisionSlotScores;
  /** 위원 세 명의 자리별 점수 (위원 1·2·3 순서) */
  members: readonly [DecisionSlotScores, DecisionSlotScores, DecisionSlotScores];
};

/** 평가를 마친 지원자 수 (시안 그대로. 평가가 모두 끝난 뒤의 모습이다) */
export const DECISION_EVALUATED_COUNT = 312;

/** 예시 자료의 첫 지원자의 순위: 합격선(모집 인원) 위로 여섯, 아래로 여섯 명이다 */
export const DECISION_FIRST_RANK = ADMISSION.quota - 5;

type DecisionSource = Omit<DecisionApplicant, "code"> & { n: number };

const SOURCES: readonly DecisionSource[] = [
  {
    n: 12,
    summary: "기업 사례 분석과 교과 성취가 함께 높은 학생",
    theme: null,
    strength: "교과 성취 · 사례 분석 과정 기록",
    weakness: "협업 사례가 적음",
    ai: [86, 84, 77],
    members: [
      [88, 86, 74],
      [85, 85, 77],
      [85, 84, 77],
    ],
  },
  {
    n: 29,
    summary: "경제 동아리에서 탐구 주제를 스스로 정해 발표해 온 학생",
    theme: null,
    strength: "주제 선정의 자기 주도성 · 발표 경험",
    weakness: "교과 성취가 다소 고르지 않음",
    ai: [85, 81, 86],
    members: [
      [83, 79, 88],
      [85, 80, 86],
      [84, 81, 84],
    ],
  },
  {
    n: 64,
    summary: "설문 조사 설계와 결과 해석이 탄탄한 학생",
    theme: "조사 · 탐구",
    strength: "조사 설계 · 결과 해석",
    weakness: "학급·동아리 역할 기록이 적음",
    ai: [84, 87, 75],
    members: [
      [86, 90, 74],
      [83, 87, 73],
      [83, 87, 72],
    ],
  },
  {
    n: 90,
    summary: "학생 자치 활동에서 의견을 모아 실행한 경험이 많은 학생",
    theme: "리더십 · 조율",
    strength: "의견 수렴 · 실행력",
    weakness: "교과 성취의 기복",
    ai: [81, 80, 89],
    members: [
      [86, 83, 96],
      [81, 79, 90],
      [76, 75, 87],
    ],
  },
  {
    n: 118,
    summary: "영어·사회 교과 성취가 높고 탐구 보고서가 충실한 학생",
    theme: "교과 성취 · 보고서",
    strength: "교과 성취 · 탐구 보고서",
    weakness: "공동체 활동 기록이 적음",
    ai: [83, 88, 72],
    members: [
      [80, 87, 64],
      [87, 94, 72],
      [82, 89, 68],
    ],
  },
  // 시안의 왼쪽 지원자 (시안의 38위 · 합격권)
  {
    n: 147,
    summary: "학생회 활동을 주도하며 조율 경험이 많은 학생.",
    theme: "리더십 · 조율",
    strength: "조율 경험 · 책임감",
    weakness: "전공 탐구 기록 얕음",
    ai: [78, 83, 90],
    members: [
      [78, 83, 94],
      [79, 82, 92],
      [77, 81, 90],
    ],
  },
  // 시안의 오른쪽 지원자 (시안의 39위 · 예비 1)
  {
    n: 171,
    summary: "영어 사회 성취가 높고 탐구 보고서가 탄탄한 학생.",
    theme: "교과 성취 · 보고서",
    strength: "교과 성취 · 보고서 완성도",
    weakness: "활동 폭 얕음",
    ai: [83, 89, 73],
    members: [
      [83, 89, 71],
      [82, 87, 73],
      [81, 88, 72],
    ],
  },
  {
    n: 196,
    summary: "교내 장터를 직접 기획해 운영해 본 실행형 학생",
    theme: "창업 · 기획",
    strength: "기획·운영 경험 · 구매자 의견 반영",
    weakness: "영어 교과 성취가 낮은 편",
    ai: [87, 76, 80],
    members: [
      [89, 78, 82],
      [80, 70, 75],
      [89, 77, 83],
    ],
  },
  {
    n: 222,
    summary: "또래 멘토링과 학급 임원 활동을 꾸준히 이어 온 학생",
    theme: "리더십 · 조율",
    strength: "꾸준한 멘토링 · 책임감",
    weakness: "전공 관련 탐구가 적음",
    ai: [79, 80, 88],
    members: [
      [77, 80, 90],
      [78, 82, 90],
      [79, 81, 87],
    ],
  },
  {
    n: 240,
    summary: "시장 조사 과정을 꼼꼼히 기록하고 한계를 분석한 학생",
    theme: "조사 · 탐구",
    strength: "조사 기록 · 한계 분석",
    weakness: "전공과 이어지는 활동이 적음",
    ai: [79, 86, 76],
    members: [
      [81, 91, 80],
      [79, 88, 76],
      [74, 85, 75],
    ],
  },
  {
    n: 263,
    summary: "창업 동아리에서 상품 기획을 맡아 온 학생",
    theme: "창업 · 기획",
    strength: "상품 기획 · 꾸준한 동아리 활동",
    weakness: "교과 성취가 고르지 않음",
    ai: [85, 75, 80],
    members: [
      [85, 75, 82],
      [84, 74, 81],
      [83, 73, 80],
    ],
  },
  {
    n: 289,
    summary: "독서와 토론 기록이 고르고 글쓰기에 강점이 있는 학생",
    theme: null,
    strength: "글쓰기 · 토론 참여",
    weakness: "전공 탐구의 깊이가 얕음",
    ai: [79, 81, 82],
    members: [
      [79, 82, 84],
      [78, 81, 85],
      [77, 80, 83],
    ],
  },
];

/** 합격선 주변의 예시 지원자 12명 (코드 순서. 순위는 화면이 배점으로 계산해 매긴다) */
export const DECISION_APPLICANTS: readonly DecisionApplicant[] = SOURCES.map(({ n, ...rest }) => ({
  code: sampleApplicantCode(n),
  ...rest,
}));
