import Link from "next/link";
import type { RefObject } from "react";
import {
  AccentTag,
  BUTTON_PRIMARY_CLASS,
  BUTTON_SECONDARY_CLASS,
  ConsoleCrumbs,
  ConsoleTitle,
  PANEL_CLASS,
  PANEL_HEAD_CLASS,
  PANEL_TITLE_CLASS,
  StatusChip,
  segmentClass,
  type ChipTone,
  type ConsoleCrumb,
} from "@/components/consoleUi";
import type { ApplicantFilter, ApplicantStatus, MaskDecision, ReviewExpression } from "@/lib/applicants/applicants";
import type { DeadlineRemaining } from "@/lib/applicants/deadline";

type ApplicantsScreenProps = {
  /** 현재 위치 줄의 "지원자 관리" 가 가는 주소 */
  applicantsPath: string;
  /** 학생부 올리기 화면의 주소 */
  uploadPath: string;
  /** 화면이 준비됐는지 (서버 HTML·hydration 에서는 false: 본문을 조작할 수 없다) */
  ready: boolean;
  /** 지금 걸러 보기 (현재 위치 줄의 다섯째 칸) */
  filter: ApplicantFilter;
  /** 고른 지원자 코드 ("A-0133", 현재 위치 줄의 마지막 칸). 없으면 null. */
  selectedCode: string | null;
  /** 제목 옆의 글 (전형·모집 단위·접수 건수) */
  subtitle: string;
  /** 접수 마감. remaining 은 브라우저에서 읽기 전(서버 렌더링·hydration 중)에는 null 이라 비워 둔다. */
  deadline: { label: string; dateText: string; remaining: DeadlineRemaining | null };
  /** 접수 인원·모집 인원·경쟁률 ("10.5:1") */
  applications: { total: number; quota: number; rate: string };
  /** 서류 검토 진행 현황. percent 는 "96.5" (막대의 채움 너비도 이 값) */
  review: { percent: string; done: number; waiting: number };
  /** 걸러 보기 버튼 다섯 (수는 전체 지원자 기준) */
  filters: { filter: ApplicantFilter; count: number; pressed: boolean }[];
  /** 내 배정 보기가 켜졌는지 */
  mineOnly: boolean;
  /** 보이는 줄 (코드 순서) */
  rows: {
    code: string;
    documentSummary: string;
    documentProblem: boolean;
    /** 가린 곳 수 ("13곳 가림") */
    maskText: string;
    /** 저장한 결정으로 정하지 않은 표현이 있으면 그 수 ("확인 2곳", 가린 곳 수 뒤에 빨강으로 붙인다). 없으면 null. */
    maskCheckText: string | null;
    assignee: string;
    status: ApplicantStatus;
    selected: boolean;
  }[];
  /** 고른 지원자의 확인 필요 사항. 고른 지원자가 없으면 null. */
  detail: {
    code: string;
    status: ApplicantStatus;
    /** 원문보기 화면의 주소 */
    originalHref: string;
    documentCounts: readonly { label: string; value: string }[];
    /** 서류 정리에 문제가 있을 때의 안내 */
    documentNotice: string | null;
    maskCounts: readonly { label: string; count: number }[];
    /** decision 은 화면에 보이는 결정(저장하지 않은 결정 → 저장한 결정), 정하지 않았으면 null */
    expressions: (ReviewExpression & { decision: MaskDecision | null })[];
    /** 화면에 보이는 결정이 아직 없는 표현 수 ("남은 확인 2곳". 0 이면 "모두 확인함") */
    undecided: number;
    /** 저장된 값과 다른 결정이 있을 때만 true */
    canSave: boolean;
    /** 화면에 보이는 결정이 저장소에 저장된 그대로인지 (저장하기 버튼의 글이 "저장됨" 이 된다. 이때 canSave 는 false 다) */
    saved: boolean;
  } | null;
  /** 상세 영역의 머리 아래 안내 (결정을 저장소에 쓰지 못함). 없으면 빈 배열. */
  notices: string[];
  /** 상세 영역의 스크롤 영역 (지원자를 바꾸면 맨 위로 돌린다, 저장 뒤 초점을 받는다) */
  detailScrollRef: RefObject<HTMLDivElement | null>;
  /** 저장하기 버튼 (저장할 때 초점이 있었는지 본다) */
  saveButtonRef: RefObject<HTMLButtonElement | null>;
  /** 지금 눌려 있는 걸러 보기 버튼 (초점을 줄 곳에 고른 지원자가 없으면 초점을 받는다) */
  pressedFilterRef: RefObject<HTMLButtonElement | null>;
  /** 고른 지원자의 줄 버튼: 코드부터 상태까지 줄 전체가 버튼 하나다 (지원자를 고른 뒤, 초점이 있던 컨트롤이 사라졌을 때 초점을 받는다) */
  selectedCodeButtonRef: RefObject<HTMLButtonElement | null>;
  /** 현재 위치 줄과 본문(제목 줄 아래 전부) (초점이 이 화면 안에 있는지 볼 때 쓴다) */
  crumbNavRef: RefObject<HTMLElement | null>;
  contentRef: RefObject<HTMLDivElement | null>;
  onSelectFilter: (filter: ApplicantFilter) => void;
  onToggleMine: () => void;
  onSelectApplicant: (code: string) => void;
  onDecide: (expressionId: string, decision: MaskDecision) => void;
  onSave: () => void;
};

