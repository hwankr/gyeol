import { useLayoutEffect, useRef, useState } from "react";
import { HOME_PATH } from "@/lib/consoleMenu";
import { CONSENT_TERMS } from "@/lib/consentTerms";

/** "동의하고 계속"을 누르면 가는 곳: 홈 화면 */
const CONTINUE_PATH = HOME_PATH;

/** "이전 단계"가 가는 곳: 로그인 화면 (로그인 1단계) */
const BACK_PATH = "/";

/**
 * 개인정보 처리방침 동의 화면(로그인 2단계) 상태: 처리방침 요약, 동의 확인란, 버튼 아래 안내 문구, 가는 곳.
 * 로그인처럼 모양뿐이다. 동의 여부는 이 화면의 React 상태 하나이고 어디에도(localStorage·sessionStorage·쿠키·주소·API) 저장하거나
 * 보내지 않는다. 홈 화면도 동의를 확인하지 않아 주소로 바로 열어도 막지 않는다. "동의하고 계속"은 홈 화면으로 이동만 한다(이동은 화면의 폼이 한다).
 */
export function useConsent() {
  const [agreed, setAgreed] = useState(false);
  /** 동의 확인란 요소 (화면에 보이는 표시를 읽는 데만 쓴다) */
  const agreeInputRef = useRef<HTMLInputElement>(null);

  // 확인란은 서버 HTML 에 이미 있어 JS 가 준비되기 전에도 누를 수 있고, 새로고침·뒤로 가기에서 브라우저가 전의 표시를 되살리기도 한다.
  // React 는 hydration 때 확인란의 표시를 상태로 되돌리지 않으므로, 화면이 붙을 때 보이는 표시를 읽어 상태를 거기에 맞춘다(useLogin 과 같다).
  // 그래야 버튼이 켜졌는지와 안내 문구가 화면에 보이는 확인란과 어긋나지 않는다.
  useLayoutEffect(() => {
    const shown = agreeInputRef.current?.checked;
    if (shown !== undefined) setAgreed(shown);
  }, []);

  return {
    terms: CONSENT_TERMS,
    agreed,
    onAgreeChange: setAgreed,
    agreeInputRef,
    hint: agreed ? "홈 화면으로 이동합니다." : "동의에 표시하면 계속할 수 있습니다.",
    continuePath: CONTINUE_PATH,
    backPath: BACK_PATH,
  };
}
