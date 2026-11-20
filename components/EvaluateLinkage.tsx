import type { KeyboardEvent, ReactNode } from "react";
import {
  AccentTag,
  BUTTON_PRIMARY_CLASS,
  BUTTON_SECONDARY_CLASS,
  PANEL_CLASS,
  PANEL_HEAD_CLASS,
  PANEL_TITLE_CLASS,
} from "@/components/consoleUi";
import { ToneSwatch } from "@/components/EvaluateParts";
import type {
  LinkageCardView,
  LinkageDetailView,
  LinkageLinkView,
  LinkageQuoteView,
  LinkageView,
} from "@/hooks/useEvaluateLinkage";
import { useLinkageLayout } from "@/hooks/useLinkageLayout";
import { linkShapes, type LinkRect, type LinkShape } from "@/lib/evaluate/linkagePaths";

/** 선의 색: 그 밖 / 고른 선·고른 카드에 닿은 선 / 다른 것을 골라 옅어진 선 */
const LINE_COLOR = "#7B8194";
const LINE_ACTIVE_COLOR = "#001AD0";
const LINE_DIM_COLOR = "#C4C8D4";

/** AI 가 제안한 연관(점선)의 선 끊김 */
const DASH = "5 4";

/** 꺼진 채로 초점을 받는 주 버튼(연계를 만드는 동안): 꺼진 주 버튼과 같은 색 */
const BUSY_BUTTON_CLASS = "aria-disabled:cursor-default aria-disabled:border-[#E4E6EE] aria-disabled:bg-[#E4E6EE] aria-disabled:text-[#505050]";

/**
 * 평가하기 · 총평의 학년별 연계 상자. 지원자의 근거를 1학년 → 2학년 → 3학년 세 줄의 카드로 놓고 학년을 넘어 이어지는 카드를 선으로 잇는다.
 * - 탭은 평가 요소다(총평에서 고른 평가 요소와 같은 선택. 이름 앞의 색 점은 그 요소의 형광펜 색, 뒤의 수는 그 요소의 연결 수).
 * - 카드(버튼): 제목, 출처, 주제 태그, 탐구 깊이 점(채운 수가 깊이). 선: 실선은 기록에 적힌 연속, 점선은 AI 가 제안한 연관이다
 *   (색만으로 구분하지 않는다). 선도 누르거나 키보드로 고를 수 있다.
 * - 카드나 선을 고르면 아래 연결 근거에 근거 구절과 이어진다고 본 까닭이 나온다. 구절의 "원문에서 보기" 는 서류 원문을 그 자리로 보낸다.
 * - 연계가 없는 지원자에게는 안내 글이, 올린 지원자면 "연계 만들기" 버튼이 나온다.
 * 폭이 좁으면 그림 영역만 가로로 스크롤한다. 평가 요소를 바꾸면 그 요소의 그림이 옅게 나타난다(고른 요소를 key 로 새로 그린다).
 * 값은 hooks/useEvaluateLinkage.ts 가 만든다. 선의 자리는 카드의 자리를 재서 계산한다(hooks/useLinkageLayout.ts, lib/evaluate/linkagePaths.ts).
 */
