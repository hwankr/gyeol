// 모집요강 초안의 쪽 고르기·받은 값 정리 검사. 실행(저장소 루트에서): npx tsx scripts/check-guideline.ts
// AI 를 부르지 않는다. 지어낸 입력으로 lib/prep/guidelinePages.ts(쪽 고르기)와 lib/prep/guidelineDraft.ts(정리),
// lib/prep/criteria.ts(저장 값 확인의 guideline 필드)를 확인하고, 가상 모집요강(samples/virtual-admission-guide.pdf)을
// 쪽별 글 읽기(lib/pipeline/guidelineText.ts)로 읽어 본다. 인자는 받지 않는다.
// 출력: 사례마다 "통과"/"실패" 한 줄, 마지막에 개수. 하나라도 실패하면 종료 코드 1.
// node scripts/check-guideline.ts 로도 돌도록(Node 의 타입 제거 실행) 값 import 는 상대 경로에 .ts 확장자를 붙인다.
import { readFile } from "node:fs/promises";
import { parsePrepCriteria, type PrepCriteria } from "../lib/prep/criteria.ts";
import {
  EQUAL_WEIGHT_WARNING,
  equalWeights,
  guidelineSaveSummary,
  normalizeGuidelineChanges,
  normalizeGuidelineDraft,
  pagesSelectedWarning,
} from "../lib/prep/guidelineDraft.ts";
import { MAX_GUIDELINE_TEXT_LENGTH, scoreGuidelinePage, selectGuidelineText } from "../lib/prep/guidelinePages.ts";
import { readGuidelinePages } from "../lib/pipeline/guidelineText.ts";

const SAMPLE_PDF = "samples/virtual-admission-guide.pdf";
const DEPARTMENT = "경영학과";

let passed = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    passed += 1;
    console.log(`통과: ${name}`);
  } else {
    failures.push(name);
    console.error(`실패: ${name}${detail === "" ? "" : ` (${detail})`}`);
  }
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** 낱말이 없는 지어낸 쪽 글 (길이 length, 글자 ch 를 반복하고 줄을 바꾼다) */
function filler(length: number, ch = "가"): string {
  let text = "";
  while (text.length < length) text += `${ch.repeat(39)}\n`;
  return text.slice(0, length).trim() + ch.repeat(length - text.slice(0, length).trim().length);
}

/** 보낸 글에 들어간 쪽 번호 (머리 줄 "[N쪽]" 으로 찾는다) */
function pagesIn(text: string): number[] {
  return [...text.matchAll(/^\[(\d+)쪽\]$/gm)].map((match) => Number(match[1]));
}

// ---------------------------------------------------------------- 쪽 고르기

