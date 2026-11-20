// 시연 영상의 장면들. `node scenes.mjs s1 s2 …` 로 고른 장면을 차례로 녹화한다(SLOW=1 이면 빠른 시험).
//
// 다시 찍는 법 (이 폴더에서):
//   1. npm install                       — playwright-core, ffmpeg-static (크롬은 Playwright 가 받아 둔 것이나 설치된 Chrome 을 쓴다)
//   2. 앱을 3210 포트에 띄운다           — 다른 작업이 빌드를 덮어쓰지 않게 저장소를 다른 폴더에 복사해 `npm run build` 뒤 `npx next start -p 3210`
//                                          (.env.local 의 API 키가 있어야 학생부 분석 장면이 돈다. 한 번에 분석 한 건)
//   3. SLOW=3 node scenes.mjs s0 s1 s2 s3 s4 s5 s6 s7 s8   — s0 은 준비(녹화 안 함). 한 장면만 다시 찍으려면 그 이름만 준다
//   4. node build.mjs ../gyeol-demo.mp4  — 장면을 이어 붙여 mp4 로 만든다
// 장면마다 시작할 때의 브라우저 저장소를 profiles/snap 에 남겨 두어, 한 장면만 다시 찍어도 앞 장면의 결과에서 이어진다.
// PACE(기본 0.85)를 줄이면 머무는 시간이 줄어 영상이 짧아진다.
import fs from "node:fs";
import path from "node:path";
import { HERE, PROJECT, Recorder, SLOW, grab, openStage, sleep } from "./rec.mjs";
import { laterScenes } from "./scenes-b.mjs";

const BASE = process.env.BASE ?? "http://localhost:3210";
const OUT = path.join(HERE, "out", SLOW === 1 ? "fast" : "final");
const WORK = path.join(HERE, "profiles", "work");
const SNAP = path.join(HERE, "profiles", "snap");
const STATE = path.join(HERE, "profiles", "state.json");
const real = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const CAP = {
  1: ["1", "로그인", "개인정보 처리방침 동의"],
  2: ["2", "전형 준비", "평가 · 배점 설정"],
  3: ["3", "지원자 관리", "개인정보 가림 확인"],
  4: ["4", "학생부 올리기", "AI 분석"],
  5: ["5", "평가하기", "세부 항목 평가"],
  6: ["6", "선발 결정", "위원 간 점수 조정"],
  7: ["7", "기록 확정", "금일 기록 최종 확정"],
};

/** 단계 자막을 잠깐 보여 준다(기다리지 않는다). */
function stepCaption(stage, no, hold = 4200) {
  stage.caption(...CAP[no]);
  setTimeout(() => stage.caption(null, null).catch(() => {}), hold * SLOW);
}

/** 위원 의견 모아보기의 그 지원자 카드 */
const card = (stage, code) => stage.$("article").filter({ has: stage.frame().getByRole("heading", { name: code }) });

