import type { ReactNode } from "react";

/** 업로드 화면(/upload)과 결과 화면(/result)의 껍데기. 데스크톱 전용(가로 1280px 이상)이다. */
export default function WorkspaceLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    // 화면 전체는 화면 높이에 고정하고 아래 영역만 스크롤한다. 결과 화면은 이 안에서 두 단이 각자 스크롤한다.
    <div className="flex h-screen min-w-[1280px] flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
