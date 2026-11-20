export type Section = {
  id: string;            // 예: "s3"
  category: string;      // 항목명. 파서가 준 값을 그대로 쓴다(목록으로 고정하지 않음). 예: "자율활동"
  grade: number | null;  // 학년. 해당 없으면 null
  subject?: string;      // 과목명(세부능력 및 특기사항) 또는 과목·영역(독서활동상황). 해당할 때만 있음
  page: number;          // PDF 쪽 번호
  text: string;          // 원문
  fieldId?: string;      // 항목 사전의 ID (예: "S06.CLUB.remarks")
  hours?: number;        // 창의적 체험활동 영역의 시간
};

/** 학과의 평가 기준 하나 */
export type Criterion = {
  id: string;          // 예: "c1"
  name: string;        // 예: "잠재역량"
  description: string; // 무엇을 근거로 볼지 설명
};

/** 학과 하나의 평가 기준 묶음 */
export type DepartmentCriteria = {
  id: string;          // 예: "business"
  department: string;  // 예: "경영학과"
  sourceText: string;  // 학과가 적은 원래 문장
  criteria: Criterion[];
};

export type Evidence = {
  id: string;
  criterionId: string; // Criterion.id
  sectionId: string;   // Section.id
  quote: string;       // 해당 Section.text 안에 글자 그대로 존재하는 구절
  reason: string;      // 이 구절이 해당 기준의 근거인 이유
};

/** 평가 요소 하나에 대한 AI 제안. 사정관이 평가를 시작할 때 참고하는 값이고 확정 점수가 아니다. */
export type ElementAssessment = {
  criterionId: string; // Criterion.id (c1 …). 평가 요소 순서와 같다
  score: number;       // 제안 점수 0~100 정수: 세부 평가 항목 질문마다 AI 가 고른 1~5 의 평균 × 20
  confidence: number;  // 신뢰도 1~4 정수. 1 이면 사람이 직접 확인해야 한다
  tags: string[];      // 기록이 뚜렷한 묶음의 태그 (0~2개)
};

/** 학년 하나의 성장 요약 (AI 제안) */
export type GradeGrowth = {
  grade: number;  // 1~3
  label: string;  // 그 학년 기록의 특징 (예: "기초 탐구")
  index: number;  // 그 학년 기록에 드러난 탐구·활동의 깊이 0~100 정수 (같은 학생의 학년 사이 변화를 보는 값)
};

/** 전형 준비의 평가 기준으로 분석했을 때 AI 가 만드는 제안 (lib/pipeline/assessRecord.ts) */
export type Assessment = {
  rubric: string;                // 이 제안을 만든 세부 평가 항목의 지문 (lib/prep/analysisCriteria.ts 의 rubricFingerprint)
  summary: string;               // 한 줄 요약
  elements: ElementAssessment[]; // criteria.criteria 와 같은 순서·같은 개수
  growth: GradeGrowth[];         // 1·2·3학년 순서로 세 건
};

/**
 * 학년별 연계의 카드: 한 평가 요소의 근거 가운데 같은 항목에서 같은 활동을 가리키는 것들 (AI 제안).
 * 평가하기 총평의 학년별 연계 상자가 학년 줄에 놓는다.
 */
export type LinkageCard = {
  id: string;              // 예: "k1"
  criterionId: string;     // Criterion.id
  sectionId: string;       // 이 카드의 근거가 모두 든 항목 (학년이 1~3 인 항목)
  evidenceIds: string[];   // Evidence.id, 1개 이상, 원문에 나오는 순서
  title: string;           // 활동을 가리키는 짧은 명사구
  theme: string;           // 관심 주제 태그. 없으면 빈 문자열
  depth: 1 | 2 | 3 | null; // 탐구 깊이(1 수업 참여 수준, 2 주어진 과제 안의 탐구, 3 스스로 정한 심화). AI 가 주지 않은 카드는 null
};

/** 학년별 연계의 연결: 같은 평가 요소의 앞 학년 카드 → 뒤 학년 카드 (AI 제안. 인과를 뜻하지 않는다) */
export type LinkageLink = {
  id: string;               // 예: "n1"
  criterionId: string;      // Criterion.id (두 카드의 기준과 같다)
  fromCardId: string;       // 앞 학년 카드
  toCardId: string;         // 뒤 학년 카드
  kind: "stated" | "suggested"; // 기록에 적힌 연속 / AI 가 제안한 연관
  statedQuote?: string;     // kind 가 "stated" 일 때만: 이어짐을 적은 원문 구절 (statedSectionId 항목의 text 에 글자 그대로 있다)
  statedSectionId?: string; // 그 구절이 든 항목 (앞 카드나 뒤 카드의 항목)
  reason: string;           // 이어진다고 본 까닭 한 문장
};

/** 학년별 연계 (lib/pipeline/linkEvidence.ts 가 만들고 lib/evaluate/linkage.ts 가 정리한다) */
export type Linkage = {
  cards: LinkageCard[];
  links: LinkageLink[];
};

export type AnalysisResult = {
  criteria: DepartmentCriteria;
  sections: Section[];   // 블라인드 처리(lib/pipeline/blind.ts)를 거친 항목. 가리기 전 원문은 들어 있지 않다
  evidences: Evidence[];
  masks: { type: string; count: number }[]; // 블라인드 처리 내역: 가린 정보 종류(예: "학교명")와 가린 곳 수. 가린 것이 없으면 빈 배열
  assessment?: Assessment; // AI 제안. 전형 준비의 평가 기준으로 분석했을 때만 있다(그 밖의 학과 기준으로 분석한 결과와 예전 결과에는 없다)
  /**
   * 학년별 연계. /api/analyze 의 응답에는 없고, 분석한 뒤 브라우저가 /api/linkage 로 받아 붙인다(lib/linkageClient.ts).
   * 없으면 연계가 아직 없는 분석이다(이 기능 전의 분석, 연결 찾기가 실패했거나 아직 하지 않은 분석).
   */
  linkage?: Linkage;
};
