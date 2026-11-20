import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RecordViewMode } from "@/components/RecordPdf";
import { usePdfViewport } from "@/hooks/usePdfViewport";
import { useRecordPagesState } from "@/hooks/useRecordPages";
import {
  documentAreasOf,
  evaluateOriginalPath,
  evidenceSlotCount,
  evidencesOf,
  passageSource,
  passagesIn,
  segmentTone,
  slotOf,
} from "@/lib/evaluate/evaluation";
import { INITIAL_DOCUMENT_AREA, type DocumentArea, type EvaluationApplicant } from "@/lib/evaluate/sampleEvaluations";
import type { PrepElement } from "@/lib/prep/criteria";
import { buildPdfPages, type PdfMarkGroup, type PdfPageView } from "@/lib/recordPdfMarks";
import { recordPagesKey } from "@/lib/recordPagesStorage";

/** 글 보기에서 스크롤 대상(고른 근거의 구절)을 스크롤 영역 높이의 이 비율만큼 아래에 둔다(위쪽 문맥이 보이게) */
const TEXT_TARGET_OFFSET = 0.2;

/**
 * 서류 원문에서 고른 것: 근거(어느 평가 요소를 보던 때 고른 것인지와 함께) 또는 항목(쪽 번호를 눌러 실제 PDF 의 자리를 보는 항목).
 * 누를 때마다 새 번호(request)라 같은 것을 다시 눌러도 다시 스크롤한다.
 */
type DocumentFocus =
  | { kind: "evidence"; evidenceId: string; elementIndex: number; request: number }
  | { kind: "section"; sectionId: string; request: number };

/** 원문 조각의 세기: 지금 고른 근거 / 지금 고른 평가 요소의 근거 / 다른 요소의 근거. 근거가 아니면 null */
export type SegmentLevel = "focus" | "strong" | "soft" | null;

type EvaluationDocumentInput = {
  applicant: EvaluationApplicant;
  elements: readonly PrepElement[];
  /** 근거를 강조할 평가 요소의 순번 (총평: 고른 요소, 세부 항목 평가: 지금 응답하는 요소) */
  highlightIndex: number;
  maskReported: boolean;
  onToggleMaskReport: () => void;
  /**
   * 원본 PDF 에서 다른 평가 요소의 근거(형광펜)를 눌렀을 때 그 요소로 바꾼다(총평). 없으면 다른 요소의 근거는 눌러도 고르지 않는다
   * (세부 항목 평가: 평가 요소를 바꾸는 것은 주소가 바뀌는 이동이다).
   */
  onPickElement?: (elementIndex: number) => void;
};

/**
 * 평가하기의 서류 원문(총평·세부 항목 평가의 왼쪽 단) 상태. 평가하면서 근거를 원본에서 바로 확인하게 한다.
 * - 올린 지원자는 실제 학생부 PDF 의 가린 쪽 그림을 이 단에서 본다(보기: 글 / PDF. 쪽 그림이 있으면 PDF 가 먼저다).
 *   AI 가 근거로 쓴 구절이 평가 요소마다 다른 형광펜 색으로 칠해져 있고(components/evidenceTone.ts), 지금 고른 요소의 근거는 짙다.
 * - 근거를 고르면(총평의 근거 문장, 이 단의 이전·다음 근거, PDF 의 형광펜) 원본이 그 자리로 스크롤되고 그 구절이 더 짙게 표시된다.
 *   글 보기에서는 그 근거가 있는 서류 구분으로 바꾼 뒤 스크롤한다. PDF 의 형광펜을 눌러 고른 근거는 보던 자리를 그대로 둔다.
 * - 예시 지원자와 쪽 그림을 남기지 못한 학생부는 글만 보여 준다(형광펜 색과 근거 이동은 같다).
 * 지원자가 바뀌면 이 훅을 쓰는 컴포넌트가 새로 그려지므로(연결부의 key) 처음 상태로 시작한다. 평가 요소만 바뀌면 보던 자리·보기·배율은 그대로다.
 */