/** 상태 표시의 색 (components/consoleUi.tsx 의 StatusChip) */
const STATUS_TONE: Record<ApplicantStatus, ChipTone> = {
  "확인 필요": "red",
  "진행 중": "blue",
  대기: "gray",
  완료: "green",
};

/**
 * 키보드로 초점을 옮길 때 브라우저는 요소의 상자만 화면에 보이게 스크롤하므로, 상자 바깥 4px 에 그리는 초점 표시(전역 :focus-visible)가
 * 화면 끝에서 잘릴 수 있다. 이 화면의 누를 수 있는 것에는 scroll-margin 8px 을 주어(scroll-m-[8px]) 초점 표시까지 보이게 스크롤되게 한다.
 * 모양에는 영향이 없다.
 *
 * 지원자 관리 화면: 현재 위치 줄, 제목 줄, 요약 상자(접수 마감·접수 인원·서류 검토 진행 현황), 걸러 보기·내 배정 보기,
 * 지원자 표와 오른쪽 상세 영역("확인 필요 사항")이 든 상자. 치수·색·글자는 디자인 값 그대로다.
 * 껍데기의 본문(<main>)이 세로로 쌓는 flex 상자라, 본문을 감싼 상자와 그 안의 마지막 상자(표·상세)가 남는 높이를 채운다.
 * 디자인에 없어 더한 것: 걸러 보기 줄 오른쪽 끝의 "학생부 올리기" 링크(학생부를 올려 분석하는 화면으로 간다).
 * "원문보기" 는 원문보기 화면으로 가는 링크다(디자인의 버튼 모양 그대로).
 * 현재 위치의 "지원자 관리" 는 보통 링크(next/link)라 화면의 JavaScript 가 준비되기 전에도 동작한다. 그 아래 본문(제목 줄, 요약 상자,
 * 걸러 보기 줄, 표, 상세 영역)은 준비되기 전(서버 HTML·hydration)에는 inert 라 초점을 받지 않고 눌리지 않는다(모양은 같다).
 * 준비 전에 들어간 초점이나 누름이 준비되면서 바뀌는 화면(저장한 결정 반영, 상세 스크롤)과 어긋나지 않게 하려는 것이다.
 */
