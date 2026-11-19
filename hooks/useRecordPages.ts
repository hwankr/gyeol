import { useEffect, useState } from "react";
import type { PageRect } from "@/lib/recordLocate";
import { loadRecordPages } from "@/lib/recordPagesStorage";

/** 화면에 그릴 쪽 하나 */
export type RecordPageView = {
  /** 쪽 번호(1부터) */
  page: number;
  /** 쪽의 크기(pt). 그림을 받기 전에도 자리를 잡는 데 쓴다 */
  width: number;
  height: number;
  /** shown: 가린 그림이 있다. scan: 글자가 없는 쪽(스캔본). unverified: 가릴 자리를 확인하지 못한 쪽 */
  state: "shown" | "scan" | "unverified";
  /** 가린 그림의 주소(이 페이지 안에서만 쓰는 blob 주소). 그림이 없는 쪽은 null */
  url: string | null;
};

/** 올린 학생부 하나의 쪽 그림과 자리 */
export type RecordPagesView = {
  pages: readonly RecordPageView[];
  /** 항목 id → 그 항목의 원문이 있는 자리 */
  sections: Readonly<Record<string, readonly PageRect[]>>;
  /** 근거 id → 그 인용 구절이 있는 자리 */
  evidences: Readonly<Record<string, readonly PageRect[]>>;
};

/**
 * 올린 학생부의 가린 쪽 그림과 자리를 브라우저 저장소(IndexedDB, lib/recordPagesStorage.ts)에서 불러온다.
 * 열쇠가 null 이거나(예시 지원자) 남긴 것이 없으면 null 이다. 불러오는 동안에도 null 이다(원문보기는 글만 보여 주다가 PDF 보기가 나타난다).
 * 그림은 이 페이지 안에서만 쓰는 주소(blob)로 만들고, 화면이 숨겨지거나 열쇠가 바뀌면 그 주소를 없앤다.
 */
export function useRecordPages(key: string | null): RecordPagesView | null {
  const [loaded, setLoaded] = useState<{ key: string; view: RecordPagesView } | null>(null);

  useEffect(() => {
    if (key === null) return;
    let alive = true;
    const urls: string[] = [];
    void loadRecordPages(key).then((data) => {
      if (!alive || data === null) return;
      const pages = data.pages.map((page, index): RecordPageView => {
        const url = page.image === null ? null : URL.createObjectURL(page.image);
        if (url !== null) urls.push(url);
        return { page: index + 1, width: page.width, height: page.height, state: page.state, url };
      });
      setLoaded({ key, view: { pages, sections: data.sections, evidences: data.evidences } });
    });
    return () => {
      alive = false;
      for (const url of urls) URL.revokeObjectURL(url);
      setLoaded(null);
    };
  }, [key]);

  return loaded !== null && loaded.key === key ? loaded.view : null;
}