export function LinkagePanel({ view }: { view: LinkageView }) {
  const { tabs, body } = view;
  const selectedId = tabs.find((tab) => tab.on)?.id ?? "";
  return (
    <section aria-labelledby="linkage-title" className={PANEL_CLASS}>
      <div className={`${PANEL_HEAD_CLASS} flex h-[40px] items-center gap-[8px] rounded-t-[7px] px-[16px]`}>
        <h3 id="linkage-title" className={PANEL_TITLE_CLASS}>
          학년별 연계
        </h3>
        <AccentTag>AI 제안</AccentTag>
      </div>
      <div className="p-[16px]">
        <div className="flex flex-wrap items-center gap-x-[16px] gap-y-[8px]">
          <div role="group" aria-label="평가 요소" className="flex flex-wrap gap-[8px]">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                aria-pressed={tab.on}
                onClick={tab.onPick}
                className={`motion-colors box-border inline-flex min-h-[32px] cursor-pointer items-center gap-[8px] rounded-[6px] border px-[10px] py-[4px] text-[13px] leading-[18px] ${
                  tab.on
                    ? "border-[#001AD0] bg-[#EEF0FF] font-semibold text-[#001AD0]"
                    : "border-[#CFCFCF] bg-white font-medium text-[#111111] hover-on:bg-[#F6F7FB] press-on:bg-[#ECEEF5]"
                }`}
              >
                <ToneSwatch tone={tab.tone} />
                <span className="[overflow-wrap:anywhere]">{tab.name}</span>
                {tab.countText !== null && <span className="text-[12px] font-medium tabular-nums">{tab.countText}</span>}
              </button>
            ))}
          </div>
          {body.kind === "graph" && body.hasCards && <Legend />}
        </div>
        {body.kind === "missing" ? (
          <div className="mt-[12px]">
            <p className="text-[13px] leading-[18px] text-[#505050]">{body.text}</p>
            {body.create !== null && (
              <div className="mt-[8px] flex flex-wrap items-center gap-x-[12px] gap-y-[6px]">
                {/* 기다리는 동안 버튼을 끄지 않고(초점이 문서로 빠지지 않게) 눌러도 다시 부르지 않게만 한다. */}
                <button
                  type="button"
                  aria-disabled={body.create.busy}
                  onClick={body.create.onCreate}
                  className={`${BUTTON_PRIMARY_CLASS} ${BUSY_BUTTON_CLASS} h-[32px] px-[12px]`}
                >
                  {body.create.label}
                </button>
                <p role="status" className="text-[13px] leading-[18px] text-[#505050]">
                  {body.create.statusText ?? ""}
                </p>
                {body.create.error !== null && (
                  <p role="alert" className="animate-fade-in text-[13px] leading-[18px] font-medium text-[#BA1A1A] [overflow-wrap:anywhere]">
                    {body.create.error}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <Graph key={selectedId} body={body} />
        )}
      </div>
    </section>
  );
}

/** 선의 종류 풀이: 실선과 점선 */
function Legend() {
  return (
    <p className="ml-auto flex flex-wrap items-center gap-x-[12px] gap-y-[4px] text-[12px] leading-[16px] text-[#505050]">
      <span className="inline-flex items-center gap-[6px]">
        <svg aria-hidden="true" width="28" height="8" className="flex-none">
          <line x1="0" y1="4" x2="28" y2="4" stroke={LINE_COLOR} strokeWidth="1.5" />
        </svg>
        기록에 적힌 연속
      </span>
      <span className="inline-flex items-center gap-[6px]">
        <svg aria-hidden="true" width="28" height="8" className="flex-none">
          <line x1="0" y1="4" x2="28" y2="4" stroke={LINE_COLOR} strokeWidth="1.5" strokeDasharray={DASH} />
        </svg>
        AI 가 제안한 연관
      </span>
    </p>
  );
}

type GraphBody = Extract<LinkageView["body"], { kind: "graph" }>;

/** 학년 줄의 카드와 선, 그 아래의 연결 근거 */
function Graph({ body }: { body: GraphBody }) {
  const { areaRef, rects } = useLinkageLayout(body.layoutKey);
  const shapes = linkShapes(body.links, rects, (ends) => {
    const link = body.links.find((item) => item.id === ends.id);
    return (link?.betweenIds ?? []).flatMap((id): LinkRect[] => (rects[id] === undefined ? [] : [rects[id]]));
  });
  const shapeById = new Map(shapes.map((shape) => [shape.id, shape]));
  return (
    <div className="animate-fade-in">
      {body.hasCards && (
        /* 폭이 좁으면 이 영역만 가로로 스크롤한다. 선을 그리는 SVG 가 카드와 같은 상자 안에 있어 같이 움직인다. */
        <div className="mt-[12px] overflow-x-auto pb-[4px]">
          <div ref={areaRef} className="relative grid min-w-[540px] grid-cols-3 gap-x-[44px]">
            {body.columns.map((column) => (
              <div key={column.grade} className="min-w-0">
                <p className="mb-[8px] text-center text-[12px] leading-[16px] font-semibold text-[#505050] [overflow-wrap:anywhere]">{column.title}</p>
                <ul className="flex flex-col gap-[12px]">
                  {column.cards.map((card) => (
                    <li key={card.id}>
                      <Card card={card} />
                    </li>
                  ))}
                </ul>
                {column.cards.length === 0 && <p className="py-[8px] text-center text-[12px] leading-[16px] text-[#505050]">근거 없음</p>}
              </div>
            ))}
            {/* 선은 카드 위에 겹쳐 그리되 선의 길만 눌린다(카드는 그대로 눌린다). */}
            <svg role="group" aria-label="카드 사이의 연결" className="pointer-events-none absolute top-0 left-0 h-full w-full overflow-visible">
              {body.links.map((link) => {
                const shape = shapeById.get(link.id);
                return shape === undefined ? null : <Line key={link.id} link={link} shape={shape} />;
              })}
            </svg>
          </div>
        </div>
      )}
      {body.note !== null && <p className="mt-[12px] text-[13px] leading-[18px] text-[#505050]">{body.note}</p>}
      {body.hasCards && (
        <>
          <div aria-live="polite">
            <Detail detail={body.detail} />
          </div>
          <p className="mt-[12px] text-[12px] leading-[16px] text-[#505050]">연결선은 AI 제안이며 인과관계를 증명하지 않습니다.</p>
        </>
      )}
    </div>
  );
}

const CARD_STATE_CLASS: Record<LinkageCardView["state"], string> = {
  picked: "border-[#001AD0] bg-[#EEF0FF]",
  end: "border-[#001AD0] bg-white",
  plain: "border-[#CFCFCF] bg-white hover-on:bg-[#F6F7FB] press-on:bg-[#ECEEF5]",
};

/** 카드 하나. data-link-card 로 자리를 잰다(hooks/useLinkageLayout.ts). */
function Card({ card }: { card: LinkageCardView }) {
  return (
    <button
      type="button"
      data-link-card={card.id}
      aria-pressed={card.state === "picked"}
      onClick={card.onPick}
      className={`motion-colors box-border block w-full cursor-pointer scroll-m-[8px] rounded-[8px] border px-[11px] py-[9px] text-left ${CARD_STATE_CLASS[card.state]}`}
    >
      <span className="block text-[14px] leading-[20px] font-semibold text-[#111111] [overflow-wrap:anywhere] break-keep">{card.title}</span>
      <span className="mt-[2px] block text-[12px] leading-[16px] text-[#505050] [overflow-wrap:anywhere]">{card.source}</span>
      {(card.theme !== null || card.depth !== null) && (
        <span className="mt-[6px] flex items-center justify-between gap-[8px]">
          <span className="min-w-0 text-[12px] leading-[16px] text-[#505050] [overflow-wrap:anywhere]">{card.theme ?? ""}</span>
          {card.depth !== null && card.depthLabel !== null && (
            <span role="img" aria-label={card.depthLabel} className="flex flex-none items-center gap-[3px]">
              {[1, 2, 3].map((step) => (
                <span
                  key={step}
                  className={`box-border h-[7px] w-[7px] rounded-full border border-[#505050] ${card.depth !== null && step <= card.depth ? "bg-[#505050]" : "bg-transparent"}`}
                />
              ))}
            </span>
          )}
        </span>
      )}
    </button>
  );
}

/**
 * 선 하나: 보이는 선과 화살표 머리, 누르기 쉬운 투명한 굵은 선. 버튼처럼 눌리고 키보드로 고를 수 있다(Enter·Space).
 * 초점 표시는 선을 따라 옅은 띠로 그린다(둘레 상자에 초점 테두리를 그리면 긴 곡선에서 너무 커진다).
 */
function Line({ link, shape }: { link: LinkageLinkView; shape: LinkShape }) {
  const color = link.state === "picked" || link.state === "touch" ? LINE_ACTIVE_COLOR : link.state === "dim" ? LINE_DIM_COLOR : LINE_COLOR;
  const onKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    link.onPick();
  };
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={link.label}
      aria-pressed={link.state === "picked"}
      onClick={link.onPick}
      onKeyDown={onKeyDown}
      className="group cursor-pointer"
      style={{ pointerEvents: "stroke", outline: "none" }}
    >
      <path d={shape.path} fill="none" stroke={LINE_ACTIVE_COLOR} strokeOpacity="0.25" strokeWidth="9" strokeLinecap="round" className="opacity-0 group-focus-visible:opacity-100" />
      <path d={shape.path} fill="none" stroke="transparent" strokeWidth="14" />
      <path
        d={shape.path}
        fill="none"
        stroke={color}
        strokeWidth={link.state === "picked" ? 2.5 : 1.5}
        strokeDasharray={link.kind === "suggested" ? DASH : undefined}
        className="motion-colors"
      />
      <polygon points={shape.arrow} fill={color} stroke={color} strokeWidth="1" strokeLinejoin="round" className="motion-colors" />
    </g>
  );
}

