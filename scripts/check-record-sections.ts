// 학생부 항목을 주고받는 공용 함수(lib/recordSections.ts) 검사. AI 와 서버를 부르지 않는다.
// 실행(저장소 루트에서): node scripts/check-record-sections.ts (npx tsx 로도 된다)
// 보는 것: 브라우저가 보낸 항목 확인(readRecordSections), 이미지 쪽을 AI 가 읽은 결과 정리(readPageSections),
// 글자가 있는 쪽의 항목과 이미지 쪽의 항목 합치기(mergeRecordSections), 쪽 그림 확인(isJpegBase64),
// 이미지 쪽의 항목명이 파서의 항목명과 글자 그대로 같은지(가상 학생부를 파서로 읽어 견준다),
// 학생부 서식 정의(lib/recordForm.ts: 별지 제8호 서식의 칸)가 항목 확인의 한도 안이고 파서가 읽은 항목이 모두 서식의 칸인지.
// 모두 통과하면 "학생부 항목 검사 통과: N건" 을 출력하고 종료 코드 0, 하나라도 어긋나면 어긋난 것을 출력하고 종료 코드 1.
// Node 로 직접(타입 제거 실행) 돌도록 값 import 는 상대 경로에 .ts 확장자를 붙인다.
import { readFile } from "node:fs/promises";
import { parsePdf } from "../lib/pipeline/parsePdf.ts";
import {
  RECORD_FORM_OTHER_ID,
  RECORD_FORM_PARTS,
  describeRecordFormForAnalysis,
  describeRecordFormForReading,
  recordFormGroup,
  recordFormPart,
  recordFormPath,
} from "../lib/recordForm.ts";
import {
  MAX_PAGE_SECTIONS,
  MAX_RECORD_SECTIONS,
  MAX_RECORD_TEXT_LENGTH,
  MAX_SECTION_CATEGORY_LENGTH,
  MAX_SECTION_FIELD_ID_LENGTH,
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
const raw = { fieldId: "S07.BASE.NOTE.text", grade: 2, subject: " 국어 ", hours: 0, text: " 본문 ", continued: false };
check("쪽: 앞뒤 공백을 빼고 정리하고, 항목명은 서식의 칸에서 정한다", same(readPageSections([raw]), [
  { fieldId: "S07.BASE.NOTE.text", category: "세부능력 및 특기사항", grade: 2, subject: "국어", hours: null, text: "본문", continued: false },
]));
check("쪽: 학년 0 은 null, 빈 과목은 null", same(readPageSections([{ ...raw, grade: 0, subject: "" }]), [
  { fieldId: "S07.BASE.NOTE.text", category: "세부능력 및 특기사항", grade: null, subject: null, hours: null, text: "본문", continued: false },
]));
check("쪽: 서식에 없는 칸은 기타", same(
  readPageSections([{ ...raw, fieldId: "모르는 칸" }])?.map((section) => [section.fieldId, section.category]),
  [[RECORD_FORM_OTHER_ID, "기타"]],
));
check("쪽: 받은 항목명은 쓰지 않는다(칸의 항목명을 쓴다)", readPageSections([{ ...raw, category: "자율활동" }])?.[0]?.category === "세부능력 및 특기사항");
check("쪽: 진로 선택 과목·체육·예술의 칸도 항목명은 같다", same(
  readPageSections([
    { ...raw, fieldId: "S07.CAREER.NOTE.text" },
    { ...raw, fieldId: "S07.ART.SCORE", subject: "" },
    { ...raw, fieldId: "S04.NCS", subject: "" },
  ])?.map((section) => section.category),
  ["세부능력 및 특기사항", "교과 성적", "국가직무능력표준 이수상황"],
));
check("쪽: 창의적 체험활동 영역의 시간은 남긴다", readPageSections([{ ...raw, fieldId: "S06.CLUB.remarks", hours: 34 }])?.[0]?.hours === 34);
check("쪽: 시간을 적지 않는 칸의 시간은 버린다", readPageSections([{ ...raw, hours: 34 }])?.[0]?.hours === null);
check("쪽: 시간 0 은 null", readPageSections([{ ...raw, fieldId: "S06.AUTO.remarks", hours: 0 }])?.[0]?.hours === null);
check("쪽: 시간이 없어도 된다", readPageSections([{ fieldId: "S06.AUTO.remarks", grade: 1, subject: null, text: "글", continued: false }])?.[0]?.hours === null);
check("쪽: 시간이 숫자가 아니면 null", readPageSections([{ ...raw, hours: "34" }]) === null);
check("쪽: 칸이 문자열이 아니면 null", readPageSections([{ ...raw, fieldId: 7 }]) === null);
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
/** 그 항목명의 칸 가운데 서식에서 맨 먼저 나오는 것으로 이미지 쪽 항목을 만든다 */
const page = (category: string, text: string, more: Partial<PageSection> = {}): PageSection => ({
  fieldId: RECORD_FORM_PARTS.find((part) => part.category === category)?.id ?? RECORD_FORM_OTHER_ID,
  category,
  grade: null,
  subject: null,
  hours: null,
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
check("합치기: 이미지 쪽의 항목은 서식의 칸을 가진다", merged[3]?.fieldId === "S07.BASE.SCORE" && merged[4]?.fieldId === "S07.BASE.NOTE.text");
check("합치기: 이미지 쪽의 시간을 남긴다", mergeRecordSections([], [{ page: 1, sections: [page("동아리활동", "동아리", { hours: 34 })] }])[0]?.hours === 34);
check("합치기: 시간이 없으면 hours 를 넣지 않는다", !("hours" in (mergeRecordSections([], [{ page: 1, sections: [page("동아리활동", "동아리")] }])[0] ?? {})));
check("합치기: 이미지 쪽에 적힌 학년이 있으면 그대로 쓴다", mergeRecordSections(textSections.slice(1, 2), [{ page: 3, sections: [page("동아리활동", "동아리", { grade: 2 })] }])[1]?.grade === 2);
check("합치기: 받은 값을 바꾸지 않는다", textSections[1]?.text === "첫 문장" && textSections[1]?.id === "s2");
check("합치기: 표 모양 항목에 이어 붙일 때는 줄을 바꾼다", mergeRecordSections(
  [{ id: "s1", category: "교과 성적", grade: 1, page: 1, text: "머리글\n국어 | A" }],
  [{ page: 2, sections: [page("교과 성적", "수학 | B", { continued: true })] }],
)[0]?.text === "머리글\n국어 | A\n수학 | B");
check("합치기: 앞에 항목이 없으면 이어지는 글도 새 항목이 된다", same(
  mergeRecordSections([], [{ page: 1, sections: [page("기타", "글", { continued: true })] }]),
  [{ id: "s1", category: "기타", grade: null, page: 1, text: "글", fieldId: RECORD_FORM_OTHER_ID }],
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

// ── 학생부 서식 정의 (별지 제8호 서식) ──
check("서식: 칸 ID 가 겹치지 않는다", new Set(RECORD_FORM_PARTS.map((part) => part.id)).size === RECORD_FORM_PARTS.length);
check("서식: 칸 ID 와 항목명이 항목 확인의 길이 한도 안이다", RECORD_FORM_PARTS.every(
  (part) => part.id.length <= MAX_SECTION_FIELD_ID_LENGTH && part.category.trim() !== "" && part.category.length <= MAX_SECTION_CATEGORY_LENGTH,
));
check("서식: 번호가 붙은 항목은 1~9 가 모두 있다", same(
  [...new Set(RECORD_FORM_PARTS.map((part) => part.no))].sort((a, b) => a - b),
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
));
check("서식: 항목명 목록은 서식의 칸에서 나온다", same(PAGE_CATEGORIES, [...new Set(RECORD_FORM_PARTS.map((part) => part.category))]));
check("서식: 서술형 항목명은 여섯 가지다", same(NARRATIVE_CATEGORIES, [
  "자율활동",
  "동아리활동",
  "진로활동",
  "세부능력 및 특기사항",
  "독서활동상황",
  "행동특성 및 종합의견",
]));
check("서식: 교과학습발달상황은 세 묶음의 성적표와 세부능력 및 특기사항이다", same(
  RECORD_FORM_PARTS.filter((part) => part.no === 7).map((part) => `${part.group}/${part.category}`),
  [
    "/교과 성적",
    "/세부능력 및 특기사항",
    "진로 선택 과목/교과 성적",
    "진로 선택 과목/세부능력 및 특기사항",
    "체육·예술/교과 성적",
    "체육·예술/세부능력 및 특기사항",
  ],
));
check("서식: 시간을 적는 칸은 창의적 체험활동의 세 영역이다", same(
  RECORD_FORM_PARTS.filter((part) => part.hours).map((part) => part.category),
  ["자율활동", "동아리활동", "진로활동"],
));
check("서식: 파서가 읽은 항목은 모두 서식의 칸이고 항목명이 그 칸의 것이다", parsed.every(
  (section) => recordFormPart(section.fieldId)?.category === section.category,
));
check("서식: 서식에서의 자리", same(
  ["S01", "S04.NCS", "S06.VOLUNTEER", "S07.BASE.SCORE", "S07.CAREER.NOTE.text", "S00.HEADER", "ETC", "없는 칸", undefined].map(recordFormPath),
  [
    "1. 인적·학적사항",
    "4. 자격증 및 인증 취득상황 > 국가직무능력표준 이수상황",
    "6. 창의적 체험활동상황 > 봉사활동실적",
    "7. 교과학습발달상황 > 교과 성적",
    "7. 교과학습발달상황 > 진로 선택 과목 > 세부능력 및 특기사항",
    "머리 부분 > 인적·학적사항",
    "기타",
    null,
    null,
  ],
));
check("서식: 화면에 더하는 묶음 이름", same(
  ["S07.CAREER.SCORE", "S07.ART.NOTE.text", "S07.BASE.SCORE", "S06.VOLUNTEER", "S04.NCS", undefined].map(recordFormGroup),
  ["진로 선택 과목", "체육·예술", null, null, null, null],
));
check("서식: AI 에 주는 쪽 읽기 설명에 모든 칸이 있다", RECORD_FORM_PARTS.every((part) => describeRecordFormForReading().includes(`fieldId "${part.id}"`)));
check("서식: AI 에 주는 분석 설명에 세 성적표의 칸이 있다", ["석차등급", "성취도별 분포비율", "체육·예술"].every((word) => describeRecordFormForAnalysis().includes(word)));

if (failures.length > 0) {
  console.error(`학생부 항목 검사 실패: ${failures.length}건 (전체 ${checks}건)`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`학생부 항목 검사 통과: ${checks}건`);
}
