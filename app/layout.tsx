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
      {/* 문서 전체는 화면 높이에 고정하고 아래 영역만 스크롤한다. 결과 화면은 이 안에서 두 단이 각자 스크롤한다. */}
      <body className="flex h-screen min-w-[1280px] flex-col overflow-hidden bg-white text-black">
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </body>
    </html>
  );
}
