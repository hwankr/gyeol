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
  sections: Section[];
  evidences: Evidence[];
};
