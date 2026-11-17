export type Competency = "학업역량" | "진로역량" | "공동체역량";

export type Section = {
  id: string;            // 예: "s3"
  category: string;      // 항목명. 아래 8개 중 하나
  grade: number | null;  // 학년. 해당 없으면 null
  subject?: string;      // 세부능력 및 특기사항일 때 과목명
  page: number;          // PDF 쪽 번호
  text: string;          // 원문
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
