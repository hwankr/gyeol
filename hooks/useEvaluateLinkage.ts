import { useLayoutEffect, useRef, useState } from "react";
import { RequestCanceledError } from "@/lib/apiClient";
import { setUploadedLinkage } from "@/lib/applicants/uploadedStorage";
import { evidencesOf, linkCardSource, linkageColumns, linkageOf, LINKAGE_COLUMN_GRADES } from "@/lib/evaluate/evaluation";
import type { ApplicantLink, ApplicantLinkCard, EvaluationApplicant, Passage } from "@/lib/evaluate/sampleEvaluations";
import { LINKAGE_ERROR, requestLinkage } from "@/lib/linkageClient";
import type { PrepElement } from "@/lib/prep/criteria";

/** 연계가 없는 올린 지원자에게 보이는 글과 버튼 */
const MISSING_UPLOADED = "이 학생부에는 아직 학년별 연계가 없습니다.";
const CREATE_LABEL = "연계 만들기";

/** 연계 예시를 넣지 않은 예시 지원자에게 보이는 글 */
const MISSING_SAMPLE = "이 예시 지원자에는 학년별 연계 예시가 없습니다.";

/** 연계를 만드는 동안의 상태 글 (AI 를 한 번 부른다) */
const CREATING_STATUS = "학년별 연계를 찾는 중… 30초쯤 걸립니다.";

/** 받은 연계를 브라우저 저장소에 붙이지 못했을 때 (저장소를 읽거나 쓰지 못함, 그 지원자가 목록에서 밀려남) */
const STORAGE_ERROR = "학년별 연계를 남기지 못했습니다. 브라우저 저장소를 확인한 뒤 다시 시도해 주세요.";

/** 고른 평가 요소에 카드가 없을 때, 카드는 있는데 선이 없을 때 */
const NO_CARDS = "이 평가 요소의 근거가 없습니다.";
const NO_LINKS = "학년을 넘어 이어지는 기록을 찾지 못했습니다.";

/** 아무것도 고르지 않았을 때 연결 근거 자리에 보이는 글 */
const DETAIL_HINT = "카드나 선을 누르면 근거가 나옵니다.";

const KIND_TEXT: Record<ApplicantLink["kind"], string> = {
  stated: "기록에 적힌 연속",
  suggested: "AI 가 제안한 연관",
};

/** 평가 요소 탭 */
export type LinkageTab = {
  id: string;
  name: string;
  /** 그 요소의 형광펜 색 순번 */
  tone: number;
  /** "연결 4". 연계가 없는 지원자면 null */
  countText: string | null;
  on: boolean;
  onPick: () => void;
};

/** 카드가 보이는 세기: 고른 카드 / 고른 선의 양 끝 카드 / 그 밖 */
export type LinkageCardState = "picked" | "end" | "plain";

export type LinkageCardView = {
  id: string;
  title: string;
  /** "세특 · 경제 · 11쪽" (쪽은 올린 지원자만) */
  source: string;
  /** "# 가격·매출". 태그가 없으면 null */
  theme: string | null;
  depth: 1 | 2 | 3 | null;
  /** 깊이 점을 글로 풀어 쓴 이름 ("탐구 깊이 2 / 3"). 깊이가 없으면 null */
  depthLabel: string | null;
  state: LinkageCardState;
  onPick: () => void;
};

export type LinkageColumnView = {
  grade: 1 | 2 | 3;
  /** "2학년 · 심화 탐구" (학년과 그 학년의 성장 이름표) */
  title: string;
  cards: LinkageCardView[];
};

/** 선이 보이는 세기: 고른 선 / 고른 카드에 닿은 선 / 그 밖 / 다른 것을 골라 옅어진 선 */
export type LinkageLinkState = "picked" | "touch" | "plain" | "dim";

export type LinkageLinkView = {
  id: string;
  fromId: string;
  toId: string;
  /** 줄을 건너뛰는 선이 피해 가야 하는 가운데 줄의 카드 id (이웃한 줄 사이의 선이면 빈 배열) */
  betweenIds: readonly string[];
  kind: ApplicantLink["kind"];
  /** 글로 읽히는 이름: "2학년 세특 경제에서 3학년 창체 진로활동까지, 기록에 적힌 연속" */
  label: string;
  state: LinkageLinkState;
  onPick: () => void;
};

/** 근거 구절 하나 (연결 근거 자리) */
export type LinkageQuoteView = {
  id: string;
  /** "2학년 · 세특 · 경제 · 11쪽" (쪽은 올린 지원자만) */
  source: string;
  text: string;
  /** AI 가 이 구절을 근거로 본 까닭 (올린 지원자만) */
  reason: string | null;
  /** 이 구절 안에 있는 "기록에 적힌 표현" (그 부분을 칠한다). 없으면 null */
  mark: string | null;
  /** 원문에서 보기: 서류 원문이 이 근거의 자리로 간다 */
  onShow: () => void;
};

