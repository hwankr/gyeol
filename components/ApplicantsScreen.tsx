import Link from "next/link";
import type { RefObject } from "react";
import type { ApplicantFilter, ApplicantStatus, MaskDecision, ReviewExpression } from "@/lib/applicants/applicants";
import type { DeadlineRemaining } from "@/lib/applicants/deadline";

type ApplicantsScreenProps = {
  /** 현재 위치 줄의 "지원자 관리" 가 가는 주소 */
  applicantsPath: string;
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
  review: { percent: string; done: number; total: number; waiting: number };
  /** 걸러 보기 버튼 다섯 (수는 전체 지원자 기준) */
  filters: { filter: ApplicantFilter; count: number; pressed: boolean }[];
  /** 내 배정 보기가 켜졌는지 */
  mineOnly: boolean;
  /** 보이는 줄 (코드 순서) */
  rows: {
    code: string;
    displayCode: string;
    documentSummary: string;
    documentProblem: boolean;
    maskText: string;
    maskNeedsCheck: boolean;
    assignee: string;
    status: ApplicantStatus;
    selected: boolean;
  }[];
  /** 고른 지원자의 확인 필요 사항. 고른 지원자가 없으면 null. */
  detail: {
    code: string;
    displayCode: string;
    status: ApplicantStatus;
    documentCounts: readonly { label: string; value: string }[];
    /** 서류 정리에 문제가 있을 때의 안내 */
    documentNotice: string | null;
    maskCounts: readonly { label: string; count: number }[];
    /** decision 은 화면에 보이는 결정(저장하지 않은 결정 → 저장한 결정), 정하지 않았으면 null */
    expressions: (ReviewExpression & { decision: MaskDecision | null })[];
    /** 저장된 값과 다른 결정이 있을 때만 true */
    canSave: boolean;
  } | null;
  /** 상세 영역의 머리 아래 안내 (결정을 저장소에 쓰지 못함, 원문보기 결과를 저장하지 못함). 없으면 빈 배열. */
  notices: string[];
  /** 상세 영역의 스크롤 영역 (지원자를 바꾸면 맨 위로 돌린다, 저장 뒤 초점을 받는다) */
  detailScrollRef: RefObject<HTMLDivElement | null>;
  /** 저장하기 버튼 (저장할 때 초점이 있었는지 본다) */
  saveButtonRef: RefObject<HTMLButtonElement | null>;
  /** 지금 눌려 있는 걸러 보기 버튼 (초점을 줄 곳에 고른 지원자가 없으면 초점을 받는다) */
  pressedFilterRef: RefObject<HTMLButtonElement | null>;
  /** 고른 지원자의 코드 버튼 (지원자를 고른 뒤, 초점이 있던 컨트롤이 사라졌을 때 초점을 받는다) */
  selectedCodeButtonRef: RefObject<HTMLButtonElement | null>;
  /** 현재 위치 줄과 본문(제목 줄 아래 전부) (초점이 이 화면 안에 있는지 볼 때 쓴다) */
  crumbNavRef: RefObject<HTMLElement | null>;
  contentRef: RefObject<HTMLDivElement | null>;
  onSelectFilter: (filter: ApplicantFilter) => void;
  onToggleMine: () => void;
  onSelectApplicant: (code: string) => void;
  onDecide: (expressionId: string, decision: MaskDecision) => void;
  onSave: () => void;
  onOpenOriginal: () => void;
};

/** 상태 표시의 동그라미 색과 글자 색 ("확인 필요" 는 디자인 값, 나머지는 코디네이터가 정한 값) */
const STATUS_COLORS: Record<ApplicantStatus, { dot: string; text: string }> = {
  "확인 필요": { dot: "bg-[#C54545]", text: "text-[#C54545]" },
  "진행 중": { dot: "bg-[#001AD0]", text: "text-[#001AD0]" },
  대기: { dot: "bg-[#999999]", text: "text-[#505050]" },
  완료: { dot: "bg-[#499B6E]", text: "text-[#505050]" },
};

