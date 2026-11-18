// 로그인 화면(/)에서 고르는 대학과 계정 목록.
// 실제 로그인이 아니라 계정을 고르는 모양만 있다. 고른 값은 어디에도 저장하거나 보내지 않는다.
// 값은 디자인에 적힌 표시 문구 하나씩만 둔다(대학·계정을 지어내지 않는다). 목록을 늘려도 화면 코드는 고치지 않는다.

/** 대학에 속한 계정 하나 */
export type LoginAccount = {
  id: string;
  /** 선택 목록에 보여 줄 문구 (이름 · 역할) */
  label: string;
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
    accounts: [{ id: "account-1", label: "홍길동 · 입학사정관" }],
  },
];