export function ApplicantsScreen({
  applicantsPath,
  uploadPath,
  ready,
  filter,
  selectedCode,
  subtitle,
  deadline,
  applications,
  review,
  filters,
  mineOnly,
  rows,
  detail,
  notices,
  detailScrollRef,
  saveButtonRef,
  pressedFilterRef,
  selectedCodeButtonRef,
  crumbNavRef,
  contentRef,
  onSelectFilter,
  onToggleMine,
  onSelectApplicant,
  onDecide,
  onSave,
}: ApplicantsScreenProps) {
  // 현재 위치: 홈 / 지원자 관리(링크) / 접수현황 / 서류 검토 / 걸러 보기 이름 / 고른 지원자 코드. 마지막 칸이 지금 위치다(굵게).
  // 고른 지원자가 없으면 걸러 보기 이름이 마지막 칸이다. 나머지는 갈 곳 없는 링크다.
  const crumbs: ConsoleCrumb[] = [
    { label: "홈" },
    { label: "지원자 관리", href: applicantsPath },
    { label: "접수현황" },
    { label: "서류 검토" },
    { label: filter },
    ...(selectedCode === null ? [] : [{ label: selectedCode }]),
  ];

  return (
    <>
      <ConsoleCrumbs items={crumbs} navRef={crumbNavRef} />

      {/*
        본문을 감싸는 상자. 준비 전에는 inert 다(hooks/useApplicants.ts 의 ready). 껍데기 본문의 남는 높이를 채우고 안에서 다시 세로로 쌓아,
        마지막 상자(표·상세)가 화면 아래까지 늘어난다.
      */}
      <div ref={contentRef} inert={!ready} className="flex min-w-0 flex-[1_1_auto] flex-col">
        <ConsoleTitle title="지원자 관리" note={subtitle} />

        {/* 요약 상자: 테두리 상자 하나에 세 칸. 칸 사이는 세로 선이고, 좁으면 줄을 바꾼다(서류 검토 진행 현황은 432px 까지만 넓어진다). */}
        <div className={`mt-[20px] flex flex-wrap ${PANEL_CLASS}`}>
          <div className="flex min-w-0 flex-[999_1_420px] flex-wrap">
            <section aria-labelledby="deadline-title" className={CARD_CLASS}>
              <h2 id="deadline-title" className={CARD_TITLE_CLASS}>
                접수 마감
              </h2>
              <p className={`gap-x-[8px] ${CARD_MAIN_CLASS}`}>
                <strong className={CARD_NUMBER_CLASS}>{deadline.dateText}</strong>
                <span>{deadline.label}</span>
              </p>
              {/* 남은 날은 브라우저에서 읽은 뒤에 채운다. 그 전에도 줄의 높이는 같다(min-height). */}
              <p className={`min-h-[18px] ${CARD_NOTE_CLASS}`}>
                <DeadlineText remaining={deadline.remaining} />
              </p>
            </section>
            <section aria-labelledby="count-title" className={`${CARD_CLASS} border-l border-l-[#E4E4E4]`}>
              <h2 id="count-title" className={CARD_TITLE_CLASS}>
                접수 인원
              </h2>
              <p className={`gap-x-[6px] ${CARD_MAIN_CLASS}`}>
                <span>현재</span>
                <strong className={CARD_NUMBER_CLASS}>{applications.total}명</strong>
                <span>지원</span>
              </p>
              <p className={`flex flex-wrap gap-x-[16px] gap-y-0 ${CARD_NOTE_CLASS}`}>
                <span>
                  모집 인원 <strong className={CARD_STRONG_CLASS}>{applications.quota}명</strong>
                </span>
                <span>
                  현재 경쟁률 <strong className={CARD_STRONG_CLASS}>{applications.rate}</strong>
                </span>
              </p>
            </section>
          </div>
          <section
            aria-labelledby="review-title"
            className="box-border max-w-[432px] min-w-0 flex-[1_1_432px] border-l border-l-[#E4E4E4] px-[20px] py-[14px]"
          >
            <h2 id="review-title" className={CARD_TITLE_CLASS}>
              서류 검토 진행 현황
            </h2>
            <p className={`gap-x-[8px] ${CARD_MAIN_CLASS}`}>
              <strong className={CARD_NUMBER_CLASS}>{review.percent}%</strong>
              <span>검토 완료</span>
            </p>
            {/* 채움 너비는 검토 완료 비율과 같은 값이다. */}
            <div aria-hidden="true" className="mt-[8px] h-[6px] overflow-hidden rounded-[3px] bg-[#E4E6EE]">
              <div className="h-[6px] bg-[#001AD0]" style={{ width: `${review.percent}%` }} />
            </div>
            <dl className="mt-[8px] flex flex-wrap gap-x-[16px] gap-y-0 text-[13px] leading-[18px] text-[#505050]">
              <div className="flex gap-[6px]">
                <dt>검토 완료</dt>
                <dd className={`tabular-nums ${CARD_STRONG_CLASS}`}>{review.done}건</dd>
              </div>
              <div className="flex gap-[6px]">
                <dt>검토 대기</dt>
                <dd className={`tabular-nums ${CARD_STRONG_CLASS}`}>{review.waiting}건</dd>
              </div>
            </dl>
          </section>
        </div>

        <div className="mt-[16px] flex flex-wrap items-center justify-between gap-x-[16px] gap-y-[8px]">
          {/* 걸러 보기: 이어 붙인 버튼 다섯. 초점을 받은 버튼은 초점 표시가 이웃 버튼에 가리지 않게 맨 위로 올린다. */}
          <div role="group" aria-label="상태별 보기" className="flex">
            {filters.map((item, index) => (
              <button
                key={item.filter}
                ref={item.pressed ? pressedFilterRef : undefined}
                type="button"
                aria-pressed={item.pressed}
                onClick={() => onSelectFilter(item.filter)}
                className={`${segmentClass(index, filters.length, item.pressed)} h-[32px] cursor-pointer scroll-m-[8px] gap-[6px] px-[12px] leading-[normal] focus-visible:z-[2]`}
              >
                {item.filter}
                <span className={`tabular-nums ${item.pressed ? "text-[#001AD0]" : "text-[#767676]"}`}>{item.count}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-x-[8px] gap-y-[8px]">
            <span id="mine-label" className="text-[13px] leading-[18px] font-medium text-[#505050]">
              내 배정 보기
            </span>
            {/* 켜고 끄는 스위치: 켜지면 파란 바탕에 동그라미가 오른쪽, 꺼지면 회색 바탕에 동그라미가 왼쪽이다. */}
            <button
              type="button"
              role="switch"
              aria-checked={mineOnly}
              aria-labelledby="mine-label"
              onClick={onToggleMine}
              className={`box-border flex h-[20px] w-[36px] cursor-pointer scroll-m-[8px] items-center rounded-[10px] border-0 p-[2px] ${
                mineOnly ? "justify-end bg-[#001AD0]" : "justify-start bg-[#767676]"
              }`}
            >
              <span aria-hidden="true" className="h-[16px] w-[16px] rounded-[50%] bg-white" />
            </button>
            {/* 디자인에는 없는 링크: 학생부 PDF 를 올려 분석하는 화면으로 간다(올린 학생부는 이 표와 평가하기에 지원자로 나온다). */}
            <Link href={uploadPath} className={`${BUTTON_SECONDARY_CLASS} ml-[8px] h-[32px] scroll-m-[8px] px-[12px]`}>
              학생부 올리기
            </Link>
          </div>
        </div>

        {/*
          표와 상세 영역이 든 상자. 본문의 남는 높이를 채우고, 두 칸의 높이는 같다(더 긴 쪽에 맞춘다). 좁으면 상세 영역이 표 아래로 내려간다.
          표의 높이에는 제한이 없어 줄이 많으면 문서가 세로로 스크롤된다(초점을 옮긴 뒤 화면에 보이게 하는 계산이 문서 스크롤 기준이다:
          hooks/useApplicants.ts 의 revealVertically).
        */}
        <div className={`mt-[12px] flex flex-[1_1_auto] flex-wrap items-stretch ${PANEL_CLASS}`}>
          {/* 표는 폭이 620px 아래로 줄지 않고, 칸이 그보다 좁으면 이 칸 안에서 가로로 스크롤된다. */}
          <div className="min-w-0 flex-[999_1_420px] overflow-x-auto">
            <div className="min-w-[620px]">
              <div
                className={`rounded-tl-[7px] px-[20px] text-[12px] leading-[16px] font-semibold text-[#505050] ${HEAD_HEIGHT_CLASS} ${ROW_GRID_CLASS} ${PANEL_HEAD_CLASS}`}
              >
                <span>지원자 코드</span>
                <span>서류 정리</span>
                <span>개인정보 가림</span>
                <span>배정</span>
                <span>상태</span>
              </div>
              {rows.length === 0 ? (
                <p className="px-[20px] py-[32px] text-center text-[14px] leading-[20px] text-[#505050]">
                  조건에 맞는 지원자가 없습니다.
                </p>
              ) : (
                <ul>
                  {rows.map((row) => (
                    <li key={row.code} className="border-b border-b-[#E4E4E4]">
                      {/*
                        줄 전체가 버튼 하나다(aria-pressed: 고른 줄). 마우스로 줄의 어디를 누르든, 키보드로 누르든 그 지원자를 고르고,
                        고른 뒤 초점은 고른 지원자의 줄 버튼에 있다(hooks/useApplicants.ts).
                        키보드 초점 표시는 줄 안쪽에 그린다(outline-offset -2px). 줄이 가로 스크롤 칸의 양 끝까지 닿아 있어 전역 규칙(바깥 2px)대로면
                        양옆이 잘리기 때문이다. 전역 :focus-visible 규칙은 레이어 밖에 있어 important 로 덮는다.
                      */}
                      <button
                        ref={row.selected ? selectedCodeButtonRef : undefined}
                        type="button"
                        aria-pressed={row.selected}
                        onClick={() => onSelectApplicant(row.code)}
                        className={`box-border min-h-[48px] w-full cursor-pointer scroll-m-[8px] border-0 px-[20px] py-[6px] text-left text-[14px] leading-[20px] text-[#505050] focus-visible:outline-offset-[-2px]! ${ROW_GRID_CLASS} ${
                          row.selected ? "bg-[#EEF0FF]" : "bg-white"
                        }`}
                      >
                        <strong className={`font-semibold tabular-nums ${row.selected ? "text-[#001AD0]" : "text-[#111111]"}`}>
                          {row.code}
                        </strong>
                        <span className={row.documentProblem ? "font-medium text-[#BA1A1A]" : "font-normal"}>
                          {row.documentSummary}
                        </span>
                        <span>
                          {row.maskText}
                          {row.maskCheckText !== null && (
                            <span className="font-medium text-[#BA1A1A]"> · {row.maskCheckText}</span>
                          )}
                        </span>
                        <span>{row.assignee}</span>
                        <span>
                          <StatusChip tone={STATUS_TONE[row.status]}>{row.status}</StatusChip>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <section
            aria-labelledby={detail === null ? "detail-title" : "detail-code"}
            className="box-border max-w-[432px] min-w-0 flex-[1_1_432px] border-l border-l-[#E4E4E4]"
          >
            {/*
              이 칸은 표와 같은 높이로 늘어나므로, 표가 길 때도 내용이 보이도록 내용을 화면 맨 위에 붙인다(sticky).
              위에 붙어 있는 동안 아래쪽이 화면 밖에 남지 않도록 내용 전체 높이를 화면 높이 이하로 둔다(max-height. 아래 안쪽 여백 16px 이
              화면 아래 끝과의 틈이 된다). 넘치려 하면 세로 flex 로 스크롤 영역만 줄어든다(디자인의 최대 528px 에서 120px 까지. 머리 줄·코드 줄·
              안내 문구는 줄지 않는다). 화면 높이·안내 줄 수가 바뀌면 CSS 가 따라 계산한다. 좁은 화면에서 이 칸이 표 아래로 내려가면
              칸의 높이가 내용과 같아 붙을 일이 없다.
            */}
            <div className="sticky top-0 flex max-h-[100vh] flex-col">
              <div className={`flex flex-none items-center rounded-tr-[7px] px-[20px] ${HEAD_HEIGHT_CLASS} ${PANEL_HEAD_CLASS}`}>
                <h2 id="detail-title" className={`text-[#111111] ${PANEL_TITLE_CLASS}`}>
                  확인 필요 사항
                </h2>
              </div>
              <div className="flex min-h-0 flex-col px-[20px] py-[16px]">
                {detail === null ? (
                  <p className="text-[14px] leading-[20px] text-[#505050]">선택한 지원자가 없습니다.</p>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-[12px]">
                    <div className="flex flex-wrap items-center gap-x-[10px] gap-y-[4px]">
                      <h3
                        id="detail-code"
                        className="text-[22px] leading-[30px] font-bold tracking-[-0.01em] whitespace-nowrap tabular-nums"
                      >
                        {detail.code}
                      </h3>
                      <StatusChip tone={STATUS_TONE[detail.status]}>{detail.status}</StatusChip>
                    </div>
                    <div className="flex gap-[8px]">
                      <Link href={detail.originalHref} className={`${DETAIL_BUTTON_CLASS} ${BUTTON_SECONDARY_CLASS}`}>
                        원문보기
                      </Link>
                      {/* 저장된 값과 다른 결정이 있을 때만 눌린다. 화면의 결정이 저장된 그대로면 글이 "저장됨" 이다(눌리지 않는다). */}
                      <button
                        ref={saveButtonRef}
                        type="button"
                        disabled={!detail.canSave}
                        onClick={onSave}
                        className={`${DETAIL_BUTTON_CLASS} ${BUTTON_PRIMARY_CLASS}`}
                      >
                        {detail.saved ? "저장됨" : "저장하기"}
                      </button>
                    </div>
                  </div>
                )}
                {notices.map((notice) => (
                  <p key={notice} role="alert" className="mt-[8px] text-[13px] leading-[18px] font-medium text-[#BA1A1A]">
                    {notice}
                  </p>
                ))}
                {detail !== null && (
                  // 상세 내용은 이 영역 안에서만 세로로 스크롤한다(내용이 짧으면 내용 높이, 길면 528px 까지. 키보드로도 스크롤된다).
                  // 스크롤바는 브라우저의 가는 스크롤바다(손잡이 #CFCFCF, 길은 투명).
                  // 스크롤 영역은 밖으로 나가는 것을 자르므로, 영역의 왼쪽·아래 끝에 붙어 있는 "가림"·"그대로 둠" 의 초점 표시(상자 바깥 4px)가
                  // 잘리지 않게 영역을 왼쪽으로 4px, 아래로 2px 넓힌다(맨 아래 묶음의 아래 여백 2px 과 합쳐 4px). 넓힌 만큼 바깥 여백을 음수로 주어
                  // 내용의 위치와 차지하는 높이는 디자인 그대로다(최대 높이 530px = 디자인의 528px + 넓힌 2px).
                  <div
                    ref={detailScrollRef}
                    tabIndex={0}
                    aria-label="확인 필요 사항 상세"
                    className="mt-[16px] -mb-[2px] -ml-[4px] box-border max-h-[530px] min-h-[120px] scroll-m-[8px] overflow-y-auto pb-[2px] pl-[4px] [scrollbar-color:#CFCFCF_transparent] [scrollbar-width:thin]"
                  >
                    <div className={DETAIL_BLOCK_CLASS}>
                      <h3 className={PANEL_TITLE_CLASS}>서류 확인</h3>
                      <dl className={COUNT_LIST_CLASS}>
                        {detail.documentCounts.map((item, index) => (
                          <CountCell key={item.label} label={item.label} value={item.value} index={index} />
                        ))}
                      </dl>
                      {detail.documentNotice !== null && (
                        <p className="mt-[8px] text-[13px] leading-[18px] font-medium text-[#BA1A1A]">{detail.documentNotice}</p>
                      )}
                    </div>
                    <div className={DETAIL_BLOCK_CLASS}>
                      <h3 className={PANEL_TITLE_CLASS}>개인정보 가림 확인</h3>
                      {/* 종류별 가림 수. 가린 것이 없는 올린 지원자(masks 가 빈 결과)는 칸이 없다(빈 목록을 그리지 않는다). */}
                      {detail.maskCounts.length > 0 && (
                        <dl className={COUNT_LIST_CLASS}>
                          {detail.maskCounts.map((item, index) => (
                            <CountCell key={item.label} label={item.label} value={item.count} index={index} />
                          ))}
                        </dl>
                      )}
                    </div>
                    <div className="border-t border-t-[#E4E4E4] pt-[12px] pb-[2px]">
                      <div className="flex flex-wrap items-center gap-x-[8px] gap-y-[4px]">
                        <h3 className={PANEL_TITLE_CLASS}>가릴지 확인이 필요한 표현</h3>
                        <AccentTag>AI 제안</AccentTag>
                        {/* 화면에 보이는 결정(저장하지 않은 것 포함) 기준으로 아직 정하지 않은 표현 수. 표현이 없으면 적지 않는다. */}
                        {detail.expressions.length > 0 && (
                          <span className="ml-auto text-[12px] leading-[16px] text-[#505050]">
                            {detail.undecided > 0 ? `남은 확인 ${detail.undecided}곳` : "모두 확인함"}
                          </span>
                        )}
                      </div>
                      {detail.expressions.length === 0 ? (
                        <p className="mt-[12px] text-[14px] leading-[20px] text-[#505050]">확인이 필요한 표현이 없습니다.</p>
                      ) : (
                        detail.expressions.map((expression, index) => (
                          <ExpressionReview
                            key={expression.id}
                            expression={expression}
                            first={index === 0}
                            onDecide={(decision) => onDecide(expression.id, decision)}
                          />
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

/** 요약 상자의 한 칸 (접수 마감, 접수 인원): 두 칸이 나란히 놓이고 좁으면 줄을 바꾼다. */
const CARD_CLASS = "box-border min-w-0 flex-[1_1_220px] px-[20px] py-[14px]";
const CARD_TITLE_CLASS = "text-[13px] leading-[18px] font-medium text-[#767676]";
/** 칸의 큰 숫자 줄: 큰 숫자와 그 옆의 작은 글이 글자 밑선을 맞춘다 (사이 간격은 쓰는 쪽이 정한다) */
const CARD_MAIN_CLASS = "mt-[6px] flex flex-wrap items-baseline gap-y-0 text-[13px] font-medium text-[#505050]";
const CARD_NUMBER_CLASS = "text-[22px] leading-[30px] font-bold tracking-[-0.01em] text-[#111111] tabular-nums";
/** 칸의 아래 줄 (남은 날, 모집 인원·경쟁률) */
const CARD_NOTE_CLASS = "mt-[6px] text-[13px] leading-[18px] text-[#505050]";
/** 아래 줄 안의 강조한 값 */
const CARD_STRONG_CLASS = "font-semibold text-[#111111]";
/**
 * 표와 상세 영역의 머리 줄 높이: 안쪽 40px 이고 아래 선은 그 밖에 더해진다(디자인이 그렇다. 합 41px).
 * 선까지 넣어 41px 로 적지 않는 것은, 화면 배율이 정수가 아니면 선의 굵기가 1px 이 아니게 그려져 합이 디자인과 달라지기 때문이다.
 */
const HEAD_HEIGHT_CLASS = "box-content h-[40px]";
/** 표의 머리 줄과 줄 버튼이 같이 쓰는 칸 나눔: 지원자 코드 92px, 서류 정리 1.25, 개인정보 가림 1, 배정 64px, 상태 100px */
const ROW_GRID_CLASS = "grid grid-cols-[92px_minmax(0,1.25fr)_minmax(0,1fr)_64px_100px] items-center gap-x-[12px] gap-y-0";
/** 상세 영역 머리의 버튼(원문보기, 저장하기)에 더하는 높이·안쪽 여백. 색·테두리는 components/consoleUi.tsx 의 버튼 클래스다. */
const DETAIL_BUTTON_CLASS = "h-[32px] cursor-pointer scroll-m-[8px] px-[12px] leading-[normal] whitespace-nowrap";
/** 상세 영역의 묶음 하나 (서류 확인, 개인정보 가림 확인): 위에 선 */
const DETAIL_BLOCK_CLASS = "border-t border-t-[#E4E4E4] py-[12px]";
/** 상세 영역의 숫자 칸 줄: 한 줄에 네 칸. 넷을 넘으면(올린 지원자의 가림 종류) 다음 줄로 넘어간다. */
const COUNT_LIST_CLASS = "mt-[8px] grid grid-cols-4 gap-y-[8px]";

/** 접수 마감 칸의 남은 날: "마감일까지 2일"(숫자와 "일" 만 빨강), 당일 "오늘 마감", 지나면 "마감 지남"(둘 다 전체가 빨강). 읽기 전에는 비운다. */
function DeadlineText({ remaining }: { remaining: DeadlineRemaining | null }) {
  if (remaining === null) return null;
  if (remaining.kind === "today") return <strong className={DEADLINE_ALERT_CLASS}>오늘 마감</strong>;
  if (remaining.kind === "passed") return <strong className={DEADLINE_ALERT_CLASS}>마감 지남</strong>;
  return (
    <>
      마감일까지 <strong className={DEADLINE_ALERT_CLASS}>{remaining.days}일</strong>
    </>
  );
}

const DEADLINE_ALERT_CLASS = "font-semibold text-[#BA1A1A]";

/** 상세 영역의 숫자 칸 하나: 흐린 이름 아래 굵은 값. 줄의 첫 칸(네 칸마다)이 아니면 왼쪽에 세로 선이 있다. */
function CountCell({ label, value, index }: { label: string; value: string | number; index: number }) {
  return (
    <div className={index % 4 === 0 ? "min-w-0" : "min-w-0 border-l border-l-[#E4E4E4] pl-[12px]"}>
      <dt className="text-[12px] leading-[16px] text-[#767676] [overflow-wrap:anywhere]">{label}</dt>
      <dd className="mt-[2px] text-[15px] leading-[22px] font-semibold tabular-nums [overflow-wrap:anywhere]">{value}</dd>
    </div>
  );
}

const DECISION_BUTTON_CLASS =
  "box-border h-[32px] cursor-pointer scroll-m-[8px] rounded-[6px] border px-[14px] text-[13px] leading-[normal] font-semibold";
/** 고르지 않은 버튼: 흰 바탕, 회색 테두리 ("가림" 은 검은 글자, "그대로 둠" 은 회색 글자) */
const DECISION_IDLE_CLASS = "border-[#CFCFCF] bg-white";
/** 고른 "가림": 짙은 남색 바탕에 흰 글자 */
const DECISION_MASK_CLASS = "border-[#000947] bg-[#000947] text-white";
/** 고른 "그대로 둠": 옅은 파란 바탕에 파란 테두리·글자 */
const DECISION_KEEP_CLASS = "border-[#001AD0] bg-[#EEF0FF] text-[#001AD0]";

/** 문장 안 표현(target)의 바탕: 정하기 전에는 노란 강조, "가림" 이면 글자와 같은 검정(가려진 모습), "그대로 둠" 이면 바탕 없음 */
function targetClass(decision: MaskDecision | null): string {
  if (decision === "mask") return "bg-[#111111]";
  return decision === "keep" ? "bg-transparent" : "bg-[#FFE58F]";
}

/**
 * 가릴지 확인이 필요한 표현 하나: 맥락 줄, 문장 상자(target 만 강조), "가림"·"그대로 둠" 버튼(aria-pressed).
 * 하나를 고르면 고른 쪽만 색이 바뀌고, 문장 안의 표현도 따라 바뀐다(targetClass). 고른 뒤에는 다른 쪽으로 바꿀 수만 있다.
 * 둘째 표현부터는 앞 표현과의 사이에 선이 있다.
 */
function ExpressionReview({
  expression,
  first,
  onDecide,
}: {
  expression: ReviewExpression & { decision: MaskDecision | null };
  first: boolean;
  onDecide: (decision: MaskDecision) => void;
}) {
  const { decision } = expression;
  return (
    <div className={first ? "mt-[12px]" : "mt-[12px] border-t border-t-[#E4E4E4] pt-[12px]"}>
      <p className="text-[12px] leading-[16px] text-[#767676]">{expression.context}</p>
      <p className="mt-[6px] rounded-[6px] bg-[#F6F7FB] px-[12px] py-[8px] text-[15px] leading-[24px] break-keep">
        {expression.before}
        <strong className={`px-[2px] py-px font-semibold text-[#111111] ${targetClass(decision)}`}>{expression.target}</strong>
        {expression.after}
      </p>
      <div className="mt-[8px] flex flex-wrap gap-[8px]">
        <button
          type="button"
          aria-pressed={decision === "mask"}
          onClick={() => onDecide("mask")}
          className={`${DECISION_BUTTON_CLASS} ${decision === "mask" ? DECISION_MASK_CLASS : `${DECISION_IDLE_CLASS} text-[#111111]`}`}
        >
          가림
        </button>
        <button
          type="button"
          aria-pressed={decision === "keep"}
          onClick={() => onDecide("keep")}
          className={`${DECISION_BUTTON_CLASS} ${decision === "keep" ? DECISION_KEEP_CLASS : `${DECISION_IDLE_CLASS} text-[#505050]`}`}
        >
          그대로 둠
        </button>
      </div>
    </div>
  );
}
