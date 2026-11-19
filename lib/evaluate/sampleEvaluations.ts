import type { AnalysisResult } from "@/types/analysis";
import { sampleApplicantCode } from "../applicants/sampleApplicants.ts";

// 평가하기 화면의 지원자 형식과 예시 자료.
// 형식(EvaluationApplicant)은 예시 지원자와 올린 지원자(학생부 올리기 화면에서 분석한 학생부, ./uploadedEvaluation.ts)가 같이 쓴다.
// 예시 자료: 로그인한 사정관에게 배정된 지원자 24명의 AI 한 줄 요약, 학년별 성장 요약, 서류 원문(가려진 학생부 문장)과
// AI 가 근거로 쓴 문장, 평가 요소 자리별 AI 점수·신뢰도, 처음 평가 상태, 다른 위원의 진행 현황.
// 실제 지원자·학교·지명이 아니다. A-0187 의 요약·세특 원문·AI 점수·내 점수·수정 사유와 A-0133·A-0251·A-0015·A-0042·A-0067 의 요약·내 점수,
// 위원별 진행 수(21·24·17 / 24, 전체 248 / 312), 마감 문구는 디자인에 적힌 그대로이고, 나머지는 화면을 채우려고 지어낸 임시 값이다.
// 난수·현재 시각을 쓰지 않고 지원자 번호로 계산해 늘 같은 결과가 나온다. 예시 지원자의 값은 AI 가 만든 것이 아니다.

/**
 * 예시 자료의 평가 요소 자리(0~3). 기본 평가 기준(lib/prep/defaultCriteria.ts)의 학업성취도·리더십·Y형 인재·전공적합성 순서다.
 * 예시 자료는 요소 id 가 아니라 자리로 적어 두고, 화면이 지금 평가 기준의 요소에 차례로 맞춘다(요소가 넷보다 많으면 자리를 돌려 쓴다).
 * 올린 지원자는 분석할 때의 평가 요소 순번이 자리다(요소 수만큼 있다).
 */
export type Slot = 0 | 1 | 2 | 3;

export const SLOT_COUNT = 4;

/** 서류 구분 (학생부의 네 영역). 화면의 서류 구분 버튼에 늘 있다. */
export const DOCUMENT_AREAS = ["교과", "세특", "창체", "행특"] as const;

/** 그 영역의 원문이 있는 지원자에게만 버튼이 나오는 서류 구분 (올린 학생부의 독서활동상황) */
export const EXTRA_DOCUMENT_AREAS = ["독서"] as const;

export type DocumentArea = (typeof DOCUMENT_AREAS)[number] | (typeof EXTRA_DOCUMENT_AREAS)[number];

/** 서류 원문을 처음 열었을 때 보이는 영역 */
export const INITIAL_DOCUMENT_AREA: DocumentArea = "세특";

/**
 * 원문의 한 조각. slots 는 AI 가 이 조각을 근거로 쓴 평가 요소의 자리들이다(근거가 아니면 빈 배열).
 * 예시 자료는 조각 하나가 근거 문장 하나이고 자리도 하나다. 올린 지원자는 여러 요소의 근거 구절이 겹칠 수 있어 자리가 여럿일 수 있다.
 */
export type PassageSegment = {
  text: string;
  slots: readonly number[];
};

/** 서류 원문 한 건: 영역, 학년(학년이 없는 항목은 null), 과목·활동 이름, 문장 조각 */
export type Passage = {
  id: string;
  area: DocumentArea;
  grade: 1 | 2 | 3 | null;
  subject: string;
  segments: readonly PassageSegment[];
};

/**
 * 평가 요소 자리 하나에 대한 AI 제안: 점수(0~100), 신뢰도(1~4), 태그.
 * 태그는 tags 가 있으면 그 글 그대로(올린 지원자: 분석할 때 정한 묶음 태그), 없으면 tagPicks(그 요소의 묶음 순번, 화면이 묶음 수로
 * 나눈 나머지를 쓴다. 예시 자료)로 고른다.
 */
export type SlotAssessment = {
  score: number;
  confidence: 1 | 2 | 3 | 4;
  tagPicks: readonly number[];
  tags?: readonly string[];
};

/** 근거 문장 하나: 출처("2학년 · 세특 · 물리학II"), 문장, AI 가 적은 이유(올린 지원자만) */
export type ApplicantEvidence = {
  id: string;
  source: string;
  text: string;
  reason?: string;
};

/** 학년 하나의 성장 요약: 이름표, 성장 지수(0~100), 활동 건수(0~5) */
export type GrowthPoint = {
  grade: 1 | 2 | 3;
  label: string;
  index: number;
  count: number;
};

/** 처음 평가 상태 (저장한 평가가 없을 때). 점수·사유는 자리별이다. */
export type EvaluationSeed = {
  status: "editing" | "draft" | "submitted";
  scores: readonly [number, number, number, number];
  reasons: Readonly<Partial<Record<Slot, string>>>;
  opinion: string;
};

