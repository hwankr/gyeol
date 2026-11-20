// 개인정보 처리방침 동의 화면(/consent)에 보여 주는 처리방침 요약. 화면 코드(components/ConsentScreen.tsx)와 나눠 글만 둔다.
// 발표 시연용 요약이라 실제 처리방침 전문이 아니다. 동의 여부는 어디에도 저장하지 않는다(hooks/useConsent.ts).

/** 처리방침 요약 한 항목: 이름과 설명 */
export type ConsentTerm = {
  term: string;
  description: string;
};

export const CONSENT_TERMS: readonly ConsentTerm[] = [
  { term: "처리 목적", description: "입학전형 서류평가의 운영과 평가 이력 관리" },
  { term: "처리 항목", description: "계정 정보(이름·소속·역할)와 열람·수정·확정 기록" },
  { term: "보유 기간", description: "해당 학년도 입학전형 자료의 보존 기간까지" },
  {
    term: "지원자 정보 보호",
    description: "평가 화면의 지원자 정보는 평가 목적으로만 이용하고 외부로 옮기지 않습니다.",
  },
];