/** 연결 근거 자리에 보이는 것 */
export type LinkageDetailView =
  | { kind: "empty"; text: string }
  | {
      kind: "link";
      /** 선의 종류 글과 기록에 적힌 연속인지 */
      kindText: string;
      stated: boolean;
      sides: { heading: string; quotes: LinkageQuoteView[] }[];
      /** 기록에 적힌 표현과 그 출처 (기록에 적힌 연속일 때만) */
      statedQuote: { text: string; source: string } | null;
      reason: string;
    }
  | {
      kind: "card";
      heading: string;
      quotes: LinkageQuoteView[];
      /** 이 카드에 닿은 선 (누르면 그 선을 고른다) */
      links: { id: string; text: string; kindText: string; onPick: () => void }[];
    };

/** 연계가 없는 올린 지원자의 "연계 만들기" */
export type LinkageCreateView = {
  label: string;
  busy: boolean;
  /** 기다리는 동안의 상태 글 (기다리지 않으면 null) */
  statusText: string | null;
  error: string | null;
  onCreate: () => void;
};

export type LinkageView = {
  tabs: LinkageTab[];
  body:
    | { kind: "missing"; text: string; create: LinkageCreateView | null }
    | {
        kind: "graph";
        /** 카드의 짜임이 바뀌면 달라지는 글 (카드 자리를 다시 재는 열쇠) */
        layoutKey: string;
        columns: LinkageColumnView[];
        links: LinkageLinkView[];
        /** 그림 대신(카드가 없음) 또는 그림 아래에(선이 없음) 적는 글. 없으면 null */
        note: string | null;
        /** 카드가 하나라도 있는지 (없으면 그림을 그리지 않는다) */
        hasCards: boolean;
        detail: LinkageDetailView;
      };
};

type LinkageInput = {
  applicant: EvaluationApplicant;
  elements: readonly PrepElement[];
  /** 지금 고른 평가 요소의 순번 (총평의 항목별 점수와 근거와 같은 선택) */
  selectedIndex: number;
  /** 탭을 눌러 평가 요소를 바꾼다 */
  onPickElement: (elementId: string) => void;
  /** 근거 구절의 "원문에서 보기": 그 근거를 골라 서류 원문을 그 자리로 보낸다 */
  onShowEvidence: (evidenceId: string) => void;
};

/** 고른 카드나 선 (어느 평가 요소를 보던 때 고른 것인지와 함께. 요소를 바꾸면 고르지 않은 것으로 본다) */
type Picked = { elementIndex: number; kind: "card" | "link"; id: string };

const IDLE = { busy: false, error: null } as const;

/**
 * 평가하기 · 총평의 학년별 연계 상자 상태(components/EvaluateLinkage.tsx 가 그린다).
 * - 탭은 평가 요소이고 총평에서 고른 요소와 같은 선택이다. 탭마다 그 요소의 연결 수를 적는다.
 * - 고른 요소의 카드를 학년 줄(1·2·3학년)에 놓고 카드 사이의 선을 그린다. 카드나 선을 하나 고르면(다시 누르면 푼다) 아래에 연결 근거가 나온다:
 *   선이면 양 끝 카드의 근거 구절과 이어진다고 본 까닭(기록에 적힌 연속이면 그 표현), 카드면 그 카드의 근거 구절과 닿은 선들.
 *   구절의 "원문에서 보기" 는 서류 원문을 그 근거의 자리로 보낸다. 고르는 것만으로는 서류 원문이 움직이지 않는다.
 * - 연계가 없는 지원자: 올린 지원자면 "연계 만들기" 가 있다. 누르면 /api/linkage 로 AI 를 한 번 불러 연계를 받아 그 지원자의 분석 결과에
 *   붙여 저장한다(lib/applicants/uploadedStorage.ts 의 setUploadedLinkage. 지원자의 코드·남긴 때는 그대로라 적어 둔 평가가 남는다).
 *   저장하면 평가할 지원자 목록이 다시 만들어져 그림이 나타난다. 화면을 여는 것만으로는 AI 를 부르지 않는다.
 *   예시 지원자는 연계 예시가 있는 두 명만 그림이 있고 나머지는 안내 글뿐이다.
 * - 이 화면이 숨겨지거나(다른 화면으로 감) 지원자가 바뀌면 진행 중인 요청을 취소한다(이미 시작된 AI 호출은 서버에서 끝까지 간다).
 */
