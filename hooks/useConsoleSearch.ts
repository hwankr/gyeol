import { createContext, useContext, useMemo, useRef, useState, type RefObject } from "react";

// 상단 바의 검색 입력란. 입력란은 껍데기(app/(console)/layout.tsx → components/ConsoleShell.tsx)에 있고 검색어를 쓰는 것은
// 지원자 관리 화면이다. 껍데기의 JS 와 지원자 관리 화면의 JS 는 따로 도착하므로, 입력란은 기본이 꺼진(disabled) 상태이고
// 지원자 관리 화면이 준비되면(그 화면의 훅이 브라우저에서 돌면) 그때 켜진다. 서버 HTML 과 첫 클라이언트 렌더링에서는 어느 주소에서나
// 꺼져 있고 비어 있다(hydration 경고 없음). 준비 전에는 글자를 넣을 수 없으므로 준비 전에 적은 글자를 살리거나 지울 일이 없다.
//
// 켜고 끄는 것과 입력란의 값을 비우는 것은 모두 지원자 관리 화면(hooks/useApplicants.ts)이 한다: 보이기 시작하면 켜고,
// 숨겨지거나 없어지면 값을 비우고 끈다. 한 번도 준비되지 않은 화면은 입력란을 켠 적이 없으므로 남길 것이 없다.
// 전형 준비 화면에서는 지원자 관리 화면이 숨겨져 있으므로 입력란은 꺼진 채(기능이 없는 컨트롤)다.
//
// 입력란은 React 가 값을 쥐지 않는 입력란(uncontrolled, defaultValue)이다. 사람이 적은 글자는 DOM 에 그대로 남고 React 가 덮어쓰지 않는다.
// 검색어 상태는 지원자 관리 화면이 갖는다. 껍데기는 입력 이벤트를 화면이 등록한 받는 쪽(listenerRef)에 그대로 넘기기만 한다.

/** 지원자 관리 화면이 쓰는 검색 연결 */
export type ConsoleSearch = {
  /** 입력란 (화면을 나갈 때 실제 값을 비운다) */
  inputRef: RefObject<HTMLInputElement | null>;
  /** 입력 이벤트를 받을 곳. 지원자 관리 화면이 보이는 동안만 등록된다. */
  listenerRef: RefObject<((query: string) => void) | null>;
  /** 입력란을 켜고 끈다 (지원자 관리 화면이 보이는 동안만 켠다) */
  setInputEnabled: (enabled: boolean) => void;
};

export const ConsoleSearchContext = createContext<ConsoleSearch | null>(null);

/** 껍데기 레이아웃의 검색 연결 */
export function useConsoleSearchState() {
  const inputRef = useRef<HTMLInputElement>(null);
  const listenerRef = useRef<((query: string) => void) | null>(null);
  /** 입력란이 켜져 있는지. 처음(서버 HTML·hydration)에는 꺼져 있다. */
  const [enabled, setInputEnabled] = useState(false);
  // context 값은 처음 한 번 만든 객체를 계속 쓴다(ref 와 state 설정 함수만 들어 있어 바뀔 일이 없다).
  const context = useMemo<ConsoleSearch>(() => ({ inputRef, listenerRef, setInputEnabled }), []);
  return {
    context,
    /** 껍데기(상단 바)에 건네는 입력란 상태 */
    input: {
      enabled,
      onChange: (query: string) => listenerRef.current?.(query),
    },
    inputRef,
  };
}

/** 지원자 관리 화면이 검색 연결을 받는다. 껍데기 레이아웃 밖에서 부르면 오류다. */
export function useConsoleSearch(): ConsoleSearch {
  const search = useContext(ConsoleSearchContext);
  if (search === null) throw new Error("useConsoleSearch 는 app/(console)/layout.tsx 안에서만 쓸 수 있습니다.");
  return search;
}
