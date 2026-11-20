import type { AnalysisResult } from "@/types/analysis";
import { sampleApplicantCode } from "../applicants/sampleApplicants.ts";

// 평가하기 화면의 지원자 형식과 예시 자료.
// 형식(EvaluationApplicant)은 예시 지원자와 올린 지원자(학생부 올리기 화면에서 분석한 학생부, ./uploadedEvaluation.ts)가 같이 쓴다.
// 예시 자료: 로그인한 사정관에게 배정된 지원자 24명의 AI 한 줄 요약, 학년별 성장 요약, 서류 원문(가려진 학생부 문장)과
// AI 가 근거로 쓴 문장, 평가 요소 자리별 AI 점수·신뢰도, 처음 평가 상태, 다른 위원의 진행 현황.
// 실제 지원자·학교·지명이 아니다. 모집 단위가 경영학과라 요약·원문·점수는 경영학과 지원자의 모습으로 지어낸 임시 값이다
// (디자인 시안은 컴퓨터공학과 지원자의 예시였다). 위원별 진행 수(21·24·17 / 24, 전체 248 / 312)와 마감 문구, 처음 상태의 짜임
// (21명 제출 완료, A-0133 평가 중, A-0187 임시 저장, A-0251 대기), A-0187 의 학년별 성장 요약은 디자인에 적힌 그대로다.
// A-0118 은 선발 결정의 예시 지원자(lib/decision/sampleDecision.ts)와 겹치는 한 명이다(평가하기에서 그 지원자의 원문과 내 평가를
// 다시 볼 수 있게). 한 줄 요약, AI 점수, 내 점수(= 선발 결정의 위원 1), 다른 위원 두 명(= 위원 2·3)의 의견은 선발 결정의 값과
// 같게 적었다(scripts/check-decision.ts 가 확인한다).
// 난수·현재 시각을 쓰지 않고 지원자 번호로 계산해 늘 같은 결과가 나온다. 예시 지원자의 값은 AI 가 만든 것이 아니다.

/**
 * 예시 자료의 평가 요소 자리(0~2). 기본 평가 기준(lib/prep/defaultCriteria.ts)의 잠재역량·학업역량·공동체역량 순서다.
 * 예시 자료는 요소 id 가 아니라 자리로 적어 두고, 화면이 지금 평가 기준의 요소에 차례로 맞춘다(요소가 셋보다 많으면 자리를 돌려 쓴다).
 * 올린 지원자는 분석할 때의 평가 요소 순번이 자리다(요소 수만큼 있다).
 */
export type Slot = 0 | 1 | 2;

export const SLOT_COUNT = 3;

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
  /** 올린 지원자만: 이 원문인 학생부 항목의 id 와 PDF 쪽 번호 (원문보기에서 실제 PDF 의 자리를 여는 데 쓴다) */
  origin?: { sectionId: string; page: number };
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

/**
 * 근거 문장 하나: 출처("2학년 · 세특 · 경제"), 문장, AI 가 적은 이유(올린 지원자만).
 * - place: 이 문장이 있는 서류 원문(Passage.id)과 그 원문 글에서의 범위 [start, end). 서류 원문에서 이 근거의 자리로 가는 데 쓴다.
 *   원문에서 구절을 찾지 못한 근거(올린 지원자)에는 없다.
 * - origin: 올린 지원자만. 분석 결과의 근거 id 와 그 근거가 든 학생부 항목의 id (실제 PDF 에서 자리를 찾는 열쇠. lib/recordPages.ts)
 */