export function useEvaluationDocument({
  applicant,
  elements,
  highlightIndex,
  maskReported,
  onToggleMaskReport,
  onPickElement,
}: EvaluationDocumentInput) {
  // 올린 지원자만 가린 쪽 그림이 있다(그 분석을 남긴 때로 찾는다).
  const pagesKey =
    applicant.original !== undefined && applicant.stamp !== undefined ? recordPagesKey(applicant.code, applicant.stamp) : null;
  const records = useRecordPagesState(pagesKey);
  const recordPages = records.view;

  const [area, setArea] = useState<DocumentArea>(INITIAL_DOCUMENT_AREA);
  /** 고른 보기. 쪽 그림이 없으면 글만 보여 준다(아래 mode). */
  const [wantedMode, setWantedMode] = useState<RecordViewMode>("pdf");
  const mode: RecordViewMode = recordPages !== null && wantedMode === "pdf" ? "pdf" : "text";
  const [focus, setFocus] = useState<DocumentFocus | null>(null);

  /** 글 보기의 스크롤 영역과 그 안의 스크롤 대상(고른 근거의 첫 조각) */
  const textScrollRef = useRef<HTMLDivElement>(null);
  const textTargetRef = useRef<HTMLElement>(null);
  /** 마지막으로 발급한 선택 요청 번호 */
  const lastRequestRef = useRef(0);
  /** 보기마다 마지막으로 스크롤까지 처리한 선택 요청 번호 */
  const handledRef = useRef<Record<RecordViewMode, number>>({ text: 0, pdf: 0 });
  const viewport = usePdfViewport(mode === "pdf", pickMark);
  const { scrollToTarget, holdPlace, restorePlace } = viewport;

  /**
   * 크게 보기: 서류 원문과 그 옆 단이 화면 전체를 덮는다(넓은 배치에서만 버튼이 있다). 원본을 읽는 자리가 좁을 때 쓴다.
   * 켜고 끌 때 단의 크기가 달라져도 PDF 에서 보던 자리가 그대로 남게, 바꾸기 직전에 그 자리를 붙잡아 두고(holdPlace) 바뀐 직후에 되돌린다.
   */
  const [expanded, setExpanded] = useState(false);
  /**
   * 크게 보기를 켜기 직전의 문서 스크롤 자리. 덮는 동안 작업 단이 흐름에서 빠져 뒤의 문서가 짧아지면 브라우저가 스크롤을 당겨 놓으므로,
   * 켜기 전에(화면이 바뀌기 전에) 적어 두었다가 끈 직후에 되돌린다.
   */
  const pageScrollRef = useRef<number | null>(null);
  /** 서류 원문 단(<section>). 크게 볼 때 이 단이 든 작업 단(data-workbench 를 단 바깥 상자)을 찾는 데 쓴다. */
  const panelRef = useRef<HTMLElement>(null);

  function toggleExpanded() {
    holdPlace();
    if (!expanded) pageScrollRef.current = window.scrollY;
    setExpanded(!expanded);
  }

  // 크게 보는 동안 뒤에 가려진 문서가 스크롤되지 않게 막고, 작업 단 밖의 것(가려진 사이드바·상단 바·내 평가 입력 등)을 쓰지 못하게 한다
  // (초점이 보이지 않는 곳으로 빠지거나 가려진 입력란에 글이 들어가지 않게). 끄면(또는 다른 화면으로 가면) 모두 되돌린다.
  // 끈 직후에는 문서가 제 길이로 돌아온 뒤라(이 effect 는 화면을 바꾼 다음에 돈다) 켜기 전의 스크롤 자리로 되돌릴 수 있다.
  // 문서의 스크롤바가 생기고 사라지면 단의 폭이 달라지므로, 그것까지 끝난 뒤에(같은 effect 안에서, 그리기 전에) PDF 에서 보던 자리를 되돌린다.
  useLayoutEffect(() => {
    if (!expanded) {
      if (pageScrollRef.current !== null) {
        window.scrollTo({ top: pageScrollRef.current, behavior: "instant" });
        pageScrollRef.current = null;
      }
      restorePlace();
      return;
    }
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    const disabled = disableOutside(panelRef.current?.closest<HTMLElement>("[data-workbench]") ?? null);
    restorePlace();
    return () => {
      root.style.overflow = overflow;
      for (const element of disabled) element.inert = false;
    };
  }, [expanded, restorePlace]);

  // 크게 보는 동안 Esc 로 끌 수 있다. 다른 것이 이미 받은 Esc(preventDefault)나 한글 조합을 끝내는 Esc 는 넘긴다.
  useEffect(() => {
    if (!expanded) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || event.isComposing) return;
      holdPlace();
      setExpanded(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expanded, holdPlace]);

  /** 지금 평가 요소의 근거 문장 (원문 순서) */
  const evidences = useMemo(
    () => evidencesOf(applicant, highlightIndex, elements.length),
    [applicant, highlightIndex, elements.length],
  );
  // 다른 평가 요소를 보던 때 고른 근거는 지금 요소의 것이 아니므로 고르지 않은 것으로 본다.
  const focused =
    focus?.kind === "evidence" && focus.elementIndex === highlightIndex
      ? (evidences.find((evidence) => evidence.id === focus.evidenceId) ?? null)
      : null;
  const focusedIndex = focused === null ? -1 : evidences.indexOf(focused);
  const focusSectionId = focus?.kind === "section" ? focus.sectionId : null;
  const focusRequest = focus?.request ?? 0;
  const focusedOrigin = focused?.origin ?? null;

  /**
   * PDF 보기의 쪽과 그 위의 형광펜: 모든 평가 요소의 근거 구절(요소 색. 지금 요소는 짙게, 고른 근거는 더 짙게),
   * 고른 항목의 원문(옅은 남색). 고른 근거의 자리를 찾지 못했으면 그 근거가 든 항목의 원문을 대신 표시한다.
   */
  const pdfPages = useMemo((): PdfPageView[] => {
    const result = applicant.original;
    if (recordPages === null || result === undefined) return [];
    const indexOfCriterion = new Map(result.criteria.criteria.map((criterion, index) => [criterion.id, index]));
    const groups: PdfMarkGroup[] = [];
    for (const evidence of result.evidences) {
      const index = indexOfCriterion.get(evidence.criterionId);
      if (index === undefined || index >= elements.length) continue;
      const isFocus = focusedOrigin?.evidenceId === evidence.id;
      groups.push({
        id: evidence.id,
        rects: recordPages.evidences[evidence.id],
        tone: index,
        level: isFocus ? "focus" : index === highlightIndex ? "strong" : "soft",
        stamp: isFocus ? focusRequest : 0,
      });
    }
    const located = focusedOrigin !== null && (recordPages.evidences[focusedOrigin.evidenceId]?.length ?? 0) > 0;
    const sectionId = located ? null : (focusedOrigin?.sectionId ?? focusSectionId);
    if (sectionId !== null) {
      groups.push({ id: `section:${sectionId}`, rects: recordPages.sections[sectionId], tone: null, level: "section" });
    }
    const targetId = located ? (focusedOrigin?.evidenceId ?? null) : sectionId === null ? null : `section:${sectionId}`;
    return buildPdfPages(recordPages.pages, groups, targetId);
  }, [applicant.original, recordPages, elements.length, highlightIndex, focusedOrigin, focusSectionId, focusRequest]);

  // 근거나 항목을 고를 때마다(같은 것을 다시 골라도), 그리고 보기를 바꿨을 때, 지금 보기의 스크롤 영역만 그 자리로 스크롤한다.
  // 그 보기에서 이미 처리한 요청이면 스크롤하지 않는다(다른 화면에 갔다가 돌아와 effect 가 다시 실행돼도 원하지 않는 스크롤이 없다).
  useEffect(() => {
    if (focus === null || focus.request === handledRef.current[mode]) return;
    handledRef.current[mode] = focus.request;
    if (mode === "pdf") {
      // 자리를 찾지 못한 항목·근거는 표시가 없다. 그때는 스크롤하지 않는다.
      scrollToTarget();
      return;
    }
    scrollTextTo(textScrollRef.current, textTargetRef.current);
  }, [focus, mode, area, pdfPages, scrollToTarget]);

  function nextRequest(): number {
    lastRequestRef.current += 1;
    return lastRequestRef.current;
  }

  /** 지금 평가 요소의 근거를 고른다: 원본이 그 자리로 스크롤된다. 글 보기에서 보이게 그 근거가 있는 서류 구분으로 바꾼다. */
  function selectEvidence(evidenceId: string) {
    const evidence = evidences.find((item) => item.id === evidenceId);
    if (evidence === undefined) return;
    showAreaOf(evidence.place?.passageId);
    setFocus({ kind: "evidence", evidenceId, elementIndex: highlightIndex, request: nextRequest() });
  }

  function showAreaOf(passageId: string | undefined) {
    const passage = applicant.passages.find((item) => item.id === passageId);
    if (passage !== undefined) setArea(passage.area);
  }

  /** 이전·다음 근거: 끝에서는 반대쪽 끝으로 돈다. 아직 고른 근거가 없으면 첫 근거(이전이면 마지막 근거)다. */
  function stepEvidence(delta: 1 | -1) {
    if (evidences.length === 0) return;
    const next =
      focusedIndex < 0 ? (delta > 0 ? 0 : evidences.length - 1) : (focusedIndex + delta + evidences.length) % evidences.length;
    selectEvidence(evidences[next].id);
  }

  /**
   * 원본 PDF 의 형광펜을 눌렀다: 그 근거를 고른다. 보던 자리가 움직이지 않게 PDF 는 스크롤하지 않는다(이미 처리한 요청으로 적어 둔다).
   * 다른 평가 요소의 근거면 그 요소로 바꾼다(바꿀 수 없는 화면에서는 고르지 않는다).
   */
  function pickMark(originEvidenceId: string) {
    for (let index = 0; index < elements.length; index += 1) {
      const found = evidencesOf(applicant, index, elements.length).find((item) => item.origin?.evidenceId === originEvidenceId);
      if (found === undefined) continue;
      if (index !== highlightIndex) {
        if (onPickElement === undefined) return;
        onPickElement(index);
      }
      const request = nextRequest();
      handledRef.current.pdf = request;
      showAreaOf(found.place?.passageId);
      setFocus({ kind: "evidence", evidenceId: found.id, elementIndex: index, request });
      return;
    }
  }

  /** 원문의 쪽 번호를 누름: 그 항목을 고르고 PDF 보기로 바꾼다 */
  function showSectionInPdf(sectionId: string) {
    setFocus({ kind: "section", sectionId, request: nextRequest() });
    setWantedMode("pdf");
  }

  const selectedSlot = slotOf(applicant, highlightIndex);
  const slotLimit = evidenceSlotCount(applicant, elements.length);
  const focusedPlace = focused?.place ?? null;

  return {
    /** 지금 고른 근거의 id (없으면 null). 총평의 근거 문장이 고른 모양을 그리는 데 쓴다 */
    focusedEvidenceId: focused?.id ?? null,
    /** 근거를 고를 때마다 바뀌는 번호 (고른 근거 문장을 목록에서 보이게 스크롤하는 때를 아는 데 쓴다) */
    focusRequest,
    onSelectEvidence: selectEvidence,
    /** 서류 원문 단(components/EvaluateParts.tsx 의 DocumentPanel)에 그릴 값 */
    view: {
      /** 넓은 배치인지: 올린 지원자는 원본을 크게 보도록 이 단이 넓고 화면 높이를 채운다(쪽 그림을 불러오는 동안에도 같은 배치다) */
      wide: pagesKey !== null,
      /** 크게 보기를 켰는지와 켜고 끄기 (넓은 배치의 머리 줄 버튼. 화면은 켜졌을 때 작업 단을 화면 전체로 편다) */
      expanded,
      onToggleExpanded: toggleExpanded,
      panelRef,
      areas: documentAreasOf(applicant).map((item) => ({ area: item, on: item === area, onPick: () => setArea(item) })),
      /**
       * 고른 서류 구분의 원문과 조각마다의 형광펜. 조각이 여러 요소의 근거면(올린 지원자의 겹친 구절) 지금 요소가 그 가운데 있을 때
       * 지금 요소의 색, 없으면 맨 앞 요소의 색이다. 고른 근거의 구절에 걸친 조각은 "focus" 이고 그 첫 조각이 스크롤 대상이다.
       */
      passages: passagesIn(applicant, area).map((passage) => {
        const place = focusedPlace?.passageId === passage.id ? focusedPlace : null;
        let offset = 0;
        let targeted = false;
        return {
          id: passage.id,
          source: passageSource(passage),
          // 올린 지원자의 원문에는 실제 PDF 의 쪽 번호와 그 항목의 id 가 있다(쪽 번호를 누르면 onShowSection 에 그 id 를 준다).
          page: passage.origin === undefined ? null : { label: `${passage.origin.page}쪽`, sectionId: passage.origin.sectionId },
          segments: passage.segments.map((segment, index) => {
            const start = offset;
            offset += segment.text.length;
            const mark = segmentTone(segment, selectedSlot, highlightIndex, slotLimit);
            const inFocus = place !== null && mark !== null && start < place.end && place.start < offset;
            const isTarget = inFocus && !targeted;
            if (isTarget) targeted = true;
            const level: SegmentLevel = mark === null ? null : inFocus ? "focus" : mark.selected ? "strong" : "soft";
            return {
              // 고른 근거의 조각은 고를 때마다 새로 그려 나타나는 움직임이 다시 걸리게 한다.
              key: inFocus ? `${passage.id}-${index}-${focusRequest}` : `${passage.id}-${index}`,
              text: segment.text,
              tone: mark?.tone ?? 0,
              level,
              isTarget,
            };
          }),
        };
      }),
      /** 평가 요소와 그 형광펜 색 (예시 지원자는 근거가 있는 앞의 요소들만) */
      legend: elements.slice(0, slotLimit).map((element, index) => ({ id: element.id, name: element.name, tone: index })),
      maskReported,
      onToggleMaskReport,
      // 원문보기 화면(/evaluate/original). 올린 지원자는 그 학생부의 분석 결과를, 예시 지원자는 미리 만든 샘플 결과를 보여 준다.
      originalHref: evaluateOriginalPath(applicant.code),
      textScrollRef,
      textTargetRef,
      /** 글 보기의 쪽 번호를 누름: 이 단이 PDF 보기로 바뀌어 실제 PDF 의 그 항목 자리를 보여 준다. 쪽 그림이 없으면 null(쪽 번호가 눌리지 않는다) */
      onShowSection: recordPages === null ? null : showSectionInPdf,
      /** 실제 PDF 보기 */
      pdf: {
        /** 가린 쪽 그림이 있는지 (없으면 보기 고르기와 쪽 번호 버튼이 없다) */
        available: recordPages !== null,
        /** 쪽 그림을 불러오는 중인지 (그동안 원문 자리를 비워 둔다: 글이 잠깐 보였다가 PDF 로 바뀌지 않게) */
        loading: records.status === "loading",
        mode,
        pages: pdfPages,
        currentPage: viewport.currentPage,
        zoom: viewport.zoom,
        pan: viewport.pan,
        scrollRef: viewport.scrollRef,
        targetRef: viewport.targetRef,
        /** 누를 수 있는 형광펜: 다른 평가 요소로 바꿀 수 있는 화면(총평)은 모든 근거, 아니면 지금 요소의 근거만 */
        pickable: onPickElement === undefined ? ("current" as const) : ("all" as const),
        onSelectMode: setWantedMode,
      },
      /** 지금 평가 요소의 근거를 원본에서 차례로 보는 줄: "근거 2 / 7" 과 이전·다음, 고른 근거의 출처와 AI 가 적은 이유 */
      evidenceNav: {
        text: focusedIndex < 0 ? `근거 ${evidences.length}건` : `근거 ${focusedIndex + 1} / ${evidences.length}`,
        tone: highlightIndex,
        disabled: evidences.length === 0,
        onPrevious: () => stepEvidence(-1),
        onNext: () => stepEvidence(1),
        current: focused === null ? null : { source: focused.source, reason: focused.reason ?? null },
      },
    },
  };
}

