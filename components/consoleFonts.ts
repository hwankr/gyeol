import localFont from "next/font/local";

// 새 화면(전형 준비 등, app/(console)/)이 쓰는 글꼴. 로그인 화면의 글꼴 선언(components/loginFonts.ts)과 같은 방식이다.
// 로그인 화면 선언을 고치면 그 화면의 글꼴 이름(계산된 font-family)이 바뀌므로 건드리지 않고 따로 선언한다.
// 이 파일은 새 화면 껍데기(components/ConsoleShell.tsx)에서만 가져온다. 그래서 @font-face 와 미리 불러오기가 그 화면들에만 들어가고,
// 로그인 화면이 내려받는 글꼴은 늘지 않으며 업로드·결과 화면은 글꼴을 내려받지 않는다.
// 대체 글꼴은 디자인 순서 그대로 두려고 next/font 가 만드는 Arial 대체 글꼴(adjustFontFallback)을 끈다.

/**
 * 본문 글꼴 Pretendard (굵기 400·500·600·700·800). 디자인 파일의 글꼴을 그대로 쓴다.
 * 파일 하나가 약 780KB 라서 미리 불러오기(preload)는 끈다. 다섯 파일(약 3.9MB)을 미리 불러오면 화면 코드(JS)와 대역폭을 다투고,
 * 끄면 CSS 가 문서 머리에 있어 글자를 그릴 때 실제로 쓰는 굵기만 곧바로 내려받는다. 그동안은 대체 글꼴로 먼저 보여 준다(swap).
 */
export const consolePretendard = localFont({
  src: [
    { path: "../fonts/pretendard/Pretendard-400.woff2", weight: "400", style: "normal" },
    { path: "../fonts/pretendard/Pretendard-500.woff2", weight: "500", style: "normal" },
    { path: "../fonts/pretendard/Pretendard-600.woff2", weight: "600", style: "normal" },
    { path: "../fonts/pretendard/Pretendard-700.woff2", weight: "700", style: "normal" },
    { path: "../fonts/pretendard/Pretendard-800.woff2", weight: "800", style: "normal" },
  ],
  display: "swap",
  preload: false,
  fallback: ["Apple SD Gothic Neo", "Malgun Gothic", "sans-serif"],
  adjustFontFallback: false,
});

/** 로고 글자 "Gyeol" 의 글꼴 Mulish (굵기 500, 라틴 글자). 파일이 작아(약 13KB) 미리 불러온다. */
export const consoleMulish = localFont({
  src: "../fonts/mulish/mulish-latin-500-normal.woff2",
  weight: "500",
  style: "normal",
  display: "swap",
  preload: true,
  fallback: ["sans-serif"],
  adjustFontFallback: false,
});
