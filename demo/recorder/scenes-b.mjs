// 뒤쪽 장면들(5~8). scenes.mjs 가 가져다 쓴다.
import { sleep } from "./rec.mjs";

/** 방금 올린 학생부의 지원자 코드 (예시 지원자 314명 다음 번호) */
const UPLOADED = process.env.UPLOADED ?? "A-0315";

export function laterScenes({ stepCaption, card }) {
  return {
    // ── 5. 평가하기 → 남은 평가 → 방금 올린 학생부 → 잠재역량 세부 항목 평가 → 임시저장 ──
    s5: {
      start: "/evaluate",
      ready: (stage) => stage.see("text=남은 평가"),
      async run(stage, rec) {
        await sleep(300);
        stepCaption(stage, 5);
        await stage.click(stage.role("button", /남은 평가/), { after: 500 });
        const row = stage.$('a[href^="/evaluate/summary"]').filter({ hasText: UPLOADED });
        await stage.hover(row, { fx: 0.25 });
        await stage.ring(row, { pad: 0, radius: 4, hold: 1000 });
        rec.mark("left-list");
        await stage.unring(120);
        await stage.click(row, { fx: 0.25, after: 200 });
        await stage.see("text=세부 평가 항목 가져오기");
        await stage.see("[data-page]");
        await sleep(1000);
        rec.mark("summary");
        // 근거를 하나 넘겨 원본 PDF 에서 그 문장의 자리를 본다.
        await stage.click(stage.role("button", "다음 근거"), { after: 600 });
        await stage.zoomTo({ x: 282, y: 226, w: 1290, h: 800 }, 1.3, 800);
        await sleep(1500);
        rec.mark("evidence");
        await stage.zoomOut(700);
        const pick = stage.$('section[aria-labelledby="my-title"] a').filter({ hasText: "잠재역량" });
        await stage.click(pick, { after: 200 });
        await stage.see('input[type="radio"]');
        await stage.see("[data-page]");
        await sleep(600);
        // 응답하는 동안 원본에서 이 요소의 근거가 보이게 첫 근거 자리로 넘긴다.
        await stage.click(stage.role("button", "다음 근거"), { after: 500 });
        rec.mark("detail");
        // 질문마다 점수를 고른다(넓은 배치에서는 오른쪽 단 안에서만 스크롤된다). 넷째 질문부터는 빠르게 감는다.
        const answers = [4, 5, 4, 5, 4, 4, 5, 4, 5, 4, 4, 5];
        const groups = stage.loc(stage.$('[role="radiogroup"]'));
        const count = await groups.count();
        const panel = '[aria-label="세부 평가 항목 질문"]';
        const panelBox = await stage.rect(panel);
        await stage.zoomTo({ x: panelBox.x - 60, y: panelBox.y - 60, w: panelBox.w + 60, h: panelBox.h + 140 }, 1.3, 800);
        for (let i = 0; i < count; i += 1) {
          if (i === 3) {
            await stage.call("ff", "▶▶ 빠르게 감기");
            rec.setSpeed(2.5);
          }
          const group = groups.nth(i);
          const box = await stage.rect(group);
          const view = await stage.rect(panel);
          if (box.y + box.h > view.y + view.h - 20) {
            const top = await stage.frame().evaluate((sel) => document.querySelector(sel).scrollTop, panel);
            await stage.scrollTo(top + (box.y + box.h - (view.y + view.h)) + 170, 550, panel);
            await sleep(120);
          }
          const choice = group.locator("label").filter({ hasText: String(answers[i % answers.length]) });
          await stage.click(choice, { before: 90, after: i === 0 ? 380 : 210, ms: i === 0 ? undefined : 400 });
          if (i === 0) rec.mark("first-answer");
        }
        rec.setSpeed(1);
        await stage.call("ff", null);
        await sleep(350);
        rec.mark("answered");
        const finish = stage.role("button", "평가 완료");
        await stage.ring(stage.loc(finish).first().locator(".."), { pad: 4, hold: 1200 });
        await stage.unring(120);
        await stage.click(finish, { after: 150 });
        await stage.zoomOut(700, { wait: false });
        await stage.see("text=세부 평가 항목 가져오기");
        await sleep(900);
        // 가져온 내 점수와 임시저장을 한 화면에서 본다(위 줄의 상태 글과 오른쪽의 내 평가 입력).
        await stage.zoomTo({ x: 1100, y: 140, w: 800, h: 520 }, 1.3, 800);
        const myScore = stage.role("button", "잠재역량 점수 줄이기");
        await stage.ring(stage.loc(myScore).first().locator("xpath=ancestor::*[2]"), { pad: 4, radius: 6, hold: 1300 });
        rec.mark("score-applied");
        await stage.unring(120);
        await stage.click(stage.role("button", "임시저장"), { after: 500 });
        await stage.ring(stage.frame().getByText("방금 임시 저장했습니다"), { pad: 8, hold: 1400 });
        rec.mark("draft-saved");
        await stage.unring(120);
        await stage.zoomOut(700);
        await stage.click(stage.menu("선발 결정"));
        await stage.see("text=인재상 적합도");
        await sleep(1000);
      },
    },

    // ── 6. 선발 결정 → 위원 간 차이 큼 → 두 명 비교 → 위원 의견 모아보기에서 A-0196 조정 확정 ──
    s6: {
      start: "/decision",
      ready: (stage) => stage.see("text=인재상 적합도"),
      async run(stage, rec) {
        await sleep(300);
        stepCaption(stage, 6);
        await stage.click(stage.role("button", /위원 간 차이 큼/), { after: 400 });
        await stage.zoomTo({ x: 282, y: 150, w: 1620, h: 450 }, 1.17, 700);
        rec.mark("spread-filter");
        const rowOf = (code) => stage.$("button[aria-pressed]").filter({ hasText: code });
        await stage.click(rowOf("A-0118"), { fx: 0.12, after: 300 });
        await stage.click(rowOf("A-0196"), { fx: 0.12, after: 450 });
        rec.mark("picked");
        const compare = stage.role("link", "선택한 2명 비교");
        await stage.click(compare, { after: 100 });
        await stage.zoomOut(700, { wait: false });
        await stage.see('section[aria-labelledby="compare-chart-title"]');
        await sleep(1000);
        await stage.zoomTo('section[aria-labelledby="compare-chart-title"]', 1.3, 800);
        await stage.ring(stage.frame().getByText("가장 크게 갈린 요소는").first(), { pad: 8, hold: 1500 });
        rec.mark("compare");
        await stage.unring(120);
        await stage.zoomOut(700);
        await stage.click(stage.$('a[href="/decision/opinions"]'), { after: 200 });
        await stage.see(card(stage, "A-0196"));
        await sleep(600);
        const article = card(stage, "A-0196");
        await stage.zoomTo(article, 1.55, 800);
        const input = article.getByLabel("위원 2 학업역량 점수");
        await stage.ring(input, { pad: 6, hold: 800 });
        rec.mark("before-adjust");
        await stage.unring(100);
        await stage.click(input, { after: 250 });
        await stage.type(input, "88", { delay: 210, after: 600 });
        await stage.ring(article.locator("tfoot"), { pad: 2, radius: 6, hold: 1300 });
        rec.mark("adjusted");
        await stage.unring(100);
        await stage.click(article.getByRole("button", { name: "조정 확정" }), { after: 500 });
        // 확정하면 최종 평가가 올라 카드가 순위를 따라 자리를 옮긴다. 화면도 그 카드를 따라간다.
        await stage.zoomTo(article, 1.55, 700);
        await stage.ring(article.locator('p[id$="-hint"]'), { pad: 6, hold: 1900 });
        rec.mark("confirmed");
        await stage.unring(120);
        await stage.zoomOut(700);
        await stage.ring(card(stage, "A-0118"), { pad: 6, hold: 1100 });
        await stage.unring(120);
        await stage.click(stage.menu("평가하기"));
        await stage.see("text=남은 평가");
        await sleep(900);
      },
    },

    // ── 6(이어서). 평가하기에서 A-0118 검색 → 총평 확인 → 위원 의견 모아보기에서 조정 확정 → 기록 확정 탭 ──
    s7: {
      start: "/evaluate",
      ready: (stage) => stage.see("text=남은 평가"),
      async run(stage, rec) {
        await sleep(250);
        const search = stage.$('input[type="search"]');
        await stage.zoomTo({ x: 282, y: 0, w: 1180, h: 420 }, 1.4, 700);
        await stage.click(search, { fx: 0.3, after: 250 });
        await stage.type(search, "A-0118", { delay: 115, after: 700 });
        const row = stage.$('a[href^="/evaluate/summary"]').filter({ hasText: "A-0118" });
        await stage.ring(row, { pad: 0, radius: 4, hold: 1000 });
        rec.mark("searched");
        await stage.unring(100);
        await stage.click(row, { fx: 0.3, after: 100 });
        await stage.zoomOut(700, { wait: false });
        await stage.see("text=세부 평가 항목 가져오기");
        await sleep(1100);
        await stage.zoomTo({ x: 1100, y: 230, w: 820, h: 760 }, 1.3, 800);
        const reason = stage.frame().getByLabel("공동체역량 수정 사유");
        await stage.ring(stage.loc(reason).first().locator(".."), { pad: 6, hold: 1800 });
        rec.mark("summary-0118");
        await stage.unring(120);
        await stage.zoomOut(700);
        await stage.click(stage.menu("선발 결정"));
        await stage.see("text=인재상 적합도");
        await sleep(350);
        await stage.click(stage.$('a[href="/decision/opinions"]'), { after: 200 });
        await stage.see(card(stage, "A-0118"));
        await sleep(600);
        const article = card(stage, "A-0118");
        await stage.zoomTo(article, 1.55, 800);
        const input = article.getByLabel("위원 2 공동체역량 점수");
        await stage.ring(input, { pad: 6, hold: 700 });
        await stage.unring(100);
        await stage.click(input, { after: 250 });
        await stage.type(input, "65", { delay: 210, after: 600 });
        await stage.ring(article.locator("tfoot"), { pad: 2, radius: 6, hold: 1200 });
        rec.mark("adjusted-0118");
        await stage.unring(100);
        await stage.click(article.getByRole("button", { name: "조정 확정" }), { after: 500 });
        await stage.zoomTo(article, 1.55, 500);
        await stage.ring(article.locator('p[id$="-hint"]'), { pad: 6, hold: 1800 });
        rec.mark("confirmed-0118");
        await stage.unring(120);
        await stage.zoomOut(700);
        await stage.click(stage.$('a[href="/decision/confirm"]'), { after: 200 });
        await stage.see("text=확정 전 확인");
        await sleep(900);
      },
    },

    // ── 7. 기록 확정 → 금일 기록 최종 확정 → 로그아웃 ──
    s8: {
      start: "/decision/confirm",
      ready: (stage) => stage.see("text=확정 전 확인"),
      tail: 500,
      async run(stage, rec) {
        await sleep(250);
        stepCaption(stage, 7);
        await stage.zoomTo({ x: 282, y: 200, w: 800, h: 440 }, 1.5, 800);
        const adjust = stage.frame().getByRole("heading", { name: /위원 간 점수 조정/ }).locator("xpath=ancestor::li[1]");
        await stage.ring(adjust, { pad: 8, hold: 1400 });
        rec.mark("checks");
        await stage.unring(120);
        const agree = stage.$("label").filter({ hasText: "선발위원 전원이" });
        const box = await stage.rect(agree);
        await stage.click(agree, { fx: 9 / box.w, fy: 0.5, after: 500 });
        await stage.click(stage.role("button", "금일 기록 최종 확정"), { after: 800 });
        const record = stage.frame().getByRole("heading", { name: "기록을 확정했습니다" }).locator("xpath=ancestor::div[2]");
        await stage.ring(record, { pad: 6, hold: 2200 });
        rec.mark("confirmed");
        await stage.unring(150);
        await stage.zoomOut(800);
        await sleep(700);
        await stage.click(stage.$('a[href="/"]').filter({ hasText: "로그아웃" }), { after: 200 });
        await stage.see("text=계속");
        await sleep(1300);
        rec.mark("logout");
        await stage.call("curtain", true, 900);
        await sleep(1300);
      },
    },
  };
}