/**
 * 화면 전체를 덮은 작업 단(bench) 밖의 것을 쓰지 못하게 한다(inert: 초점을 받지 않고 눌리지 않으며 보조 기술에도 읽히지 않는다).
 * 작업 단에서 위로 올라가며 조상마다 그 형제들을 끈다. <body> 바로 아래의 것(앱 밖의 것)은 그대로 둔다.
 * 이미 꺼져 있던 것은 건드리지 않는다. 끈 요소들을 돌려준다(되돌릴 때 쓴다). 작업 단을 찾지 못했으면 아무것도 끄지 않는다.
 */
function disableOutside(bench: HTMLElement | null): HTMLElement[] {
  const disabled: HTMLElement[] = [];
  let node = bench;
  while (node !== null && node.parentElement !== null && node.parentElement !== document.body) {
    for (const sibling of node.parentElement.children) {
      if (sibling === node || !(sibling instanceof HTMLElement) || sibling.inert) continue;
      sibling.inert = true;
      disabled.push(sibling);
    }
    node = node.parentElement;
  }
  return disabled;
}

/**
 * 글 보기의 스크롤 영역(container)만 스크롤해 고른 근거의 구절(target)이 보이게 한다.
 * scrollIntoView 는 바깥 요소(문서)까지 움직일 수 있어 쓰지 않는다. 이미 다 보이면 움직이지 않는다.
 */
function scrollTextTo(container: HTMLElement | null, target: HTMLElement | null) {
  if (container === null || target === null) return;
  const containerRect = container.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  if (targetRect.top >= containerRect.top && targetRect.bottom <= containerRect.bottom) return;
  const top = targetRect.top - containerRect.top + container.scrollTop - container.clientHeight * TEXT_TARGET_OFFSET;
  container.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}
