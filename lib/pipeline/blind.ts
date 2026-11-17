import type { Section } from "@/types/analysis";

/** 항목 원문에서 이름·학교명·주민등록번호·주소 같은 식별 정보를 가린다. */
export async function blind(sections: Section[]): Promise<Section[]> {
  // TODO: 실제 구현
  // 항목 text 에서 식별 정보를 찾아 ●●● 로 바꾼다. 근거의 quote 가 가린 뒤의 원문과 글자 그대로 맞도록
  // 근거 추출(extractEvidence)보다 먼저 실행해야 한다. 지금은 가짜 데이터가 이미 가려져 있어 그대로 돌려준다.
  return sections;
}