/**
 * 키보드로 초점을 옮길 때 브라우저는 요소의 상자만 화면에 보이게 스크롤하므로, 상자 바깥 4px 에 그리는 초점 표시(전역 :focus-visible)가
 * 화면 끝에서 잘릴 수 있다. 이 화면의 누를 수 있는 것에는 scroll-margin 8px 을 주어(scroll-m-[8px]) 초점 표시까지 보이게 스크롤되게 한다.
 * 모양에는 영향이 없다.
 *
 * 지원자 관리 화면: 현재 위치 줄, 제목 줄, 요약 카드 셋(접수 마감·접수 인원·서류 검토 진행 현황), 걸러 보기·내 배정 보기,
 * 지원자 표와 오른쪽 상세 영역("확인 필요 사항"). 치수·색·글자는 디자인 값 그대로다.
 * 현재 위치의 "지원자 관리" 는 보통 링크(next/link)라 화면의 JavaScript 가 준비되기 전에도 동작한다. 그 아래 본문(제목 줄, 요약 카드,
 * 걸러 보기 줄, 표, 상세 영역)은 준비되기 전(서버 HTML·hydration)에는 inert 라 초점을 받지 않고 눌리지 않는다(모양은 같다).
 * 준비 전에 들어간 초점이나 누름이 준비되면서 바뀌는 화면(저장한 결정 반영, 상세 스크롤)과 어긋나지 않게 하려는 것이다.
 */
