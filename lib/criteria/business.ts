import type { DepartmentCriteria } from "@/types/analysis";

// 경영학과 평가 기준.
// 임시 값이다. 팀이 실제 학과 기준을 정하면 이 파일을 고친다.
export const businessCriteria: DepartmentCriteria = {
  id: "business",
  department: "경영학과",
  sourceText:
    "잠재역량(전공 관심·교과 연계·자기주도적 후속 탐구), 학업역량(자료 분석·수정·한계 인식), 공동체역량(의사소통·협업·의견 조정). 전공 관련 교과는 영어, 사회, 국어 순으로 우선한다.",
  criteria: [
    {
      id: "c1",
      name: "잠재역량",
      description:
        "전공(경영)에 대한 관심, 교과와의 연계, 스스로 이어간 후속 탐구가 드러나는 기록. 전공 관련 교과는 영어, 사회, 국어 순으로 우선해서 본다.",
    },
    {
      id: "c2",
      name: "학업역량",
      description: "자료를 분석하고, 결과를 수정·보완하고, 한계를 인식한 과정이 드러나는 기록",
    },
    {
      id: "c3",
      name: "공동체역량",
      description: "의사소통, 협업, 의견 조정이 드러나는 기록",
    },
  ],
};
