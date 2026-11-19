// 원문의 자리 찾기(lib/recordLocate.ts) 검사. AI 와 서버를 부르지 않는다.
// 실행(저장소 루트에서): node scripts/check-record-locate.ts (npx tsx 로도 된다)
// 보는 것: 글자 접기(foldText), 가린 구간 찾기(unmaskSpans)와 가려진 원문의 구절을 가리기 전 원문의 범위로 옮기기(originalRangeOf),
// 글자 줄 만들기(buildRecordStream), 항목 맞추기(alignToStream: 표의 다른 칸이 끼어 있을 때, 글자가 조금 다를 때, 같은 글이 두 번 나올 때),
// 자리와 가린 자리 모으기(locateRecord: 이름·학교명의 자리, 항목 밖에 또 나오는 곳, 인적·학적사항, 쪽 머리말·꼬리말, 그림을 만들지 않는 쪽),
// 가상 학생부 PDF 전체(파서 → 블라인드 → 자리 찾기: 모든 항목의 자리, 이름·학교명이 나오는 모든 곳이 덮였는지, 샘플 결과의 근거 자리),
// 별지 제8호 서식을 본뜬 가상 학생부 PDF(samples/filled-form-record.pdf. AI 가 읽었을 때의 모양으로 적은 항목 몇 개로: 인적·학적사항을
// 서식의 다음 제목 위까지만 덮는지, 머리글을 풀어 적은 표의 자리, 쪽마다 되풀이되는 머리말·꼬리말, 증명사진·직인의 자리).
// 모두 통과하면 "원문 자리 검사 통과: N건" 을 출력하고 종료 코드 0, 하나라도 어긋나면 어긋난 것을 출력하고 종료 코드 1.
// Node 로 직접(타입 제거 실행) 돌도록 값 import 는 상대 경로에 .ts 확장자를 붙인다.
import { readFile } from "node:fs/promises";
import { getDocumentProxy } from "unpdf";
import type { AnalysisResult, Section } from "../types/analysis.ts";
import { blind } from "../lib/pipeline/blind.ts";
import { parsePdfDocument } from "../lib/pipeline/parsePdf.ts";
import {
  alignToStream,
  buildRecordStream,
  foldText,
  locateRecord,
  originalRangeOf,
  rectsOfIndexes,
  unmaskSpans,
  type PageItems,
  type PageRect,
  type RecordStream,
} from "../lib/recordLocate.ts";
import { readPageItems } from "../lib/recordPageItems.ts";
import { smallImageRects } from "../lib/recordPages.ts";

const SAMPLE_PDF = "samples/virtual-student-record.pdf";
const SAMPLE_RESULT = "lib/mock/sample-result.json";
const FORM_PDF = "samples/filled-form-record.pdf";

let checks = 0;
const failures: string[] = [];

