import { ADMISSION } from "../admission.ts";
import { sampleApplicantCode } from "../applicants/sampleApplicants.ts";

// 선발 결정 화면의 예시 자료: 합격선 주변(접전 구간)의 지원자 12명.
// 실제 지원자가 아니다. A-0147·A-0171 의 요약·강점·약점·최종 평가(82.0점·81.8점)는 시안에 적힌 그대로이고, 나머지는 화면을 채우려고
// 지어낸 임시 값이다. 값은 모두 손으로 적었고(난수·현재 시각을 쓰지 않는다) AI 가 만든 것이 아니다.
// - 시안의 모집 인원은 38명이지만 이 프로젝트의 모집 인원은 30명이라(lib/admission.ts) 합격선은 30위다. 시안의 38위·39위가 30위·31위다.
// - 지원자는 평가하기에 배정된 24명(lib/evaluate/sampleEvaluations.ts)과 겹치지 않는다. 모집 단위 전체의 순위에서 합격선 근처만 떼어 온 것이다.
// - 점수는 평가 요소 자리(0~3: 기본 평가 기준의 학업성취도·리더십·Y형 인재·전공적합성 순서)별로 적는다. 화면이 지금 평가 기준의 요소에
//   차례로 맞추고(요소가 넷보다 많으면 자리를 돌려 쓴다), 전형 준비에서 저장한 배점으로 가중 평균한다(lib/decision/decision.ts).
// - 위원 세 명의 요소 점수는 자리마다 평균이 정수가 되게 적었다(막대 그래프와 표의 요소 점수가 정수로 떨어진다).
// - 기본 배점(30·20·25·25)에서 최종 평가는 순서대로 83.7 · 83.2 · 83.0 · 82.4 · 82.1 · 82.0 | 81.8 · 81.5 · 81.1 · 80.8 · 80.4 · 80.1 이고,
//   위원 간 차이가 큰 지원자는 넷(A-0090, A-0118, A-0196, A-0240)이다(scripts/check-decision.ts 가 확인한다).

