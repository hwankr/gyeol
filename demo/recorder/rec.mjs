// 시연 영상 녹화 장치: 앱을 1920×1080 틀(iframe) 안에 띄우고 그 위에 커서·확대·강조·자막을 얹어 프레임을 뽑는다.
//
// 느린 동작 촬영: 브라우저의 모든 CSS 움직임(앱의 전환·무대의 확대·커서)을 SLOW 배 느리게 돌리고(Animation.setPlaybackRate),
// 받은 프레임의 시각을 SLOW 로 나눠 영상 시각으로 삼는다. 실제로는 초당 50장쯤 받으므로 영상 시각으로는 초당 200장쯤이 되어,
// 60fps 의 칸마다 그때의 화면이 정확히 들어간다(움직임이 끊기지 않는다). 이 파일의 시간 값은 모두 "영상 시각" 이다.
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const FFMPEG = require("ffmpeg-static");
/** 앱 저장소의 폴더(글꼴과 예시 학생부 PDF 를 여기서 읽는다): 이 폴더가 demo/recorder 이므로 두 칸 위다 */
export const PROJECT = path.resolve(HERE, "../..").replaceAll("\\", "/");
export const W = 1920;
export const H = 1080;
export const FPS = 60;
/** 느리게 돌리는 배수 */
export const SLOW = Number(process.env.SLOW ?? 4);

const CHROME_CANDIDATES = [
  path.join(os.homedir(), "AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe"),
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
];

/** 머무는 시간의 배수: 1 보다 작으면 장면이 그만큼 빨리 넘어간다(움직임의 빠르기는 그대로다). */
export const PACE = Number(process.env.PACE ?? 0.85);

const realSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
/** 영상 시각으로 ms 만큼 머문다(PACE 를 곱한다). */
export const sleep = (ms) => realSleep(ms * SLOW * PACE);
/** 움직임이 끝나기를 기다린다(영상 시각 ms 그대로). */
const settle = (ms) => realSleep(ms * SLOW);

/** 앱 문서마다 넣는 스타일: 입력 커서가 깜박이지 않게(느린 촬영에서는 깜박임만 빨라진다) */
const APP_INIT_SCRIPT = `
  (() => {
    if (window.top === window) return;
    const add = () => {
      const style = document.createElement("style");
      style.textContent = "*{caret-animation:manual}";
      (document.head || document.documentElement).appendChild(style);
    };
    if (document.documentElement) add(); else document.addEventListener("DOMContentLoaded", add);
  })();
`;