function check(name: string, ok: boolean): void {
  checks += 1;
  if (!ok) failures.push(name);
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ── foldText: 글자 접기 ──
check("접기: 공백을 빼고 자리를 남긴다", same(foldText("가 나\n다"), { folded: "가나다", map: [0, 2, 4] }));
check("접기: 전각·호환 글자를 푼다", foldText("ＡＢ：１ ㎝ Ⅱ").folded === "AB:1cmII");
check("접기: 따옴표·줄표·가운뎃점을 한 가지로 맞춘다", foldText("‘가’ “나” – ㆍ").folded === "'가'\"나\"-·");
check("접기: 뺄 글자를 뺀다", foldText("국어 | A | 1", "|").folded === "국어A1");
check("접기: 풀어 쓴 자모를 붙인다", foldText("가".normalize("NFD") + "나").folded === "가나");

// ── unmaskSpans: 가린 구간 찾기 ──
check("가린 구간: 가린 것이 없으면 빈 배열", same(unmaskSpans("그대로", "그대로"), []));
check("가린 구간: 가운데 한 곳", same(unmaskSpans("김하늘 학생은 성실함", "[이름] 학생은 성실함"), [{ start: 0, end: 3, label: "[이름]" }]));
check("가린 구간: 여러 곳", same(unmaskSpans("가온고등학교에서 김하늘이 발표함", "[학교명]에서 [이름]이 발표함"), [
  { start: 0, end: 6, label: "[학교명]" },
  { start: 9, end: 12, label: "[이름]" },
]));
check("가린 구간: 끝에 있는 표시", same(unmaskSpans("연락처 010-1234-5678", "연락처 [전화번호]"), [{ start: 4, end: 17, label: "[전화번호]" }]));
check("가린 구간: 붙어 있는 표시는 한 구간", same(unmaskSpans("가 김하늘가온고 나", "가 [이름][학교명] 나"), [{ start: 2, end: 8, label: "[이름][학교명]" }]));
check("가린 구간: 견줄 수 없으면 null", unmaskSpans("전혀 다른 글", "[이름] 학생은") === null);
check("가린 구간: 표시가 없는데 글이 다르면 null", unmaskSpans("가나다", "가나라") === null);
check("가린 구간: 가린 글이 빈 글일 수는 없다", unmaskSpans("가나", "가[이름]나") === null);

// ── originalRangeOf: 가려진 원문의 구절 → 가리기 전 원문의 범위 ──
const beforeText = "가온고등학교 축제에서 김하늘이 사회를 맡아 진행함.";
const afterText = "[학교명] 축제에서 [이름]이 사회를 맡아 진행함.";
check("구절 범위: 가린 구간 뒤의 구절", same(originalRangeOf(beforeText, afterText, "사회를 맡아 진행함"), [17, 27]));
check("구절 범위: 가린 구간을 품은 구절", same(originalRangeOf(beforeText, afterText, "축제에서 [이름]이 사회를"), [7, 20]));
check("구절 범위: 가린 구간 앞에서 끝나는 구절", same(originalRangeOf(beforeText, afterText, "축제에서 "), [7, 12]));
check("구절 범위: 원문에 없는 구절은 null", originalRangeOf(beforeText, afterText, "없는 구절") === null);
check("구절 범위: 가린 것이 없는 원문", same(originalRangeOf("가나다라", "가나다라", "나다"), [1, 3]));

// ── buildRecordStream: 글자 줄 ──
/** 한 줄에 조각 하나: x 는 왼쪽, y 는 기준선 */
const item = (str: string, x: number, y: number, size = 10) => ({ str, x, y, w: str.length * size, size });
const twoColumns: PageItems = {
  page: 1,
  width: 600,
  height: 800,
  items: [
    item("본문 첫째 줄 가나다라마바사", 200, 100),
    item("자율활동", 40, 100),
    item("본문 둘째 줄 아자차카타파하", 200, 114),
    item("(56시간)", 40, 114),
    item("가온고 1 / 3", 250, 780),
  ],
};
const twoColumnStream = buildRecordStream([twoColumns]);
check(
  "글자 줄: 위에서 아래로, 줄 안에서는 왼쪽에서 오른쪽으로 읽는다",
  twoColumnStream.text === "자율활동본문첫째줄가나다라마바사(56시간)본문둘째줄아자차카타파하가온고1/3",
);
check("글자 줄: 쪽의 범위", same(twoColumnStream.ranges.get(1), [0, twoColumnStream.text.length]));
check("글자 줄: 떨어진 조각은 다른 토막이다", twoColumnStream.run[3] !== twoColumnStream.run[4]);
check("글자 줄: 자리는 쪽 크기에 대한 비율이다", Math.abs(twoColumnStream.x[0] - 40 / 600) < 1e-9 && twoColumnStream.y[0] < 100 / 800);
check("글자 줄: 글자 없는 쪽은 빈 범위", same(buildRecordStream([{ page: 2, width: 600, height: 800, items: [] }]).ranges.get(2), [0, 0]));

// ── alignToStream: 항목 맞추기 ──
const body = foldText("본문 첫째 줄 가나다라마바사 본문 둘째 줄 아자차카타파하").folded;
const aligned = alignToStream(twoColumnStream.text, body, 0, twoColumnStream.text.length);
check("맞추기: 표의 다른 칸이 끼어 있어도 모든 글자를 찾는다", aligned.every((at) => at >= 0));
check("맞추기: 둘째 줄은 이름 칸을 건너뛴 자리다", twoColumnStream.text.slice(aligned[12], aligned[12] + 4) === "본문둘째");
const changed = foldText("본문 첫째 줄 가나다라마바사 본문 둘째 쭐 아자차카타파하").folded;
const alignedChanged = alignToStream(twoColumnStream.text, changed, 0, twoColumnStream.text.length);
check("맞추기: 글자 하나가 달라도 나머지를 찾는다", alignedChanged.filter((at) => at < 0).length === 1);
check("맞추기: 범위가 비면 아무것도 찾지 않는다", alignToStream("가나다", "가나다", 3, 3).every((at) => at < 0));
check("맞추기: 문서에 없는 글은 찾지 않는다", alignToStream(twoColumnStream.text, "전혀없는글자들이이어지는문장입니다", 0, twoColumnStream.text.length).every((at) => at < 0));
const repeated = "해당사항없음가나다라마바사해당사항없음가나다라마바사";
const claimed = new Array<boolean>(repeated.length).fill(false);
const first = alignToStream(repeated, "해당사항없음가나다라마바사", 0, repeated.length, claimed);
for (const at of first) claimed[at] = true;
const second = alignToStream(repeated, "해당사항없음가나다라마바사", 0, repeated.length, claimed);
check("맞추기: 같은 글이 두 번 나오면 항목마다 다른 자리를 찾는다", first[0] === 0 && second[0] === 13);

// ── rectsOfIndexes: 네모 합치기 ──
const bodyRects = rectsOfIndexes(twoColumnStream, aligned);
check("네모: 줄 토막마다 하나", bodyRects.length === 2 && bodyRects.every((rect) => rect[0] === 1));
check("네모: 이름 칸은 들어가지 않는다", bodyRects.every((rect) => rect[1] >= 200 / 600 - 1e-4));

// ── locateRecord: 지어낸 학생부 ──
const section = (id: string, category: string, page: number, text: string, more: Partial<Section> = {}): Section => ({
  id,
  category,
  grade: null,
  page,
  text,
  ...more,
});
const madePages: PageItems[] = [
  {
    page: 1,
    width: 600,
    height: 800,
    items: [
      item("가온고등학교 3학년 2반 7번 담임 박바다", 60, 60),
      item("성명", 60, 120),
      item("김하늘", 200, 120),
      item("주소", 60, 134),
      item("가람시 나루로 12", 200, 134),
      item("자율활동", 60, 300),
      item("학급 회의에서 김하늘 학생이 가온고등학교 축제 예산안을 정리하여 발표함.", 150, 300, 6),
      item("가온고등학교 발급 1 / 2", 200, 785),
    ],
  },
  {
    page: 2,
    width: 600,
    height: 800,
    items: [item("행동특성", 60, 100), item("맡은 일을 끝까지 해내며 친구들의 의견을 고르게 듣는 학생임.", 150, 100, 6), item("가온고등학교 발급 2 / 2", 200, 785)],
  },
  { page: 3, width: 600, height: 800, items: [] },
];
const madeOriginals = [
  section("s1", "인적·학적사항", 1, "성명: 김하늘\n주소: 가람시 나루로 12", { fieldId: "S01" }),
  section("s2", "자율활동", 1, "학급 회의에서 김하늘 학생이 가온고등학교 축제 예산안을 정리하여 발표함.", { grade: 1 }),
  section("s3", "행동특성 및 종합의견", 2, "맡은 일을 끝까지 해내며 친구들의 의견을 고르게 듣는 학생임.", { grade: 1 }),
];
const madeBlind = blind(madeOriginals.map((item) => ({ ...item })));
const madeStream = buildRecordStream(madePages);
const madeEvidences = [
  { id: "e1", criterionId: "c1", sectionId: "s2", quote: "축제 예산안을 정리하여 발표함", reason: "" },
  { id: "e2", criterionId: "c1", sectionId: "s3", quote: "친구들의 의견을 고르게 듣는", reason: "" },
  { id: "e3", criterionId: "c1", sectionId: "s9", quote: "없는 항목", reason: "" },
];
const made = locateRecord({ stream: madeStream, pageCount: 3, originals: madeOriginals, blinded: madeBlind.sections, evidences: madeEvidences });

/** 글자 줄에서 그 글이 나오는 모든 곳의 글자가 덮는 네모 안에 있는지 */
function allCovered(stream: RecordStream, covers: readonly PageRect[], text: string): boolean {
  const folded = foldText(text).folded;
  let at = stream.text.indexOf(folded);
  let found = 0;
  while (at >= 0) {
    found += 1;
    for (let offset = 0; offset < folded.length; offset += 1) {
      const index = at + offset;
      const centerX = stream.x[index] + stream.w[index] / 2;
      const centerY = stream.y[index] + stream.h[index] / 2;
      const inside = covers.some(
        (rect) =>
          rect[0] === stream.page[index] &&
          centerX >= rect[1] &&
          centerX <= rect[1] + rect[3] &&
          centerY >= rect[2] &&
          centerY <= rect[2] + rect[4],
      );
      if (!inside) return false;
    }
    at = stream.text.indexOf(folded, at + 1);
  }
  return found > 0;
}

check("지어낸 학생부: 블라인드가 이름과 학교명을 가렸다", madeBlind.sections[1].text.includes("[이름]") && madeBlind.sections[1].text.includes("[학교명]"));
check("지어낸 학생부: 모든 항목의 자리를 찾는다", same(Object.keys(made.sections).sort(), ["s1", "s2", "s3"]));
check("지어낸 학생부: 이름이 나오는 모든 곳을 덮는다", allCovered(madeStream, made.covers, "김하늘"));
check("지어낸 학생부: 학교명이 나오는 모든 곳을 덮는다(머리말·꼬리말 포함)", allCovered(madeStream, made.covers, "가온고등학교"));
check("지어낸 학생부: 인적·학적사항의 값을 덮는다", allCovered(madeStream, made.covers, "가람시 나루로 12"));
check("지어낸 학생부: 쪽의 맨 위(머리 부분)부터 인적·학적사항까지 통째로 덮는다", made.covers.some((rect) => rect[0] === 1 && rect[1] === 0 && rect[2] === 0 && rect[3] === 1 && rect[4] > 0.15));
check("지어낸 학생부: 가리지 않은 본문은 덮지 않는다", !allCovered(madeStream, made.covers, "축제 예산안을 정리하여 발표함"));
check("지어낸 학생부: 글자가 없는 쪽만 그림을 만들지 않는다", same(made.unverified, [3]));
check("지어낸 학생부: 근거의 자리를 찾는다(없는 항목의 근거는 뺀다)", same(Object.keys(made.evidences).sort(), ["e1", "e2"]));
check("지어낸 학생부: 근거의 자리는 그 항목의 쪽이다", made.evidences.e1?.every((rect) => rect[0] === 1) === true && made.evidences.e2?.every((rect) => rect[0] === 2) === true);
check("지어낸 학생부: 근거의 자리는 항목의 자리 안이다", (made.evidences.e1?.[0]?.[3] ?? 1) < (made.sections.s2?.[0]?.[3] ?? 0));

// 가린 구간의 글이 PDF 의 글자에 없으면(AI 가 그림에서 다르게 읽음 등) 그 쪽은 그림을 만들지 않는다.
const misread = madeOriginals.map((item) => (item.id === "s2" ? { ...item, text: item.text.replace("김하늘", "김하눌") } : item));
const misreadBlind = misread.map((item) => (item.id === "s2" ? { ...item, text: item.text.replace("김하눌", "[이름]").replace("가온고등학교", "[학교명]") } : item));
const misreadLocation = locateRecord({ stream: madeStream, pageCount: 3, originals: misread, blinded: misreadBlind, evidences: [] });
check("확인 못 한 쪽: 가린 글을 PDF 에서 찾지 못하면 그 쪽은 그림을 만들지 않는다", misreadLocation.unverified.includes(1) && !misreadLocation.unverified.includes(2));
// 인적·학적사항의 자리를 찾지 못하면 첫 다른 항목 위까지 덮는다.
const lostIdentity = madeOriginals.map((item) => (item.id === "s1" ? { ...item, text: "성명: 전혀다른이름\n주소: 어디에도없는주소입니다" } : item));
const lostLocation = locateRecord({ stream: madeStream, pageCount: 3, originals: lostIdentity, blinded: blind(lostIdentity.map((item) => ({ ...item }))).sections, evidences: [] });
check("확인 못 한 쪽: 인적·학적사항의 자리를 못 찾으면 첫 다른 항목 위까지 덮는다", lostLocation.covers.some((rect) => rect[0] === 1 && rect[2] === 0 && rect[3] === 1 && rect[4] > 0.3));
// 쪽마다 되풀이되는 줄은 위아래 띠 밖에 있어도 덮는다(높이가 다른 마지막 쪽의 것도). 한 쪽에만 있는 줄은 덮지 않는다.
const runningPages: PageItems[] = [1, 2, 3, 4].map((pageNumber) => ({
  page: pageNumber,
  width: 600,
  height: 800,
  items: [
    item(`본문 ${pageNumber}쪽의 기록을 적은 문장으로 서로 다른 내용임 ${"가나다라".repeat(pageNumber)}`, 60, 300, 6),
    item(`증명서 발급 확인 ${pageNumber} / 4`, 200, pageNumber === 4 ? 500 : 660),
    ...(pageNumber === 2 ? [item("이 쪽에만 있는 안내 줄", 60, 400)] : []),
  ],
}));
const runningStream = buildRecordStream(runningPages);
const runningOriginals = runningPages.map((page, index) => section(`s${index + 1}`, "자율활동", page.page, page.items[0].str, { grade: 1 }));
const runningLocation = locateRecord({ stream: runningStream, pageCount: 4, originals: runningOriginals, blinded: runningOriginals, evidences: [] });
check("되풀이되는 줄: 쪽 절반 이상에서 같은 높이에 나오는 줄을 모두 덮는다(높이가 다른 쪽 포함)", allCovered(runningStream, runningLocation.covers, "증명서 발급 확인"));
check("되풀이되는 줄: 한 쪽에만 있는 줄은 덮지 않는다", !allCovered(runningStream, runningLocation.covers, "이 쪽에만 있는 안내 줄"));
check("되풀이되는 줄: 본문은 덮지 않는다", !allCovered(runningStream, runningLocation.covers, "본문 1쪽의 기록을 적은 문장"));

check("짝이 맞지 않으면 모든 쪽을 그림 없이 둔다", same(locateRecord({ stream: madeStream, pageCount: 3, originals: madeOriginals, blinded: [], evidences: [] }).unverified, [1, 2, 3]));

// ── 가상 학생부 PDF 전체 ──
const pdf = await getDocumentProxy(new Uint8Array(await readFile(SAMPLE_PDF)));
const report = await parsePdfDocument(pdf);
const pages: PageItems[] = [];
for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) pages.push(await readPageItems(pdf, pageNumber));
const stream = buildRecordStream(pages);
const { sections: blinded } = blind(report.sections.map((item) => ({ ...item })));
const sample = JSON.parse(await readFile(SAMPLE_RESULT, "utf8")) as AnalysisResult;
const sampleMatches = sample.sections.length === blinded.length && sample.sections.every((item, index) => item.text === blinded[index].text);
const location = locateRecord({
  stream,
  pageCount: pdf.numPages,
  originals: report.sections,
  blinded,
  evidences: sampleMatches ? sample.evidences : [],
});
check("가상 학생부: 모든 쪽에 글자가 있다", pages.every((page) => page.items.length > 0));
check("가상 학생부: 모든 항목의 자리를 찾는다", report.sections.every((item) => (location.sections[item.id]?.length ?? 0) > 0));
check("가상 학생부: 항목의 자리는 그 항목의 쪽에서 시작한다", report.sections.every((item) => location.sections[item.id]?.[0]?.[0] === item.page));
check("가상 학생부: 그림을 만들지 않는 쪽이 없다", location.unverified.length === 0);
check("가상 학생부: 이름이 나오는 모든 곳을 덮는다", allCovered(stream, location.covers, "김민준"));
check("가상 학생부: 학교명이 나오는 모든 곳을 덮는다", allCovered(stream, location.covers, "가상고등학교"));
check("가상 학생부: 꼬리말을 덮는다", allCovered(stream, location.covers, "가상 합성 학생부 · AI 평가 테스트용 · 실제 발급 문서 아님"));
check("가상 학생부: 샘플 결과의 원문이 파서 → 블라인드 결과와 같다", sampleMatches);
check("가상 학생부: 샘플 결과의 모든 근거의 자리를 찾는다", sample.evidences.length > 0 && sample.evidences.every((item) => (location.evidences[item.id]?.length ?? 0) > 0));
await pdf.loadingTask.destroy();