export type ApplicantEvidence = {
  id: string;
  source: string;
  text: string;
  reason?: string;
  place?: { passageId: string; start: number; end: number };
  origin?: { evidenceId: string; sectionId: string };
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
  scores: readonly [number, number, number];
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
  /** 자리별 AI 제안. 예시 지원자는 셋, 올린 지원자는 분석할 때의 평가 요소 수만큼이다. */
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

/** 예시 지원자의 자리별 AI 제안 (자리 셋) */
type SampleAssessments = readonly [SlotAssessment, SlotAssessment, SlotAssessment];

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
// 지원자 관리 화면에 보이는 내 담당 지원자(lib/applicants/sampleApplicants.ts 의 MY_NUMBERS)와 같은 사람들이어야 한다
// (scripts/check-applicants.ts 가 확인한다).
// 근거 문장의 자리: 0 잠재역량(전공 관련 활동 및 탐색, 전공 관련 교과 이수, 자기주도성) · 1 학업역량(탐구력, 학습 태도, 기초학업역량) ·
// 2 공동체역량(사회역량, 개인역량).
const APPLICANT_SOURCES: readonly ApplicantSource[] = [
  {
    n: 4,
    summary: "가격 변화에 따른 수요를 설문 자료로 분석해 본 탐구형 학생",
    key: [2, "경제", "수요와 공급 단원에서 ", ["학교 매점의 간식 가격을 바꾸었을 때 사려는 마음이 어떻게 달라지는지 설문해 수요 곡선을 직접 그림.", 0], " ", ["응답이 한 학년에 치우친 점을 스스로 짚고 표본을 다시 나누어 조사한 뒤 결과를 견줌.", 1]],
  },
  {
    n: 9,
    summary: "학급 회의를 이끌며 갈등을 조정한 경험이 있는 학생",
    key: [2, "사회·문화", "모둠 토의에서 ", ["의견이 갈린 두 모둠원의 주장을 표로 나란히 정리해 공통점을 먼저 찾도록 이끎.", 2], " 토의 결과를 바탕으로 ", ["세대 갈등을 다룬 설문 문항을 직접 만들어 학급에서 조사하고 결과를 보고서로 정리함.", 1]],
  },
  {
    n: 15,
    summary: "경제 동아리에서 또래 학습을 꾸준히 이끈 학생",
    key: [2, "경제", ["환율 변동이 수출 기업의 이익에 미치는 영향을 기사 사례로 설명하는 발표 자료를 스스로 정리함.", 0], " ", ["친구들이 자주 헷갈리는 개념을 모아 풀이 순서를 나눈 학습지를 만들어 함께 풀었음.", 2], " 수업 뒤에도 질문을 받아 끝까지 설명하는 모습이 꾸준함."],
  },
  {
    n: 21,
    summary: "기업 사례 분석을 한 학기 동안 꾸준히 기록한 학생",
    key: [2, "경제", ["관심 있는 기업 세 곳의 가격 전략을 기사와 공시 자료로 조사해 차이를 표로 비교함.", 0], " ", ["조사마다 막힌 지점과 보완한 방법을 학습 일지에 적어 한 학기 동안 이어 감.", 1], " 같은 사례를 다른 관점에서 다시 살펴보는 습관이 돋보임."],
  },
  {
    n: 26,
    summary: "영어 원서 읽기와 번역 활동을 3년간 이어 온 학생",
    key: [3, "영어 독해와 작문", ["경영 분야 영어 원서를 읽고 장마다 핵심 내용을 우리말로 옮겨 요약 노트를 만듦.", 0], " 번역이 어색한 문장은 ", ["여러 표현을 견주어 보고 까닭을 적어 두는 등 스스로 기준을 세워 고쳐 나감.", 1]],
  },
  {
    n: 33,
    summary: "창업 동아리에서 시장 조사를 맡아 대회를 준비한 학생",
    key: [2, "사회문제 탐구", "지역 상권을 다룬 과제에서 ", ["학교 주변 가게 스무 곳의 업종과 영업 시간을 직접 조사해 채워지지 않은 수요를 찾는 과정을 설명함.", 0], " ", ["조사한 가게가 한쪽 거리에 몰린 문제를 구역을 나누어 다시 조사하는 방법으로 스스로 보완함.", 1]],
  },
  {
    n: 38,
    summary: "통계 자료로 학교 급식 만족도를 조사해 발표한 학생",
    key: [2, "확률과 통계", ["급식 만족도 설문을 설계하고 학년별 표본을 나누어 조사한 뒤 결과를 상자 그림으로 나타냄.", 1], " ", ["조사 결과를 영양 교사에게 전달하고 개선 의견을 학급에 다시 알리는 과정을 맡음.", 2]],
  },
  {
    n: 42,
    summary: "독서 기록과 토론 활동이 고르게 쌓인 학생",
    key: [2, "독서", ["기업과 사회를 다룬 책 세 권을 읽고 저자의 주장을 견주는 서평을 씀.", 0], " 이어진 토론에서 ", ["상대의 근거를 다시 정리해 준 뒤 자신의 반론을 펴는 방식으로 논의를 이끎.", 2], " 읽은 내용을 다른 교과의 발표에도 꾸준히 활용함."],
  },
  {
    n: 47,
    summary: "물가 자료를 직접 그래프로 정리해 해석한 학생",
    key: [2, "경제", ["한 달 동안 같은 가게의 품목별 가격을 기록하고 변화를 그래프로 그려 물가 지수와의 관계를 해석함.", 0], " ", ["기록이 빠진 날의 값을 주변 날짜로 어림하는 방법의 한계를 스스로 짚어 보고서에 적음.", 1]],
  },
  {
    n: 53,
    summary: "봉사 활동에서 어르신 금융 교육을 기획한 학생",
    key: [2, "기술·가정", "생활 속 소비 단원에서 ", ["어르신이 휴대 전화로 은행 일을 볼 때 겪는 어려움을 조사해 단계별 안내 자료를 만듦.", 0], " ", ["모둠원과 역할을 나누어 안내 자료를 시연하고 받은 의견을 반영해 고침.", 2]],
  },
  {
    n: 58,
    summary: "경제 개념을 글로 풀어 쓰는 데 강점이 있는 학생",
    key: [3, "화법과 작문", ["기회비용 개념을 일상 사례로 풀어 쓴 설명문을 작성하고 개념이 잘못 쓰인 기사 문장을 직접 찾아 고침.", 0], " ", ["글의 각 문단이 왜 필요한지 묻는 친구의 질문에 예를 들어 답함.", 2]],
  },
  {
    n: 67,
    summary: "모의 창업 과제를 기획부터 보고서까지 맡은 학생",
    key: [2, "통합사회", ["모의 창업 과제에서 판매 품목과 가격을 직접 정하고 예상 비용과 수익을 표로 비교함.", 0], " ", ["예상과 다른 판매 결과가 나오자 가격을 바꾸어 다시 운영하고 차이를 보고서에 정리함.", 1], " 운영 과정을 모둠원에게 나누어 설명함."],
  },
  {
    n: 72,
    summary: "동아리 회비 관리 방식을 직접 고안해 운영한 학생",
    key: [2, "정보", ["동아리 회비의 수입과 지출을 기록하는 표 양식을 만들고 항목을 스스로 설계함.", 0], " ", ["써 본 부원들의 불편을 모아 입력 단계를 줄이는 방향으로 두 차례 고침.", 2]],
  },
  {
    n: 79,
    summary: "사회 문제를 데이터로 살펴 정책을 제안해 본 학생",
    key: [2, "통합사회", ["공공 자료에서 지역별 대중교통 이용 자료를 내려받아 배차 간격과 이용량의 관계를 살핌.", 1], " ", ["분석 결과를 바탕으로 노선 조정안을 만들어 모둠 발표를 이끎.", 2]],
  },
  {
    n: 85,
    summary: "경제 개념을 영상으로 설명해 또래 학습을 도운 학생",
    key: [2, "경제", ["비교 우위를 두 나라의 생산 사례로 확인하고 교역 전후의 이익을 계산해 견줌.", 1], " ", ["설명 과정을 짧은 영상으로 만들어 학급에 공유하고 질문에 답하는 시간을 맡음.", 2]],
  },
  {
    n: 91,
    summary: "학교 신문 편집을 맡아 협업 과정을 조율한 학생",
    key: [2, "언어와 매체", ["기사 초안을 서로 읽고 고치는 절차를 정해 모둠의 마감 일정을 조율함.", 2], " ", ["같은 사건을 다룬 기사 두 편의 표현 차이를 분석해 매체의 관점을 설명하는 글을 씀.", 1]],
  },
  {
    n: 98,
    summary: "기업의 사회적 책임을 주제로 토론과 글쓰기를 이어 간 학생",
    key: [3, "생활과 윤리", ["기업의 이윤 추구와 사회적 책임이 부딪친 사례를 들어 책임의 범위를 따져 보는 글을 씀.", 0], " ", ["같은 사례를 두고 주주와 소비자의 입장이 달라지는 까닭을 경제 교과에서 배운 내용으로 설명함.", 1]],
  },
  {
    n: 104,
    summary: "미적분 개념을 경제 현상에 적용해 본 융합형 학생",
    key: [3, "미적분", ["한계 비용을 도함수로 설명하고 생산량에 따른 이윤 변화를 그래프로 나타냄.", 1], " ", ["수학에서 배운 최적화 문제를 경제 교과의 사례와 이어 발표하는 등 교과를 넘나드는 시도가 돋보임.", 0]],
  },
  {
    n: 110,
    summary: "교내 매점 판매 자료로 재고 문제를 살펴본 학생",
    key: [2, "사회문제 탐구", ["매점의 요일별 판매량을 한 달 동안 기록해 품목별로 남는 양을 정리함.", 0], " ", ["행사 주간 전후의 값을 견주어 주문량을 조정하자고 제안하는 보고서를 씀.", 1]],
  },
  {
    n: 118,
    summary: "영어·사회 교과 성취가 높고 탐구 보고서가 충실한 학생",
    key: [2, "영어Ⅰ", "사회·문화 시간에 배운 공정 무역 개념과 이어, ", ["공정 무역 인증 제품을 다룬 영어 기사 여러 편을 읽고 인증 기준과 소비자 가격의 관계를 탐구 보고서로 정리함.", 0], " ", ["기사마다 수치의 출처를 확인하고 서로 다른 값은 표로 나란히 놓아 어느 자료가 더 믿을 만한지 근거를 들어 밝힘.", 1]],
  },
  {
    n: 124,
    summary: "모의 투자 활동에서 손실 원인을 끈질기게 분석한 학생",
    key: [2, "경제", ["모의 투자에서 수익률이 예상보다 낮게 나오자 종목 선택과 사고판 시점을 하나씩 되짚어 원인을 찾음.", 0], " ", ["판단을 바꿀 때마다 근거와 결과를 표로 기록해 분산 투자의 중요성을 보고서에 정리함.", 1]],
  },
  {
    n: 133,
    summary: "영어 교과 성취가 꾸준하고 동아리 운영 경험이 있는 학생",
    key: [2, "영어Ⅰ", ["해외 기업의 광고 문구를 읽고 문화권에 따라 표현이 달라지는 까닭을 영어로 직접 써서 설명함.", 1], " ", ["단원이 끝날 때마다 틀린 문제의 원인을 유형별로 나누어 정리하는 습관을 한 학기 내내 이어 감.", 1], " 모둠 활동에서는 ", ["풀이가 막힌 친구에게 답이 아니라 다음 단계의 실마리를 건네는 방식으로 도움.", 2]],
  },
  {
    n: 187,
    summary: "소비 자료 탐구를 가격 전략 제안으로 넓힌 자기주도형 학생",
    key: [2, "경제", "시장 가격 단원에서 ", ["학교 매점의 품목별 판매 자료를 직접 모아 가격과 판매량의 관계를 표로 정리함.", 1], " ", ["판매가 준 원인을 가격 인상으로 가설을 세운 뒤 묶음 할인안을 만들어 다시 조사함.", 1], " 탐구 과정을 보고서로 정리해 발표하고, ", ["친구들의 질문에 자료를 들어 차분히 답함.", 2]],
  },
  {
    n: 251,
    summary: "지역 상권 문제를 판매 기획으로 풀어 본 실행형 학생",
    key: [2, "사회문제 탐구", "지역 문제 해결 과제에서 ", ["전통 시장의 주말 방문객을 늘리는 꾸러미 상품의 구성과 가격을 설계하고 상인을 만나 직접 다듬음.", 0], " ", ["사 본 사람들의 의견을 모아 구성과 가격을 고치는 등 두 차례 개선함.", 0], " 발표에서는 ", ["모둠원이 맡은 부분을 차례로 소개하며 역할을 고르게 나눔.", 2]],
  },
];

/** 상세 값이 정해진 지원자의 둘째 세특 원문 (번호 → 원문). 없는 지원자는 아래 묶음에서 번호로 고른다. */
const SECOND_DETAIL_PASSAGES: Readonly<Record<number, PassageSource>> = {
  133: [3, "확률과 통계", ["동아리 부원 수와 활동 시간 자료로 평균과 분산을 구해 운영 계획을 세우는 데 활용함.", 0], " 발표 자료를 만들 때 ", ["표본이 적어 결론을 일반화하기 어렵다는 점을 스스로 밝힘.", 1]],
  187: [3, "영어 독해와 작문", ["해외 유통 기업의 가격 정책을 다룬 영어 기사를 읽고 핵심 내용을 요약해 발표함.", 0], " 이어진 자유 주제 탐구에서 ", ["지역 전통 시장의 요일별 방문 자료를 모아 할인 행사 시기를 제안하는 계획을 스스로 설계함.", 0], " ", ["예측이 빗나간 날을 따로 모아 원인을 살피는 등 결과의 한계를 스스로 짚음.", 1]],
  251: [3, "확률과 통계", ["판매 기록을 요일별로 나누어 평균과 변화율을 계산하고 방문이 몰리는 시간대를 그래프로 나타냄.", 1], " ", ["계산 결과가 직관과 다를 때 자료를 다시 살펴 입력 오류를 찾아냄.", 1]],
};

/** 둘째 세특 원문 묶음 (번호로 고른다) */
const DETAIL_POOL: readonly PassageSource[] = [
  [3, "경제", ["시장 실패 단원에서 외부 효과의 사례를 지역 기사에서 직접 찾아 해결 방안을 견주어 설명함.", 0], " 과제를 일찍 마친 뒤 ", ["반대 사례를 스스로 찾아 자신의 주장에 빠진 조건을 보완함.", 1]],
  [1, "통합사회", ["시장 경제 단원에서 가정의 한 달 지출을 조사해 줄일 수 있는 항목을 계산으로 보임.", 1], " ", ["조사 과정에서 생긴 궁금증을 다음 탐구 주제로 이어 가는 모습이 보임.", 0]],
  [3, "사회문제 탐구", ["청소년의 소비 습관을 설문으로 조사하고 응답을 항목별로 나누어 비율을 직접 계산해 봄.", 1], " ", ["탐구 계획을 스스로 세우고 중간 점검 때마다 방향을 고쳐 끝까지 마무리함.", 0]],
  [1, "영어", ["기업 소개 글을 읽고 핵심 표현을 정리해 자신이 생각한 가상 상품의 소개문을 영어로 씀.", 0], " ", ["같은 글을 다르게 옮긴 친구의 표현과 견주어 장단점을 발표함.", 2]],
  [3, "영어 독해와 작문", ["세계 경제를 다룬 영어 기사에 실린 통계를 다시 읽으며 글쓴이의 결론이 어디까지 맞는지 살핌.", 1], " ", ["기사와 다른 자료를 스스로 찾아 견주고 차이가 나는 까닭을 정리함.", 0]],
  [1, "국어", ["설명문 쓰기에서 경제 개념을 비유로 풀어 쓴 글을 완성하고 친구의 조언을 받아 두 번 고쳐 씀.", 1], " ", ["모둠 글쓰기에서는 맡은 부분을 먼저 마치고 다른 모둠원의 문장을 다듬는 일을 도움.", 2]],
  [3, "정치와 법", ["소비자 보호 제도 단원에서 약관 분쟁 사례를 찾아 쟁점을 표로 정리함.", 1], " ", ["사례를 기업과 소비자의 입장으로 나누어 살피고 기업이 고칠 점을 제안함.", 0]],
];

/** 창체 원문 묶음 (번호로 고른다) */
const ACTIVITY_POOL: readonly PassageSource[] = [
  [2, "동아리활동", ["동아리 부장으로 한 해 활동 계획을 세우고 부원의 관심사에 맞추어 모둠을 나눔.", 2], " ", ["발표회를 앞두고 일정이 밀리자 역할을 다시 나누어 기한 안에 마무리함.", 2]],
  [1, "자율활동", ["학급 규칙을 정하는 회의에서 사회를 맡아 모든 의견이 한 번씩 다루어지도록 진행함.", 2], " 학급 행사에서는 ", ["준비물 목록을 만들어 빠진 것이 없도록 스스로 챙김.", 2]],
  [2, "진로활동", ["관심 분야의 직업인을 조사하고 필요한 역량을 자신의 학습 계획과 견주어 보고서를 씀.", 0], " ", ["조사 뒤 경제 교과 선택 과목을 스스로 정해 이수 계획을 세움.", 0]],
  [3, "동아리활동", ["후배 부원에게 경제 기사 읽는 법을 가르치는 시간을 만들어 한 학기 동안 운영함.", 2], " ", ["활동 결과물을 전시회에 내기 위해 설명 자료를 직접 만듦.", 0]],
  [2, "봉사활동", ["도서관 책 정리 봉사에 꾸준히 참여하며 찾기 쉬운 배열 방법을 제안함.", 2], " ", ["처음 참여한 친구에게 일을 나누어 설명해 함께 마침.", 2]],
  [1, "진로활동", ["진로 탐색 시간에 경영 분야의 진로를 조사하고 관련 책을 읽어 소감을 발표함.", 0], " ", ["발표 뒤 받은 질문을 정리해 다음 탐구 주제로 삼음.", 1]],
];

/**
 * 번호로 고르지 않고 정해 둔 창체 원문 (번호 → 묶음 순번). A-0118 은 번호로 고르면 동아리 부장 기록(공동체역량 근거 둘)이 되어
 * 약점(공동체 활동 기록이 적음)과 어긋나므로 진로활동을 쓴다. 그래서 A-0118 의 공동체역량 근거는 행특의 한 문장뿐이다.
 */
const FIXED_ACTIVITY_PICKS: Readonly<Record<number, number>> = {
  118: 5,
};

/** 행특 원문 묶음 (번호로 고른다). 학년은 3학년이다. */
const BEHAVIOR_POOL: readonly PassageSource[] = [
  [3, "행동특성 및 종합의견", ["맡은 일을 끝까지 해내는 책임감이 강하고 약속한 기한을 어기는 일이 없음.", 2], " ", ["어려워하는 친구에게 먼저 다가가 설명해 주어 학급에서 믿음이 두터움.", 2]],
  [3, "행동특성 및 종합의견", ["새로운 과제가 주어지면 스스로 계획을 세워 시도해 보는 진취적인 태도를 지님.", 0], " 수업 태도가 한결같고 ", ["질문을 통해 이해를 넓혀 가는 학습 습관이 자리 잡혀 있음.", 1]],
  [3, "행동특성 및 종합의견", ["학급 일에 앞장서면서도 다른 사람의 의견을 끝까지 듣고 조율하는 모습이 돋보임.", 2], " ", ["실수했을 때 원인을 돌아보고 같은 실수를 되풀이하지 않으려 노력함.", 1]],
  [3, "행동특성 및 종합의견", ["관심 분야를 깊이 파고드는 끈기가 있고 알게 된 것을 친구들과 나누기를 즐김.", 0], " ", ["모둠 활동에서 궂은일을 먼저 맡아 분위기를 이끎.", 2]],
  [3, "행동특성 및 종합의견", ["규칙과 약속을 잘 지키고 주변을 배려하는 태도가 몸에 배어 있음.", 2], " ", ["학습 계획을 스스로 세워 꾸준히 실천하며 성적이 고르게 오름.", 1]],
  [3, "행동특성 및 종합의견", ["의견이 다른 친구와도 차분히 대화하여 합의점을 찾는 힘이 있음.", 2], " ", ["호기심이 많아 수업에서 생긴 궁금증을 스스로 찾아 해결함.", 1]],
];

/** 학년별 교과 과목 (교과 원문은 과목과 성취도를 계산해 만든다). 전공 관련 교과(영어·사회·국어)가 학년마다 들어 있다. */
const GRADE_SUBJECTS: readonly (readonly string[])[] = [
  ["국어", "수학", "영어", "통합사회", "한국사"],
  ["문학", "수학Ⅰ", "영어Ⅰ", "경제", "사회·문화"],
  ["화법과 작문", "확률과 통계", "영어 독해와 작문", "정치와 법", "사회문제 탐구"],
];

/** 성취도: 번호·학년·과목 순번으로 정한다 (A 가 가장 많고 C 는 드물다) */
function achievementOf(n: number, gradeIndex: number, subjectIndex: number): string {
  const value = (n * (3 + subjectIndex) + gradeIndex * 5 + subjectIndex * 7) % 10;
  return value < 6 ? "A" : value < 9 ? "B" : "C";
}

/**
 * 번호로 계산하지 않고 정해 둔 성취도 (번호 → 학년별, GRADE_SUBJECTS 와 같은 자리). A-0118 은 번호로 계산하면 영어Ⅰ 등 절반이 C 라
 * 요약(영어·사회 교과 성취가 높음)과 어긋나므로 수학만 B 이고 나머지는 A 로 둔다.
 */
const FIXED_ACHIEVEMENTS: Readonly<Record<number, readonly (readonly string[])[]>> = {
  118: [
    ["A", "B", "A", "A", "A"],
    ["A", "B", "A", "A", "A"],
    ["A", "B", "A", "A", "A"],
  ],
};

/** 교과 원문 세 건(학년마다 한 건). 2학년 줄은 학업역량 자리(기초학업역량)의 근거다. */
function subjectPassages(code: string, n: number, withEvidence: boolean): Passage[] {
  return GRADE_SUBJECTS.map((subjects, gradeIndex) => {
    const text = subjects
      .map((subject, index) => `${subject} ${FIXED_ACHIEVEMENTS[n]?.[gradeIndex][index] ?? achievementOf(n, gradeIndex, index)}`)
      .join(" · ");
    const segment: PassageSegment = { text, slots: withEvidence && gradeIndex === 1 ? [1] : [] };
    return {
      id: `${code}-subject-${gradeIndex + 1}`,
      area: "교과",
      grade: (gradeIndex + 1) as 1 | 2 | 3,
      subject: "교과 성취도",
      segments: [segment],
    };
  });
}

/** 근거 표시를 뺀 원문 (A-0187 의 창체·행특은 근거로 삼지 않는다. 근거가 세특 두 건에만 있는 지원자의 모습이다) */
function withoutEvidence(passage: Passage): Passage {
  return { ...passage, segments: passage.segments.map((segment) => ({ text: segment.text, slots: [] })) };
}

/** 지원자 한 명의 서류 원문: 교과 3건, 세특 2건, 창체 1건, 행특 1건 */
function passagesOf(source: ApplicantSource, code: string): Passage[] {
  const { n } = source;
  // A-0187 은 세특 두 건만 근거로 쓴다(근거 수: 잠재역량 2, 학업역량 3, 공동체역량 1).
  const detailOnly = n === 187;
  const second = SECOND_DETAIL_PASSAGES[n] ?? DETAIL_POOL[(n * 5) % DETAIL_POOL.length];
  const activity = toPassage(`${code}-activity`, "창체", ACTIVITY_POOL[FIXED_ACTIVITY_PICKS[n] ?? (n * 3) % ACTIVITY_POOL.length]);
  const behavior = toPassage(`${code}-behavior`, "행특", BEHAVIOR_POOL[(n * 7) % BEHAVIOR_POOL.length]);
  return [
    ...subjectPassages(code, n, !detailOnly),
    toPassage(`${code}-detail-1`, "세특", source.key),
    toPassage(`${code}-detail-2`, "세특", second),
    detailOnly ? withoutEvidence(activity) : activity,
    detailOnly ? withoutEvidence(behavior) : behavior,
  ];
}

/** 번호로 계산하지 않고 정해 둔 AI 점수 (잠재역량·학업역량·공동체역량 순서) */
const FIXED_AI_SCORES: Readonly<Record<number, readonly [number, number, number]>> = {
  15: [86, 85, 88],
  42: [88, 87, 86],
  67: [82, 79, 76],
  // 선발 결정의 A-0118 과 같은 값
  118: [83, 88, 72],
  133: [80, 84, 82],
  187: [88, 85, 78],
  251: [86, 80, 82],
};

/** A-0187 의 신뢰도(3·2·1)와 태그(전공활동탐색·자기주도성 / 탐구력·학습태도 / 사회역량). 공동체역량은 근거가 하나뿐이라 신뢰도가 낮다. */
const FIXED_CONFIDENCE: Readonly<Record<number, readonly [1 | 2 | 3 | 4, 1 | 2 | 3 | 4, 1 | 2 | 3 | 4]>> = {
  187: [3, 2, 1],
};

const FIXED_TAG_PICKS: Readonly<Record<number, readonly (readonly number[])[]>> = {
  187: [[0, 2], [0, 1], [0]],
};

const CONFIDENCE_CYCLE: readonly (1 | 2 | 3 | 4)[] = [3, 2, 4, 3, 2, 3, 4, 1];

/** 자리별 AI 제안. 점수는 72~90, 신뢰도는 위 순서를 돌려 쓴다(1 은 드물다). */
function assessmentsOf(n: number): SampleAssessments {
  const slots = [0, 1, 2].map((slot): SlotAssessment => {
    const score = FIXED_AI_SCORES[n]?.[slot] ?? 72 + ((n * (7 + 3 * slot) + 11 * slot) % 19);
    const confidence = FIXED_CONFIDENCE[n]?.[slot] ?? CONFIDENCE_CYCLE[(n + 3 * slot) % CONFIDENCE_CYCLE.length];
    const tagPicks = FIXED_TAG_PICKS[n]?.[slot] ?? ((n + slot) % 2 === 0 ? [n + slot, n + slot + 1] : [n + slot]);
    return { score, confidence, tagPicks };
  });
  return slots as unknown as SampleAssessments;
}

/** 학년별 성장 이름표 (디자인 그대로) */
const GROWTH_LABELS = ["기초 탐구", "심화 · 프로젝트", "융합 · 확장"] as const;

/** 학년별 성장 요약. A-0187 은 디자인 값(52·74·88, 2·3·3건)이고 나머지는 번호로 계산한다(지수는 학년이 오를수록 커진다). 건수는 근거 수와 따로 적은 값이다. */
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
  "근거 문장은 충분하나 공동체역량 영역의 사례가 다소 적음.",
];