function checkPageSelection() {
  // 짧은 문서: 전체를 쪽 순서대로
  {
    const pages = ["첫 쪽 글", "둘째 쪽 배점 30", "셋째 쪽 글"];
    const result = selectGuidelineText(pages, DEPARTMENT);
    check(
      "쪽 고르기: 짧은 문서는 전체를 쪽 순서대로 쓴다",
      result.text === "[1쪽]\n첫 쪽 글\n\n[2쪽]\n둘째 쪽 배점 30\n\n[3쪽]\n셋째 쪽 글" &&
        result.pagesRead === 3 &&
        result.pagesTotal === 3,
      JSON.stringify(result),
    );
  }

  // 정확히 한도 / 한도 + 1
  {
    const block = (n: number, body: string) => `[${n}쪽]\n${body}`;
    // 두 쪽: "[1쪽]\n" (5) + a + "\n\n" (2) + "[2쪽]\n" (5) + b
    const a = filler(12_000);
    const bExact = filler(MAX_GUIDELINE_TEXT_LENGTH - (block(1, a).length + 2 + "[2쪽]\n".length), "나");
    const exact = selectGuidelineText([a, bExact], DEPARTMENT);
    check(
      "쪽 고르기: 이어 붙인 전체가 정확히 24,000자면 전체를 쓴다",
      exact.text.length === MAX_GUIDELINE_TEXT_LENGTH && exact.pagesRead === 2,
      `${exact.text.length}자, 읽은 쪽 ${exact.pagesRead}`,
    );
    const over = selectGuidelineText([a, `${bExact}나`], DEPARTMENT);
    check(
      "쪽 고르기: 24,001자면 골라 담는다(한 쪽은 빠진다)",
      over.text.length <= MAX_GUIDELINE_TEXT_LENGTH && over.pagesRead === 1 && same(pagesIn(over.text), [1]),
      `${over.text.length}자, 쪽 ${pagesIn(over.text).join(",")}`,
    );
  }

  // 긴 문서(지어낸 40쪽): 낱말이 든 쪽이 먼저 담기고 쪽 순서로 되돌려진다
  {
    const pages = Array.from({ length: 40 }, (_, index) => filler(1_500 + (index % 3) * 100));
    pages[34] = `5. 학생부종합 서류평가\n평가요소 반영비율 평가항목 배점\n${filler(1_400)}`; // 35쪽: 점수 5
    pages[6] = `1. 전년 대비 주요 변경사항\n${filler(1_400)}`; // 7쪽: 점수 1
    pages[22] = `평가 기준: 평가기준 평가 내용 평가내용\n${filler(1_400)}`; // 23쪽: 점수 2 (공백이 있는 "평가 기준"도 공백을 빼고 센다 → 3)
    const result = selectGuidelineText(pages, DEPARTMENT);
    const included = pagesIn(result.text);
    const sorted = [...included].sort((x, y) => x - y);
    check(
      "쪽 고르기(40쪽): 24,000자를 넘지 않는다",
      result.text.length <= MAX_GUIDELINE_TEXT_LENGTH,
      `${result.text.length}자`,
    );
    check(
      "쪽 고르기(40쪽): 낱말이 든 쪽(7·23·35쪽)이 담긴다",
      [7, 23, 35].every((page) => included.includes(page)),
      `담은 쪽 ${included.join(",")}`,
    );
    check("쪽 고르기(40쪽): 담은 쪽은 쪽 순서로 되돌려진다", same(included, sorted), included.join(","));
    check(
      "쪽 고르기(40쪽): 낱말이 없는 쪽은 앞쪽부터 담는다",
      included.filter((page) => ![7, 23, 35].includes(page))[0] === 1,
      included.join(","),
    );
    check(
      "쪽 고르기(40쪽): 읽은 쪽 수·전체 쪽 수",
      result.pagesRead === included.length && result.pagesTotal === 40 && result.pagesRead < 40,
      `${result.pagesRead}/${result.pagesTotal}`,
    );
  }

  // 통째로 들어가지 않는 쪽은 건너뛰고 다음 쪽을 본다
  {
    const pages = [
      `배점 배점 배점\n${filler(15_000)}`, // 1쪽: 점수 3, 15,0xx자
      `배점 배점\n${filler(12_000)}`, // 2쪽: 점수 2, 들어가지 않는다
      `배점\n${filler(5_000)}`, // 3쪽: 점수 1, 들어간다
    ];
    const result = selectGuidelineText(pages, DEPARTMENT);
    check(
      "쪽 고르기: 통째로 들어가지 않는 쪽(2쪽)은 건너뛰고 다음 쪽(3쪽)을 담는다",
      same(pagesIn(result.text), [1, 3]) && result.text.length <= MAX_GUIDELINE_TEXT_LENGTH && result.pagesRead === 2,
      `쪽 ${pagesIn(result.text).join(",")}, ${result.text.length}자`,
    );
  }

  // 점수 순서로 처음 보는 쪽 하나가 한도를 넘는다
  {
    const big = `평가요소 배점\n${filler(30_000)}`;
    const result = selectGuidelineText([filler(1_000), big, filler(1_000)], DEPARTMENT);
    check(
      "쪽 고르기: 점수가 가장 높은 쪽 하나가 한도를 넘으면 그 쪽의 앞 24,000자만 쓴다",
      result.text.length === MAX_GUIDELINE_TEXT_LENGTH &&
        result.text.startsWith("[2쪽]\n평가요소 배점\n") &&
        result.text === `[2쪽]\n${big}`.slice(0, MAX_GUIDELINE_TEXT_LENGTH) &&
        result.pagesRead === 1 &&
        result.pagesTotal === 3,
      `${result.text.length}자, 읽은 쪽 ${result.pagesRead}`,
    );
    const firstPageBig = selectGuidelineText([filler(30_000), filler(1_000)], DEPARTMENT);
    check(
      "쪽 고르기: 낱말이 없는 문서에서 첫 쪽이 한도를 넘으면 첫 쪽의 앞 24,000자만 쓴다",
      firstPageBig.text.length === MAX_GUIDELINE_TEXT_LENGTH &&
        firstPageBig.text.startsWith("[1쪽]\n") &&
        firstPageBig.pagesRead === 1,
      `${firstPageBig.text.length}자`,
    );
  }

  // 낱말이 하나도 없는 문서: 앞쪽부터
  {
    const pages = Array.from({ length: 10 }, () => filler(5_000));
    const result = selectGuidelineText(pages, DEPARTMENT);
    check(
      "쪽 고르기: 낱말이 없는 문서는 앞쪽부터 담는다",
      same(pagesIn(result.text), [1, 2, 3, 4]) && result.pagesRead === 4 && result.pagesTotal === 10,
      `쪽 ${pagesIn(result.text).join(",")}`,
    );
  }

  // 모집 단위 이름이 점수에 들어간다 (공백을 뺀 값으로 센다)
  {
    check(
      "쪽 점수: 모집 단위 이름(공백을 빼고)과 낱말을 센다",
      scoreGuidelinePage("경영 학과 모집\n배점과 배점", "경영학과") === 3 &&
        scoreGuidelinePage("경영학과", "경영 학과") === 1 &&
        scoreGuidelinePage("배점배점", DEPARTMENT) === 2,
    );
    const pages = Array.from({ length: 10 }, () => filler(5_000));
    pages[8] = `경영 학과\n${filler(5_000)}`;
    const result = selectGuidelineText(pages, DEPARTMENT);
    check(
      "쪽 고르기: 모집 단위 이름이 든 쪽(9쪽)이 먼저 담긴다",
      pagesIn(result.text).includes(9) && same(pagesIn(result.text), [1, 2, 3, 9]),
      `쪽 ${pagesIn(result.text).join(",")}`,
    );
  }

  // 빈 쪽이 섞인 문서
  {
    const short = selectGuidelineText(["첫 쪽", "", "  \n ", "넷째 쪽"], DEPARTMENT);
    check(
      "쪽 고르기: 빈 쪽은 보낸 글에 넣지 않고 읽은 쪽으로 센다(짧은 문서)",
      short.text === "[1쪽]\n첫 쪽\n\n[4쪽]\n넷째 쪽" && short.pagesRead === 4 && short.pagesTotal === 4,
      JSON.stringify(short),
    );
    const pages = [filler(10_000), "", filler(10_000), "", filler(10_000)];
    const long = selectGuidelineText(pages, DEPARTMENT);
    check(
      "쪽 고르기: 빈 쪽이 섞인 긴 문서도 빈 쪽은 읽은 쪽으로 센다",
      same(pagesIn(long.text), [1, 3]) && long.pagesRead === 4 && long.pagesTotal === 5,
      `쪽 ${pagesIn(long.text).join(",")}, 읽은 쪽 ${long.pagesRead}`,
    );
  }
}

