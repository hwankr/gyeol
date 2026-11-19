import { useLayoutEffect, useRef, useState } from "react";
import { LOGIN_UNIVERSITIES, type LoginAccount, type LoginUniversity } from "@/lib/loginAccounts";

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

/** 선택 목록에 보여 줄 문구 (이름 · 역할) */
function accountLabel({ name, role }: LoginAccount): string {
  return `${name} · ${role}`;
}

/** "계속" 아래 안내 문구: 어느 계정으로 들어가는지. 고른 계정이 없으면(계정이 없는 대학) 비운다. */
function accountHint(account: LoginAccount | undefined): string {
  return account ? `${account.name} ${account.role} 계정으로 들어갑니다.` : "";
}

/**
 * 로그인 화면 상태: 대학·계정 선택, 고른 계정의 안내 문구, "계속"이 가는 곳.
 * 실제 로그인(비밀번호·인증·세션)은 없다. 고른 값은 어디에도(localStorage·sessionStorage·쿠키·주소·API) 저장하거나
 * 보내지 않고, 다른 화면도 이 값을 쓰지 않는다. "계속"은 전형 준비 화면으로 이동만 한다(이동은 화면의 폼이 한다).
 */
export function useLogin() {
  const [universityId, setUniversityId] = useState(DEFAULT_UNIVERSITY_ID);
  const [accountId, setAccountId] = useState(() => firstAccountId(DEFAULT_UNIVERSITY_ID));
  /** 두 선택 목록 요소 (화면에 보이는 값을 읽는 데만 쓴다) */
  const universitySelectRef = useRef<HTMLSelectElement>(null);
  const accountSelectRef = useRef<HTMLSelectElement>(null);

  // 두 선택 목록은 서버 HTML 에 이미 있어 JS 가 준비되기 전에도 고를 수 있고, 새로고침·뒤로 가기에서 브라우저가 전에 고른 값을
  // 되살리기도 한다. React 는 hydration 때 선택 목록에 보이는 값을 상태로 되돌리지 않으므로, 화면이 붙을 때 보이는 값을 읽어 상태를
  // 거기에 맞춘다. 그래야 안내 문구가 화면에 보이는 계정과 어긋나지 않는다. 보이는 값이 상태와 같으면 아무것도 바뀌지 않는다.
  useLayoutEffect(() => {
    const shownUniversity = findUniversity(universitySelectRef.current?.value ?? "");
    const shownAccountId = accountSelectRef.current?.value;
    if (shownUniversity === undefined || shownAccountId === undefined) return;
    setUniversityId(shownUniversity.id);
    // 대학을 바꿔 둔 경우에는 보이는 계정 목록이 아직 처음 대학의 것이다. 그 대학의 계정이 아니면 그 대학의 첫 번째 계정으로 둔다.
    setAccountId(
      shownUniversity.accounts.some((account) => account.id === shownAccountId)
        ? shownAccountId
        : firstAccountId(shownUniversity.id),
    );
  }, []);

  const accounts = findUniversity(universityId)?.accounts ?? [];

  function selectUniversity(id: string) {
    setUniversityId(id);
    setAccountId(firstAccountId(id));
  }

  return {
    universities: LOGIN_UNIVERSITIES.map(({ id, name }) => ({ id, name })),
    universityId,
    accounts: accounts.map((account) => ({ id: account.id, label: accountLabel(account) })),
    accountId,
    hint: accountHint(accounts.find((account) => account.id === accountId)),
    onSelectUniversity: selectUniversity,
    onSelectAccount: setAccountId,
    universitySelectRef,
    accountSelectRef,
    continuePath: CONTINUE_PATH,
  };
}