/** 평가 요소 자리 넷의 점수 (0~100 정수) */
export type DecisionSlotScores = readonly [number, number, number, number];

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
    summary: "알고리즘 문제 풀이와 교과 성취가 함께 높은 학생",
    theme: null,
    strength: "교과 성취 · 문제 해결 과정 기록",
    weakness: "협업 사례가 적음",
    ai: [86, 79, 82, 85],
    members: [
      [88, 77, 82, 87],
      [86, 78, 83, 86],
      [87, 79, 81, 85],
    ],
  },
  {
    n: 29,
    summary: "수학 동아리에서 탐구 주제를 스스로 정해 발표해 온 학생",
    theme: null,
    strength: "주제 선정의 자기 주도성 · 발표 경험",
    weakness: "전공 교과 이수가 다소 적음",
    ai: [83, 86, 84, 81],
    members: [
      [80, 88, 83, 80],
      [83, 89, 84, 79],
      [83, 87, 85, 81],
    ],
  },
  {
    n: 64,
    summary: "물리 실험 설계와 결과 해석이 탄탄한 학생",
    theme: "실험 · 탐구",
    strength: "실험 설계 · 결과 해석",
    weakness: "학급·동아리 역할 기록이 적음",
    ai: [86, 77, 83, 84],
    members: [
      [88, 77, 86, 85],
      [85, 76, 83, 84],
      [85, 75, 83, 83],
    ],
  },
  {
    n: 90,
    summary: "학생 자치 활동에서 의견을 모아 실행한 경험이 많은 학생",
    theme: "리더십 · 조율",
    strength: "의견 수렴 · 실행력",
    weakness: "교과 성취의 기복",
    ai: [80, 88, 83, 79],
    members: [
      [83, 96, 88, 81],
      [79, 90, 84, 79],
      [75, 87, 80, 74],
    ],
  },
  {
    n: 118,
    summary: "수학·과학 교과 성취가 높고 탐구 보고서가 충실한 학생",
    theme: "교과 성취 · 보고서",
    strength: "교과 성취 · 탐구 보고서",
    weakness: "공동체 활동 기록이 적음",
    ai: [88, 74, 82, 82],
    members: [
      [86, 68, 79, 79],
      [93, 75, 86, 86],
      [88, 73, 81, 81],
    ],
  },
  // 시안의 왼쪽 지원자 (시안의 38위 · 합격권)
  {
    n: 147,
    summary: "학생회 활동을 주도하며 조율 경험이 많은 학생.",
    theme: "리더십 · 조율",
    strength: "조율 경험 · 책임감",
    weakness: "전공 탐구 기록 얕음",
    ai: [79, 88, 84, 78],
    members: [
      [80, 92, 84, 77],
      [81, 90, 83, 78],
      [79, 88, 82, 76],
    ],
  },
  // 시안의 오른쪽 지원자 (시안의 39위 · 예비 1)
  {
    n: 171,
    summary: "수학 과학 성취가 높고 실험 보고서가 탄탄한 학생.",
    theme: "교과 성취 · 보고서",
    strength: "교과 성취 · 보고서 완성도",
    weakness: "활동 폭 얕음",
    ai: [89, 73, 79, 84],
    members: [
      [89, 71, 80, 85],
      [87, 72, 81, 84],
      [88, 73, 79, 83],
    ],
  },
  {
    n: 196,
    summary: "웹 서비스를 직접 만들어 운영해 본 구현형 학생",
    theme: "개발 · 구현",
    strength: "구현 경험 · 사용자 의견 반영",
    weakness: "수학 교과 성취가 낮은 편",
    ai: [78, 79, 87, 83],
    members: [
      [81, 80, 89, 86],
      [73, 74, 80, 79],
      [80, 80, 89, 87],
    ],
  },
  {
    n: 222,
    summary: "또래 멘토링과 학급 임원 활동을 꾸준히 이어 온 학생",
    theme: "리더십 · 조율",
    strength: "꾸준한 멘토링 · 책임감",
    weakness: "전공 관련 탐구가 적음",
    ai: [81, 87, 80, 79],
    members: [
      [78, 88, 79, 78],
      [81, 89, 80, 77],
      [81, 87, 81, 79],
    ],
  },
  {
    n: 240,
    summary: "화학 실험 과정을 꼼꼼히 기록하고 오차를 분석한 학생",
    theme: "실험 · 탐구",
    strength: "실험 기록 · 오차 분석",
    weakness: "전공과 이어지는 활동이 적음",
    ai: [83, 74, 81, 82],
    members: [
      [87, 77, 83, 85],
      [86, 74, 80, 81],
      [82, 71, 77, 80],
    ],
  },
  {
    n: 263,
    summary: "앱 개발 동아리에서 기능 구현을 맡아 온 학생",
    theme: "개발 · 구현",
    strength: "기능 구현 · 꾸준한 동아리 활동",
    weakness: "교과 성취가 고르지 않음",
    ai: [77, 78, 83, 85],
    members: [
      [78, 79, 86, 85],
      [75, 78, 83, 84],
      [75, 77, 83, 83],
    ],
  },
  {
    n: 289,
    summary: "독서와 토론 기록이 고르고 글쓰기에 강점이 있는 학생",
    theme: null,
    strength: "글쓰기 · 토론 참여",
    weakness: "전공 탐구의 깊이가 얕음",
    ai: [82, 81, 79, 79],
    members: [
      [82, 82, 79, 80],
      [83, 80, 78, 81],
      [81, 78, 77, 79],
    ],
  },
];

/** 합격선 주변의 예시 지원자 12명 (코드 순서. 순위는 화면이 배점으로 계산해 매긴다) */
export const DECISION_APPLICANTS: readonly DecisionApplicant[] = SOURCES.map(({ n, ...rest }) => ({
  code: sampleApplicantCode(n),
  ...rest,
}));