// ---------------------------------------------------------------- 정리

const NO_PAGES = { department: DEPARTMENT, pagesRead: 3, pagesTotal: 3 };

function group(tag: string, name: string, questions: unknown[]) {
  return { tag, name, questions };
}

function checkNormalize() {
  // 원고와 같은 정상 값
  {
    const raw = {
      elements: [
        { name: "학업역량", weight: 30, groups: [group("학업성취도", "학업성취도", ["…를 보이는가?"])] },
        { name: "진로역량", weight: 40, groups: [group("교과이수노력", "전공 관련 교과 이수 노력", ["…했는가?"])] },
        { name: "공동체역량", weight: 30, groups: [group("협업소통", "협업과 소통능력", ["…하는가?"])] },
      ],
      changes: [{ title: "모집단위 신설", body: "인공지능융합학과 신설" }],
      warnings: [],
    };
    const result = normalizeGuidelineDraft(raw, NO_PAGES);
    check(
      "정리: 모든 배점이 정수이고 합이 100 이면 그대로 쓴다, id 는 e1…",
      same(result.criteria?.elements.map((e) => [e.id, e.weight]), [
        ["e1", 30],
        ["e2", 40],
        ["e3", 30],
      ]) && result.warnings.length === 0,
      JSON.stringify(result.warnings),
    );
    check("정리: 결과가 parsePrepCriteria 를 통과한다", result.criteria !== null && same(parsePrepCriteria(result.criteria), result.criteria));
    check("정리: 평가 기준의 version 과 모집 단위", result.criteria?.version === 1 && result.criteria.department === DEPARTMENT);
  }

  // 한도를 넘는 값 자르기·버리기
  {
    const longName = "가".repeat(35);
    const raw = {
      elements: [
        { name: 7, weight: 10, groups: [group("a", "a", ["q"])] }, // 이름이 문자열 아님 → 버림
        { name: "   ", weight: 10, groups: [group("a", "a", ["q"])] }, // 빈 이름 → 버림
        { name: "묶음없음", weight: 10, groups: [] }, // 묶음 0개 → 버림
        {
          name: `  ${longName}  `,
          weight: 10,
          groups: [
            group("", "태그없음", ["q"]), // 태그 빔 → 버림
            group("t", "  ", ["q"]), // 이름 빔 → 버림
            group("t", "질문없음", ["", "   ", 3]), // 질문 0개 → 버림
            group(" 교과 성취 도와 학업 발전 정도 확인 ", "나".repeat(25), [
              ...Array.from({ length: 10 }, (_, i) => `${i}${"다".repeat(250)}`),
            ]),
            ...Array.from({ length: 7 }, (_, i) => group(`t${i}`, `묶음${i}`, ["q"])),
          ],
        },
        ...Array.from({ length: 8 }, (_, i) => ({ name: `요소${i}`, weight: 10, groups: [group("t", "n", ["q"])] })),
      ],
      changes: [],
      warnings: [],
    };
    const result = normalizeGuidelineDraft(raw, NO_PAGES);
    const elements = result.criteria?.elements ?? [];
    const first = elements[0];
    check("정리: 이름이 문자열이 아니거나 빈 요소, 묶음이 0개인 요소는 버리고 요소는 6개까지", elements.length === 6 && first?.name === longName.slice(0, 30));
    check("정리: 요소 이름은 앞뒤 공백을 빼고 30자로 자른다", first?.name.length === 30);
    check(
      "정리: 태그·이름이 비거나 질문이 0개인 묶음은 버리고 묶음은 6개까지",
      first?.groups.length === 6 && first.groups[0].name === "나".repeat(20),
      `${first?.groups.length}개`,
    );
    check("정리: 태그는 공백을 빼고 12자로 자른다", first?.groups[0].tag === "교과성취도와학업발전정도", first?.groups[0].tag);
    check(
      "정리: 질문은 200자로 자르고 8개까지",
      first?.groups[0].questions.length === 8 && first.groups[0].questions.every((q) => q.length === 200),
    );
    check("정리: 한도를 채운 결과도 parsePrepCriteria 를 통과한다", result.criteria !== null && parsePrepCriteria(result.criteria) !== null);
    check(
      "정리: id 는 남은 요소 순서대로 e1…e6",
      same(
        elements.map((e) => e.id),
        ["e1", "e2", "e3", "e4", "e5", "e6"],
      ),
    );
  }

  // 배점 규칙
  {
    const three = (weights: unknown[]) => ({
      elements: weights.map((weight, i) => ({ name: `요소${i}`, weight, groups: [group("t", "n", ["q"])] })),
      changes: [],
      warnings: [],
    });
    const cases: [string, unknown[]][] = [
      ["하나가 null", [30, null, 30]],
      ["합이 99", [30, 39, 30]],
      ["소수(합은 100)", [33.5, 33.5, 33]],
      ["음수(합은 100)", [-10, 60, 50]],
      ["100 초과", [101, 0, -1]],
      ["문자열", ["30", 40, 30]],
      ["소수(모집요강의 29.5%·40.5%·30%, 합은 100)", [29.5, 40.5, 30]],
      ["모두 문자열 숫자", ["30", "40", "30"]],
      ["모두 null", [null, null, null]],
      ["null 과 소수가 섞임", [null, 40.5, 30]],
    ];
    for (const [label, weights] of cases) {
      const result = normalizeGuidelineDraft(three(weights), NO_PAGES);
      check(
        `정리(배점): ${label} → 34·33·33 으로 나누고 배점 경고`,
        same(result.criteria?.elements.map((e) => e.weight), [34, 33, 33]) && same(result.warnings, [EQUAL_WEIGHT_WARNING]),
        JSON.stringify([result.criteria?.elements.map((e) => e.weight), result.warnings]),
      );
    }
    const keptPlain = normalizeGuidelineDraft(three([30, 40, 30]), NO_PAGES);
    check("정리(배점): 30·40·30 → 그대로, 경고 없음", same(keptPlain.criteria?.elements.map((e) => e.weight), [30, 40, 30]) && keptPlain.warnings.length === 0);
    const keptFloatForm = normalizeGuidelineDraft(three([30.0, 40.0, 30.0]), NO_PAGES);
    check("정리(배점): 30.0·40.0·30.0(소수점 아래가 0 인 숫자)은 정수로 보고 그대로", same(keptFloatForm.criteria?.elements.map((e) => e.weight), [30, 40, 30]) && keptFloatForm.warnings.length === 0);
    const kept = normalizeGuidelineDraft(three([0, 100, 0]), NO_PAGES);
    check("정리(배점): 0·100·0 (모두 정수이고 합 100) → 그대로", same(kept.criteria?.elements.map((e) => e.weight), [0, 100, 0]) && kept.warnings.length === 0);
    check("정리(배점): 요소 6개는 17·17·17·17·16·16", same(equalWeights(6), [17, 17, 17, 17, 16, 16]));
    check("정리(배점): 요소 3개는 34·33·33, 4개는 25·25·25·25, 1개는 100", same(equalWeights(3), [34, 33, 33]) && same(equalWeights(4), [25, 25, 25, 25]) && same(equalWeights(1), [100]));
    // 요소가 버려져 합이 100 이 아니게 되면 나눈다
    const dropped = normalizeGuidelineDraft(
      {
        elements: [
          { name: "가", weight: 50, groups: [group("t", "n", ["q"])] },
          { name: "나", weight: 50, groups: [] },
        ],
        changes: [],
        warnings: [],
      },
      NO_PAGES,
    );
    check("정리(배점): 요소가 버려져 남은 배점 합이 100 이 아니면 나눈다", same(dropped.criteria?.elements.map((e) => e.weight), [100]) && same(dropped.warnings, [EQUAL_WEIGHT_WARNING]));
  }

  // 요소 0개
  {
    const result = normalizeGuidelineDraft({ elements: [], changes: [{ title: "제목", body: "내용" }], warnings: ["경고"] }, NO_PAGES);
    check("정리: 요소가 0개면 criteria 는 null 이고 배점 경고는 붙지 않는다", result.criteria === null && same(result.warnings, ["경고"]) && result.changes.length === 1);
    const broken = normalizeGuidelineDraft("깨진 값", NO_PAGES);
    check("정리: 객체가 아닌 값도 예외 없이 빈 결과", broken.criteria === null && broken.changes.length === 0 && broken.warnings.length === 0);
  }

  // 변경 사항
  {
    const changes = normalizeGuidelineChanges([
      { title: 1, body: "내용" },
      { title: "제목", body: "  " },
      "문자열",
      { title: `  ${"제".repeat(45)}  `, body: "내".repeat(320) },
      ...Array.from({ length: 8 }, (_, i) => ({ title: `제목${i}`, body: `내용${i}` })),
    ]);
    check("정리(변경 사항): 문자열이 아니거나 빈 것은 버리고 6건까지", changes.length === 6);
    check("정리(변경 사항): 제목 40자·내용 300자로 자른다", changes[0].title.length === 40 && changes[0].body.length === 300);
    check("정리(변경 사항): 배열이 아니면 빈 배열", normalizeGuidelineChanges({}).length === 0);
  }

  // 경고
  {
    const element = { name: "가", weight: 100, groups: [group("t", "n", ["q"])] };
    const result = normalizeGuidelineDraft(
      { elements: [element], changes: [], warnings: [3, "  ", ` ${"경".repeat(320)} `, "둘째"] },
      NO_PAGES,
    );
    check("정리(경고): 문자열만 남기고 빈 것은 버리고 300자로 자른다", same(result.warnings.map((w) => w.length), [300, 2]));

    const selected = normalizeGuidelineDraft({ elements: [element], changes: [], warnings: ["AI 경고"] }, { department: DEPARTMENT, pagesRead: 12, pagesTotal: 40 });
    check(
      "정리(경고): 쪽을 골라 읽었으면 쪽 경고를 맨 앞에 더한다",
      same(selected.warnings, [pagesSelectedWarning(12, 40), "AI 경고"]) &&
        selected.warnings[0] === "모집요강이 길어 평가와 관련된 쪽 위주로 12쪽(전체 40쪽)만 읽었습니다.",
      JSON.stringify(selected.warnings),
    );
    const full = normalizeGuidelineDraft(
      {
        elements: [{ ...element, weight: null }],
        changes: [],
        warnings: Array.from({ length: 12 }, (_, i) => `AI 경고 ${i}`),
      },
      { department: DEPARTMENT, pagesRead: 3, pagesTotal: 5 },
    );
    check(
      "정리(경고): 모두 10건까지이고 쪽 경고(맨 앞)·배점 경고(맨 끝)는 빠지지 않는다",
      full.warnings.length === 10 &&
        full.warnings[0] === pagesSelectedWarning(3, 5) &&
        full.warnings[9] === EQUAL_WEIGHT_WARNING &&
        full.warnings[1] === "AI 경고 0" &&
        full.warnings[8] === "AI 경고 7",
      JSON.stringify(full.warnings),
    );
  }
}