const scenes = {
  // ── 준비(녹화하지 않음): 흐름에 없는 조정 두 건을 미리 확정해 둔다(기록 확정은 조정이 모두 끝나야 눌린다) ──
  s0: {
    start: "/decision/opinions",
    record: false,
    ready: (stage) => stage.see("text=조정 필요"),
    async run(stage) {
      const frame = stage.frame();
      for (const [code, edits] of [
        ["A-0090", [["위원 3 잠재역량 점수", "80"], ["위원 3 학업역량 점수", "78"]]],
        ["A-0240", [["위원 3 잠재역량 점수", "76"], ["위원 1 학업역량 점수", "90"]]],
      ]) {
        const article = card(stage, code);
        for (const [label, value] of edits) await article.getByLabel(label).fill(value);
        await article.getByRole("button", { name: "조정 확정" }).click();
        await real(300);
      }
      await frame.getByRole("button", { name: /조정 필요/ }).click();
      console.log("  조정 필요:", await frame.getByRole("button", { name: /조정 필요/ }).innerText());
    },
  },

  // ── 1. 로그인 → 개인정보 처리방침 동의 → 홈 ──
  s1: {
    start: "/",
    curtain: true,
    ready: (stage) => stage.see("text=계속"),
    async run(stage, rec) {
      await stage.placeCursor(1500, 880);
      await sleep(500);
      await stage.call("curtain", false, 700);
      await sleep(1100);
      stepCaption(stage, 1);
      await sleep(700);
      await stage.zoomTo("main > div", 1.5, 1000);
      await stage.hover("#gyeol-account", { fx: 0.4 });
      await stage.ring("#gyeol-account", { hold: 1100 });
      await stage.unring(200);
      rec.mark("login-continue");
      await stage.click(stage.role("button", "계속"), { after: 200 });
      await stage.see("text=동의하고 계속");
      await stage.zoomTo("main > div", 1.42, 700);
      await sleep(300);
      await stage.ring("main dl", { pad: 6, hold: 1700 });
      await stage.unring(250);
      const agree = stage.$("label").filter({ hasText: "이에 동의합니다" });
      const box = await stage.rect(agree);
      await stage.click(agree, { fx: 9 / box.w, fy: 0.5, after: 500 });
      rec.mark("consent-checked");
      await stage.click(stage.role("button", "동의하고 계속"), { after: 100 });
      await stage.zoomOut(900, { wait: false });
      await stage.see("text=오늘 할 일");
      await sleep(1700);
    },
  },

  // ── 2. 전형 준비 → 평가·배점 설정 → 수정하기 → 저장 → 기준 변경 기록 ──
  s2: {
    start: "/home",
    ready: (stage) => stage.see("text=오늘 할 일"),
    async run(stage, rec) {
      await sleep(400);
      stepCaption(stage, 2);
      await stage.click(stage.menu("전형 준비"));
      await stage.see("text=모집요강 올리기");
      await sleep(500);
      await stage.click(stage.$('a[href="/prep/weights"]'));
      await stage.see("text=수정하기");
      await sleep(700);
      await stage.click(stage.role("button", "수정하기"), { after: 500 });
      rec.mark("weights-edit");
      await stage.zoomTo({ x: 282, y: 300, w: 1180, h: 470 }, 1.38, 900);
      const minus = stage.role("button", "잠재역량 배점 줄이기");
      await stage.click(minus, { after: 150 });
      for (let i = 0; i < 4; i += 1) await stage.tap(minus);
      await sleep(250);
      const plus = stage.role("button", "학업역량 배점 늘리기");
      await stage.click(plus, { after: 150 });
      for (let i = 0; i < 4; i += 1) await stage.tap(plus);
      await sleep(300);
      rec.mark("weights-changed");
      await stage.ring(stage.frame().getByText("합계").locator(".."), { pad: 10, hold: 1300 });
      await stage.unring(200);
      await stage.zoomOut(800);
      await stage.click(stage.role("button", "저장하기"), { after: 900 });
      rec.mark("weights-saved");
      await stage.click(stage.$('a[href="/prep/history"]'));
      await stage.see("text=배점 변경");
      await sleep(500);
      const row = stage.frame().getByText("배점 변경").first().locator("xpath=ancestor::*[self::tr or self::li or @role='row'][1]");
      const rowBox = await stage.rect(row);
      await stage.zoomTo({ x: 282, y: rowBox.y - 70, w: 1040, h: rowBox.h + 140 }, 1.45, 900);
      await stage.ring(row, { pad: 2, radius: 6, hold: 2000 });
      rec.mark("history");
      await stage.unring(200);
      await stage.zoomOut(800);
      await sleep(300);
    },
  },

  // ── 3. 홈 → 오늘 할 일 → 가림 확인 필요 → 지원자 관리에서 1건 가림 → 저장 ──
  s3: {
    start: "/prep/history",
    ready: (stage) => stage.see("text=배점 변경"),
    async run(stage, rec) {
      await sleep(300);
      await stage.click(stage.menu("홈"));
      await stage.see("text=오늘 할 일");
      stepCaption(stage, 3);
      await sleep(900);
      const todo = stage.$('section[aria-labelledby="home-todo-title"]');
      await stage.zoomTo(todo, 1.6, 900);
      const maskTodo = stage.$('a[href="/applicants"]').filter({ hasText: "가림 확인 필요" });
      await stage.hover(maskTodo, { fx: 0.3 });
      await stage.ring(maskTodo, { pad: 2, hold: 1300 });
      rec.mark("home-todo");
      await stage.unring(150);
      await stage.click(maskTodo, { fx: 0.3, after: 100 });
      await stage.zoomOut(800, { wait: false });
      await stage.see("text=가릴지 확인이 필요한 표현");
      await sleep(1500);
      const detail = stage.$('[aria-label="확인 필요 사항 상세"]');
      await stage.zoomTo({ x: 1456, y: 400, w: 432, h: 560 }, 1.55, 900);
      const firstExpression = stage.frame().getByText("한울제").locator("xpath=ancestor::p[1]");
      await stage.ring(firstExpression, { pad: 6, hold: 1500 });
      await stage.unring(200);
      await stage.click(detail.getByRole("button", { name: "가림", exact: true }).first(), { after: 700 });
      rec.mark("masked");
      await stage.click(stage.role("button", "저장하기"), { after: 800 });
      await stage.zoomOut(800);
      const row = stage.$('button[aria-pressed="true"]').filter({ hasText: "A-0133" });
      await stage.ring(row, { pad: 0, radius: 4, hold: 1500 });
      rec.mark("mask-saved");
      await stage.unring(200);
      await sleep(200);
    },
  },

  // ── 4. 학생부 올리기 → AI 분석 → 평가하기 ──
  s4: {
    start: "/applicants",
    ready: (stage) => stage.see("text=가릴지 확인이 필요한 표현"),
    async run(stage, rec) {
      await sleep(300);
      stepCaption(stage, 4, 3000);
      await stage.click(stage.$('a[href="/applicants/upload"]'));
      await stage.see("text=학생부 PDF 파일을 이곳에 올리세요");
      await sleep(900);
      const pick = stage.$("label span").filter({ hasText: "학생부 올리기" });
      await stage.hover(pick);
      await sleep(250);
      await stage.fakePress(300);
      await stage.$('input[type="file"]').setInputFiles(`${PROJECT}/samples/virtual-student-record.pdf`);
      const rows = stage.$('ul[aria-label="올려 둔 학생부"]');
      await stage.see(rows);
      await sleep(600);
      await stage.zoomTo({ x: 302, y: 900, w: 1165, h: 140 }, 1.5, 900);
      await stage.ring(rows.locator("li").first(), { pad: 4, hold: 1100 });
      await stage.unring(200);
      rec.mark("file-picked");
      if (process.env.NO_ANALYZE) {
        await stage.zoomOut(600);
        return;
      }
      await stage.click(stage.role("button", "분석 시작"), { after: 300 });
      await sleep(2200);
      rec.mark("analyzing");
      await stage.call("ff", "▶▶ 빠르게 감기");
      rec.setSpeed(Number(process.env.FF ?? 6));
      await stage.see(rows.getByRole("link", { name: "평가하기" }), 300000, { compress: false });
      rec.setSpeed(1);
      await stage.call("ff", null);
      await sleep(1000);
      await stage.ring(rows.locator("li").first(), { pad: 4, hold: 2000 });
      rec.mark("analyzed");
      await stage.unring(200);
      await stage.zoomOut(800);
      await stage.click(stage.menu("평가하기"));
      await stage.see("text=남은 평가");
      await sleep(1200);
    },
  },
};