// ── 별지 제8호 서식을 본뜬 가상 학생부 PDF ──
// 항목은 AI 가 쪽을 읽었을 때의 모양으로 적는다(칸 이름: 값, 표의 머리글은 한 줄로 풀어 적음). 이름·학교는 모두 지어낸 것이다.
const formPdf = await getDocumentProxy(new Uint8Array(await readFile(FORM_PDF)));
const formPages: PageItems[] = [];
for (let pageNumber = 1; pageNumber <= formPdf.numPages; pageNumber += 1) formPages.push(await readPageItems(formPdf, pageNumber));
const formStream = buildRecordStream(formPages);
const formOriginals: Section[] = [
  section(
    "s1",
    "인적·학적사항",
    1,
    [
      "학교: 새봄고등학교",
      "1학년: 학과 보통과 / 반 5 / 번호 17 / 담임성명 오정민",
      "2학년: 학과 보통과 / 반 2 / 번호 9 / 담임성명 문가은",
      "3학년: 학과 보통과 / 반 3 / 번호 12 / 담임성명 배도현",
      "1학년 1학기 전공·과정: 공통 과정",
    ].join("\n"),
    { fieldId: "S00.HEADER" },
  ),
  section(
    "s2",
    "인적·학적사항",
    1,
    [
      "성명: 한서윤",
      "성별: 여",
      "주민등록번호: 080514-4123456",
      "주소: 다온시 물빛구 은행나무로 27, 104동 902호(물빛동, 한빛아파트)",
      "학적사항: 2024년 02월 08일 물빛중학교 제3학년 졸업",
      "학적사항: 2024년 03월 04일 새봄고등학교 제1학년 입학",
    ].join("\n"),
    { fieldId: "S01" },
  ),
  section(
    "s3",
    "출결상황",
    1,
    [
      "학년 | 수업일수 | 결석 질병 | 결석 미인정 | 결석 기타 | 지각 질병 | 지각 미인정 | 지각 기타 | 조퇴 질병 | 조퇴 미인정 | 조퇴 기타 | 결과 질병 | 결과 미인정 | 결과 기타 | 특기사항",
      "1 | 190 | 1 | . | . | . | . | . | 1 | . | . | . | . | . | 질병결석 1일(감기)",
      "2 | 191 | . | . | . | . | . | . | . | . | . | . | . | . | 개근",
      "3 | 98 | . | . | . | . | . | . | . | . | . | . | . | . |",
    ].join("\n"),
    { fieldId: "S02.ATTENDANCE" },
  ),
  section(
    "s4",
    "수상경력",
    1,
    [
      "학년(학기) | 수상명 | 등급(위) | 수상연월일 | 수여기관 | 참가대상(참가인원)",
      "1(2) | 교내 경제 탐구 보고서 대회 | 우수상(2위) | 2024.11.21. | 새봄고등학교장 | 1학년(214명)",
      "2(1) | 독서 토론 한마당 | 최우수상(1위) | 2025.06.12. | 새봄고등학교장 | 전교생(48명)",
    ].join("\n"),
    { fieldId: "S03.AWARD" },
  ),
  section(
    "s5",
    "자율활동",
    2,
    "학급 자치 회의(2024.04.)에서 급식 잔반을 줄이는 방법을 안건으로 올리고, 일주일 동안 반별 잔반량을 직접 재어 표로 정리함. 잔반이 많은 요일의 식단을 비교하여 '선택 반찬 사전 조사'를 제안하였고, 한서윤 학생이 만든 설문지가 2학기 급식 모니터링에 그대로 쓰임. 새봄고등학교 축제 '봄빛제' 준비 위원으로 부스 배치도를 그리고 동선이 겹치는 구간을 찾아 수정함.",
    { grade: 1, fieldId: "S06.AUTO.remarks", hours: 62 },
  ),
];
const formBlind = blind(formOriginals.map((item) => ({ ...item })));
const formLocation = locateRecord({
  stream: formStream,
  pageCount: formPdf.numPages,
  originals: formOriginals,
  blinded: formBlind.sections,
  evidences: [{ id: "e1", criterionId: "c1", sectionId: "s5", quote: "일주일 동안 반별 잔반량을 직접 재어 표로 정리함", reason: "" }],
});
/** 그 쪽에서 글(접은 글)이 처음 나오는 자리의 위쪽 높이 */
const topOf = (text: string, pageNumber: number): number => {
  const range = formStream.ranges.get(pageNumber) ?? [0, 0];
  const at = formStream.text.slice(range[0], range[1]).indexOf(foldText(text).folded);
  return at < 0 ? Number.NaN : formStream.y[range[0] + at];
};
const identityCover = formLocation.covers.find((rect) => rect[0] === 1 && rect[1] === 0 && rect[2] === 0 && rect[3] === 1);
const identityBottom = identityCover === undefined ? Number.NaN : identityCover[4];
check("서식 학생부: 다섯 쪽 모두 글자가 있다", formPdf.numPages === 5 && formPages.every((page) => page.items.length > 0));
check("서식 학생부: 그림을 만들지 않는 쪽이 없다", formLocation.unverified.length === 0);
check("서식 학생부: 인적·학적사항은 쪽의 맨 위부터 다음 제목(2. 출결상황) 바로 위까지 덮는다", identityBottom > topOf("새봄고등학교 제1학년 입학", 1) && identityBottom < topOf("2. 출결상황", 1));
check("서식 학생부: 주민등록번호와 주소를 덮는다", allCovered(formStream, formLocation.covers, "080514-4123456") && allCovered(formStream, formLocation.covers, "은행나무로 27"));
check("서식 학생부: 담임성명을 덮는다", allCovered(formStream, formLocation.covers, "오정민") && allCovered(formStream, formLocation.covers, "배도현"));
check("서식 학생부: 머리글을 풀어 적은 표(출결상황)의 자리를 찾는다", (formLocation.sections.s3?.length ?? 0) > 0 && formLocation.sections.s3?.every((rect) => rect[0] === 1) === true);
check("서식 학생부: 출결상황은 덮지 않는다", !allCovered(formStream, formLocation.covers, "질병결석 1일(감기)"));
check("서식 학생부: 이름이 나오는 모든 곳을 덮는다(쪽마다의 머리말 포함)", allCovered(formStream, formLocation.covers, "한서윤"));
check("서식 학생부: 학교명이 나오는 모든 곳을 덮는다(수여기관, 꼬리말, 끝의 학교장 포함)", allCovered(formStream, formLocation.covers, "새봄고등학교"));
check("서식 학생부: 꼬리말의 발급번호를 덮는다", allCovered(formStream, formLocation.covers, "2026-03-00412"));
check("서식 학생부: 가리지 않은 본문은 덮지 않는다", !allCovered(formStream, formLocation.covers, "일주일 동안 반별 잔반량을 직접 재어 표로 정리함"));
check("서식 학생부: 근거의 자리는 2쪽이다", formLocation.evidences.e1?.every((rect) => rect[0] === 2) === true);
const photoRects = await smallImageRects(formPdf, 1);
const sealRects = await smallImageRects(formPdf, 5);
check("서식 학생부: 증명사진의 자리를 찾는다(1쪽 위쪽)", photoRects.length === 1 && photoRects[0][2] < 0.3 && photoRects[0][3] > 0.1);
check("서식 학생부: 직인의 자리를 찾는다(5쪽)", sealRects.length === 1 && sealRects[0][3] > 0.05);
check("서식 학생부: 그림이 없는 쪽은 그림 자리가 없다", (await smallImageRects(formPdf, 2)).length === 0);
await formPdf.loadingTask.destroy();

if (failures.length > 0) {
  console.error(`원문 자리 검사 실패: ${failures.length}건 (전체 ${checks}건)`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`원문 자리 검사 통과: ${checks}건`);
}
