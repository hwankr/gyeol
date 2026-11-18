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

export type AnalysisResult = {
  criteria: DepartmentCriteria;
  sections: Section[];   // 블라인드 처리(lib/pipeline/blind.ts)를 거친 항목. 가리기 전 원문은 들어 있지 않다
  evidences: Evidence[];
  masks: { type: string; count: number }[]; // 블라인드 처리 내역: 가린 정보 종류(예: "학교명")와 가린 곳 수. 가린 것이 없으면 빈 배열
};