/** 다른 위원 한 명의 의견 (내 평가를 제출한 뒤에 보인다). total 이 null 이면 그 위원이 아직 제출하지 않았다. */
export type PeerOpinion = {
  reviewer: string;
  total: number | null;
  comment: string;
};

/** 평가할 지원자 한 명 */
export type EvaluationApplicant = {
  /** "A-0187" 꼴 */
  code: string;
  /** AI 한 줄 요약 */
  summary: string;
  /** 자리별 AI 제안. 예시 지원자는 넷, 올린 지원자는 분석할 때의 평가 요소 수만큼이다. */
  ai: readonly SlotAssessment[];
  growth: readonly [GrowthPoint, GrowthPoint, GrowthPoint];
  passages: readonly Passage[];
  /** 처음 평가 상태. null 이면 아직 시작하지 않았다("대기"). */
  seed: EvaluationSeed | null;
  peers: readonly PeerOpinion[];
  /**
   * 자리별 근거 문장(올린 지원자만). 없으면 원문 조각에서 만든다(예시 자료는 조각 하나가 근거 문장 하나다).
   * 올린 지원자는 근거 구절이 겹치면 조각이 구절보다 잘게 나뉘므로 구절을 따로 둔다.
   */
  evidences?: readonly (readonly ApplicantEvidence[])[];
  /** 원문보기로 여는 분석 결과(올린 지원자만). 없으면 미리 만든 샘플 결과를 연다. */
  original?: AnalysisResult;
  /**
   * 이 지원자의 평가를 이 분석에 묶는 표시(올린 지원자만: 분석을 남긴 때). 저장한 평가의 basis 에 들어간다.
   * 올린 지원자의 코드는 저장소 사정에 따라 다른 학생부에 다시 붙을 수 있어, 표시가 다른 평가는 쓰지 않는다(lib/evaluate/evaluation.ts).
   */
  stamp?: string;
};

/** 예시 지원자의 자리별 AI 제안 (자리 넷) */
type SampleAssessments = readonly [SlotAssessment, SlotAssessment, SlotAssessment, SlotAssessment];

/** 글만 있으면 근거가 아닌 문장, [글, 자리] 면 그 자리의 근거 문장 */
type SegmentSource = string | readonly [string, Slot];

/** 원문 한 건을 적는 꼴: [학년, 과목·활동 이름, 조각…] */
type PassageSource = readonly [1 | 2 | 3, string, ...SegmentSource[]];

function toSegments(sources: readonly SegmentSource[]): PassageSegment[] {
  return sources.map((source) =>
    typeof source === "string" ? { text: source, slots: [] } : { text: source[0], slots: [source[1]] },
  );
}

function toPassage(id: string, area: DocumentArea, source: PassageSource): Passage {
  const [grade, subject, ...segments] = source;
  return { id, area, grade, subject, segments: toSegments(segments) };
}

/** 지원자마다 적어 둔 값: 번호, 한 줄 요약, 요약과 맞는 세특 원문 한 건 */
type ApplicantSource = {
  n: number;
  summary: string;
  key: PassageSource;
};