export function useEvaluateLinkage({ applicant, elements, selectedIndex, onPickElement, onShowEvidence }: LinkageInput): LinkageView {
  const [picked, setPicked] = useState<Picked | null>(null);
  const [creating, setCreating] = useState<{ busy: boolean; error: string | null }>(IDLE);
  /** 진행 중인 연계 만들기 요청을 취소하는 컨트롤러 (진행 중이 아니면 null) */
  const requestRef = useRef<AbortController | null>(null);

  // cacheComponents 에서는 다른 화면으로 가도 이 화면이 숨겨질 뿐 상태가 남는다. 숨겨지거나 언마운트될 때 진행 중인 요청을 취소하고
  // 처음 상태로 되돌린다(hooks/useRecordUpload.ts 와 같은 방식).
  useLayoutEffect(() => {
    return () => {
      requestRef.current?.abort();
      requestRef.current = null;
      setCreating(IDLE);
    };
  }, []);

  async function create() {
    const { original, stamp, code } = applicant;
    if (original === undefined || stamp === undefined || requestRef.current !== null) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setCreating({ busy: true, error: null });
    try {
      const linkage = await requestLinkage(original, controller.signal);
      if (controller.signal.aborted) return;
      requestRef.current = null;
      // 붙이면 평가할 지원자 목록이 다시 만들어져 이 지원자에게 연계가 생긴다(그림이 나타난다).
      setCreating({ busy: false, error: setUploadedLinkage(code, stamp, linkage) ? null : STORAGE_ERROR });
    } catch (error) {
      // 취소된 요청은 아무것도 바꾸지 않는다.
      if (error instanceof RequestCanceledError || controller.signal.aborted) return;
      requestRef.current = null;
      setCreating({ busy: false, error: error instanceof Error ? error.message : LINKAGE_ERROR });
    }
  }

  const tabs: LinkageTab[] = elements.map((element, index) => {
    const linkage = linkageOf(applicant, index, elements.length);
    return {
      id: element.id,
      name: element.name,
      tone: index,
      countText: linkage === null ? null : `연결 ${linkage.links.length}`,
      on: index === selectedIndex,
      onPick: () => onPickElement(element.id),
    };
  });

  const linkage = linkageOf(applicant, selectedIndex, elements.length);
  if (linkage === null) {
    const uploaded = applicant.original !== undefined && applicant.stamp !== undefined;
    return {
      tabs,
      body: {
        kind: "missing",
        text: uploaded ? MISSING_UPLOADED : MISSING_SAMPLE,
        create: uploaded
          ? {
              label: CREATE_LABEL,
              busy: creating.busy,
              statusText: creating.busy ? CREATING_STATUS : null,
              error: creating.error,
              onCreate: () => void create(),
            }
          : null,
      },
    };
  }

  const passageById = new Map(applicant.passages.map((passage) => [passage.id, passage]));
  const evidenceById = new Map(evidencesOf(applicant, selectedIndex, elements.length).map((evidence) => [evidence.id, evidence]));
  const cardById = new Map(linkage.cards.map((card) => [card.id, card]));
  const columnCards = linkageColumns(applicant, linkage);

  // 다른 평가 요소를 보던 때 고른 것, 지금 연계에 없는 것은 고르지 않은 것으로 본다.
  const current = picked !== null && picked.elementIndex === selectedIndex ? picked : null;
  const pickedCard = current?.kind === "card" ? (cardById.get(current.id) ?? null) : null;
  const pickedLink = current?.kind === "link" ? (linkage.links.find((link) => link.id === current.id) ?? null) : null;
  const somethingPicked = pickedCard !== null || pickedLink !== null;

  /** 같은 것을 다시 누르면 푼다 */
  const toggle = (kind: Picked["kind"], id: string) =>
    setPicked((previous) =>
      previous !== null && previous.elementIndex === selectedIndex && previous.kind === kind && previous.id === id
        ? null
        : { elementIndex: selectedIndex, kind, id },
    );

  /** 쪽 글: 올린 지원자의 원문에만 쪽 번호가 있다 */
  const pageSuffix = (passage: Passage | undefined) => (passage?.origin === undefined ? "" : ` · ${passage.origin.page}쪽`);

  const quotesOf = (card: ApplicantLinkCard, statedQuote: string | null): LinkageQuoteView[] =>
    card.evidenceIds.flatMap((id) => {
      const evidence = evidenceById.get(id);
      if (evidence === undefined) return [];
      return [
        {
          id,
          source: `${evidence.source}${pageSuffix(passageById.get(card.passageId))}`,
          text: evidence.text,
          reason: evidence.reason ?? null,
          // 기록에 적힌 표현이 이 구절 안에 있으면 그 부분을, 표현이 이 구절을 통째로 품고 있으면(표현이 더 긴 문장) 구절 전체를 칠한다.
          mark:
            statedQuote === null
              ? null
              : evidence.text.includes(statedQuote)
                ? statedQuote
                : statedQuote.includes(evidence.text)
                  ? evidence.text
                  : null,
          onShow: () => onShowEvidence(id),
        },
      ];
    });

  /** 카드를 가리키는 글: "2학년 · 가격·매출 후속 탐구" */
  const cardHeading = (card: ApplicantLinkCard) => `${card.grade}학년 · ${card.title}`;

  /** 선의 글로 읽히는 이름에 쓰는 카드의 자리: "2학년 세특 경제" */
  const cardPlace = (card: ApplicantLinkCard) => {
    const passage = passageById.get(card.passageId);
    return passage === undefined ? `${card.grade}학년 ${card.title}` : `${card.grade}학년 ${passage.area} ${passage.subject}`;
  };

  const columns: LinkageColumnView[] = LINKAGE_COLUMN_GRADES.map((grade, index) => ({
    grade,
    title: `${grade}학년 · ${applicant.growth[index].label}`,
    cards: columnCards[index].map((card): LinkageCardView => {
      const passage = passageById.get(card.passageId);
      return {
        id: card.id,
        title: card.title,
        source: `${passage === undefined ? "" : linkCardSource(passage)}${pageSuffix(passage)}`,
        theme: card.theme === "" ? null : `# ${card.theme}`,
        depth: card.depth,
        depthLabel: card.depth === null ? null : `탐구 깊이 ${card.depth} / 3`,
        state:
          pickedCard?.id === card.id
            ? "picked"
            : pickedLink !== null && (pickedLink.fromCardId === card.id || pickedLink.toCardId === card.id)
              ? "end"
              : "plain",
        onPick: () => toggle("card", card.id),
      };
    }),
  }));

  const links: LinkageLinkView[] = linkage.links.flatMap((link) => {
    const from = cardById.get(link.fromCardId);
    const to = cardById.get(link.toCardId);
    if (from === undefined || to === undefined) return [];
    const touches = pickedCard !== null && (link.fromCardId === pickedCard.id || link.toCardId === pickedCard.id);
    return [
      {
        id: link.id,
        fromId: from.id,
        toId: to.id,
        // 1학년 → 3학년 선은 2학년 줄의 카드를 피해 간다.
        betweenIds: linkage.cards.filter((card) => card.grade > from.grade && card.grade < to.grade).map((card) => card.id),
        kind: link.kind,
        label: `${cardPlace(from)}에서 ${cardPlace(to)}까지, ${KIND_TEXT[link.kind]}`,
        state: pickedLink?.id === link.id ? "picked" : touches ? "touch" : somethingPicked ? "dim" : "plain",
        onPick: () => toggle("link", link.id),
      },
    ];
  });

  let detail: LinkageDetailView = { kind: "empty", text: DETAIL_HINT };
  if (pickedLink !== null) {
    const from = cardById.get(pickedLink.fromCardId);
    const to = cardById.get(pickedLink.toCardId);
    const stated = pickedLink.stated;
    const statedPassage = stated === null ? undefined : passageById.get(stated.passageId);
    if (from !== undefined && to !== undefined) {
      detail = {
        kind: "link",
        kindText: KIND_TEXT[pickedLink.kind],
        stated: pickedLink.kind === "stated",
        sides: [from, to].map((card) => ({ heading: cardHeading(card), quotes: quotesOf(card, stated?.quote ?? null) })),
        statedQuote:
          stated === null
            ? null
            : {
                text: stated.quote,
                source:
                  statedPassage === undefined
                    ? ""
                    : `${statedPassage.grade === null ? "" : `${statedPassage.grade}학년 · `}${linkCardSource(statedPassage)}${pageSuffix(statedPassage)}`,
              },
        reason: pickedLink.reason,
      };
    }
  } else if (pickedCard !== null) {
    detail = {
      kind: "card",
      heading: cardHeading(pickedCard),
      quotes: quotesOf(pickedCard, null),
      links: linkage.links.flatMap((link) => {
        const outgoing = link.fromCardId === pickedCard.id;
        if (!outgoing && link.toCardId !== pickedCard.id) return [];
        const other = cardById.get(outgoing ? link.toCardId : link.fromCardId);
        if (other === undefined) return [];
        return [
          {
            id: link.id,
            text: outgoing ? `→ ${cardHeading(other)}` : `← ${cardHeading(other)}`,
            kindText: KIND_TEXT[link.kind],
            onPick: () => toggle("link", link.id),
          },
        ];
      }),
    };
  }

  return {
    tabs,
    body: {
      kind: "graph",
      layoutKey: `${applicant.code}:${selectedIndex}:${linkage.cards.map((card) => card.id).join(",")}`,
      columns,
      links,
      note: linkage.cards.length === 0 ? NO_CARDS : linkage.links.length === 0 ? NO_LINKS : null,
      hasCards: linkage.cards.length > 0,
      detail,
    },
  };
}
