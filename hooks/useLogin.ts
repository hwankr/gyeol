import { useState } from "react";
import { LOGIN_UNIVERSITIES, type LoginUniversity } from "@/lib/loginAccounts";

/** 대학 선택의 기본값: 목록의 첫 번째 대학 */
const DEFAULT_UNIVERSITY_ID = LOGIN_UNIVERSITIES[0]?.id ?? "";

/** "계속"을 누르면 가는 곳: 전형 준비 화면 */
const CONTINUE_PATH = "/prep";

function findUniversity(id: string): LoginUniversity | undefined {
  return LOGIN_UNIVERSITIES.find((university) => university.id === id);
}

/** 그 대학의 첫 번째 계정 id (대학을 바꾸면 계정은 그 대학의 첫 번째로 돌아간다) */
function firstAccountId(universityId: string): string {
  return findUniversity(universityId)?.accounts[0]?.id ?? "";
}

/**
 * 로그인 화면 상태: 대학·계정 선택과 "계속"이 가는 곳.
 * 실제 로그인(비밀번호·인증·세션)은 없다. 고른 값은 어디에도(localStorage·sessionStorage·쿠키·주소·API) 저장하거나
 * 보내지 않고, 다른 화면도 이 값을 쓰지 않는다. "계속"은 전형 준비 화면으로 이동만 한다(이동은 화면의 폼이 한다).
 */
export function useLogin() {
  const [universityId, setUniversityId] = useState(DEFAULT_UNIVERSITY_ID);
  const [accountId, setAccountId] = useState(() => firstAccountId(DEFAULT_UNIVERSITY_ID));

  const accounts = findUniversity(universityId)?.accounts ?? [];

  function selectUniversity(id: string) {
    setUniversityId(id);
    setAccountId(firstAccountId(id));
  }

  return {
    universities: LOGIN_UNIVERSITIES.map(({ id, name }) => ({ id, name })),
    universityId,
    accounts: accounts.map(({ id, label }) => ({ id, label })),
    accountId,
    onSelectUniversity: selectUniversity,
    onSelectAccount: setAccountId,
    continuePath: CONTINUE_PATH,
  };
}