// 제출을 마친 21명(번호가 작은 순서)과 아직 남은 3명(A-0133, A-0187, A-0251). 평가 순서는 코드 순서다.
const APPLICANT_SOURCES: readonly ApplicantSource[] = [
  {
    n: 4,
    summary: "화학 실험 오차를 통계로 분석해 본 탐구형 학생",
    key: [2, "화학Ⅰ", "중화 적정 실험에서 ", ["같은 실험을 다섯 번 되풀이해 측정값의 평균과 표준편차를 구하고 오차 범위를 그래프로 나타냄.", 0], " ", ["오차가 큰 회차의 원인을 뷰렛 눈금 읽기 방식에서 찾아 측정 절차를 고쳐 다시 실험함.", 2]],
  },
  {
    n: 9,
    summary: "학급 회의를 이끌며 갈등을 조정한 경험이 있는 학생",
    key: [2, "사회·문화", "모둠 토의에서 ", ["의견이 갈린 두 모둠원의 주장을 표로 나란히 정리해 공통점을 먼저 찾도록 이끎.", 1], " 토의 결과를 바탕으로 ", ["세대 갈등을 다룬 설문 문항을 직접 만들어 학급에서 조사하고 결과를 보고서로 정리함.", 0]],
  },
  {
    n: 15,
    summary: "수학 동아리에서 또래 학습을 꾸준히 이끈 학생",
    key: [2, "수학Ⅱ", ["미분 단원에서 접선의 기울기를 함수의 변화율로 설명하는 풀이를 스스로 정리해 발표함.", 0], " ", ["친구들이 자주 틀리는 유형을 모아 풀이 순서를 나눈 학습지를 만들어 함께 풀었음.", 1], " 수업 뒤에도 질문을 받아 끝까지 설명하는 모습이 꾸준함."],
  },
  {
    n: 21,
    summary: "정보 교과에서 알고리즘 문제 풀이를 꾸준히 기록한 학생",
    key: [2, "정보", ["정렬 알고리즘 세 가지를 직접 구현하고 자료 크기에 따른 실행 시간을 표로 비교함.", 3], " ", ["풀이마다 막힌 지점과 고친 방법을 학습 일지에 적어 한 학기 동안 이어 감.", 0], " 같은 문제를 다른 방법으로 다시 풀어 보는 습관이 돋보임."],
  },
  {
    n: 26,
    summary: "영어 원서 읽기와 번역 활동을 3년간 이어 온 학생",
    key: [3, "영어 독해와 작문", ["과학 분야 영어 원서를 읽고 장마다 핵심 내용을 우리말로 옮겨 요약 노트를 만듦.", 0], " 번역이 어색한 문장은 ", ["여러 표현을 견주어 보고 까닭을 적어 두는 등 스스로 기준을 세워 고쳐 나감.", 2]],
  },
  {
    n: 33,
    summary: "로봇 동아리에서 센서 제어를 맡아 대회를 준비한 학생",
    key: [2, "물리학Ⅰ", "역학 단원에서 배운 내용을 바탕으로 ", ["초음파 센서로 거리를 재어 속력을 조절하는 주행 로봇의 제어 과정을 설명함.", 3], " ", ["측정값이 흔들리는 문제를 이동 평균으로 줄이는 방법을 스스로 찾아 적용함.", 2]],
  },
  {
    n: 38,
    summary: "통계 자료로 학교 급식 만족도를 조사해 발표한 학생",
    key: [2, "확률과 통계", ["급식 만족도 설문을 설계하고 학년별 표본을 나누어 조사한 뒤 결과를 상자 그림으로 나타냄.", 0], " ", ["조사 결과를 영양 교사에게 전달하고 개선 의견을 학급에 다시 알리는 과정을 맡음.", 1]],
  },
  {
    n: 42,
    summary: "독서 기록과 토론 활동이 고르게 쌓인 학생",
    key: [2, "독서", ["기술과 사회를 다룬 책 세 권을 읽고 저자의 주장을 견주는 서평을 씀.", 0], " 이어진 토론에서 ", ["상대의 근거를 다시 정리해 준 뒤 자신의 반론을 펴는 방식으로 논의를 이끎.", 1], " 읽은 내용을 다른 교과의 발표에도 꾸준히 활용함."],
  },
  {
    n: 47,
    summary: "지구과학 관측 기록을 직접 그래프로 정리한 학생",
    key: [2, "지구과학Ⅰ", ["한 달 동안 기온과 습도를 같은 시각에 기록하고 변화를 그래프로 그려 날씨와의 관계를 해석함.", 0], " ", ["관측이 빠진 날의 값을 주변 날짜로 어림하는 방법의 한계를 스스로 짚어 보고서에 적음.", 2]],
  },
  {
    n: 53,
    summary: "봉사 활동에서 어르신 디지털 교육을 기획한 학생",
    key: [2, "기술·가정", "생활 속 기술 단원에서 ", ["어르신이 무인 주문기를 쓸 때 겪는 어려움을 조사해 단계별 안내 자료를 만듦.", 2], " ", ["모둠원과 역할을 나누어 안내 자료를 시연하고 받은 의견을 반영해 고침.", 1]],
  },
  {
    n: 58,
    summary: "수학 증명 과정을 글로 풀어 쓰는 데 강점이 있는 학생",
    key: [3, "미적분", ["평균값 정리를 그림과 글로 풀어 쓴 설명문을 작성하고 조건이 빠지면 성립하지 않는 예를 직접 찾음.", 0], " ", ["증명의 각 단계가 왜 필요한지 묻는 친구의 질문에 반례를 들어 답함.", 1]],
  },
  {
    n: 67,
    summary: "생명과학 실험을 설계부터 보고서까지 맡은 학생",
    key: [2, "생명과학Ⅰ", ["효소 활성에 온도가 미치는 영향을 알아보는 실험을 직접 설계하고 대조군을 두어 결과를 비교함.", 0], " ", ["예상과 다른 결과가 나오자 시약 농도를 바꾸어 다시 실험하고 차이를 보고서에 정리함.", 2], " 실험 과정을 모둠원에게 나누어 설명함."],
  },
  {
    n: 72,
    summary: "웹 개발로 동아리 출석 관리 도구를 만든 학생",
    key: [2, "정보", ["동아리 출석을 기록하는 웹 화면을 만들고 자료를 표로 저장하는 구조를 스스로 설계함.", 3], " ", ["써 본 부원들의 불편을 모아 입력 단계를 줄이는 방향으로 두 차례 고침.", 2]],
  },
  {
    n: 79,
    summary: "사회 문제를 데이터로 살펴 정책을 제안해 본 학생",
    key: [2, "통합사회", ["공공 자료에서 지역별 대중교통 이용 자료를 내려받아 배차 간격과 이용량의 관계를 살핌.", 0], " ", ["분석 결과를 바탕으로 노선 조정안을 만들어 모둠 발표를 이끎.", 1]],
  },
  {
    n: 85,
    summary: "물리 개념을 영상으로 설명해 또래 학습을 도운 학생",
    key: [2, "물리학Ⅰ", ["운동량 보존을 수레 충돌 실험으로 확인하고 측정값과 이론값의 차이를 계산함.", 0], " ", ["실험 과정을 짧은 영상으로 만들어 학급에 공유하고 질문에 답하는 시간을 맡음.", 1]],
  },
  {
    n: 91,
    summary: "학교 신문 편집을 맡아 협업 과정을 조율한 학생",
    key: [2, "언어와 매체", ["기사 초안을 서로 읽고 고치는 절차를 정해 모둠의 마감 일정을 조율함.", 1], " ", ["같은 사건을 다룬 기사 두 편의 표현 차이를 분석해 매체의 관점을 설명하는 글을 씀.", 0]],
  },
  {
    n: 98,
    summary: "인공지능 윤리를 주제로 토론과 글쓰기를 이어 간 학생",
    key: [3, "생활과 윤리", ["자동 추천 기술의 편향 문제를 사례로 들어 책임의 주체를 따져 보는 글을 씀.", 2], " ", ["추천 알고리즘이 자료에 따라 결과가 달라지는 까닭을 정보 교과에서 배운 내용으로 설명함.", 3]],
  },
  {
    n: 104,
    summary: "미적분 개념을 경제 현상에 적용해 본 융합형 학생",
    key: [3, "미적분", ["한계 비용을 도함수로 설명하고 생산량에 따른 이윤 변화를 그래프로 나타냄.", 0], " ", ["수학에서 배운 최적화 문제를 경제 교과의 사례와 이어 발표하는 등 교과를 넘나드는 시도가 돋보임.", 2]],
  },
  {
    n: 110,
    summary: "아두이노로 교실 환경 측정 장치를 만든 학생",
    key: [2, "과학탐구실험", ["이산화 탄소 센서를 연결해 교실의 농도를 시간대별로 기록하는 장치를 만듦.", 3], " ", ["쉬는 시간 환기 전후의 값을 견주어 환기 권장 시각을 제안하는 보고서를 씀.", 0]],
  },
  {
    n: 117,
    summary: "멘토링으로 후배의 코딩 학습을 한 학기 동안 도운 학생",
    key: [3, "정보", ["반복문과 조건문을 처음 배우는 후배를 위해 단계별 연습 문제를 만들어 한 학기 동안 함께 풂.", 1], " ", ["설명하면서 자신이 헷갈리던 재귀 함수 개념을 다시 정리해 예제를 직접 구현함.", 3]],
  },
  {
    n: 124,
    summary: "과학 탐구에서 실패 원인을 끈질기게 분석한 학생",
    key: [2, "화학Ⅰ", ["전지 실험에서 전압이 예상보다 낮게 나오자 전극 간격과 용액 농도를 하나씩 바꾸어 원인을 찾음.", 2], " ", ["조건을 바꿀 때마다 결과를 표로 기록해 변인 통제의 중요성을 보고서에 정리함.", 0]],
  },
  {
    n: 133,
    summary: "수학 교과 성취가 꾸준하고 동아리 운영 경험이 있는 학생",
    key: [2, "수학Ⅱ", ["함수의 극한 단원에서 좌극한과 우극한이 다른 경우를 그래프로 직접 그려 설명함.", 0], " ", ["단원이 끝날 때마다 틀린 문제의 원인을 유형별로 나누어 정리하는 습관을 한 학기 내내 이어 감.", 0], " 모둠 활동에서는 ", ["풀이가 막힌 친구에게 답이 아니라 다음 단계의 실마리를 건네는 방식으로 도움.", 1]],
  },
  {
    n: 187,
    summary: "물리 탐구를 코딩으로 확장한 자기주도형 학생",
    key: [2, "물리학II", "단진동 단원에서 ", ["진자 운동 시뮬레이션을 직접 코딩하여 이론값과 비교하고 오차율을 표로 정리함.", 0], " ", ["오차 원인을 공기 저항으로 가설을 세운 뒤 감쇠 항을 추가해 재실험함.", 0], " 탐구 과정을 보고서로 정리해 발표하고, ", ["친구들의 질문에 수식을 들어 차분히 답함.", 1]],
  },
  {
    n: 251,
    summary: "지역 문제를 앱으로 풀어본 실행형 학생",
    key: [2, "정보", "지역 문제 해결 과제에서 ", ["버스 도착 시각을 알려 주는 앱의 화면 흐름을 설계하고 공공 자료를 불러오는 기능을 직접 구현함.", 3], " ", ["써 본 사람들의 의견을 모아 글자 크기와 단계 수를 고치는 등 두 차례 개선함.", 2], " 발표에서는 ", ["모둠원이 맡은 부분을 차례로 소개하며 역할을 고르게 나눔.", 1]],
  },
];

