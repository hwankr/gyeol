import type { RefObject } from "react";
import Form from "next/form";
import { GyeolLogo } from "@/components/GyeolLogo";
import { pretendard } from "@/components/loginFonts";

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
  /** "계속"을 누르면 가는 주소 (홈 화면) */
  continuePath: string;
};

// 소개 문단. 따옴표는 디자인 원문 그대로(‘ U+2018 와 ' U+0027)다.
const INTRO =
  "AI 활용 입시평가제도 보조 및 관리 서비스를 제공하는 입학사정 지원도구 ‘결'은 학생이 그동안 쌓아온 기록의 ‘결'을 읽고, 대학이 원하는 인재상의 ‘결'을 맞추기 위해 다음과 같은 기능을 제안합니다.";

const FEATURES = [
  { term: "개인정보 보호", description: "이름·출신학교·지역·부모 정보는 평가 화면에 나타나지 않습니다." },
  { term: "정확한 근거", description: "AI가 제안한 점수에는 항상 학생부 원문 문장이 연결됩니다." },
  { term: "꾸준한 기록", description: "열람·수정·확정은 모두 이력으로 남습니다." },
] as const;

/** 안내 문구 요소의 id. "계속" 버튼의 설명(aria-describedby)으로 잇는다. */
const HINT_ID = "gyeol-login-hint";

/**
 * 로그인 화면 (/). 왼쪽은 로고와 소개, 오른쪽 흰 카드는 계정 선택이다.
 * 화면 폭에 맞춰 늘고 줄며, 좁으면 두 덩어리가 위아래로 쌓이고 내용이 길면 문서가 세로로 스크롤된다.
 * 치수·색·글자는 디자인 값을 그대로 쓴다. 바탕 글자(14px, 줄 높이 20px, #111111)는 바깥 상자에 두고 각 글자가 필요한 값만 바꾼다.
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
    // 넓게 깐 무늬 층을 overflow-hidden 으로 잘라 내서 무늬 때문에 스크롤 영역이 늘지 않는다.
    <div
      className={`${pretendard.className} relative box-border flex min-h-screen flex-wrap items-center overflow-hidden bg-[#000947] text-[14px] leading-[20px] break-keep text-[#111111]`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-[60%] rotate-[15.4deg] bg-[url(/login-pattern.svg)] bg-size-[75px_260px]"
      />

      <div className="relative box-border min-w-0 flex-[1_1_480px] p-[clamp(32px,6vw,88px)] text-white">
        <div className="max-w-[480px] animate-rise-in">
          {/* 로고 그림 높이 48px 은 바뀌기 전 로고(56px 글자)의 대문자 높이에 맞춘 값이다. 상자 높이 56px 은 그대로라 아래 간격이 바뀌지 않는다. */}
          <div className="flex h-[56px] items-center">
            <GyeolLogo className="h-[48px] text-white" />
          </div>
          <p className="mt-[32px] text-[16px] leading-[26px]">{INTRO}</p>
          {/* 항목마다 위에 가는 줄을 긋고, 마지막 항목은 아래에도 긋는다. */}
          <dl className="mt-[32px] flex flex-col">
            {FEATURES.map((feature) => (
              <div
                key={feature.term}
                className="flex flex-wrap gap-x-[16px] gap-y-[4px] border-t border-[rgba(255,255,255,0.28)] py-[14px] last:border-b"
              >
                <dt className="flex-[0_0_112px] text-[14px] leading-[22px] font-semibold">{feature.term}</dt>
                <dd className="flex-[1_1_240px] text-[14px] leading-[22px]">{feature.description}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <main className="relative box-border flex min-w-0 flex-[1_1_480px] items-center justify-center px-[24px] py-[48px]">
        <div className="box-border w-full max-w-[440px] animate-rise-in rounded-[8px] bg-white p-[36px] [animation-delay:90ms]">
          <p className="text-[13px] leading-[18px] font-medium text-[#505050]">1 / 3 · 계정 선택</p>
          <h1 className="mt-[6px] text-[26px] leading-[34px] font-bold tracking-[-0.01em]">로그인</h1>
          {/*
            "계속"은 보통 HTML 폼 제출(GET, action = 홈 화면 주소)이 받친다. 그래서 버튼이 보이는 어느 순간에 눌러도
            (HTML 을 받는 도중, JS 가 도착하기 전, hydration 도중) 브라우저가 홈 화면으로 이동한다(문서 이동, 주소 끝에 빈 "?").
            JS 가 준비된 뒤에는 next/form 이 그 제출을 가로채 새로고침 없이 이동한다(주소는 정확히 홈 화면 주소).
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
              className="motion-colors mt-[8px] box-border flex h-[48px] w-full cursor-pointer items-center justify-center rounded-[6px] border border-[#000947] bg-[#000947] p-0 text-[15px] font-semibold text-white hover-on:border-[#1A2259] hover-on:bg-[#1A2259] press-on:border-[#00062E] press-on:bg-[#00062E]"
            >
              계속
            </button>
            <p id={HINT_ID} className="text-[13px] leading-[18px] text-[#505050]">
              {hint}
            </p>
          </Form>
        </div>
      </main>
    </div>
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