// ---------------------------------------------------------------- 저장 값의 guideline 필드, 기록 내용

function checkGuidelineField() {
  const base: PrepCriteria = {
    version: 1,
    department: DEPARTMENT,
    elements: [{ id: "e1", name: "가", weight: 100, groups: [{ tag: "t", name: "n", questions: ["q"] }] }],
  };
  check("저장 값: guideline 이 없는 예전 값(T1 형식)은 그대로 읽힌다", same(parsePrepCriteria(base), base));
  const withGuideline = { ...base, guideline: { fileName: "모집요강.pdf", changes: [{ title: "제목", body: "내용" }] } };
  check("저장 값: 모양에 맞는 guideline 은 그대로 읽힌다", same(parsePrepCriteria(withGuideline), withGuideline));
  check("저장 값: 변경 사항 0건인 guideline 도 읽힌다", parsePrepCriteria({ ...base, guideline: { fileName: "a.pdf", changes: [] } }) !== null);
  const bad: [string, unknown][] = [
    ["파일 이름 256자", { fileName: `${"가".repeat(252)}.pdf`, changes: [] }],
    ["파일 이름 빔", { fileName: "  ", changes: [] }],
    ["변경 사항 7건", { fileName: "a.pdf", changes: Array.from({ length: 7 }, () => ({ title: "t", body: "b" })) }],
    ["제목 41자", { fileName: "a.pdf", changes: [{ title: "제".repeat(41), body: "b" }] }],
    ["내용 301자", { fileName: "a.pdf", changes: [{ title: "t", body: "내".repeat(301) }] }],
    ["빈 제목", { fileName: "a.pdf", changes: [{ title: "", body: "b" }] }],
    ["changes 가 배열 아님", { fileName: "a.pdf", changes: {} }],
    ["값이 null", null],
  ];
  for (const [label, guideline] of bad) {
    check(`저장 값: guideline ${label} → 값 전체를 저장한 값이 없는 것으로 본다`, parsePrepCriteria({ ...base, guideline }) === null);
  }
  check(
    "저장 값: 파일 이름 255자는 통과",
    parsePrepCriteria({ ...base, guideline: { fileName: `${"가".repeat(251)}.pdf`, changes: [] } }) !== null,
  );

  const elements = [
    { id: "e1", name: "학업역량", weight: 30, groups: [] },
    { id: "e2", name: "진로역량", weight: 40, groups: [] },
    { id: "e3", name: "공동체역량", weight: 30, groups: [] },
  ];
  check(
    "기록 내용: 모집요강으로 새로 만듦",
    guidelineSaveSummary("가상 모집요강.pdf", elements) === "모집요강으로 평가 기준을 새로 만듦: 가상 모집요강.pdf (평가 요소 3개, 배점 30·40·30)",
  );
  const long = guidelineSaveSummary("가".repeat(600), elements);
  check(
    "기록 내용: 500자를 넘으면 파일 이름을 줄이고 … 를 붙인다",
    long.length <= 500 && long.includes("…") && long.endsWith("(평가 요소 3개, 배점 30·40·30)"),
    `${long.length}자`,
  );
}