/** 제출을 마친 지원자의 내 점수가 AI 점수와 다른 자리의 차이 (번호로 고른다. 0 이면 AI 점수 그대로) */
const SEED_DELTAS: readonly number[] = [0, 2, 0, -1, 0, 1, 0];

const SEED_REASON_UP = "근거 문장 밖의 활동 기록까지 살펴 조금 올림";
const SEED_REASON_DOWN = "근거가 한 과목에 치우쳐 있어 조금 낮춤";

/** AI 점수를 정해 둔 지원자 가운데 제출을 마친 세 명은 AI 점수 그대로 제출한 것으로 둔다 */
const SEED_WITHOUT_DELTA: readonly number[] = [15, 42, 67];

/** 아직 남은 지원자의 처음 상태 */
const PENDING_SEEDS: Readonly<Record<number, EvaluationSeed | null>> = {
  // 평가 중: 두 자리를 고쳤고 그중 하나(잠재역량)는 아직 수정 사유를 적지 않았다(기본 배점에서 내 종합 점수 83).
  133: {
    status: "editing",
    scores: [82, 85, 82],
    reasons: { 1: "오답을 유형별로 정리해 온 기록을 반영해 1점 올림" },
    opinion: "",
  },
  // 임시 저장: 공동체역량 한 자리를 고치고 사유를 적었다(내 점수 88·85·81, 기본 배점에서 내 종합 점수 86).
  187: {
    status: "draft",
    scores: [88, 85, 81],
    reasons: { 2: "동아리 후배 지도 경험을 반영해 3점 올림" },
    opinion: "",
  },
  251: null,
};

