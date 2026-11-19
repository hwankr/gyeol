import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SERVICE_NAME } from "@/lib/constants";
import "./globals.css";

export const metadata: Metadata = {
  title: SERVICE_NAME,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko">
      {/*
        모든 화면이 같이 쓰는 것만 둔다. 로그인 화면(/)과 새 화면(app/(console)/)은 화면 폭에 맞춰 늘고 줄며 내용이 길면 문서가 스크롤된다.
        루트 레이아웃을 둘로 나누면 화면 사이 이동이 새로고침이 되므로 하나로 둔다.
      */}
      <body className="bg-white text-black">{children}</body>
    </html>
  );
}
