// 사이드바·상단 바·전형 준비 화면이 그리는 대학·전형·사정관 값.
// 디자인에 적힌 값과 코디네이터가 정한 값(.orchestration/prep-applicants-pages/specs/T1-data.json 의 admission)을 글자 그대로 옮겼다.
// 모집 인원은 디자인의 38 이 아니라 30 이다(지원자 관리 디자인의 "모집 인원 30명", "경쟁률 10.5:1" 과 맞춘 값).
// 전형은 하나뿐이라 전형 선택 버튼은 기능이 없다.

export const ADMISSION = {
  /** 대학 이름 (사이드바) */
  university: "영남대학교",
  /** 시스템 이름 (사이드바) */
  systemName: "2027학년도 입시 관리 시스템",
  /** 전형 선택 버튼에 보이는 전형 이름 */
  trackShort: "학생부종합(일반)",
  /** 전형 요약 카드의 전형 */
  trackFull: "2027 수시 · 학생부종합 (일반학생)",
  /** 모집 단위와 덧붙이는 글 */
  unit: "컴퓨터공학과",
  unitExtra: "외 45개",
  /** 모집 인원(명)과 덧붙이는 글 */
  quota: 30,
  quotaTotalText: "전형 전체 412명",
  /** 평가 방식 */
  methodMain: "서류",
  methodPercent: "100%",
  methodExtra: "사정관 2인 + 위촉위원 1인",
  /** 상단 바의 소속과 사정관 */
  office: "영남대학교 입학처",
  reviewerName: "홍길동",
  reviewerRole: "사정관",
} as const;

/** 바꾼 사람으로 기록에 남기는 이름 (예: "홍길동 사정관") */
export const REVIEWER_LABEL = `${ADMISSION.reviewerName} ${ADMISSION.reviewerRole}`;
