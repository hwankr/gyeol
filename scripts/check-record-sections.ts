// 학생부 항목을 주고받는 공용 함수(lib/recordSections.ts) 검사. AI 와 서버를 부르지 않는다.
// 실행(저장소 루트에서): node scripts/check-record-sections.ts (npx tsx 로도 된다)
// 보는 것: 브라우저가 보낸 항목 확인(readRecordSections), 이미지 쪽을 AI 가 읽은 결과 정리(readPageSections),
// 글자가 있는 쪽의 항목과 이미지 쪽의 항목 합치기(mergeRecordSections), 쪽 그림 확인(isJpegBase64),
// 이미지 쪽의 항목명이 파서의 항목명과 글자 그대로 같은지(가상 학생부를 파서로 읽어 견준다).
// 모두 통과하면 "학생부 항목 검사 통과: N건" 을 출력하고 종료 코드 0, 하나라도 어긋나면 어긋난 것을 출력하고 종료 코드 1.
// Node 로 직접(타입 제거 실행) 돌도록 값 import 는 상대 경로에 .ts 확장자를 붙인다.
import { readFile } from "node:fs/promises";
import { parsePdf } from "../lib/pipeline/parsePdf.ts";
import {
  MAX_PAGE_SECTIONS,
  MAX_RECORD_SECTIONS,
  MAX_RECORD_TEXT_LENGTH,
  MAX_SECTION_TEXT_LENGTH,
  NARRATIVE_CATEGORIES,
  PAGE_CATEGORIES,
  isJpegBase64,
  mergeRecordSections,
  readPageSections,
  readRecordSections,
  type PageSection,
} from "../lib/recordSections.ts";

const SAMPLE_PDF = "samples/virtual-student-record.pdf";

let checks = 0;
const failures: string[] = [];