/** 상세 값이 정해진 지원자의 둘째 세특 원문 (번호 → 원문). 없는 지원자는 아래 묶음에서 번호로 고른다. */
const SECOND_DETAIL_PASSAGES: Readonly<Record<number, PassageSource>> = {
  133: [3, "확률과 통계", ["동아리 부원 수와 활동 시간 자료로 평균과 분산을 구해 운영 계획을 세우는 데 활용함.", 3], " 발표 자료를 만들 때 ", ["표본이 적어 결론을 일반화하기 어렵다는 점을 스스로 밝힘.", 2]],
  187: [3, "정보", ["수치 해석 라이브러리를 쓰지 않고 오일러 방법을 파이썬으로 직접 구현함.", 3], " 이어진 자유 주제 탐구에서 ", ["공공 자전거 대여 자료를 모아 시간대별 수요를 예측하는 모델을 스스로 설계함.", 3], " ", ["예측이 빗나간 날을 따로 모아 원인을 살피는 등 결과의 한계를 스스로 짚음.", 2]],
  251: [3, "수학Ⅱ", ["앱 이용 기록을 요일별로 나누어 변화율을 계산하고 이용이 몰리는 시간대를 그래프로 나타냄.", 0], " ", ["계산 결과가 직관과 다를 때 자료를 다시 살펴 입력 오류를 찾아냄.", 0]],
};