// ---------------------------------------------------------------- 가상 모집요강 PDF

async function checkSamplePdf() {
  let pages: string[];
  try {
    pages = await readGuidelinePages(await readFile(SAMPLE_PDF));
  } catch (error) {
    check(`가상 모집요강: ${SAMPLE_PDF} 를 읽는다`, false, error instanceof Error ? error.name : String(error));
    return;
  }
  check(`가상 모집요강: 세 쪽이다 (${SAMPLE_PDF})`, pages.length === 3, `${pages.length}쪽`);
  const squashed = pages.map((page) => page.replace(/\s+/g, ""));
  check("가상 모집요강: 1쪽에 전년 대비 주요 변경사항", squashed[0]?.includes("전년대비주요변경사항") === true);
  check(
    "가상 모집요강: 3쪽에 평가요소·반영비율과 세 요소",
    ["평가요소및반영비율", "학업역량30%", "진로역량40%", "공동체역량30%"].every((word) => squashed[2]?.includes(word)),
  );
  const selection = selectGuidelineText(pages, DEPARTMENT);
  check(
    "가상 모집요강: 24,000자 이하라 세 쪽 전체를 보낸다",
    same(pagesIn(selection.text), [1, 2, 3]) && selection.pagesRead === 3 && selection.pagesTotal === 3,
    `${selection.text.length}자`,
  );
}

async function main(): Promise<number> {
  checkPageSelection();
  checkNormalize();
  checkGuidelineField();
  await checkSamplePdf();
  console.log("");
  if (failures.length > 0) {
    console.error(`모집요강 초안 검사 실패: ${failures.length}개 실패, ${passed}개 통과`);
    return 1;
  }
  console.log(`모집요강 초안 검사 통과: ${passed}개 사례`);
  return 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
    process.exitCode = 1;
  },
);
