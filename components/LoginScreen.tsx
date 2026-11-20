import type { RefObject } from "react";
import Form from "next/form";
import { LOGIN_BUTTON_CLASS, LoginCard, LoginFrame } from "@/components/LoginFrame";

type LoginScreenProps = {
  /** 대학 선택 목록 */
  universities: { id: string; name: string }[];
  /** 선택한 대학 id */
  universityId: string;
  /** 선택한 대학의 계정 목록 */
  accounts: { id: string; label: string }[];
  /** 선택한 계정 id */
  accountId: string;
  /** "계속" 아래 안내 문구 (어느 계정으로 들어가는지) */
  hint: string;
  onSelectUniversity: (universityId: string) => void;
  onSelectAccount: (accountId: string) => void;
  /** 두 선택 목록 요소에 붙일 ref (훅이 화면에 보이는 값을 읽는다) */
  universitySelectRef: RefObject<HTMLSelectElement | null>;
  accountSelectRef: RefObject<HTMLSelectElement | null>;
  /** "계속"을 누르면 가는 주소 (로그인 2단계: 개인정보 처리방침 동의 화면) */
  continuePath: string;
};

/** 안내 문구 요소의 id. "계속" 버튼의 설명(aria-describedby)으로 잇는다. */
const HINT_ID = "gyeol-login-hint";

/**
 * 로그인 화면 (/). 왼쪽은 로고와 소개, 오른쪽 흰 카드는 계정 선택이다. 바탕·왼쪽 소개·카드 틀은 다음 단계 화면(개인정보 처리방침 동의)과
 * 같이 쓰는 조각(components/LoginFrame.tsx)이다. 치수·색·글자는 디자인 값을 그대로 쓴다.
 * 움직임(디자인 시안에 없어 정한 것): 화면이 나타날 때 소개와 카드가 12px 아래에서 올라오며 나타난다(카드는 90ms 늦게. CSS 라서 JS 를 기다리지 않는다).
 * "계속" 과 선택 목록은 마우스를 올리면 색이 조금 바뀐다.
 */
export function LoginScreen({
  universities,
  universityId,
  accounts,
  accountId,
  hint,
  onSelectUniversity,
  onSelectAccount,
  universitySelectRef,
  accountSelectRef,
  continuePath,
}: LoginScreenProps) {
  return (
    <LoginFrame riseIntro>
      <LoginCard step="1 / 3 · 계정 선택" title="로그인">
        {/*
          "계속"은 보통 HTML 폼 제출(GET, action = 동의 화면 주소)이 받친다. 그래서 버튼이 보이는 어느 순간에 눌러도
          (HTML 을 받는 도중, JS 가 도착하기 전, hydration 도중) 브라우저가 동의 화면으로 이동한다(문서 이동, 주소 끝에 빈 "?").
          JS 가 준비된 뒤에는 next/form 이 그 제출을 가로채 새로고침 없이 이동한다(주소는 정확히 동의 화면 주소).
          두 선택 목록에는 name 이 없어 고른 값은 주소에 실리지 않는다.
        */}
        <Form className="mt-[24px] flex flex-col gap-[16px]" action={continuePath}>
          <SelectField
            id="gyeol-university"
            label="대학"
            value={universityId}
            options={universities.map(({ id, name }) => ({ value: id, label: name }))}
            onChange={onSelectUniversity}
            selectRef={universitySelectRef}
          />
          <SelectField
            id="gyeol-account"
            label="계정"
            value={accountId}
            options={accounts.map(({ id, label }) => ({ value: id, label }))}
            onChange={onSelectAccount}
            selectRef={accountSelectRef}
          />
          {/* 디자인의 "계속"은 링크 모양(가운데 놓인 글자, 안쪽 여백 없음)이다. 같은 모양을 제출 버튼에 준다. */}
          <button
            type="submit"
            aria-describedby={HINT_ID}
            className={LOGIN_BUTTON_CLASS}
          >
            계속
          </button>
          <p id={HINT_ID} className="text-[13px] leading-[18px] text-[#505050]">
            {hint}
          </p>
        </Form>
      </LoginCard>
    </LoginFrame>
  );
}

type SelectFieldProps = {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  selectRef: RefObject<HTMLSelectElement | null>;
};

/** 이름표와 선택 목록. 선택 목록은 브라우저 기본 모양(화살표 포함)에 크기·테두리·글자만 디자인 값으로 준다. */
function SelectField({ id, label, value, options, onChange, selectRef }: SelectFieldProps) {
  return (
    <div className="flex flex-col gap-[6px]">
      <label htmlFor={id} className="text-[13px] leading-[18px] font-semibold">
        {label}
      </label>
      {/* 줄 높이는 디자인이 따로 정하지 않아 브라우저 기본값(normal)이 쓰인 것을 그대로 맞춘다. */}
      <select
        ref={selectRef}
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="motion-colors m-0 box-border h-[44px] w-full cursor-pointer rounded-[6px] border border-[#CFCFCF] bg-white px-[12px] py-0 text-[15px] leading-[normal] text-[#111111] hover:border-[#AEAEAE]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
