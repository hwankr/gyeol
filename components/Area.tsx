import type { ReactNode } from "react";

type AreaProps = {
  /** 왼쪽 위에 "영역: <이름>" 으로 표시할 이름 */
  name: string;
  className?: string;
  children: ReactNode;
};

/** 화면의 한 영역. 1px 회색 테두리 상자와 왼쪽 위 영역 이름만 그린다. */
export function Area({ name, className = "", children }: AreaProps) {
  return (
    <section className={`border border-neutral-300 p-3 ${className}`}>
      <p className="mb-2 text-xs text-neutral-500">영역: {name}</p>
      {children}
    </section>
  );
}