/** 둘째 세특 원문 묶음 (번호로 고른다) */
const DETAIL_POOL: readonly PassageSource[] = [
  [3, "정보", ["자료 구조 단원에서 스택과 큐를 직접 구현하고 쓰임에 맞는 예를 찾아 설명함.", 3], " 과제를 일찍 마친 뒤 ", ["예외 상황을 스스로 만들어 프로그램이 멈추지 않도록 고침.", 0]],
  [1, "통합과학", ["에너지 전환 단원에서 가정의 전기 사용량을 조사해 줄일 수 있는 방법을 계산으로 보임.", 0], " ", ["조사 과정에서 생긴 궁금증을 다음 탐구 주제로 이어 가는 모습이 보임.", 2]],
  [3, "수학과제 탐구", ["암호에 쓰이는 소수의 성질을 조사하고 간단한 암호화 과정을 직접 계산해 봄.", 3], " ", ["탐구 계획을 스스로 세우고 중간 점검 때마다 방향을 고쳐 끝까지 마무리함.", 0]],
  [1, "수학", ["이차함수의 최대·최소를 실생활 문제에 적용해 풀이 과정을 글로 정리함.", 0], " ", ["같은 문제를 다른 방법으로 푼 친구의 풀이와 견주어 장단점을 발표함.", 1]],
  [3, "인공지능 기초", ["분류 모델에 넣는 자료를 바꾸어 가며 정확도가 달라지는 까닭을 살핌.", 3], " ", ["결과가 기대와 다를 때 자료의 치우침을 의심하고 다시 나누어 실험함.", 2]],
  [1, "국어", ["설명문 쓰기에서 과학 개념을 비유로 풀어 쓴 글을 완성하고 친구의 조언을 받아 두 번 고쳐 씀.", 0], " ", ["모둠 글쓰기에서는 맡은 부분을 먼저 마치고 다른 모둠원의 문장을 다듬는 일을 도움.", 1]],
  [3, "물리학Ⅱ", ["전자기 유도 실험에서 코일의 감은 수를 바꾸어 유도 기전력의 변화를 측정함.", 0], " ", ["측정값을 스프레드시트로 정리하고 추세선을 그려 관계식을 추정함.", 3]],
];

/** 창체 원문 묶음 (번호로 고른다) */
const ACTIVITY_POOL: readonly PassageSource[] = [
  [2, "동아리활동", ["동아리 부장으로 한 해 활동 계획을 세우고 부원의 관심사에 맞추어 모둠을 나눔.", 1], " ", ["발표회를 앞두고 일정이 밀리자 역할을 다시 나누어 기한 안에 마무리함.", 1]],
  [1, "자율활동", ["학급 규칙을 정하는 회의에서 사회를 맡아 모든 의견이 한 번씩 다루어지도록 진행함.", 1], " 학급 행사에서는 ", ["준비물 목록을 만들어 빠진 것이 없도록 스스로 챙김.", 2]],
  [2, "진로활동", ["관심 분야의 직업인을 조사하고 필요한 역량을 자신의 학습 계획과 견주어 보고서를 씀.", 3], " ", ["조사 뒤 정보 교과 선택 과목을 스스로 정해 이수 계획을 세움.", 3]],
  [3, "동아리활동", ["후배 부원에게 프로그래밍 기초를 가르치는 시간을 만들어 한 학기 동안 운영함.", 1], " ", ["활동 결과물을 전시회에 내기 위해 설명 자료를 직접 만듦.", 2]],
  [2, "봉사활동", ["도서관 책 정리 봉사에 꾸준히 참여하며 찾기 쉬운 배열 방법을 제안함.", 2], " ", ["처음 참여한 친구에게 일을 나누어 설명해 함께 마침.", 1]],
  [1, "진로활동", ["진로 탐색 시간에 소프트웨어 분야의 진로를 조사하고 관련 책을 읽어 소감을 발표함.", 3], " ", ["발표 뒤 받은 질문을 정리해 다음 탐구 주제로 삼음.", 2]],
];

