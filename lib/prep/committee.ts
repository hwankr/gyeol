import { ADMISSION } from "../admission.ts";

// 한 모집 단위의 지원자를 함께 평가하는 위원 (평가 방식: 사정관 2인 + 위촉위원 1인. lib/admission.ts 의 methodExtra).
// 전형 준비 · 공통 기준 협의가 위원별 의견 칸을 그리는 데 쓴다. 첫 위원은 상단 바의 사정관이고, 나머지 두 사람은
// 평가하기의 다른 위원(lib/evaluate/sampleEvaluations.ts)·로그인 화면의 계정(lib/loginAccounts.ts)과 같은 이름이다.
// 로그인이 모양뿐이라 위원마다 따로 들어와 적는 것이 아니라, 이 브라우저 한 곳에서 위원별 칸에 적는다.

/** 위원 한 사람. number 는 1 부터이고, AI 에는 이름 대신 "위원 <number>" 로만 보낸다. */
export type CommitteeMember = {
  number: number;
  name: string;
  role: string;
};

export const COMMITTEE_MEMBERS: readonly CommitteeMember[] = [
  { number: 1, name: ADMISSION.reviewerName, role: ADMISSION.reviewerRole },
  { number: 2, name: "김서연", role: "사정관" },
  { number: 3, name: "이준호", role: "위촉위원" },
];

/** 화면에 적는 위원 이름: "홍길동 사정관" */
export function memberLabel(member: CommitteeMember): string {
  return `${member.name} ${member.role}`;
}

/** AI 에 보내고 의견 정리에 적히는 위원 이름: "위원 1" (사람 이름은 AI 에 보내지 않는다) */
export function memberAlias(number: number): string {
  return `위원 ${number}`;
}
