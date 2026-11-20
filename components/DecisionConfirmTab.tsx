import Link from "next/link";
import { BUTTON_PRIMARY_CLASS, BUTTON_SECONDARY_CLASS, PANEL_CLASS, StatusChip } from "@/components/consoleUi";
import { CONFIRM_CHECKS_TITLE_ID, CONFIRM_RECORD_TITLE_ID, type DecisionConfirmView } from "@/hooks/useDecisionConfirm";

/**
 * 이 탭의 글자색. 시안처럼 흑백이다: 읽을 글(항목 이름, 굵게 적은 값, 명단의 점수)은 검은색(#111111), 나머지는 한 가지 회색(#505050).
 * 색은 둘뿐이다: 아직 끝나지 않은 확인 항목의 붉은색(머리의 `조정 N` 과 같은 #BA1A1A)과 확정한 기록의 `확정 완료` 표시(초록).
 */
const INK_CLASS = "text-[#111111]";
const GRAY_CLASS = "text-[#505050]";
const ALERT_CLASS = "text-[#BA1A1A]";

/** 두 단의 작은 제목 (`확정 전 확인`, `합격선 주변 명단`) */
const SECTION_TITLE_CLASS = `scroll-m-[8px] text-[13px] leading-[18px] font-semibold ${INK_CLASS}`;

/** 명단의 칸: 순위, 지원자 코드, 최종 평가, 구분 */
const LIST_CELL_CLASS = "px-[8px] py-[9px] text-left tabular-nums";

/**
 * 선발 결정 · 기록 확정 탭(/decision/confirm). 시안의 배치대로 왼쪽에 확정하기 전에 확인할 세 가지와 확인란·확정 버튼을,
 * 오른쪽에 합격선 주변 명단을 둔다. 상자 없이 흰 바탕에 바로 놓는다(시안). 색·글자·버튼 모양은 다른 콘솔 화면에 맞췄다.
 * - 확인 항목: 앞의 둥근 점이 끝났는지를 알린다(끝났으면 검은 점, 남았으면 붉은 고리와 붉은 글자). 오른쪽의 버튼은 그것을 볼 수 있는
 *   탭으로 가는 링크다(`순위 보기`·`위원 의견 보기`·`두 지원자 비교`).
 * - 확인란과 `금일 기록 최종 확정`: 조정이 남았으면 확인란이 꺼져 있고, 확인란에 표시해야 버튼이 켜진다. 버튼 아래의 글이 까닭을 알린다.
 * - 확정한 뒤에는 그 자리에 확정한 기록 상자(시각·사람, 합격선, `확정 취소`)가 온다.
 * - 명단: 순위 순서의 표. 합격권과 예비 사이에 굵은 선(합격선)이 있다. 시안에 없는 것: 표의 머리 줄.
 * 폭이 좁으면(820px 아래) 두 단이 위아래로 놓인다(@container/confirm).
 */
