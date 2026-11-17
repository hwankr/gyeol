import type { Section } from "@/types/analysis";
import { sampleResult } from "../mock/sampleResult.ts";

/** 학생부 PDF 를 항목(Section) 단위로 나눈다. */
export async function parsePdf(file: File): Promise<Section[]> {
  // TODO: 실제 구현
  // PDF 에서 쪽별 텍스트를 뽑아 항목명(인적·학적사항 … 행동특성 및 종합의견)·학년·과목 기준으로 나누고,
  // 항목마다 원문(text)과 쪽 번호(page)를 채운다. 지금은 파일을 읽지 않고 가짜 데이터를 돌려준다.
  void file;
  return sampleResult.sections.map((section) => ({ ...section }));
}