/**
 * 번호로 계산하지 않고 정해 둔 제출 완료 상태. A-0118 은 선발 결정의 위원 1(로그인한 사정관)의 점수와 종합 의견 그대로다
 * (기본 배점에서 내 종합 점수 80.1). 세 자리 모두 AI 점수(83·88·72)와 달라 자리마다 수정 사유가 있다.
 */
const SUBMITTED_SEEDS: Readonly<Record<number, EvaluationSeed>> = {
  118: {
    status: "submitted",
    scores: [82, 89, 62],
    reasons: {
      0: "교과 밖의 전공 관련 활동이 적어 1점 낮춤",
      1: "영어·사회 교과 성취와 보고서의 논리를 반영해 1점 올림",
      2: "공동체 활동의 근거 문장이 한 건뿐이라 10점 낮춤",
    },
    opinion: "교과 성취는 높으나 공동체 활동 기록이 거의 없음. 혼자 하는 탐구에 치우쳐 있음.",
  },
};

function seedOf(n: number, ai: SampleAssessments): EvaluationSeed | null {
  if (Object.hasOwn(PENDING_SEEDS, n)) return PENDING_SEEDS[n];
  if (Object.hasOwn(SUBMITTED_SEEDS, n)) return SUBMITTED_SEEDS[n];
  const scores: [number, number, number] = [ai[0].score, ai[1].score, ai[2].score];
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
  return Math.round((ai[0].score + ai[1].score + ai[2].score) / SLOT_COUNT);
}