/** 행특 원문 묶음 (번호로 고른다). 학년은 3학년이다. */
const BEHAVIOR_POOL: readonly PassageSource[] = [
  [3, "행동특성 및 종합의견", ["맡은 일을 끝까지 해내는 책임감이 강하고 약속한 기한을 어기는 일이 없음.", 2], " ", ["어려워하는 친구에게 먼저 다가가 설명해 주어 학급에서 믿음이 두터움.", 1]],
  [3, "행동특성 및 종합의견", ["새로운 과제가 주어지면 스스로 계획을 세워 시도해 보는 진취적인 태도를 지님.", 2], " 수업 태도가 한결같고 ", ["질문을 통해 이해를 넓혀 가는 학습 습관이 자리 잡혀 있음.", 0]],
  [3, "행동특성 및 종합의견", ["학급 일에 앞장서면서도 다른 사람의 의견을 끝까지 듣고 조율하는 모습이 돋보임.", 1], " ", ["실수했을 때 원인을 돌아보고 같은 실수를 되풀이하지 않으려 노력함.", 2]],
  [3, "행동특성 및 종합의견", ["관심 분야를 깊이 파고드는 끈기가 있고 알게 된 것을 친구들과 나누기를 즐김.", 2], " ", ["모둠 활동에서 궂은일을 먼저 맡아 분위기를 이끎.", 1]],
  [3, "행동특성 및 종합의견", ["규칙과 약속을 잘 지키고 주변을 배려하는 태도가 몸에 배어 있음.", 2], " ", ["학습 계획을 스스로 세워 꾸준히 실천하며 성적이 고르게 오름.", 0]],
  [3, "행동특성 및 종합의견", ["의견이 다른 친구와도 차분히 대화하여 합의점을 찾는 힘이 있음.", 1], " ", ["호기심이 많아 수업에서 생긴 궁금증을 스스로 찾아 해결함.", 2]],
];

/** 학년별 교과 과목 (교과 원문은 과목과 성취도를 계산해 만든다) */
const GRADE_SUBJECTS: readonly (readonly string[])[] = [
  ["국어", "수학", "영어", "통합과학", "정보"],
  ["수학Ⅰ", "수학Ⅱ", "영어Ⅰ", "물리학Ⅰ", "정보"],
  ["미적분", "확률과 통계", "영어 독해와 작문", "물리학Ⅱ", "인공지능 기초"],
];

/** 성취도: 번호·학년·과목 순번으로 정한다 (A 가 가장 많고 C 는 드물다) */
function achievementOf(n: number, gradeIndex: number, subjectIndex: number): string {
  const value = (n * (3 + subjectIndex) + gradeIndex * 5 + subjectIndex * 7) % 10;
  return value < 6 ? "A" : value < 9 ? "B" : "C";
}

/** 교과 원문 세 건(학년마다 한 건). 2학년 줄은 학업성취도 자리의 근거다. */
function subjectPassages(code: string, n: number, withEvidence: boolean): Passage[] {
  return GRADE_SUBJECTS.map((subjects, gradeIndex) => {
    const text = subjects.map((subject, index) => `${subject} ${achievementOf(n, gradeIndex, index)}`).join(" · ");
    const segment: PassageSegment = { text, slots: withEvidence && gradeIndex === 1 ? [0] : [] };
    return {
      id: `${code}-subject-${gradeIndex + 1}`,
      area: "교과",
      grade: (gradeIndex + 1) as 1 | 2 | 3,
      subject: "교과 성취도",
      segments: [segment],
    };
  });
}

/** 근거 표시를 뺀 원문 (A-0187 의 창체·행특은 디자인에 적힌 근거 수와 맞도록 근거로 삼지 않는다) */
function withoutEvidence(passage: Passage): Passage {
  return { ...passage, segments: passage.segments.map((segment) => ({ text: segment.text, slots: [] })) };
}

/** 지원자 한 명의 서류 원문: 교과 3건, 세특 2건, 창체 1건, 행특 1건 */
function passagesOf(source: ApplicantSource, code: string): Passage[] {
  const { n } = source;
  // A-0187 은 디자인의 근거 수(학업 2, 리더십 1, Y형 1, 전공 2)와 맞도록 세특 두 건만 근거로 쓴다.
  const detailOnly = n === 187;
  const second = SECOND_DETAIL_PASSAGES[n] ?? DETAIL_POOL[(n * 5) % DETAIL_POOL.length];
  const activity = toPassage(`${code}-activity`, "창체", ACTIVITY_POOL[(n * 3) % ACTIVITY_POOL.length]);
  const behavior = toPassage(`${code}-behavior`, "행특", BEHAVIOR_POOL[(n * 7) % BEHAVIOR_POOL.length]);
  return [
    ...subjectPassages(code, n, !detailOnly),
    toPassage(`${code}-detail-1`, "세특", source.key),
    toPassage(`${code}-detail-2`, "세특", second),
    detailOnly ? withoutEvidence(activity) : activity,
    detailOnly ? withoutEvidence(behavior) : behavior,
  ];
}

