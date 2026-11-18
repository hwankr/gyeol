export type Competency = "학업역량" | "진로역량" | "공동체역량";

export type Section = {
  id: string;            // 예: "s3"
  category: string;      // 항목명. 파서가 준 값을 그대로 쓴다(목록으로 고정하지 않음). 예: "자율활동"
  grade: number | null;  // 학년. 해당 없으면 null
  subject?: string;      // 세부능력 및 특기사항일 때 과목명
  page: number;          // PDF 쪽 번호
  text: string;          // 원문
  fieldId?: string;      // 항목 사전의 ID (예: "S06.CLUB.remarks")
  hours?: number;        // 창의적 체험활동 영역의 시간
};

export type Evidence = {
  id: string;
  competency: Competency;
  sectionId: string;     // Section.id
  quote: string;         // 해당 Section.text 안에 글자 그대로 존재하는 문장
  reason: string;        // 이 역량의 근거인 이유
};

export type AnalysisResult = {
  sections: Section[];
  evidences: Evidence[];
};
