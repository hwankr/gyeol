import type { RefObject } from "react";
import Form from "next/form";
import Link from "next/link";
import { LOGIN_BUTTON_CLASS, LoginCard, LoginFrame } from "@/components/LoginFrame";
import type { ConsentTerm } from "@/lib/consentTerms";

type ConsentScreenProps = {
  /** 처리방침 요약 항목 (이름 + 설명) */
  terms: readonly ConsentTerm[];
  /** 동의 확인란에 표시했는지 (표시해야 "동의하고 계속"이 켜진다) */
  agreed: boolean;
  onAgreeChange: (agreed: boolean) => void;
  /** 동의 확인란에 붙일 ref (훅이 화면에 보이는 표시를 읽는다) */
  agreeInputRef: RefObject<HTMLInputElement | null>;
  /** "동의하고 계속" 아래 안내 문구 */
  hint: string;
  /** "동의하고 계속"을 누르면 가는 주소 (홈 화면) */
  continuePath: string;
  /** "이전 단계"가 가는 주소 (로그인 화면) */
  backPath: string;
};

/** 안내 문구 요소의 id. "동의하고 계속" 버튼의 설명(aria-describedby)으로 잇는다. */
const HINT_ID = "gyeol-consent-hint";

/**
 * 개인정보 처리방침 동의 화면 (/consent, 로그인 2단계). 디자인 시안에는 없는 화면이라 로그인 화면의 조각으로 만들었다:
 * 바탕·무늬와 왼쪽 로고·소개는 로그인 화면과 같은 조각(components/LoginFrame.tsx)을 그대로 쓰고, 오른쪽 흰 카드만 내용이 다르다
 * (단계 글, 제목, 처리방침 요약 네 항목, 동의 확인란, "동의하고 계속"과 안내 한 줄, "이전 단계"). 글자·색·치수는 로그인 화면의 값이고,
 * 확인란은 선발 결정 · 기록 확정 탭의 확인란과 같은 모양·방식이다.
 * 움직임: 로그인에서 넘어올 때 왼쪽 소개는 다시 올라오지 않고 그대로 있는 것처럼 보이며(LoginFrame 의 riseIntro 를 끄고 두 화면의 소개를
 * 한 쌍으로 묶는다), 카드만 12px 아래에서 올라오며 나타난다.
 */
export function ConsentScreen({
  terms,
  agreed,
  onAgreeChange,
  agreeInputRef,
  hint,
  continuePath,
  backPath,
}: ConsentScreenProps) {
  return (
    <LoginFrame riseIntro={false}>
      <LoginCard step="2 / 3 · 개인정보 처리방침 동의" title="개인정보 처리방침">
        {/* 항목 사이에만 가는 줄을 긋는다. */}
        <dl className="mt-[24px] rounded-[6px] border border-[#E4E4E4]">
          {terms.map((item) => (
            <div key={item.term} className="border-t border-[#E4E4E4] px-[16px] py-[12px] first:border-t-0">
              <dt className="text-[13px] leading-[18px] font-semibold">{item.term}</dt>
              <dd className="mt-[2px] text-[13px] leading-[20px] text-[#505050]">{item.description}</dd>
            </div>
          ))}
        </dl>
        {/*
          "동의하고 계속"은 로그인의 "계속"처럼 보통 HTML 폼 제출(GET, action = 홈 화면 주소)이 받친다. JS 가 준비된 뒤에는 next/form 이
          그 제출을 가로채 새로고침 없이 이동한다. 확인란에는 name 이 없어 동의 여부는 주소에 실리지 않는다. 버튼은 표시하기 전에는 꺼져 있고,
          확인란의 required 는 그래도 표시 없이 제출되는 경우(예: 버튼이 켜진 채 표시를 지운 순간)를 브라우저가 막게 한다.
        */}
        <Form className="mt-[20px] flex flex-col gap-[16px]" action={continuePath}>
          <label className="flex cursor-pointer items-start gap-[10px] text-[14px] leading-[20px]">
            {/* 진짜 확인란은 보이지 않게 두고(초점과 상태는 이것이 가진다) 옆의 네모가 모양을 그린다. */}
            <input
              ref={agreeInputRef}
              id="gyeol-consent-agree"
              type="checkbox"
              required
              checked={agreed}
              aria-describedby={HINT_ID}
              onChange={(event) => onAgreeChange(event.currentTarget.checked)}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className={`motion-colors mt-px box-border flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[4px] border peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-black ${
                agreed ? "border-[#001AD0] bg-[#001AD0]" : "border-[#001AD0] bg-[#EEF0FF]"
              }`}
            >
              {agreed && (
                <svg viewBox="0 0 12 12" fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-[12px] w-[12px]">
                  <path d="M2.5 6.3 4.9 8.6 9.5 3.6" />
                </svg>
              )}
            </span>
            <span>개인정보 처리방침을 확인했으며 이에 동의합니다. (필수)</span>
          </label>
          <button type="submit" disabled={!agreed} aria-describedby={HINT_ID} className={LOGIN_BUTTON_CLASS}>
            동의하고 계속
          </button>
          <p id={HINT_ID} className="text-[13px] leading-[18px] text-[#505050]">
            {hint}
          </p>
        </Form>
        <p className="mt-[20px] text-[13px] leading-[18px]">
          <Link href={backPath} className="text-[#505050] underline underline-offset-2 hover:text-[#111111]">
            이전 단계
          </Link>
        </p>
      </LoginCard>
    </LoginFrame>
  );
}