/**
 * 번호로 지어내지 않고 정해 둔 다른 위원의 의견 (김서연 사정관, 이준호 위촉위원 순서).
 * A-0118 은 선발 결정의 위원 2·3 의 종합 의견 그대로이고, total 은 그 위원의 점수(85·92·78, 82·89·64)를 기본 배점(50·30·20)으로
 * 가중 평균해 반올림한 값이다(85.7 → 86, 80.5 → 81).
 */
const FIXED_PEERS: Readonly<Record<number, readonly [PeerOpinion, PeerOpinion]>> = {
  118: [
    {
      reviewer: PEER_REVIEWERS[0],
      total: 86,
      comment: "전공 관련 교과 성취가 매우 높고 탐구 보고서의 논리가 탄탄함. 활동이 적은 점은 학업으로 충분히 보완됨.",
    },
    { reviewer: PEER_REVIEWERS[1], total: 81, comment: "보고서의 완성도가 높음. 공동체 활동은 근거가 적어 낮게 평가함." },
  ],
};

/**
 * 이준호 위촉위원이 평가 순서의 앞 17명 가운데 아직 제출하지 않은 지원자.
 * A-0118 은 평가 순서의 20번째라 앞 17명 규칙으로는 미제출이지만 선발 결정의 위원 3 점수가 있어야 하므로 제출한 것으로 두고
 * (FIXED_PEERS), 그만큼 앞 17명의 마지막(17번째) A-0098 을 미제출로 돌린다. 그래서 제출 수는 그대로 SECOND_PEER_DONE(17)이다
 * (scripts/check-decision.ts 가 확인한다).
 */
const SECOND_PEER_BEHIND = 98;

/**
 * 다른 위원의 의견. 김서연 사정관은 모두 제출했고, 이준호 위촉위원은 평가 순서의 앞 17명만 제출했다(A-0118 과 A-0098 만 자리를
 * 바꾼다. 위 SECOND_PEER_BEHIND).
 */
function peersOf(n: number, position: number, ai: SampleAssessments): PeerOpinion[] {
  const fixed = FIXED_PEERS[n];
  if (fixed !== undefined) return [...fixed];
  const base = roughTotal(ai);
  const secondDone = position < SECOND_PEER_DONE && n !== SECOND_PEER_BEHIND;
  return [
    { reviewer: PEER_REVIEWERS[0], total: base + ((n % 5) - 2), comment: PEER_COMMENTS[n % PEER_COMMENTS.length] },
    secondDone
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
