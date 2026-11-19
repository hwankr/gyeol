// 로그인 화면(/)에서 고르는 대학과 계정 목록.
// 실제 로그인이 아니라 계정을 고르는 모양만 있다. 고른 값은 어디에도 저장하거나 보내지 않는다.
// 값은 디자인에 적힌 것만 둔다: 대학 하나, 계정 셋(대학·계정을 지어내지 않는다). 목록을 늘려도 화면 코드는 고치지 않는다.

/** 대학에 속한 계정 하나. 선택 목록의 문구(이름 · 역할)와 안내 문구는 hooks/useLogin.ts 가 이름과 역할로 만든다. */
export type LoginAccount = {
  id: string;
  /** 이름 */
  name: string;
  /** 역할 */
  role: string;
};

/** 대학 하나와 그 대학의 계정들 */
export type LoginUniversity = {
  id: string;
  name: string;
  accounts: readonly LoginAccount[];
};

export const LOGIN_UNIVERSITIES: readonly LoginUniversity[] = [
  {
    id: "university-1",
    name: "영남대학교",
    accounts: [
      { id: "account-1", name: "홍길동", role: "입학사정관" },
      { id: "account-2", name: "김서연", role: "입학사정관" },
      { id: "account-3", name: "이준호", role: "위촉위원" },
    ],
  },
];