Object.assign(scenes, laterScenes({ stepCaption, card }));

// ── 실행기 ────────────────────────────────────────────────────────────────────
function copyDir(from, to) {
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true });
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE, "utf8"));
  } catch {
    return { cursor: { x: 1500, y: 880 } };
  }
}

const names = process.argv.slice(2);
for (const name of names) {
  /** 이번 실행에서 이어서 찍는 장면인지: 그러면 앞 장면이 남긴 저장소를 그대로 쓰고 그것을 새로 남겨 둔다 */
  const continued = names.indexOf(name) > 0;
  const scene = scenes[name];
  if (!scene) throw new Error(`없는 장면: ${name}`);
  // 장면을 다시 찍을 수 있게, 시작할 때의 저장소를 남겨 두고 다시 찍을 때는 그것으로 되돌린다.
  const snap = path.join(SNAP, `before-${name}`);
  const stateSnap = path.join(SNAP, `state-${name}.json`);
  if (name === "s0") {
    fs.rmSync(WORK, { recursive: true, force: true });
    fs.rmSync(SNAP, { recursive: true, force: true });
    fs.rmSync(STATE, { force: true });
  } else if (fs.existsSync(snap) && !continued) {
    copyDir(snap, WORK);
    if (fs.existsSync(stateSnap)) fs.copyFileSync(stateSnap, STATE);
  } else if (fs.existsSync(WORK)) {
    copyDir(WORK, snap);
    fs.writeFileSync(stateSnap, JSON.stringify(loadState()));
  }
  const state = loadState();

  const started = Date.now();
  fs.mkdirSync(OUT, { recursive: true });
  const { context, page, stage, cdp } = await openStage({ baseUrl: BASE, profileDir: WORK, startPath: scene.start });
  try {
    await scene.ready(stage);
    await stage.frame().waitForLoadState("networkidle").catch(() => {});
    await real(800 + 900 * SLOW);
    await stage.placeCursor(state.cursor.x, state.cursor.y);
    if (!scene.curtain) await stage.call("curtain", false, 0);
    await real(300);
    if (scene.record === false) {
      await scene.run(stage, null);
      console.log(name, "준비 끝");
    } else {
      const out = path.join(OUT, `${name}.mkv`);
      const recorder = new Recorder(page, out, { cdp });
      stage.recorder = recorder;
      await recorder.start();
      await scene.run(stage, recorder);
      const info = await recorder.stop(scene.tail ?? 250);
      console.log(name, `${info.length.toFixed(1)}s`, `frames ${info.frames} (received ${info.received})`, `took ${((Date.now() - started) / 1000).toFixed(0)}s`, JSON.stringify(info.marks));
      for (const mark of info.marks) await grab(out, Math.max(0, mark.at - 0.05), path.join(OUT, `${name}-${mark.label}.jpg`));
    }
    fs.writeFileSync(STATE, JSON.stringify({ cursor: stage.cursor }));
  } catch (error) {
    await page.screenshot({ path: path.join(OUT, `${name}-error.jpg`), type: "jpeg", quality: 70 }).catch(() => {});
    console.error(name, "실패:", String(error.stack ?? error).slice(0, 1500));
    process.exitCode = 1;
  } finally {
    await context.close();
  }
  if (process.exitCode) break;
}
