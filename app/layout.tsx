import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SERVICE_NAME, WIREFRAME_BANNER } from "@/lib/constants";
import "./globals.css";

export const metadata: Metadata = {
  title: SERVICE_NAME,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko">
      {/* 문서 전체는 스크롤하지 않고 띠 아래 영역만 스크롤한다. 그래서 띠는 항상 보인다. */}
      <body className="flex h-screen min-w-[1280px] flex-col overflow-hidden bg-white text-black">
        <div className="shrink-0 border-b border-neutral-400 bg-neutral-200 px-3 py-1 text-center text-sm">
          {WIREFRAME_BANNER}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </body>
    </html>
  );
}
