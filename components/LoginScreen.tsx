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
  onSelectUniversity: (universityId: string) => void;
  onSelectAccount: (accountId: string) => void;
  /** "계속"을 누르면 가는 주소 (업로드 화면) */
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

/**
 * 로그인 화면 (/). 왼쪽은 로고와 소개, 오른쪽 카드는 계정 선택이다.
 * 화면 폭에 맞춰 늘고 줄며, 좁으면 두 덩어리가 위아래로 쌓이고 내용이 길면 문서가 세로로 스크롤된다.
 * 치수·색·글자는 디자인 값을 그대로 쓴다. 줄 높이는 디자인(브라우저 기본 normal)에 맞춰 바깥 상자에서 normal 로 되돌린다.
 */
export function LoginScreen({
  universities,
  universityId,
  accounts,
  accountId,
  onSelectUniversity,
  onSelectAccount,
  continuePath,
}: LoginScreenProps) {
  return (
    // 넓게 깐 무늬 층을 overflow-hidden 으로 잘라 내서 무늬 때문에 스크롤 영역이 늘지 않는다.
    <div
      className={`${pretendard.className} relative box-border flex min-h-screen flex-wrap items-center gap-x-[40px] gap-y-[48px] overflow-hidden bg-[#000947] pt-[clamp(32px,6.95vw,100px)] pr-[clamp(20px,5.56vw,80px)] pb-[clamp(32px,6.95vw,100px)] pl-[clamp(24px,7.99vw,115px)] leading-[normal] break-keep text-white`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-[60%] rotate-[15.4deg] bg-[url(/login-pattern.svg)] bg-size-[75px_260px]"
      />

      <div className="relative min-w-0 flex-[1_1_360px]">
        <GyeolLogo />
        <p className="mt-[51px] max-w-[500px] text-[16px] leading-[24px] font-light text-white">{INTRO}</p>
        <dl className="mt-[87px] flex flex-col gap-[28px]">
          {FEATURES.map((feature) => (
            <div key={feature.term} className="flex flex-wrap gap-x-0 gap-y-[4px] leading-[24px]">
              <dt className="flex-[0_0_124px] text-[16px] font-bold text-[#D6D6D6]">{feature.term}</dt>
              <dd className="min-w-0 flex-[1_1_240px] text-[15px] font-normal text-[#D6D6D6]">{feature.description}</dd>
            </div>
          ))}
        </dl>
      </div>

      <main className="relative box-border min-w-0 max-w-[640px] flex-[1_1_480px] rounded-[12px] bg-white px-[clamp(24px,5.83vw,84px)] pt-[clamp(48px,12.36vw,178px)] pb-[clamp(48px,11.8vw,170px)] text-[#111111]">
        <p className="text-[13px] leading-[16px] font-bold text-[#767676]">1 / 3 · 계정 선택</p>
        <h1 className="mt-[6px] text-[32px] leading-[40px] font-bold tracking-[-0.02em] text-[#111111]">로그인</h1>
        {/*
          "계속"은 보통 HTML 폼 제출(GET, action = 업로드 화면 주소)이 받친다. 그래서 버튼이 보이는 어느 순간에 눌러도
          (HTML 을 받는 도중, JS 가 도착하기 전, hydration 도중) 브라우저가 업로드 화면으로 이동한다(문서 이동, 주소 끝에 빈 "?").
          JS 가 준비된 뒤에는 next/form 이 그 제출을 가로채 새로고침 없이 이동한다(주소는 정확히 업로드 화면 주소).
          두 선택 목록에는 name 이 없어 고른 값은 주소에 실리지 않는다.
        */}
        <Form className="mt-[34px] flex flex-col gap-[24px]" action={continuePath}>
          <SelectField
            id="gyeol-university"
            label="대학"
            value={universityId}
            options={universities.map(({ id, name }) => ({ value: id, label: name }))}
            onChange={onSelectUniversity}
          />
          <SelectField
            id="gyeol-account"
            label="계정"
            value={accountId}
            options={accounts.map(({ id, label }) => ({ value: id, label }))}
            onChange={onSelectAccount}
          />
          {/* 안쪽 여백(1px 6px)은 디자인이 따로 정하지 않아 브라우저 기본값이 쓰인 것을 그대로 맞춘다. */}
          <button
            type="submit"
            className="mt-[66px] box-border h-[78px] w-full cursor-pointer rounded-[4px] border-0 bg-[#000947] px-[6px] py-px text-[20px] font-bold text-white"
          >
            계속
          </button>
        </Form>
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
};

/** 이름표와 선택 목록. 브라우저 기본 선택 목록의 모양을 지우고(appearance-none) 위아래 화살표를 겹친다. */
function SelectField({ id, label, value, options, onChange }: SelectFieldProps) {
  return (
    <div className="flex flex-col gap-[8px]">
      <label htmlFor={id} className="text-[20px] leading-[28px] font-bold text-[#505050]">
        {label}
      </label>
      <div className="relative">
        {/* 오른쪽 안쪽 여백(60px)이 화살표 자리라서 긴 문구도 화살표와 겹치지 않는다. */}
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="m-0 box-border block h-[58px] w-full cursor-pointer appearance-none rounded-[6px] border-2 border-[#BBBBBB] bg-white py-0 pr-[60px] pl-[28px] text-[16px] font-normal text-[#767676]"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <svg
          aria-hidden="true"
          viewBox="0 0 12 20"
          className="pointer-events-none absolute top-1/2 right-[34px] -mt-[10px] h-[20px] w-[12px]"
        >
          <path
            fill="none"
            stroke="#131927"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M1 6.5L6 1.5L11 6.5M1 13.5L6 18.5L11 13.5"
          />
        </svg>
      </div>
    </div>
  );
}
