// "새 학과 기준 만들기"에 바로 넣어 볼 수 있는 예시 문장.
// 기능을 써 보려고 지어낸 문장이다. 실제 대학·학과의 평가 기준이 아니다.
// 학과 이름은 50자, 문장은 2,000자 이하여야 한다(lib/criteria/limits.ts).

/** 예시 하나: 학과 이름과 학과가 보고 싶은 점을 적은 문장 */
export type CriteriaExample = {
  department: string;
  sourceText: string;
};

/** 업로드 화면의 "기준 문장 예시" 영역에 이 순서대로 보여 준다. 학과 이름은 서로 달라야 한다(목록의 key 로 쓴다). */
export const CRITERIA_EXAMPLES: readonly CriteriaExample[] = [
  {
    department: "컴퓨터공학과",
    sourceText:
      "컴퓨터공학과는 수학과 정보 교과에서 드러나는 논리적 사고력과 문제 해결 과정을 가장 중요하게 본다. 스스로 주제를 정해 끝까지 탐구한 경험, 그리고 팀 프로젝트에서 맡은 역할과 협업 태도도 본다.",
  },
];
