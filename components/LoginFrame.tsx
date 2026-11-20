import { ViewTransition, type ReactNode } from "react";
import { GyeolLogo } from "@/components/GyeolLogo";
import { pretendard } from "@/components/loginFonts";

// 소개 문단. 따옴표는 디자인 원문 그대로(‘ U+2018 와 ' U+0027)다.
const INTRO =
  "AI 활용 입시평가제도 보조 및 관리 서비스를 제공하는 입학사정 지원도구 ‘결'은 학생이 그동안 쌓아온 기록의 ‘결'을 읽고, 대학이 원하는 인재상의 ‘결'을 맞추기 위해 다음과 같은 기능을 제안합니다.";

const FEATURES = [
  { term: "개인정보 보호", description: "이름·출신학교·지역·부모 정보는 평가 화면에 나타나지 않습니다." },
  { term: "정확한 근거", description: "AI가 제안한 점수에는 항상 학생부 원문 문장이 연결됩니다." },
  { term: "꾸준한 기록", description: "열람·수정·확정은 모두 이력으로 남습니다." },
] as const;

type LoginFrameProps = {
  /**
   * 화면이 나타날 때 왼쪽 소개가 12px 아래에서 올라오는지. 로그인 화면은 올라오고, 로그인 다음 단계(개인정보 처리방침 동의)는
   * 로그인에서 넘어올 때 소개가 그대로 있는 것처럼 보이도록 올라오지 않는다.
   */
  riseIntro: boolean;
  /** 오른쪽에 놓을 흰 카드 (LoginCard) */
  children: ReactNode;
};

/**
 * 로그인 단계 화면(로그인 /, 개인정보 처리방침 동의 /consent)이 같이 쓰는 틀. 짙은 남색 바탕과 무늬, 왼쪽의 로고·소개 문단·세 항목,
 * 오른쪽 카드 자리가 있다. 화면 폭에 맞춰 늘고 줄며, 좁으면 두 덩어리가 위아래로 쌓이고 내용이 길면 문서가 세로로 스크롤된다.
 * 치수·색·글자는 로그인 디자인 값을 그대로 쓴다. 바탕 글자(14px, 줄 높이 20px, #111111)는 바깥 상자에 두고 각 글자가 필요한 값만 바꾼다.
 *
 * 왼쪽 소개는 이름 붙인 <ViewTransition>(login-intro) 안에 있다. 로그인 ↔ 동의처럼 두 화면에 모두 소개가 있는 이동에서는 React 가
 * 두 소개를 한 쌍으로 묶어 같은 자리에서 겹쳐 바꾸므로(글이 같아 움직이지 않는 것처럼 보인다) 화면 전체의 겹쳐 바뀜(page-cover)에
 * 섞여 옅어지지 않는다. 짝이 없는 이동(로그인 → 홈 등)에서는 이름이 쓰이지 않아 전과 같다. 화면 안의 상태 변화에는 움직이지 않는다(default="none").
 */
export function LoginFrame({ riseIntro, children }: LoginFrameProps) {
  return (
    // 넓게 깐 무늬 층을 overflow-hidden 으로 잘라 내서 무늬 때문에 스크롤 영역이 늘지 않는다.
    <div
      className={`${pretendard.className} relative box-border flex min-h-screen flex-wrap items-center overflow-hidden bg-[#000947] text-[14px] leading-[20px] break-keep text-[#111111]`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-[60%] rotate-[15.4deg] bg-[url(/login-pattern.svg)] bg-size-[75px_260px]"
      />

      <ViewTransition name="login-intro" share="auto" default="none">
        <div className="relative box-border min-w-0 flex-[1_1_480px] p-[clamp(32px,6vw,88px)] text-white">
          <div className={`max-w-[480px] ${riseIntro ? "animate-rise-in" : ""}`}>
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
      </ViewTransition>

      <main className="relative box-border flex min-w-0 flex-[1_1_480px] items-center justify-center px-[24px] py-[48px]">
        {children}
      </main>
    </div>
  );
}

type LoginCardProps = {
  /** 카드 맨 위의 단계 글 (예: "1 / 3 · 계정 선택") */
  step: string;
  /** 카드 제목 (h1) */
  title: string;
  children: ReactNode;
};

/** 오른쪽 흰 카드 (최대 440px, 안쪽 36px): 단계 글, 제목, 그 아래 내용. 화면이 나타날 때 12px 아래에서 올라오며 나타난다(90ms 늦게. CSS 라서 JS 를 기다리지 않는다). */
export function LoginCard({ step, title, children }: LoginCardProps) {
  return (
    <div className="box-border w-full max-w-[440px] animate-rise-in rounded-[8px] bg-white p-[36px] [animation-delay:90ms]">
      <p className="text-[13px] leading-[18px] font-medium text-[#505050]">{step}</p>
      <h1 className="mt-[6px] text-[26px] leading-[34px] font-bold tracking-[-0.01em]">{title}</h1>
      {children}
    </div>
  );
}

/** "계속" 류의 주 버튼 모양 (높이 48px, #000947). 마우스를 올리면 색이 조금 바뀐다. 꺼지면(disabled) 옅은 회색 바탕에 회색 글자이고 올려놓음·누름 색이 걸리지 않는다. */
export const LOGIN_BUTTON_CLASS =
  "motion-colors mt-[8px] box-border flex h-[48px] w-full cursor-pointer items-center justify-center rounded-[6px] border border-[#000947] bg-[#000947] p-0 text-[15px] font-semibold text-white hover-on:border-[#1A2259] hover-on:bg-[#1A2259] press-on:border-[#00062E] press-on:bg-[#00062E] disabled:cursor-default disabled:border-[#E4E6EE] disabled:bg-[#E4E6EE] disabled:text-[#505050]";
