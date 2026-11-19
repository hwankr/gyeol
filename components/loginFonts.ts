import localFont from "next/font/local";

// 로그인 화면(/)만 쓰는 글꼴. 업로드·결과 화면은 와이어프레임이라 웹 글꼴을 쓰지 않으므로,
// 루트 레이아웃이 아니라 로그인 화면 컴포넌트에서만 가져온다(그 화면의 CSS 에만 @font-face 가 들어간다).
// 파일은 저장소의 fonts/ 에 있고 라이선스(SIL OFL 1.1) 원문을 같은 폴더에 둔다. 빌드·실행에 외부 글꼴 서버가 필요 없다.
// 대체 글꼴은 디자인 순서 그대로 두려고 next/font 가 만드는 Arial 대체 글꼴(adjustFontFallback)을 끈다.

/**
 * 본문 글꼴 Pretendard (굵기 400·500·600·700). 디자인 파일의 글꼴을 그대로 쓴다.
 * 파일 하나가 약 780KB 라서 미리 불러오기(preload)는 끈다. CSS 가 문서 머리에 있어 곧바로 내려받기 시작하고,
 * 그동안은 대체 글꼴로 글자를 먼저 보여 준다(swap).
 */
export const pretendard = localFont({
  src: [
    { path: "../fonts/pretendard/Pretendard-400.woff2", weight: "400", style: "normal" },
    { path: "../fonts/pretendard/Pretendard-500.woff2", weight: "500", style: "normal" },
    { path: "../fonts/pretendard/Pretendard-600.woff2", weight: "600", style: "normal" },
    { path: "../fonts/pretendard/Pretendard-700.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  preload: false,
  fallback: ["Apple SD Gothic Neo", "Malgun Gothic", "sans-serif"],
  adjustFontFallback: false,
});

/** 로고 글자 "Gyeol" 의 글꼴 Mulish (굵기 500, 라틴 글자). 파일이 작고(약 13KB) 화면에서 가장 큰 글자라 미리 불러온다. */
export const mulish = localFont({
  src: "../fonts/mulish/mulish-latin-500-normal.woff2",
  weight: "500",
  style: "normal",
  display: "swap",
  preload: true,
  fallback: ["sans-serif"],
  adjustFontFallback: false,
});
