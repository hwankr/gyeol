type HistoryTabProps = {
  /** 최신순 기록. 브라우저 저장소를 읽기 전(서버 렌더링·hydration 중)에는 undefined 라 제목만 그린다. */
  entries: { id: string; at: string; timeText: string; actor: string; summary: string }[] | undefined;
};

/**
 * 전형 준비 · 기준 변경 기록 탭(/prep/history). 디자인은 탭 아래가 비어 있어 내용은 코디네이터가 정한 모양이다:
 * 흰 상자 하나에 제목과 최신순 목록(시각·바꾼 사람, 내용). 기록이 없으면 안내 문장.
 */
export function HistoryTab({ entries }: HistoryTabProps) {
  return (
    <section
      aria-labelledby="history-title"
      className="mt-[18px] rounded-[6px] bg-white pt-[19px] px-[25px] pb-[22px]"
    >
      <h2 id="history-title" className="text-[20px] leading-[28px] font-extrabold">
        기준 변경 기록
      </h2>
      {entries !== undefined &&
        (entries.length === 0 ? (
          <p className="mt-[22px] text-[14px] leading-[20px] font-medium text-[#505050]">아직 변경 기록이 없습니다.</p>
        ) : (
          <ol className="mt-[10px]">
            {entries.map((entry) => (
              <li key={entry.id} className="border-b border-b-[#ECECEC] py-[12px]">
                <p className="text-[14px] leading-[20px] [overflow-wrap:anywhere]">
                  <time dateTime={entry.at} className="font-extrabold text-[#111111]">
                    {entry.timeText}
                  </time>
                  <span className="ml-[12px] font-medium text-[#505050]">{entry.actor}</span>
                </p>
                <p className="mt-[4px] text-[14px] leading-[20px] font-medium text-[#505050] [overflow-wrap:anywhere]">
                  {entry.summary}
                </p>
              </li>
            ))}
          </ol>
        ))}
    </section>
  );
}