export function DecisionConfirmTab({ checks, action, list, announcement, alert }: DecisionConfirmView) {
  return (
    <div className="@container/confirm mt-[24px]">
      {/* 확정·취소한 결과는 화면에 그대로 보인다. 여기는 화면 낭독기에 알리는 자리다. */}
      <p role="status" className="sr-only">
        {announcement}
      </p>
      <div className="grid grid-cols-1 gap-x-[56px] gap-y-[36px] @min-[820px]/confirm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section aria-labelledby={CONFIRM_CHECKS_TITLE_ID} className="min-w-0">
          {/* tabIndex -1: 확정을 취소하면 누른 버튼이 사라지므로 초점을 이 제목으로 옮긴다(hooks/useDecisionConfirm.ts). */}
          <h2 id={CONFIRM_CHECKS_TITLE_ID} tabIndex={-1} className={SECTION_TITLE_CLASS}>
            확정 전 확인
          </h2>
          <ul className="mt-[18px] flex flex-col gap-[22px]">
            {checks.map((check) => (
              <li key={check.key} className="flex items-center gap-[14px]">
                <CheckDot done={check.done} />
                <div className="min-w-0 flex-[1_1_0%]">
                  <h3 className={`text-[17px] leading-[24px] font-semibold tracking-[-0.01em] ${INK_CLASS}`}>
                    {check.title}
                    <span className="sr-only">{check.done ? " (확인됨)" : " (남은 일이 있음)"}</span>
                  </h3>
                  <p className={`mt-[2px] text-[13px] leading-[18px] tabular-nums [overflow-wrap:anywhere] break-keep ${GRAY_CLASS}`}>
                    {check.parts.map((part, index) => (
                      <span key={part.text}>
                        {index > 0 && " · "}
                        {part.strong ? (
                          <strong className={`font-bold ${check.done ? INK_CLASS : ALERT_CLASS}`}>{part.text}</strong>
                        ) : (
                          part.text
                        )}
                      </span>
                    ))}
                  </p>
                </div>
                <Link href={check.link.href} className={`${BUTTON_SECONDARY_CLASS} h-[34px] flex-none scroll-m-[8px] px-[14px] leading-[normal]`}>
                  {check.link.label}
                </Link>
              </li>
            ))}
          </ul>
          {alert !== "" && (
            <p role="alert" className={`mt-[20px] text-[13px] leading-[18px] ${ALERT_CLASS}`}>
              {alert}
            </p>
          )}
          {/* 확정한 기록을 읽기 전에는 자리만 잡아 둔다(확인란과 버튼이 잠깐 보였다가 확정한 기록으로 바뀌지 않게). */}
          {action === null ? (
            <div aria-hidden="true" className="mt-[32px] h-[112px]" />
          ) : action.kind === "open" ? (
            <ConfirmForm action={action} />
          ) : (
            <ConfirmRecord action={action} />
          )}
        </section>
        <section aria-labelledby="decision-confirm-list" className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-[10px] gap-y-[2px]">
            <h2 id="decision-confirm-list" className={SECTION_TITLE_CLASS}>
              합격선 주변 명단
            </h2>
            <p className="text-[13px] leading-[18px] text-[#767676]">{list.note}</p>
          </div>
          {list.rows.length === 0 ? (
            <p className={`mt-[18px] text-[14px] leading-[20px] ${GRAY_CLASS}`}>평가를 마친 지원자가 없습니다.</p>
          ) : (
            <table className="mt-[10px] w-full table-fixed border-collapse text-[14px] leading-[20px]">
              <caption className="sr-only">합격선 주변 지원자의 순위와 최종 평가 ({list.note})</caption>
              <colgroup>
                <col className="w-[18%]" />
                <col className="w-[30%]" />
                <col className="w-[28%]" />
                <col className="w-[24%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-b-[#E4E4E4] text-[12px] leading-[16px] text-[#767676]">
                  <th scope="col" className={`${LIST_CELL_CLASS} font-medium`}>
                    순위
                  </th>
                  <th scope="col" className={`${LIST_CELL_CLASS} font-medium`}>
                    지원자 코드
                  </th>
                  <th scope="col" className={`${LIST_CELL_CLASS} font-medium`}>
                    최종 평가
                  </th>
                  <th scope="col" className={`${LIST_CELL_CLASS} font-medium`}>
                    구분
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.rows.map((row) => (
                  // 합격선: 예비 1번 줄의 위쪽에 굵은 선을 긋는다(시안). 화면 낭독기는 그 줄의 구분 앞에서 "합격선" 을 읽는다.
                  <tr key={row.code} className={row.cutBefore ? "border-t-2 border-t-[#111111]" : ""}>
                    <td className={`${LIST_CELL_CLASS} ${GRAY_CLASS}`}>
                      {row.rankText}
                      <span className="sr-only">위</span>
                    </td>
                    <th scope="row" className={`${LIST_CELL_CLASS} font-medium ${INK_CLASS}`}>
                      {row.code}
                    </th>
                    <td className={`${LIST_CELL_CLASS} ${INK_CLASS}`}>
                      {row.finalText}
                      <span className="sr-only">점</span>
                    </td>
                    <td className={`${LIST_CELL_CLASS} ${row.standing.admitted ? INK_CLASS : GRAY_CLASS}`}>
                      {row.cutBefore && <span className="sr-only">{list.cutlineText} 아래, </span>}
                      {row.standing.text}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}

/** 확인 항목 앞의 점: 끝났으면 검은 점, 남았으면 붉은 고리. 장식이다(끝났는지는 항목 이름 뒤의 화면 낭독기용 글이 알린다). */
function CheckDot({ done }: { done: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`motion-colors box-border h-[12px] w-[12px] flex-none rounded-[50%] border-2 ${
        done ? "border-[#111111] bg-[#111111]" : "border-[#BA1A1A] bg-white"
      }`}
    />
  );
}

type OpenAction = Extract<NonNullable<DecisionConfirmView["action"]>, { kind: "open" }>;
type ConfirmedAction = Extract<NonNullable<DecisionConfirmView["action"]>, { kind: "confirmed" }>;

/** 확인란과 `금일 기록 최종 확정` 버튼, 그 아래의 안내 글 */
function ConfirmForm({ action }: { action: OpenAction }) {
  const hintId = "decision-confirm-hint";
  return (
    <div className="mt-[32px]">
      <label
        className={`flex items-start gap-[10px] text-[14px] leading-[20px] ${
          action.checkEnabled ? `cursor-pointer ${INK_CLASS}` : "cursor-default text-[#767676]"
        }`}
      >
        {/* 진짜 확인란은 보이지 않게 두고(초점과 상태는 이것이 가진다) 옆의 네모가 모양을 그린다. */}
        <input
          type="checkbox"
          checked={action.checked}
          disabled={!action.checkEnabled}
          aria-describedby={hintId}
          onChange={(event) => action.onCheck(event.currentTarget.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className={`motion-colors mt-px box-border flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[4px] border peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-black ${
            action.checked
              ? "border-[#001AD0] bg-[#001AD0]"
              : action.checkEnabled
                ? "border-[#001AD0] bg-[#EEF0FF]"
                : "border-[#E4E4E4] bg-[#F0F0F2]"
          }`}
        >
          {action.checked && (
            <svg viewBox="0 0 12 12" fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-[12px] w-[12px]">
              <path d="M2.5 6.3 4.9 8.6 9.5 3.6" />
            </svg>
          )}
        </span>
        <span className="[overflow-wrap:anywhere] break-keep">선발위원 전원이 합격선과 조정 결과를 확인했습니다.</span>
      </label>
      <button
        type="button"
        disabled={!action.canConfirm}
        aria-describedby={hintId}
        onClick={action.onConfirm}
        className={`${BUTTON_PRIMARY_CLASS} mt-[16px] h-[48px] w-full scroll-m-[8px] text-[15px]!`}
      >
        금일 기록 최종 확정
      </button>
      <p id={hintId} className={`mt-[8px] text-[12px] leading-[17px] tabular-nums [overflow-wrap:anywhere] break-keep ${GRAY_CLASS}`}>
        {action.hint}
      </p>
    </div>
  );
}

/** 확정한 기록: 확정한 시각·사람, 합격선, 확정한 뒤 달라졌다는 안내, `확정 취소` */
function ConfirmRecord({ action }: { action: ConfirmedAction }) {
  return (
    <div className={`${PANEL_CLASS} mt-[32px] animate-fade-in px-[20px] py-[18px]`}>
      <div className="flex flex-wrap items-center gap-x-[8px] gap-y-[4px]">
        {/* tabIndex -1: 확정하면 누른 버튼이 사라지므로 초점을 이 제목으로 옮긴다(hooks/useDecisionConfirm.ts). */}
        <h3 id={CONFIRM_RECORD_TITLE_ID} tabIndex={-1} className={`scroll-m-[8px] text-[17px] leading-[24px] font-semibold tracking-[-0.01em] ${INK_CLASS}`}>
          기록을 확정했습니다
        </h3>
        <StatusChip tone="green">확정 완료</StatusChip>
      </div>
      <p className={`mt-[4px] text-[13px] leading-[18px] tabular-nums ${GRAY_CLASS}`}>
        {action.whenText} · {action.actor}
      </p>
      <p className={`mt-[10px] text-[13px] leading-[18px] tabular-nums [overflow-wrap:anywhere] break-keep ${INK_CLASS}`}>{action.summary}</p>
      {action.changed !== "" && (
        <p role="alert" className={`mt-[10px] text-[13px] leading-[18px] [overflow-wrap:anywhere] break-keep ${ALERT_CLASS}`}>
          {action.changed}
        </p>
      )}
      <div className="mt-[14px] flex flex-wrap items-center justify-end gap-x-[12px] gap-y-[8px] border-t border-t-[#E4E4E4] pt-[12px]">
        <p className={`min-w-[160px] flex-[1_1_0%] text-[12px] leading-[17px] [overflow-wrap:anywhere] break-keep ${GRAY_CLASS}`}>
          확정을 취소하면 기록을 지우고 다시 확인해 확정할 수 있습니다.
        </p>
        <button type="button" onClick={action.onCancel} className={`${BUTTON_SECONDARY_CLASS} h-[36px] flex-none scroll-m-[8px] px-[14px]`}>
          확정 취소
        </button>
      </div>
    </div>
  );
}
