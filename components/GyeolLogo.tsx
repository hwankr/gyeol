import { mulish } from "@/components/loginFonts";

/**
 * 로그인 화면의 로고: 곡선 세 개 무늬와 로고 글자 "Gyeol".
 * 크기는 글자 크기를 따른다(무늬·간격이 em 단위). 로고 글자는 서비스 이름 상수(SERVICE_NAME)와 따로 적는다.
 */
export function GyeolLogo() {
  return (
    <div className="flex items-center gap-[0.45em] text-[length:clamp(60px,7.08vw,102px)] leading-none">
      <svg aria-hidden="true" viewBox="0 0 107 147" className="h-[0.96em] w-[0.7em] flex-none">
        <path fill="#FFFFFF" d="M0 0A53.5 53.5 0 0 0 107 0L91 0Q85.5 0 85.1 5A32 32 0 0 1 21.9 5Q21.5 0 16 0Z" />
        <path
          fill="#FFFFFF"
          d="M0 46.75A53.5 53.5 0 0 0 107 46.75L91 46.75Q85.5 46.75 85.1 51.75A32 32 0 0 1 21.9 51.75Q21.5 46.75 16 46.75Z"
        />
        <path
          fill="#FFFFFF"
          d="M0 93.5A53.5 53.5 0 0 0 107 93.5L91 93.5Q85.5 93.5 85.1 98.5A32 32 0 0 1 21.9 98.5Q21.5 93.5 16 93.5Z"
        />
      </svg>
      {/* 글자를 무늬와 눈으로 가운데가 맞게 조금 올린다(디자인 값). */}
      <span className={`${mulish.className} relative -top-[0.123em] font-medium tracking-[-0.01em]`}>Gyeol</span>
    </div>
  );
}
