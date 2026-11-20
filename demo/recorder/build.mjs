// 장면 파일(out/final/s1.mkv …)을 이어 붙여 mp4 한 편으로 만든다. 장면 사이는 짧게 겹쳐 넘긴다(xfade).
// `node build.mjs [출력 파일]`. 색은 여기서 한 번만 바꾼다(JPEG 의 BT.601 전 범위 → BT.709 제한 범위. 정확한 반올림을 켠다).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { FFMPEG, FPS, HERE } from "./rec.mjs";

const DIR = path.join(HERE, "out", process.env.FROM ?? "final");
const OUT = process.argv[2] ?? path.join(HERE, "out", "gyeol-demo.mp4");
const NAMES = (process.env.SCENES ?? "s1,s2,s3,s4,s5,s6,s7,s8").split(",");
const FADE = 0.3;

const clips = NAMES.map((name) => {
  const info = JSON.parse(fs.readFileSync(path.join(DIR, `${name}.json`), "utf8"));
  return { name, file: path.join(DIR, `${name}.mkv`), length: info.frames / FPS };
});

const inputs = clips.flatMap((clip) => ["-i", clip.file]);
const filters = [];
let last = "[0:v]";
let offset = 0;
clips.forEach((clip, index) => {
  if (index === 0) {
    offset = clip.length;
    return;
  }
  const label = `[x${index}]`;
  filters.push(`${last}[${index}:v]xfade=transition=fade:duration=${FADE}:offset=${(offset - FADE).toFixed(4)}${label}`);
  last = label;
  offset += clip.length - FADE;
});
filters.push(
  `${last}scale=in_color_matrix=bt601:in_range=pc:out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p[out]`,
);

const args = [
  "-y", "-hide_banner", "-loglevel", "error", "-stats",
  ...inputs,
  "-filter_complex", filters.join(";"),
  "-map", "[out]",
  "-r", String(FPS),
  "-c:v", "libx264", "-preset", process.env.PRESET ?? "medium", "-crf", process.env.CRF ?? "16", "-profile:v", "high", "-g", String(FPS * 2),
  "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
  "-movflags", "+faststart", OUT,
];
fs.mkdirSync(path.dirname(OUT), { recursive: true });
const result = spawnSync(FFMPEG, args, { stdio: ["ignore", "inherit", "inherit"] });
if (result.status !== 0) process.exit(result.status ?? 1);

let at = 0;
const chapters = clips.map((clip, index) => {
  const start = at;
  at += clip.length - (index < clips.length - 1 ? FADE : 0);
  return `${clip.name} ${start.toFixed(1)}s`;
});
console.log(`\n${OUT}\n길이 ${offset.toFixed(1)}s · ${(fs.statSync(OUT).size / 1024 / 1024).toFixed(1)}MB\n${chapters.join(" · ")}`);