/** 브라우저를 띄우고 무대(stage) 쪽을 연다. profileDir 의 저장소(localStorage·IndexedDB)는 실행 사이에 남는다. */
export async function openStage({ baseUrl, profileDir, startPath = "/", headless = true }) {
  const executablePath = CHROME_CANDIDATES.find((candidate) => fs.existsSync(candidate));
  const context = await chromium.launchPersistentContext(profileDir, {
    executablePath,
    headless,
    viewport: { width: W, height: H },
    deviceScaleFactor: 1,
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    colorScheme: "light",
    args: [
      "--force-color-profile=srgb", "--hide-scrollbars", "--disable-features=Translate",
      "--enable-gpu", "--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu-rasterization", "--enable-zero-copy",
    ],
  });
  await context.addInitScript(APP_INIT_SCRIPT);
  const page = context.pages()[0] ?? (await context.newPage());
  const stageHtml = fs.readFileSync(path.join(HERE, "stage.html"), "utf8").replace("__SLOW__", String(SLOW));
  await page.route(`${baseUrl}/__stage`, (route) => route.fulfill({ contentType: "text/html; charset=utf-8", body: stageHtml }));
  await page.route(`${baseUrl}/__stage/*.woff2`, (route) => {
    const weight = /p(\d+)\.woff2/.exec(route.request().url())?.[1] ?? "500";
    route.fulfill({ contentType: "font/woff2", body: fs.readFileSync(`${PROJECT}/fonts/pretendard/Pretendard-${weight}.woff2`) });
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send("Animation.enable");
  await cdp.send("Animation.setPlaybackRate", { playbackRate: 1 / SLOW });
  await page.goto(`${baseUrl}/__stage`);
  await page.evaluate(() => document.fonts.ready);
  const stage = new Stage(page, baseUrl, cdp);
  if (startPath !== null) await stage.load(startPath);
  return { context, page, stage, cdp };
}

/** 무대 조작: 카메라(확대), 커서, 강조 테두리, 자막. 좌표는 모두 앱 화면(1920×1080) 기준이다. */
export class Stage {
  constructor(page, baseUrl, cdp) {
    this.page = page;
    this.baseUrl = baseUrl;
    this.cdp = cdp;
    this.cam = { tx: 0, ty: 0, s: 1 };
    this.cursor = { x: 960, y: 620 };
    // TRACE=1 이면 오래 걸린 동작을 적는다(느린 촬영에서 어디가 막히는지 볼 때).
    if (process.env.TRACE) {
      for (const name of ["rect", "call", "zoomTo", "moveTo", "hover", "click", "tap", "type", "ring", "unring", "scrollTo", "see"]) {
        const original = this[name].bind(this);
        this[name] = async (...args) => {
          const started = Date.now();
          try {
            return await original(...args);
          } finally {
            const took = Date.now() - started;
            if (took > Number(process.env.TRACE) * SLOW) console.log(`  [trace] ${name} ${took}ms`, name === "call" ? args[0] : "");
          }
        };
      }
    }
  }

  frame() {
    return this.page.frame({ name: "app" });
  }

  /** 틀 안의 앱을 그 주소로 새로 연다(녹화 밖에서 쓴다). */
  async load(pathname) {
    await this.page.evaluate((url) => window.stage.load(url), `${this.baseUrl}${pathname}`);
    await realSleep(300);
    await this.frame().waitForLoadState("load");
  }

  /** 앱 안의 요소 */
  $(selector) {
    return this.frame().locator(selector);
  }

  /**
   * 화면에 보이는 것만 고른다. 이 앱은 다녀온 화면을 지우지 않고 숨겨 두므로(cacheComponents) 같은 글자가 숨은 화면에도 남아 있다.
   */
  loc(target) {
    return (typeof target === "string" ? this.$(target) : target).filter({ visible: true });
  }

  /**
   * 그것이 화면에 보일 때까지 기다린다. 녹화하는 중에 기다림이 길어지면(영상 시각 0.4초 넘게) 그 구간을 빠르게 감아
   * 불러오는 시간이 영상에 남지 않게 한다. compress 를 끄면 감지 않는다(따로 빠르게 감는 구간).
   */
  async see(target, timeout = 30000, { compress = true } = {}) {
    const waiting = this.loc(target).first().waitFor({ state: "visible", timeout });
    const recorder = this.recorder;
    if (!recorder || !compress) return waiting;
    let fast = false;
    const timer = setTimeout(() => {
      fast = true;
      recorder.setSpeed(recorder.speed * 10);
    }, 400 * SLOW);
    try {
      await waiting;
    } finally {
      clearTimeout(timer);
      if (fast) recorder.setSpeed(recorder.speed / 10);
    }
  }

  async rect(target) {
    return this.loc(target).first().evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    });
  }

  call(name, ...args) {
    return this.page.evaluate(([n, a]) => window.stage[n](...a), [name, args]);
  }

  // ── 카메라 ────────────────────────────────────────────────────────────────
  /** 영역(또는 점)을 화면의 (ax, ay) 자리에 두고 s 배로 확대한다. 화면 밖이 보이지 않게 가장자리에서 멈춘다. */
  async zoomTo(area, s, ms = 900, { wait = true, ax = 0.5, ay = 0.5 } = {}) {
    const r = area.x === undefined ? await this.rect(area) : area;
    const cx = r.x + (r.w ?? 0) / 2;
    const cy = r.y + (r.h ?? 0) / 2;
    const tx = Math.min(0, Math.max(W - W * s, W * ax - cx * s));
    const ty = Math.min(0, Math.max(H - H * s, H * ay - cy * s));
    this.cam = { tx, ty, s };
    await this.call("cam", tx, ty, s, ms);
    if (wait) await settle(ms + 50);
  }

  async zoomOut(ms = 800, opts) {
    await this.zoomTo({ x: W / 2, y: H / 2 }, 1, ms, opts);
  }

  // ── 커서 ──────────────────────────────────────────────────────────────────
  /** 커서를 그 점으로 옮긴다. 걸리는 시간은 거리에 따라 정한다. */
  async moveTo(x, y, { ms, wait = true } = {}) {
    const distance = Math.hypot(x - this.cursor.x, y - this.cursor.y);
    const duration = ms ?? Math.round(Math.min(1000, 300 + distance * 0.6));
    this.cursor = { x, y };
    await this.call("cursorTo", x, y, duration);
    if (wait) await settle(duration + 30);
    return duration;
  }

  /** 요소 안의 한 점(fx, fy: 0~1)으로 커서를 옮기고 진짜 마우스도 그 자리에 둔다(올렸을 때의 색이 나온다). */
  async hover(target, { fx = 0.5, fy = 0.5, ms } = {}) {
    const locator = this.loc(target).first();
    const r = await this.rect(locator);
    await this.moveTo(r.x + r.w * fx, r.y + r.h * fy, { ms });
    await locator.hover({ position: { x: r.w * fx, y: r.h * fy }, force: true, timeout: 5000 }).catch(() => {});
    return r;
  }

  /** 커서를 옮겨 누른다. */
  async click(target, { fx = 0.5, fy = 0.5, ms, before = 160, after = 450, force = false } = {}) {
    const locator = this.loc(target).first();
    const r = await this.hover(locator, { fx, fy, ms });
    await sleep(before);
    await this.call("press");
    await sleep(90);
    await locator.click({ position: { x: r.w * fx, y: r.h * fy }, force });
    await sleep(after);
    return r;
  }

  /** 커서를 움직임 없이 그 자리에 둔다(장면을 시작할 때). */
  async placeCursor(x, y) {
    this.cursor = { x, y };
    await this.call("cursorTo", x, y, 0);
    await this.page.mouse.move(this.cam.tx + x * this.cam.s, this.cam.ty + y * this.cam.s).catch(() => {});
  }

  /** 커서를 옮기지 않고 지금 자리의 요소를 한 번 더 누른다(같은 버튼을 잇달아 누를 때). */
  async tap(target, { after = 170 } = {}) {
    await this.call("press");
    await sleep(70);
    await this.loc(target).first().click();
    await sleep(after);
  }

  /** 누르는 시늉만 한다(실제 누름은 따로 한다: 파일 고르기처럼 창이 뜨는 것). */
  async fakePress(after = 300) {
    await this.call("press");
    await sleep(after);
  }

  /** 앱 안에서 역할과 이름으로 찾는다. */
  role(role, name, options = {}) {
    return this.frame().getByRole(role, { name, ...options });
  }

  /** 주 메뉴의 링크 */
  menu(label) {
    return this.$('nav[aria-label="주 메뉴"] a').filter({ hasText: label });
  }

  /** 글자를 한 자씩 친다. */
  async type(target, text, { delay = 110, after = 350 } = {}) {
    await this.loc(target).first().pressSequentially(text, { delay: delay * SLOW });
    await sleep(after);
  }

  // ── 강조 ──────────────────────────────────────────────────────────────────
  async ring(target, { pad = 8, radius = 10, dim = false, hold = 0 } = {}) {
    const r = target.x === undefined ? await this.rect(target) : target;
    await this.call("ring", r.x - pad, r.y - pad, r.w + pad * 2, r.h + pad * 2, { radius, dim });
    if (hold > 0) await sleep(hold);
    return r;
  }

  async unring(wait = 300) {
    await this.call("unring");
    if (wait > 0) await sleep(wait);
  }

  caption(no, text, sub) {
    return this.call("caption", no, text, sub);
  }

  /** 앱 안에서 부드럽게 스크롤한다. selector 를 주면 그 요소 안을, 아니면 문서를 스크롤한다. */
  async scrollTo(top, ms = 700, selector = null) {
    await this.frame().evaluate(
      ([to, duration, sel]) =>
        new Promise((resolve) => {
          const el = sel ? document.querySelector(sel) : document.scrollingElement;
          const from = el.scrollTop;
          const start = performance.now();
          const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
          // rAF 가 넘겨주는 시각은 느린 촬영에서 같이 느려지므로 쓰지 않는다(performance.now 와 섞으면 끝나지 않는다).
          function step() {
            const t = Math.min(1, (performance.now() - start) / duration);
            el.scrollTop = from + (to - from) * ease(t);
            if (t < 1) requestAnimationFrame(step);
            else resolve();
          }
          requestAnimationFrame(step);
        }),
      [top, ms * SLOW, selector],
    );
  }
}