/** 디자인에 적힌(또는 디자인의 내 점수와 맞춘) AI 점수 */
const FIXED_AI_SCORES: Readonly<Record<number, readonly [number, number, number, number]>> = {
  15: [88, 86, 84, 85],
  42: [90, 86, 88, 87],
  67: [80, 76, 79, 80],
  133: [83, 80, 76, 82],
  187: [85, 78, 88, 80],
  251: [79, 82, 86, 84],
};

/** A-0187 의 신뢰도(3·1·2·3)와 태그(탐구심화·자기주도 / 소통 / 진취성·전문성 / 전공탐구·전공교과이수)는 디자인에 적힌 그대로다. */
const FIXED_CONFIDENCE: Readonly<Record<number, readonly [1 | 2 | 3 | 4, 1 | 2 | 3 | 4, 1 | 2 | 3 | 4, 1 | 2 | 3 | 4]>> = {
  187: [3, 1, 2, 3],
};

const FIXED_TAG_PICKS: Readonly<Record<number, readonly (readonly number[])[]>> = {
  187: [[2, 3], [1], [3, 1], [1, 0]],
};

const CONFIDENCE_CYCLE: readonly (1 | 2 | 3 | 4)[] = [3, 2, 4, 3, 2, 3, 4, 1];

/** 자리별 AI 제안. 점수는 72~90, 신뢰도는 위 순서를 돌려 쓴다(1 은 드물다). */
function assessmentsOf(n: number): SampleAssessments {
  const slots = [0, 1, 2, 3].map((slot): SlotAssessment => {
    const score = FIXED_AI_SCORES[n]?.[slot] ?? 72 + ((n * (7 + 3 * slot) + 11 * slot) % 19);
    const confidence = FIXED_CONFIDENCE[n]?.[slot] ?? CONFIDENCE_CYCLE[(n + 3 * slot) % CONFIDENCE_CYCLE.length];
    const tagPicks = FIXED_TAG_PICKS[n]?.[slot] ?? ((n + slot) % 2 === 0 ? [n + slot, n + slot + 1] : [n + slot]);
    return { score, confidence, tagPicks };
  });
  return slots as unknown as SampleAssessments;
}

/** 학년별 성장 이름표 (디자인 그대로) */
const GROWTH_LABELS = ["기초 탐구", "심화 · 프로젝트", "융합 · 확장"] as const;

/** 학년별 성장 요약. A-0187 은 디자인 값(52·74·88, 2·3·3건)이고 나머지는 번호로 계산한다(지수는 학년이 오를수록 커진다). */
function growthOf(n: number): EvaluationApplicant["growth"] {
  const first = 48 + ((n * 5) % 14);
  const second = first + 12 + ((n * 3) % 10);
  const third = Math.min(96, second + 6 + ((n * 7) % 10));
  const indexes = n === 187 ? [52, 74, 88] : [first, second, third];
  const counts = n === 187 ? [2, 3, 3] : [1 + (n % 3), 2 + ((n * 2) % 3), 2 + ((n + 1) % 3)];
  const points = [0, 1, 2].map(
    (index): GrowthPoint => ({
      grade: (index + 1) as 1 | 2 | 3,
      label: GROWTH_LABELS[index],
      index: indexes[index],
      count: counts[index],
    }),
  );
  return points as unknown as EvaluationApplicant["growth"];
}

const SEED_OPINIONS: readonly string[] = [
  "교과 학습과 탐구 활동이 서로 이어지고 기록의 근거가 분명함.",
  "학년이 오를수록 탐구의 깊이가 더해지는 흐름이 뚜렷함.",
  "협업 과정에서 맡은 역할이 구체적으로 드러나 신뢰가 감.",
  "전공과 이어지는 활동이 꾸준하고 스스로 주제를 넓혀 간 점이 좋음.",
  "기록 전반에서 성실함과 자기 주도성이 고르게 확인됨.",
  "근거 문장은 충분하나 리더십 영역의 사례가 다소 적음.",
];

/** 제출을 마친 지원자의 내 점수가 AI 점수와 다른 자리의 차이 (번호로 고른다. 0 이면 AI 점수 그대로) */
const SEED_DELTAS: readonly number[] = [0, 2, 0, -1, 0, 1, 0];

const SEED_REASON_UP = "근거 문장 밖의 활동 기록까지 살펴 조금 올림";
const SEED_REASON_DOWN = "근거가 한 과목에 치우쳐 있어 조금 낮춤";

/** 디자인에 내 점수가 적힌(제출을 마친) 지원자는 AI 점수 그대로 제출한 것으로 둔다 */
const SEED_WITHOUT_DELTA: readonly number[] = [15, 42, 67];