function check(name: string, ok: boolean): void {
  checks += 1;
  if (!ok) failures.push(name);
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

const valid = { id: "x9", category: "자율활동", grade: 2, page: 3, text: "본문" };

// ── readRecordSections: 브라우저가 보낸 항목 확인 ──
check("항목: 올바른 항목은 통과하고 id 를 새로 준다", same(readRecordSections([valid, { ...valid, id: "x9" }]), [
  { id: "s1", category: "자율활동", grade: 2, page: 3, text: "본문" },
  { id: "s2", category: "자율활동", grade: 2, page: 3, text: "본문" },
]));
check("항목: subject·fieldId·hours 는 있으면 남긴다", same(
  readRecordSections([{ ...valid, subject: "국어", fieldId: "S07.BASE.NOTE.text", hours: 30 }]),
  [{ id: "s1", category: "자율활동", grade: 2, subject: "국어", page: 3, text: "본문", fieldId: "S07.BASE.NOTE.text", hours: 30 }],
));
check("항목: 모르는 키는 결과에 섞이지 않는다", same(readRecordSections([{ ...valid, extra: "x", __proto__: null }]), [
  { id: "s1", category: "자율활동", grade: 2, page: 3, text: "본문" },
]));
check("항목: 학년 null 허용", readRecordSections([{ ...valid, grade: null }]) !== null);
check("항목: 배열이 아니면 거절", readRecordSections({ sections: [valid] }) === null);
check("항목: 빈 배열 거절", readRecordSections([]) === null);
check("항목: 개수 한도 초과 거절", readRecordSections(Array.from({ length: MAX_RECORD_SECTIONS + 1 }, () => valid)) === null);
check("항목: 개수 한도는 허용", readRecordSections(Array.from({ length: MAX_RECORD_SECTIONS }, () => valid))?.length === MAX_RECORD_SECTIONS);
check("항목: 항목이 객체가 아니면 거절", readRecordSections(["본문"]) === null);
check("항목: 항목명이 공백뿐이면 거절", readRecordSections([{ ...valid, category: "  " }]) === null);
check("항목: 항목명이 길면 거절", readRecordSections([{ ...valid, category: "가".repeat(41) }]) === null);
check("항목: 학년이 0 이면 거절", readRecordSections([{ ...valid, grade: 0 }]) === null);
check("항목: 학년이 소수면 거절", readRecordSections([{ ...valid, grade: 1.5 }]) === null);
check("항목: 학년이 문자열이면 거절", readRecordSections([{ ...valid, grade: "2" }]) === null);
check("항목: 쪽이 0 이면 거절", readRecordSections([{ ...valid, page: 0 }]) === null);
check("항목: 쪽이 한도를 넘으면 거절", readRecordSections([{ ...valid, page: 61 }]) === null);
check("항목: 원문이 공백뿐이면 거절", readRecordSections([{ ...valid, text: " \n " }]) === null);
check("항목: 원문이 한도를 넘으면 거절", readRecordSections([{ ...valid, text: "가".repeat(MAX_SECTION_TEXT_LENGTH + 1) }]) === null);
check("항목: 원문이 한도와 같으면 허용", readRecordSections([{ ...valid, text: "가".repeat(MAX_SECTION_TEXT_LENGTH) }]) !== null);
check("항목: 원문 합이 한도를 넘으면 거절", readRecordSections(
  Array.from({ length: MAX_RECORD_TEXT_LENGTH / MAX_SECTION_TEXT_LENGTH + 1 }, () => ({ ...valid, text: "가".repeat(MAX_SECTION_TEXT_LENGTH) })),
) === null);
check("항목: 과목이 문자열이 아니면 거절", readRecordSections([{ ...valid, subject: 3 }]) === null);
check("항목: 시간이 음수면 거절", readRecordSections([{ ...valid, hours: -1 }]) === null);
check("항목: 시간이 NaN 이면 거절", readRecordSections([{ ...valid, hours: Number.NaN }]) === null);

// ── readPageSections: 이미지 쪽을 AI 가 읽은 결과 정리 ──
const raw = { category: "세부능력 및 특기사항", grade: 2, subject: " 국어 ", text: " 본문 ", continued: false };
check("쪽: 앞뒤 공백을 빼고 정리한다", same(readPageSections([raw]), [
  { category: "세부능력 및 특기사항", grade: 2, subject: "국어", text: "본문", continued: false },
]));
check("쪽: 학년 0 은 null, 빈 과목은 null", same(readPageSections([{ ...raw, grade: 0, subject: "" }]), [
  { category: "세부능력 및 특기사항", grade: null, subject: null, text: "본문", continued: false },
]));
check("쪽: 목록에 없는 항목명은 기타", readPageSections([{ ...raw, category: "모르는 항목" }])?.[0]?.category === "기타");
check("쪽: 빈 글 항목은 버린다", same(readPageSections([{ ...raw, text: "  " }]), []));
check("쪽: 빈 배열(빈 쪽)은 통과", same(readPageSections([]), []));
check("쪽: continued 는 첫 항목에서만 남긴다", same(
  readPageSections([{ ...raw, continued: true }, { ...raw, continued: true }])?.map((section) => section.continued),
  [true, false],
));
check("쪽: 첫 항목이 버려지면 둘째의 continued 는 남기지 않는다", same(
  readPageSections([{ ...raw, text: "", continued: true }, { ...raw, continued: true }])?.map((section) => section.continued),
  [false],
));
check("쪽: 배열이 아니면 null", readPageSections({ sections: [] }) === null);
check("쪽: 개수 한도 초과면 null", readPageSections(Array.from({ length: MAX_PAGE_SECTIONS + 1 }, () => raw)) === null);
check("쪽: 필드 타입이 다르면 null", readPageSections([{ ...raw, continued: "false" }]) === null);
check("쪽: 학년이 소수면 null", readPageSections([{ ...raw, grade: 2.5 }]) === null);

// ── mergeRecordSections: 합치기 ──
const page = (category: string, text: string, more: Partial<PageSection> = {}): PageSection => ({
  category,
  grade: null,
  subject: null,
  text,
  continued: false,
  ...more,
});
const textSections = [
  { id: "s1", category: "인적·학적사항", grade: null, page: 1, text: "성명: 가나다" },
  { id: "s2", category: "자율활동", grade: 1, page: 2, text: "첫 문장" },
  { id: "s3", category: "행동특성 및 종합의견", grade: 3, page: 5, text: "끝" },
];
const merged = mergeRecordSections(textSections, [
  { page: 4, sections: [page("교과 성적", "과목 | 성취도", { grade: 2 }), page("세부능력 및 특기사항", "세특", { subject: "국어" })] },
  { page: 3, sections: [page("기타", "이어지는 문장", { continued: true }), page("동아리활동", "동아리")] },
]);
check("합치기: 쪽 순서로 놓고 id 를 새로 준다", same(merged.map((section) => `${section.id}:${section.page}:${section.category}`), [
  "s1:1:인적·학적사항",
  "s2:2:자율활동",
  "s3:3:동아리활동",
  "s4:4:교과 성적",
  "s5:4:세부능력 및 특기사항",
  "s6:5:행동특성 및 종합의견",
]));
check("합치기: 앞쪽에서 이어지는 글은 앞 항목 뒤에 공백 하나로 붙인다", merged[1]?.text === "첫 문장 이어지는 문장");
check("합치기: 학년이 없으면 같은 묶음의 앞 항목 학년을 쓴다(창의적 체험활동)", merged[2]?.grade === 1);
check("합치기: 묶음이 다르면 학년을 이어받지 않는다", mergeRecordSections(textSections.slice(0, 2), [{ page: 3, sections: [page("교과 성적", "표")] }])[2]?.grade === null);
check("합치기: 성적표의 학년을 세부능력 및 특기사항이 이어받는다", merged[4]?.grade === 2 && merged[4]?.subject === "국어");
check("합치기: 이미지 쪽에 적힌 학년이 있으면 그대로 쓴다", mergeRecordSections(textSections.slice(1, 2), [{ page: 3, sections: [page("동아리활동", "동아리", { grade: 2 })] }])[1]?.grade === 2);
check("합치기: 받은 값을 바꾸지 않는다", textSections[1]?.text === "첫 문장" && textSections[1]?.id === "s2");
check("합치기: 표 모양 항목에 이어 붙일 때는 줄을 바꾼다", mergeRecordSections(
  [{ id: "s1", category: "교과 성적", grade: 1, page: 1, text: "머리글\n국어 | A" }],
  [{ page: 2, sections: [page("교과 성적", "수학 | B", { continued: true })] }],
)[0]?.text === "머리글\n국어 | A\n수학 | B");
check("합치기: 앞에 항목이 없으면 이어지는 글도 새 항목이 된다", same(
  mergeRecordSections([], [{ page: 1, sections: [page("기타", "글", { continued: true })] }]),
  [{ id: "s1", category: "기타", grade: null, page: 1, text: "글" }],
));
check("합치기: 붙인 글이 한도를 넘으면 새 항목으로 둔다", mergeRecordSections(
  [{ id: "s1", category: "자율활동", grade: 1, page: 1, text: "가".repeat(MAX_SECTION_TEXT_LENGTH) }],
  [{ page: 2, sections: [page("자율활동", "글", { continued: true })] }],
).length === 2);
check("합치기: 이미지 쪽만 있어도 된다", mergeRecordSections([], [{ page: 2, sections: [page("자율활동", "나")] }, { page: 1, sections: [page("자율활동", "가")] }]).map((section) => section.text).join("") === "가나");
check("합치기: 합친 결과는 서버 확인을 통과한다", same(readRecordSections(merged), merged));

// ── isJpegBase64: 쪽 그림 확인 ──
check("그림: JPEG 머리로 시작하는 base64 통과", isJpegBase64("/9j/4AAQSkZJRg=="));
check("그림: PNG 는 거절", !isJpegBase64("iVBORw0KGgo="));
check("그림: data URL 은 거절", !isJpegBase64("data:image/jpeg;base64,/9j/4AAQ"));
check("그림: base64 가 아닌 글자가 있으면 거절", !isJpegBase64("/9j/4AAQ\nSkZJRg"));

// ── 항목명: 이미지 쪽의 항목명이 파서의 항목명과 글자 그대로 같은지 ──
const parsed = await parsePdf(await readFile(SAMPLE_PDF));
const parserCategories = [...new Set(parsed.map((section) => section.category))];
check(
  "항목명: 파서가 가상 학생부에서 읽는 항목명이 모두 이미지 쪽 항목명 목록에 있다",
  parserCategories.length > 0 && parserCategories.every((category) => (PAGE_CATEGORIES as readonly string[]).includes(category)),
);
check("항목명: 서술형 항목명이 모두 이미지 쪽 항목명 목록에 있다", NARRATIVE_CATEGORIES.every((category) => (PAGE_CATEGORIES as readonly string[]).includes(category)));
check("항목명: 파서가 읽은 항목은 서버 확인을 통과한다", readRecordSections(parsed)?.length === parsed.length);

if (failures.length > 0) {
  console.error(`학생부 항목 검사 실패: ${failures.length}건 (전체 ${checks}건)`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`학생부 항목 검사 통과: ${checks}건`);
}