/**
 * 화면을 프레임으로 받아 곧바로 mp4 로 만든다(ffmpeg 에 60fps 로 흘려 넣는다).
 * 영상 시각의 칸(1/60초)마다 그때 화면에 있던 프레임을 한 장씩 쓴다. speed 가 1 보다 크면 그 구간은 그만큼 빠르게 감긴다.
 */
export class Recorder {
  constructor(page, out, { quality = 95, crf = 15, cdp } = {}) {
    this.page = page;
    this.out = out;
    this.quality = quality;
    this.crf = crf;
    this.cdp = cdp;
    this.speed = 1;
    this.vt = 0;
    this.last = null;
    this.current = null;
    this.written = 0;
    this.received = 0;
    this.repeats = 0;
    this.on = false;
    this.marks = [];
  }

  async start() {
    fs.mkdirSync(path.dirname(this.out), { recursive: true });
    // 받은 JPEG 프레임을 다시 압축하지 않고 그대로 담는다(MJPEG). 색 변환과 H.264 인코딩은 마지막에 한 번만 한다(build.mjs).
    this.ffmpeg = spawn(
      FFMPEG,
      ["-y", "-hide_banner", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-", "-c:v", "copy", this.out],
      { stdio: ["pipe", "ignore", "pipe"] },
    );
    this.ffmpegError = "";
    this.ffmpeg.stderr.on("data", (chunk) => (this.ffmpegError += chunk));
    this.done = new Promise((resolve) => this.ffmpeg.on("close", resolve));
    this.cdp ??= await this.page.context().newCDPSession(this.page);
    this.handler = ({ data, metadata, sessionId }) => {
      this.cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
      if (!this.on) return;
      const t = metadata.timestamp;
      if (this.last !== null) this.vt += Math.max(0, t - this.last) / (this.speed * SLOW);
      this.last = Math.max(this.last ?? t, t);
      this.received += 1;
      this.flush(this.vt);
      this.current = Buffer.from(data, "base64");
    };
    this.cdp.on("Page.screencastFrame", this.handler);
    this.on = true;
    await this.cdp.send("Page.startScreencast", { format: "jpeg", quality: this.quality, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
  }

  /** 영상 시각 until 앞의 칸을 지금 화면(current)으로 채운다. */
  flush(until) {
    if (this.current === null) return;
    let first = true;
    while (this.written / FPS < until) {
      this.ffmpeg.stdin.write(this.current);
      this.written += 1;
      if (!first) this.repeats += 1;
      first = false;
    }
  }

  setSpeed(speed) {
    this.speed = speed;
  }

  /** 지금의 영상 시각에 이름표를 남긴다(나중에 그 장면을 찾아볼 때 쓴다). */
  mark(label) {
    this.marks.push({ label, at: Number(this.vt.toFixed(3)) });
  }

  /** 녹화를 멈춘다. tail(영상 시각 ms)만큼 마지막 화면을 더 둔다. */
  async stop(tail = 300) {
    await realSleep(200);
    this.on = false;
    await this.cdp.send("Page.stopScreencast").catch(() => {});
    this.cdp.off("Page.screencastFrame", this.handler);
    this.flush(this.vt + tail / 1000);
    this.ffmpeg.stdin.end();
    const code = await this.done;
    if (code !== 0) throw new Error(`ffmpeg 실패(${code}): ${this.ffmpegError}`);
    const info = { out: this.out, length: this.written / FPS, frames: this.written, received: this.received, repeats: this.repeats, marks: this.marks };
    fs.writeFileSync(this.out.replace(/\.mkv$/, ".json"), JSON.stringify(info, null, 2));
    return info;
  }
}

/** 영상의 한 시각(초)을 그림 파일로 뽑는다(확인용). */
export function grab(video, at, out) {
  return new Promise((resolve, reject) => {
    const child = spawn(FFMPEG, ["-y", "-hide_banner", "-loglevel", "error", "-ss", String(at), "-i", video, "-frames:v", "1", "-q:v", "2", out]);
    child.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`grab 실패 ${code}`))));
  });
}