/** 아직 남은 지원자의 처음 상태 */
const PENDING_SEEDS: Readonly<Record<number, EvaluationSeed | null>> = {
  // 평가 중: 두 자리를 고쳤고 그중 하나는 아직 수정 사유를 적지 않았다(내 종합 점수 81).
  133: {
    status: "editing",
    scores: [84, 80, 78, 82],
    reasons: { 0: "오답을 유형별로 정리해 온 기록을 반영해 1점 올림" },
    opinion: "",
  },
  // 임시 저장: 디자인 값(내 점수 85·80·88·80, 내 종합 점수 84)
  187: {
    status: "draft",
    scores: [85, 80, 88, 80],
    reasons: { 1: "동아리 후배 지도 경험을 반영해 2점 올림" },
    opinion: "",
  },
  251: null,
};

function seedOf(n: number, ai: SampleAssessments): EvaluationSeed | null {
  if (Object.hasOwn(PENDING_SEEDS, n)) return PENDING_SEEDS[n];
  const scores: [number, number, number, number] = [ai[0].score, ai[1].score, ai[2].score, ai[3].score];
  const reasons: Partial<Record<Slot, string>> = {};
  const delta = SEED_WITHOUT_DELTA.includes(n) ? 0 : SEED_DELTAS[n % SEED_DELTAS.length];
  if (delta !== 0) {
    const slot = (n % SLOT_COUNT) as Slot;
    scores[slot] += delta;
    reasons[slot] = delta > 0 ? SEED_REASON_UP : SEED_REASON_DOWN;
  }
  return { status: "submitted", scores, reasons, opinion: SEED_OPINIONS[n % SEED_OPINIONS.length] };
}

/** 다른 위원의 이름 (평가 방식: 사정관 2인 + 위촉위원 1인) */
const PEER_REVIEWERS = ["김서연 사정관", "이준호 위촉위원"] as const;

/** 위원 한 명에게 배정된 평가 수 */
export const ASSIGNED_COUNT = APPLICANT_SOURCES.length;

/** 이준호 위촉위원이 제출을 마친 수 (평가 순서의 앞에서부터) */
const SECOND_PEER_DONE = 17;

const PEER_COMMENTS: readonly string[] = [
  "탐구 과정이 구체적이고 결과를 스스로 되짚는 태도가 좋음.",
  "교과 성취가 고르고 활동의 일관성이 보임.",
  "협업 기록은 좋으나 전공 관련 활동의 깊이는 더 확인이 필요함.",
  "기록의 근거가 충분하고 성장 흐름이 분명함.",
  "자기 주도적인 학습 태도가 여러 과목에서 확인됨.",
];

/** 배점을 똑같이 나눈 AI 종합 점수의 어림 (다른 위원의 종합 점수를 지어낼 때만 쓴다) */
function roughTotal(ai: SampleAssessments): number {
  return Math.round((ai[0].score + ai[1].score + ai[2].score + ai[3].score) / SLOT_COUNT);
}

/** 다른 위원의 의견. 김서연 사정관은 모두 제출했고, 이준호 위촉위원은 평가 순서의 앞 17명만 제출했다. */
function peersOf(n: number, position: number, ai: SampleAssessments): PeerOpinion[] {
  const base = roughTotal(ai);
  return [
    { reviewer: PEER_REVIEWERS[0], total: base + ((n % 5) - 2), comment: PEER_COMMENTS[n % PEER_COMMENTS.length] },
    position < SECOND_PEER_DONE
      ? { reviewer: PEER_REVIEWERS[1], total: base + (((n * 3) % 5) - 2), comment: PEER_COMMENTS[(n * 3 + 1) % PEER_COMMENTS.length] }
      : { reviewer: PEER_REVIEWERS[1], total: null, comment: "아직 제출하지 않았습니다." },
  ];
}

/** 로그인한 사정관에게 배정된 지원자 24명 (평가 순서 = 코드 순서) */
export const EVALUATION_APPLICANTS: readonly EvaluationApplicant[] = APPLICANT_SOURCES.map((source, position) => {
  const code = sampleApplicantCode(source.n);
  const ai = assessmentsOf(source.n);
  return {
    code,
    summary: source.summary,
    ai,
    growth: growthOf(source.n),
    passages: passagesOf(source, code),
    seed: seedOf(source.n, ai),
    peers: peersOf(source.n, position, ai),
  };
});

/** 다른 위원의 진행 현황 (제출 수 / 배정 수). 로그인한 사정관의 수는 화면이 저장한 평가로 계산한다. */
export const PEER_PROGRESS: readonly { name: string; done: number; total: number }[] = [
  { name: PEER_REVIEWERS[0], done: ASSIGNED_COUNT, total: ASSIGNED_COUNT },
  { name: PEER_REVIEWERS[1], done: SECOND_PEER_DONE, total: ASSIGNED_COUNT },
];

/**
 * 모집 단위 전체의 평가 수: 전체 312건 가운데 로그인한 사정관의 것(24건)을 뺀 나머지에서 제출을 마친 수(227건).
 * 여기에 로그인한 사정관의 제출 수를 더한 것이 전체 진행 수다(처음에는 227 + 21 = 248).
 */
export const DEPARTMENT_PROGRESS = {
  total: 312,
  othersDone: 227,
} as const;

/** 1차 평가 마감 문구 (디자인 그대로) */
export const EVALUATION_DEADLINE_TEXT = "11. 20 (금) 18:00";
