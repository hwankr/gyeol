import { createContext, useCallback, useContext, useMemo, useRef, useState, type RefObject } from "react";

// 상단 바의 검색 입력란. 입력란은 껍데기(app/(console)/layout.tsx → components/ConsoleShell.tsx)에 있고 검색어를 쓰는 것은
// 지원자 관리 화면과 평가하기의 평가 대기 목록 화면이다(아래 설명은 지원자 관리 화면을 예로 든다. 평가 대기 목록도 같은 방식이다). 껍데기의 JS 와 지원자 관리 화면의 JS 는 따로 도착하므로, 입력란은 기본이 꺼진(disabled) 상태이고
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
  /**
   * 입력란을 켜고 끈다 (검색을 쓰는 화면이 보이는 동안만 켠다). 켤 때 label 을 주면 입력란의 안내 글자(placeholder)와 이름(aria-label)이
   * 그 글이 된다(예: "지원자 코드 검색"). 끄면 기본 글 "검색" 으로 돌아간다.
   */
  setInputEnabled: (enabled: boolean, label?: string) => void;
};

/** 검색을 쓰는 화면이 없을 때 입력란의 안내 글자와 이름 */
export const DEFAULT_SEARCH_LABEL = "검색";

type SearchInputState = { enabled: boolean; label: string };

const SEARCH_INPUT_OFF: SearchInputState = { enabled: false, label: DEFAULT_SEARCH_LABEL };

export const ConsoleSearchContext = createContext<ConsoleSearch | null>(null);

/** 껍데기 레이아웃의 검색 연결 */
export function useConsoleSearchState() {
  const inputRef = useRef<HTMLInputElement>(null);
  const listenerRef = useRef<((query: string) => void) | null>(null);
  /** 입력란이 켜져 있는지와 안내 글자. 처음(서버 HTML·hydration)에는 꺼져 있고 안내 글자는 "검색" 이다. */
  const [input, setInput] = useState<SearchInputState>(SEARCH_INPUT_OFF);
  const setInputEnabled = useCallback((enabled: boolean, label: string = DEFAULT_SEARCH_LABEL) => {
    setInput((previous) => {
      const next: SearchInputState = enabled ? { enabled: true, label } : SEARCH_INPUT_OFF;
      return previous.enabled === next.enabled && previous.label === next.label ? previous : next;
    });
  }, []);
  // context 값은 처음 한 번 만든 객체를 계속 쓴다(ref 와 바뀌지 않는 함수만 들어 있다).
  const context = useMemo<ConsoleSearch>(() => ({ inputRef, listenerRef, setInputEnabled }), [setInputEnabled]);
  return {
    context,
    /** 껍데기(상단 바)에 건네는 입력란 상태 */
    input: {
      enabled: input.enabled,
      label: input.label,
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