/** 연결 근거: 고른 선이나 카드의 근거 구절 */
function Detail({ detail }: { detail: LinkageDetailView }) {
  if (detail.kind === "empty") {
    return (
      <p className="mt-[12px] rounded-[8px] border border-dashed border-[#CFCFCF] px-[12px] py-[10px] text-[13px] leading-[18px] text-[#505050]">
        {detail.text}
      </p>
    );
  }
  return (
    <div role="group" aria-label="연결 근거" className="mt-[12px] animate-fade-in rounded-[8px] border border-[#001AD0] px-[12px] pt-[10px] pb-[12px]">
      {detail.kind === "link" ? (
        <>
          <p className="flex flex-wrap items-center gap-[8px]">
            <strong className="text-[13px] leading-[18px] font-semibold text-[#111111]">연결 근거</strong>
            <AccentTag>{detail.kindText}</AccentTag>
          </p>
          {detail.sides.map((side) => (
            <QuoteGroup key={side.heading} heading={side.heading} quotes={side.quotes} />
          ))}
          {detail.statedQuote !== null && (
            <div className="mt-[10px]">
              <p className="text-[12px] leading-[16px] font-semibold text-[#111111]">
                기록에 적힌 표현
                {detail.statedQuote.source !== "" && <span className="font-normal text-[#505050]"> · {detail.statedQuote.source}</span>}
              </p>
              <p className="mt-[4px] text-[14px] leading-[22px] text-[#111111] [overflow-wrap:anywhere] break-keep">
                <Marked>{detail.statedQuote.text}</Marked>
              </p>
            </div>
          )}
          <p className="mt-[10px] border-t border-t-[#E4E4E4] pt-[8px] text-[13px] leading-[20px] text-[#505050] [overflow-wrap:anywhere] break-keep">
            <span className="font-semibold text-[#111111]">이유</span> · {detail.reason}
          </p>
        </>
      ) : (
        <>
          <p className="text-[13px] leading-[18px] font-semibold text-[#111111] [overflow-wrap:anywhere]">{detail.heading}</p>
          <QuoteGroup heading={null} quotes={detail.quotes} />
          <div className="mt-[10px] border-t border-t-[#E4E4E4] pt-[8px]">
            <p className="text-[12px] leading-[16px] font-semibold text-[#111111]">이 카드의 연결</p>
            {detail.links.length === 0 ? (
              <p className="mt-[4px] text-[13px] leading-[18px] text-[#505050]">이 카드에 닿은 선이 없습니다.</p>
            ) : (
              <ul className="mt-[4px] flex flex-col gap-[4px]">
                {detail.links.map((link) => (
                  <li key={link.id}>
                    <button
                      type="button"
                      onClick={link.onPick}
                      className={`${BUTTON_SECONDARY_CLASS} min-h-[28px] w-full justify-between gap-[8px] px-[8px] py-[4px] text-left`}
                    >
                      <span className="min-w-0 [overflow-wrap:anywhere]">{link.text}</span>
                      <span className="flex-none text-[12px] text-[#505050]">{link.kindText}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** 카드 하나의 근거 구절들 (heading 은 그 카드를 가리키는 글. 카드를 골랐을 때는 위에 이미 있어 null) */
function QuoteGroup({ heading, quotes }: { heading: string | null; quotes: LinkageQuoteView[] }) {
  return (
    <div className="mt-[10px]">
      {heading !== null && <p className="text-[12px] leading-[16px] font-semibold text-[#111111] [overflow-wrap:anywhere]">{heading}</p>}
      <ul>
        {quotes.map((quote) => (
          <li key={quote.id} className="mt-[6px]">
            <div className="flex flex-wrap items-center justify-between gap-x-[8px] gap-y-[2px]">
              <span className="text-[12px] leading-[16px] text-[#505050] [overflow-wrap:anywhere]">{quote.source}</span>
              <button type="button" onClick={quote.onShow} className={`${BUTTON_SECONDARY_CLASS} h-[26px] flex-none px-[8px]`}>
                원문에서 보기
              </button>
            </div>
            <p className="mt-[4px] rounded-[6px] bg-[#F6F7FB] px-[12px] py-[8px] text-[14px] leading-[22px] text-[#111111] [overflow-wrap:anywhere] break-keep">
              {quote.mark === null ? quote.text : <MarkedIn text={quote.text} mark={quote.mark} />}
            </p>
            {quote.reason !== null && (
              <p className="mt-[4px] px-[12px] text-[12px] leading-[18px] text-[#505050] [overflow-wrap:anywhere] break-keep">{quote.reason}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 기록에 적힌 표현의 칠: 평가 요소의 형광펜 색과 헷갈리지 않게 옅은 남색 면과 밑줄이다. */
function Marked({ children }: { children: ReactNode }) {
  return <mark className="rounded-[2px] bg-[#DCE0FF] px-[2px] text-[#111111] underline decoration-[#001AD0] underline-offset-[4px]">{children}</mark>;
}

/** 구절 안에서 기록에 적힌 표현(처음 나오는 자리)만 칠한다. 구절에 그 표현이 없으면 구절 그대로다. */
function MarkedIn({ text, mark }: { text: string; mark: string }) {
  const at = text.indexOf(mark);
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <Marked>{mark}</Marked>
      {text.slice(at + mark.length)}
    </>
  );
}
