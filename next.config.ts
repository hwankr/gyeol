import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // 개발 실행 화면 왼쪽 아래의 Next.js 로고 버튼을 숨긴다(와이어프레임 규칙: 로고·아이콘 없음).
  // 컴파일·실행 오류 표시는 그대로 나온다.
  devIndicators: false,
};

export default nextConfig;