export function ApplicantsScreen({
  applicantsPath,
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
  onOpenOriginal,
}: ApplicantsScreenProps) {
  return (
    <>
      <nav ref={crumbNavRef} aria-label="현재 위치" className="mt-[24px] border-b border-b-[#AEAEAE] pb-[8px] pl-[5px]">
        <ol className="flex flex-wrap items-center gap-x-[22px] gap-y-[4px] text-[14px] leading-[20px] font-medium tracking-[-0.02em] text-[#505050]">
          <li>
            <DeadLink>홈</DeadLink>
          </li>
          <CrumbArrow />
          <li>
            <Link href={applicantsPath} className="scroll-m-[8px] text-[#505050] no-underline">
              지원자 관리
            </Link>
          </li>
          <CrumbArrow />
          <li>
            <DeadLink>접수현황</DeadLink>
          </li>
          <CrumbArrow />
          <li>
            <DeadLink>서류 검토</DeadLink>
          </li>
          <CrumbArrow />
          {/* 걸러 보기 이름은 늘 갈 곳 없는 링크다. 고른 지원자가 없으면 이 칸이 마지막 칸(지금 위치)이다. */}
          <li
            aria-current={selectedCode === null ? "page" : undefined}
            className={selectedCode === null ? "font-extrabold" : undefined}
          >
            <DeadLink>{filter}</DeadLink>
          </li>
          {selectedCode !== null && (
            <>
              <CrumbArrow />
              <li aria-current="page" className="font-extrabold">
                {selectedCode}
              </li>
            </>
          )}
        </ol>
      </nav>

      {/*
        본문을 감싸는 상자. 준비 전에는 inert 다(hooks/useApplicants.ts 의 ready). 안쪽 여백·테두리가 없는 block 이라 첫 자식의 위 여백이
        밖으로 합쳐져 배치는 감싸지 않았을 때와 같다.
      */}
      <div ref={contentRef} inert={!ready}>
        <div className="mt-[17px] flex flex-wrap items-baseline gap-x-[17px] gap-y-0">
          <h1 className="text-[28px] leading-[36px] font-extrabold tracking-[-0.02em]">지원자 관리</h1>
          <p className="text-[16px] leading-[24px] font-semibold text-[#505050]">{subtitle}</p>
        </div>

        <div className="mt-[15px] mr-[8px] -ml-[10px]">
          <div className="flex flex-wrap items-start gap-x-[21px] gap-y-[16px]">
            <section
              aria-labelledby="deadline-title"
              className="box-border min-w-0 flex-[0_1_256px] rounded-[4px] bg-white px-[23px] pt-[19px] pb-[23px]"
            >
              <h2 id="deadline-title" className={CARD_TITLE_CLASS}>
                접수 마감
              </h2>
              <p className="mt-[12px] text-[18px] leading-[24px] font-semibold">
                {deadline.label} <span aria-hidden="true" className="font-normal">|</span>
              </p>
              <p className="text-[26px] leading-[30px] font-extrabold tracking-[-0.02em]">{deadline.dateText}</p>
              <p className={`mt-[9px] ${CARD_NOTE_CLASS}`}>
                <svg aria-hidden="true" viewBox="0 0 16 16" {...CARD_ICON_PROPS} className="h-[16px] w-[16px] flex-none">
                  <circle cx="8" cy="9.3" r="5.2" />
                  <path d="M8 9.3V6.5M6.3 1.6h3.4M8 1.6v2.5" />
                </svg>
                <DeadlineText remaining={deadline.remaining} />
              </p>
            </section>
            <section
              aria-labelledby="count-title"
              className="box-border min-w-0 flex-[0_1_256px] rounded-[4px] bg-white pt-[19px] pr-[23px] pb-[23px] pl-[25px]"
            >
              <h2 id="count-title" className={CARD_TITLE_CLASS}>
                접수 인원
              </h2>
              <p className="mt-[12px] text-[24px] leading-[28px] font-medium">
                현재 <strong className="text-[26px] font-extrabold">{applications.total}</strong>명 지원
              </p>
              <p className="text-[18px] leading-[24px] font-semibold">모집 인원 {applications.quota}명</p>
              <p className={`mt-[12px] ${CARD_NOTE_CLASS}`}>
                <svg aria-hidden="true" viewBox="0 0 16 16" {...CARD_ICON_PROPS} className="h-[16px] w-[16px] flex-none">
                  <circle cx="8" cy="5" r="3" />
                  <path d="M2.5 14.5v-1a5.5 5.5 0 0 1 11 0v1" />
                </svg>
                <span>
                  현재 경쟁률 <span className="text-[#499B6E]">{applications.rate}</span>
                </span>
              </p>
            </section>
            <section
              aria-labelledby="review-title"
              className="ml-auto box-border min-w-0 flex-[0_1_440px] rounded-[4px] bg-white pt-[19px] pr-[38px] pb-[18px] pl-[24px]"
            >
              <h2 id="review-title" className={CARD_TITLE_CLASS}>
                서류 검토 진행 현황
              </h2>
              <p className="mt-[5px] flex items-center gap-[9px]">
                <span className="text-[26px] leading-[30px] font-extrabold text-[#499B6E]">{review.percent}%</span>
                <span className="rounded-[9px] bg-[#E9F3EE] px-[8px] text-[11px] leading-[18px] font-medium text-[#499B6E]">
                  검토 완료
                </span>
              </p>
              {/* 채움 너비는 검토 완료 비율과 같은 값이다(디자인의 86.5% 는 옆의 숫자와 맞지 않아 따르지 않는다). */}
              <div aria-hidden="true" className="mt-[12px] h-[11px] overflow-hidden rounded-[6px] bg-[#999999]">
                <div className="h-[11px] bg-[#499B6E]" style={{ width: `${review.percent}%` }} />
              </div>
              <p className="mt-[3px] flex justify-between pr-[7px] pl-[3px] text-[11px] leading-[14px] font-medium text-[#767676]">
                <span>{review.done}건 검토 완료</span>
                <span>총 {review.total}건</span>
              </p>
              <div className="mt-[13px] flex pl-[4px] text-[#505050]">
                <div className="flex-[0_0_175px]">
                  <p className={COUNT_NUMBER_CLASS}>{review.done}건</p>
                  <p className={COUNT_LABEL_CLASS}>검토 완료</p>
                </div>
                <div>
                  <p className={COUNT_NUMBER_CLASS}>{review.waiting}건</p>
                  <p className={COUNT_LABEL_CLASS}>검토 대기</p>
                </div>
              </div>
            </section>
          </div>

          <div className="mt-[16px] flex flex-wrap items-center gap-x-[14px] gap-y-[10px] border-b border-b-[#AEAEAE] pr-[12px] pb-[13px] pl-[1px]">
            {filters.map((item) => (
              <button
                key={item.filter}
                ref={item.pressed ? pressedFilterRef : undefined}
                type="button"
                aria-pressed={item.pressed}
                onClick={() => onSelectFilter(item.filter)}
                className={`scroll-m-[8px] h-[29px] cursor-pointer rounded-[15px] border-0 px-[16px] text-[14px] font-semibold text-[#505050] ${
                  item.pressed ? "bg-[#DEE0FF]" : "bg-white"
                }`}
              >
                {item.filter}
                <span className="ml-[11px]">{item.count}</span>
              </button>
            ))}
            <div className="ml-auto flex items-center gap-[17px]">
              <span id="mine-label" className="text-[12px] leading-[16px] font-medium text-[#505050]">
                내 배정 보기
              </span>
              {/* 켜진 모양은 디자인 그대로, 꺼진 모양(흰 바탕, 회색 동그라미, 회색 글자)은 코디네이터가 정한 값이다. */}
              <button
                type="button"
                aria-pressed={mineOnly}
                aria-labelledby="mine-label"
                onClick={onToggleMine}
                className={`scroll-m-[8px] flex h-[32px] cursor-pointer items-center gap-[9px] rounded-[16px] border-0 pr-[13px] pl-[5px] text-[12px] font-extrabold [box-shadow:0_1px_3px_rgba(0,9,71,0.14)] ${
                  mineOnly ? "bg-[#E6E8F6] text-[#111111]" : "bg-white text-[#767676]"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`h-[20px] w-[20px] rounded-[50%] ${
                    mineOnly ? "bg-[linear-gradient(90deg,#031DD2,#4960FD)]" : "bg-[#BDBDBD]"
                  }`}
                />
                보기
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-start gap-x-[21px] gap-y-0">
            <div className="min-w-0 flex-[1_1_420px] overflow-x-auto">
              <table className="w-full min-w-[560px] table-fixed border-collapse text-left text-[16px] leading-[22px]">
                <thead>
                  <tr className="border-b border-b-[#BDBDBD] text-[#767676]">
                    <th scope="col" className={`box-border w-[94px] pl-[11px] ${HEAD_CELL_CLASS}`}>
                      지원자 코드
                    </th>
                    <th scope="col" className={`w-[183px] ${HEAD_CELL_CLASS}`}>
                      서류 정리
                    </th>
                    <th scope="col" className={`w-[163px] ${HEAD_CELL_CLASS}`}>
                      개인정보 가림
                    </th>
                    <th scope="col" className={`w-[68px] ${HEAD_CELL_CLASS}`}>
                      배정
                    </th>
                    <th scope="col" className={HEAD_CELL_CLASS}>
                      상태
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="pt-[9px] pb-[8px] pl-[11px] text-[16px] leading-[22px] font-medium text-[#767676]"
                      >
                        해당하는 지원자가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      // 줄의 어디를 마우스로 눌러도 그 지원자를 고른다. 키보드로는 코드 칸의 버튼으로 고른다(줄에는 Tab 정지점을 더하지 않는다).
                      // 고른 뒤 초점은 고른 지원자의 코드 버튼에 간다(hooks/useApplicants.ts).
                      <tr
                        key={row.code}
                        aria-current={row.selected ? "true" : undefined}
                        onClick={() => onSelectApplicant(row.code)}
                        className={`cursor-pointer ${row.selected ? "font-extrabold" : "font-normal"}`}
                      >
                        <th
                          scope="row"
                          className={`pt-[9px] pb-[8px] pl-[11px] text-left whitespace-nowrap ${
                            row.selected ? "font-extrabold" : "font-bold"
                          }`}
                        >
                          {/* 모양은 디자인의 글자 그대로다(버튼의 글꼴·색·여백은 칸을 따른다). */}
                          <button
                            ref={row.selected ? selectedCodeButtonRef : undefined}
                            type="button"
                            aria-label={`${row.code} 확인 필요 사항 보기`}
                            onClick={() => onSelectApplicant(row.code)}
                            className="scroll-m-[8px] cursor-pointer border-0 bg-transparent p-0 text-left"
                          >
                            {row.displayCode}
                          </button>
                        </th>
                        <td className={`${BODY_CELL_CLASS} ${row.documentProblem ? "text-[#BA1A1A]" : ""}`}>
                          {row.documentSummary}
                        </td>
                        <td className={`${BODY_CELL_CLASS} ${row.maskNeedsCheck ? "text-[#BA1A1A]" : ""}`}>{row.maskText}</td>
                        <td className={BODY_CELL_CLASS}>{row.assignee}</td>
                        <td className={BODY_CELL_CLASS}>
                          <span className={`inline-flex items-center gap-[10px] text-[14px] ${STATUS_COLORS[row.status].text}`}>
                            <StatusDot status={row.status} />
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/*
              표가 길 때도 보이도록 화면 맨 위에 붙는다(sticky). 화면 맨 위에서의 위치는 디자인과 같다.
              위에 붙어 있는 동안 아래쪽이 화면 밖에 남지 않도록 전체 높이를 화면 높이 − 8px 이하로 둔다(max-height). 넘치려 하면 세로 flex 로
              스크롤 영역만 줄어든다(디자인의 450px 에서 120px 까지. 탭 모양 제목·머리·안내 문구는 줄지 않는다). 화면 높이·안내 줄 수가 바뀌면
              CSS 가 따라 계산한다. 자식에 위아래 바깥 여백이 없어 block 에서 flex 로 바꿔도 여백이 합쳐지는 방식은 달라지지 않는다.
            */}
            <section
              aria-labelledby={detail === null ? "detail-tab-title" : "detail-code"}
              className="sticky top-0 flex max-h-[calc(100vh-8px)] min-w-0 flex-[0_1_431px] flex-col"
            >
              <div className="border-b border-b-[#BDBDBD]">
                <h2
                  id="detail-tab-title"
                  className="-mb-[2px] inline-block border-b-[3px] border-b-[#505050] pt-[8px] pr-[9px] pb-[6px] pl-[8px] text-[16px] leading-[22px] font-medium text-[#767676]"
                >
                  확인 필요 사항
                </h2>
              </div>
              {detail === null ? (
                <p className="px-[8px] py-[12px] text-[16px] leading-[22px] font-medium text-[#767676]">
                  선택한 지원자가 없습니다.
                </p>
              ) : (
                <div className="flex items-start justify-between gap-[12px] pt-[12px] pr-[13px] pl-[8px]">
                  <div className="flex flex-wrap items-center gap-x-[20px] gap-y-[4px]">
                    <h3 id="detail-code" className="text-[40px] leading-[48px] font-bold whitespace-nowrap">
                      {detail.displayCode}
                    </h3>
                    <span
                      className={`inline-flex items-center gap-[9px] text-[14px] font-extrabold ${STATUS_COLORS[detail.status].text}`}
                    >
                      <StatusDot status={detail.status} />
                      {detail.status}
                    </span>
                  </div>
                  <div className="mt-[7px] flex flex-none flex-col gap-[8px]">
                    <button
                      ref={saveButtonRef}
                      type="button"
                      disabled={!detail.canSave}
                      onClick={onSave}
                      className="scroll-m-[8px] h-[31px] cursor-pointer rounded-[5px] border-0 bg-[#000947] px-[16px] text-[13px] font-semibold text-white disabled:cursor-default"
                    >
                      저장하기
                    </button>
                    <button
                      type="button"
                      onClick={onOpenOriginal}
                      className="scroll-m-[8px] h-[31px] cursor-pointer rounded-[5px] border-0 bg-[#BAC3FF] px-[16px] text-[13px] font-semibold text-[#000947]"
                    >
                      원문보기
                    </button>
                  </div>
                </div>
              )}
              {notices.map((notice) => (
                <p
                  key={notice}
                  role="alert"
                  className="pt-[8px] pr-[13px] pl-[8px] text-[13px] leading-[18px] font-medium text-[#BA1A1A]"
                >
                  {notice}
                </p>
              ))}
              {detail !== null && (
                <div className="relative flex min-h-[120px] flex-col">
                  {/*
                    상세 내용은 이 영역 안에서만 세로로 스크롤한다(높이 450px, 키보드로도 스크롤된다). 스크롤바는 전형 준비의 세부 평가 항목
                    패널과 같은 브라우저 스크롤바를 가늘게 꾸민 것(globals.css 의 .prep-scrollbar, 굵기 6px)이고 자리를 늘 비워 둔다
                    (scrollbar-gutter: stable). 영역 오른쪽을 19px 비우고 안쪽 여백을 줄여, 스크롤바가 디자인의 그린 막대와 같은 자리(오른쪽 안쪽
                    19~25px)에 오고 글의 줄바꿈 너비는 디자인과 같다(45 = 19 + 6 + 20).
                    키보드 초점 표시는 이 영역만 안쪽에 그린다(outline-offset -2px). 영역이 머리(원문보기) 바로 아래에 붙어 있어 전역 규칙(바깥 2px)대로면
                    원문보기와 겹치기 때문이다. 전역 :focus-visible 규칙은 레이어 밖에 있어 important 로 덮는다.
                  */}
                  <div
                    ref={detailScrollRef}
                    tabIndex={0}
                    aria-label="확인 필요 사항 상세"
                    className="prep-scrollbar mr-[19px] box-border scroll-m-[8px] h-[450px] min-h-0 overflow-y-auto pt-[16px] pr-[20px] pb-[16px] pl-[8px] [scrollbar-gutter:stable] focus-visible:outline-offset-[-2px]!"
                  >
                    <h3 className={DETAIL_TITLE_CLASS}>서류 확인</h3>
                    <dl className="mt-[7px] flex max-w-[367px] justify-between">
                      {detail.documentCounts.map((item) => (
                        <div key={item.label}>
                          <dt className="text-[16px] leading-[22px] font-bold">{item.label}</dt>
                          <dd className="mt-[2px] text-[13px] leading-[18px] font-medium text-[#767676]">{item.value}</dd>
                        </div>
                      ))}
                    </dl>
                    {detail.documentNotice !== null && (
                      <p className="mt-[8px] text-[13px] leading-[18px] font-medium text-[#BA1A1A]">{detail.documentNotice}</p>
                    )}
                    <h3 className={`mt-[19px] ${DETAIL_TITLE_CLASS}`}>개인정보 가림 확인</h3>
                    <ul className="mt-[8px] ml-[1px] flex flex-wrap gap-x-[37px] gap-y-[8px] text-center">
                      {detail.maskCounts.map((item) => (
                        <li key={item.label} className="flex flex-col items-center">
                          <strong className="text-[26px] leading-[30px] font-extrabold">{item.count}</strong>
                          <span className="mt-[3px] text-[11px] leading-[14px] font-medium text-[#767676]">{item.label}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-[25px] flex flex-wrap items-center gap-x-[17px] gap-y-[4px]">
                      <h3 className={DETAIL_TITLE_CLASS}>가릴지 확인이 필요한 표현</h3>
                      <span className="rounded-[10px] bg-[#DEE0FF] px-[13px] text-[11px] leading-[19px] font-semibold text-[#111111]">
                        AI 제안
                      </span>
                    </div>
                    {detail.expressions.length === 0 ? (
                      <p className={`mt-[12px] ${SENTENCE_TEXT_CLASS}`}>확인이 필요한 표현이 없습니다.</p>
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
            </section>
          </div>
        </div>
        </div>
      </>
    );
  }

  const CARD_TITLE_CLASS = "text-[16px] leading-[20px] font-extrabold text-[#505050]";
  const CARD_NOTE_CLASS = "ml-[2px] flex items-center gap-[7px] text-[16px] leading-[20px] font-medium text-[#505050]";
  const CARD_ICON_PROPS = {
    fill: "none",
    stroke: "#505050",
    strokeWidth: "1.4",
    strokeLinecap: "round",
    strokeLinejoin: "round",
  } as const;
  const COUNT_NUMBER_CLASS = "text-[20px] leading-[26px] font-semibold";
  const COUNT_LABEL_CLASS = "mt-[2px] text-[13px] leading-[16px] font-medium";
  const HEAD_CELL_CLASS = "pt-[8px] pb-[7px] text-left font-medium";
  const BODY_CELL_CLASS = "pt-[9px] pb-[8px]";
  const DETAIL_TITLE_CLASS = "text-[16px] leading-[22px] font-extrabold text-[#505050]";
  const SENTENCE_TEXT_CLASS = "text-[14px] leading-[20px] font-normal text-[#505050]";

  /** 접수 마감 카드의 남은 날: "마감일까지 2일"(숫자와 "일" 만 빨강), 당일 "오늘 마감", 지나면 "마감 지남"(둘 다 전체가 빨강). 읽기 전에는 비운다. */
  function DeadlineText({ remaining }: { remaining: DeadlineRemaining | null }) {
    if (remaining === null) return <span />;
    if (remaining.kind === "today") return <span className="text-[#BA1A1A]">오늘 마감</span>;
    if (remaining.kind === "passed") return <span className="text-[#BA1A1A]">마감 지남</span>;
    return (
      <span>
        마감일까지 <span className="text-[#BA1A1A]">{remaining.days}일</span>
      </span>
    );
  }

  /** 상태 앞의 동그라미 (장식) */
  function StatusDot({ status }: { status: ApplicantStatus }) {
    return <span aria-hidden="true" className={`h-[10px] w-[10px] rounded-[50%] ${STATUS_COLORS[status].dot}`} />;
  }

  /** 갈 곳이 없는 링크: href 없는 <a> 라서 초점을 받지 않고 눌러도 아무 일도 없다. */
  function DeadLink({ children }: { children: string }) {
    return (
      <a aria-disabled="true" className="cursor-default text-[#505050] no-underline">
        {children}
      </a>
    );
  }

  /** 현재 위치 줄의 항목 사이 화살표 (장식) */
  function CrumbArrow() {
    return (
      <li aria-hidden="true" className="flex">
        <svg viewBox="0 0 7 10" className="h-[10px] w-[7px]">
          <path
            fill="none"
            stroke="#131927"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M1.5 1l4 4-4 4"
          />
        </svg>
      </li>
    );
  }

  const DECISION_BUTTON_CLASS = "scroll-m-[8px] h-[33px] cursor-pointer rounded-[3px] border px-[17px] text-[14px]";
  /** 고르지 않은 버튼: 디자인 모양 (흰 바탕, 회색 테두리·글자) */
  const DECISION_IDLE_CLASS = "border-[#E2E2E2] bg-white text-[#505050]";
  /** 고른 버튼 (코디네이터가 정한 값) */
  const DECISION_CHOSEN_CLASS = "border-[#BAC3FF] bg-[#DEE0FF] text-[#000947] font-extrabold";

  /**
   * 가릴지 확인이 필요한 표현 하나: 맥락 줄, 문장 상자(target 만 강조), "가림"·"그대로 둠" 버튼(aria-pressed).
   * 아무것도 고르지 않았을 때는 디자인 그대로("가림" 굵기 800, "그대로 둠" 굵기 600)이고, 하나를 고르면 고른 쪽만 강조하고
   * 다른 쪽은 디자인 모양(굵기 600)이다. 고른 뒤에는 다른 쪽으로 바꿀 수만 있다.
   * 디자인은 첫 표현의 맥락 줄 위 여백이 12px(제목 줄 아래), 다음 표현부터 23px(앞 표현의 버튼 아래)이다.
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
    const maskClass =
      decision === "mask" ? DECISION_CHOSEN_CLASS : `${DECISION_IDLE_CLASS} ${decision === null ? "font-extrabold" : "font-semibold"}`;
    const keepClass = decision === "keep" ? DECISION_CHOSEN_CLASS : `${DECISION_IDLE_CLASS} font-semibold`;
    return (
      <>
        <p className={`${first ? "mt-[12px]" : "mt-[23px]"} ${SENTENCE_TEXT_CLASS}`}>{expression.context}</p>
        <p className={`mt-[8px] rounded-[2px] bg-white px-[15px] ${first ? "py-[8px]" : "py-[12px]"} ${SENTENCE_TEXT_CLASS}`}>
          {expression.before}
          <strong className="font-extrabold text-[#111111]">{expression.target}</strong>
          {expression.after}
        </p>
        <div className="mt-[12px] flex flex-wrap gap-[8px]">
          <button
            type="button"
            aria-pressed={decision === "mask"}
            onClick={() => onDecide("mask")}
            className={`${DECISION_BUTTON_CLASS} ${maskClass}`}
          >
            가림
          </button>
          <button
            type="button"
            aria-pressed={decision === "keep"}
            onClick={() => onDecide("keep")}
            className={`${DECISION_BUTTON_CLASS} ${keepClass}`}
          >
            그대로 둠
          </button>
      </div>
    </>
  );
}
