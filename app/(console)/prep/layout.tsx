"use client";

import type { ReactNode } from "react";
import { PrepHeader } from "@/components/PrepHeader";
import { usePrepHeader } from "@/hooks/usePrepHeader";

/** 전형 준비 화면 세 탭(/prep, /prep/weights, /prep/history)의 공통 머리: 현재 위치·제목·전형 요약·탭 줄(usePrepHeader → PrepHeader). */
export default function PrepLayout({ children }: Readonly<{ children: ReactNode }>) {
  const header = usePrepHeader();
  return (
    <>
      <PrepHeader {...header} />
      {children}
    </>
  );
}
