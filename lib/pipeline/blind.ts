/**
 * 블라인드 처리: 지원자를 식별할 수 있는 정보를 가린다.
 *
 * AI에 보내기 전, 그리고 화면에 보내기 전에 서버에서 실행한다.
 * 가려진 자리에는 "[이름]", "[학교명]" 같은 표시가 들어가고, 원래 값은 결과에 남지 않는다.
 * 처음 구현은 제공받은 파일이고, 그 뒤 검증에서 드러난 빈틈(약칭, 과목명, 영문 이름, 구분자 없는 전화번호, 규칙끼리 겹치는 곳 등)을
 * 메우도록 규칙을 보강했다.
 *
 * 두 단계로 처리한다.
 *   (1) 문서 전체(모든 항목의 text 와 subject, 인적·학적사항 포함)에서 학생 이름과 학교·대학 이름을 모은다.
 *   (2) 항목마다 text 와 subject(문자열일 때), 인적·학적사항 줄의 항목 이름을 가린다.
 *       다른 필드(id, category, grade, page, fieldId, hours)는 그대로 둔다.
 *
 * 한 글을 가리는 방법(구간 방식):
 *   1. 그 글에서 모든 규칙의 후보 구간을 한꺼번에 모은다. 규칙끼리는 서로가 바꾼 결과를 보지 않는다(모두 같은 글을 본다).
 *   2. 이미 있는 표시 글자와 겹치는 후보, 종류를 가리키는 낱말 안쪽에 완전히 들어가는 학교·대학 후보
 *      (인적·학적사항 이름을 글자 그대로 맞춘 것, 파생형)는 버린다. 학생 이름·번호 후보는 그 안에서도 남긴다.
 *      원문에 처음부터 있던 표시 글자([블라인드] 등 여섯 가지)는 이미 가린 자리로 보고 그 안쪽은 가리지 않는다
 *      (성명이 "학교명" 이어도 원문의 "[학교명]" 안은 그대로다. 그래야 다시 적용해도 바뀌지 않는다).
 *   3. 겹치는 후보 구간을 하나로 합친다(맞닿기만 한 구간은 합치지 않는다). 합친 구간 하나가 표시 하나, 한 곳이다.
 *   4. 합친 구간의 종류는 가장 먼저 시작하는 후보의 것(시작이 같으면 가장 긴 것, 그것도 같으면
 *      주민등록번호 → 전화번호 → 학교명 → 대학명 → 이름 순서).
 *   5. 바꾼 결과에 1~4 를 다시 적용한다. 새로 바꿀 구간이 없거나 10번이 되면 멈춘다. 넣은 표시("[…]")는 경계에서
 *      한글·영문자·숫자가 아닌 글자다. 9번째 회차까지 마친 뒤에는 경계 조건을 지킨 채로 한 번 더 후보를 모아 보고, 없으면 끝낸다.
 *      하나라도 있을 때만 그 10번째 회차를 경계 조건(주민등록번호·구분자 없는 전화번호의 앞뒤 숫자 경계, 한글 2자 이름의 앞뒤 조건,
 *      영문 이름의 앞뒤 경계, 파생형의 앞뒤 조건) 없이 다시 모아 가리고 끝낸다. 그래서 경계 조건을 끝까지 지키면 9번 안에 끝나는
 *      글은 그 결과와 같고, 더 걸릴 글만 마지막에 더 가린다. 어느 쪽이든 다시 적용해도 바뀌지 않는다.
 *      masks 는 처음 센 순서이고, 한 글 안에서는 왼쪽 구간부터 센다.
 *   그래서 어느 규칙이든 그 글에서 맞춘 글자는 모두 가려진다(한 규칙이 다른 규칙의 일부를 드러내지 않는다).
 *
 * 규칙(후보):
 *   - 주민등록번호(월·일과 뒷자리 첫 글자가 맞고 앞뒤가 숫자가 아닌 것), 전화번호(구분자가 있는 꼴과 없는 꼴)
 *   - 학교·대학 기본 꼴 낱말: 접미사(고등학교·중학교·초등학교 / 대학교)가 나오는 곳마다, 바로 앞에 이어진 한글·영문자·숫자를
 *     될 수 있는 만큼(학교 15자, 대학 12자까지) 붙인 낱말(앞에 붙는 글자가 학교 1자, 대학 2자보다 적으면 낱말이 아님).
 *     낱말 전체가 종류를 가리키는 말(일반고등학교, 국립대학교 등)이면 후보가 아니다(그 낱말과 겹치는 학생 이름·번호 후보가
 *     있으면 그 낱말을 통째로 후보로 삼는다. 성명이 "인문계" 면 "인문계고등학교" → [학교명]). 인적·학적사항에서 읽은 이름과 같으면
 *     통째로, 그 이름으로 끝나면서 더 길면 그 이름 부분만, 그 밖에는 통째로 후보다.
 *   - 인적·학적사항에서 읽은 학교·대학 이름 가운데 기본 꼴 낱말 하나와 같은 꼴이 아닌 것(여러 낱말, 기호가 든 이름 등)은
 *     글자 그대로(낱말 사이 공백 수는 달라도 됨). "[" 나 "]" 가 든 값은 이름으로 읽지 않는다.
 *   - 학생 이름: 인적·학적사항의 "성명"·"이름" 줄에서 읽은 이름(한글 2~5자, 영문)이 다른 곳에 나온 경우.
 *     한글 이름은 값의 낱말을 붙여 읽고, 마지막 낱말이 성별(남, 여 등)이면 그것을 뺀 것도 이름으로 읽는다("김민준 남" → 김민준, 김민준남).
 *     한글 3자 이상은 나오는 곳마다, 한글 2자는 앞이 한글이 아니고 뒤가 한글이 아니거나 조사·호칭만 붙은 곳.
 *     붙여 쓴 꼴, 성명 값에 띄어 적힌 꼴("남궁 민수", 공백 수는 달라도 됨), 3자 이상은 성 첫 글자 뒤 공백 하나("남 궁민수")도 가린다.
 *     영문은 대소문자·낱말 사이 공백 수와 상관없이 앞뒤가 영문자·숫자가 아닌 곳에서. 영문 이름의 낱말은 영문자가 이어진 덩어리다
 *     (공백·-·'·. 이 낱말을 나눈다). 낱말이 둘이면 순서를 바꾼 꼴도(사이는 공백, 쉼표, 또는 성명에 적힌 그 구분 기호).
 *   - 학교·대학 파생형(인적·학적사항에서 읽은 이름과 문서의 기본 꼴 낱말에서 만든다):
 *     띄어 쓴 꼴(○○ 고등학교)은 앞 경계만 본다(앞 글자가 한글·영문자·숫자가 아님).
 *     줄임말(○○고·○○고교·○○중·○○초·○○초교·○○여고·○○대·○○대학)은 앞 경계와 뒤 경계(끝, 한글이 아닌 글자,
 *     조사 1~2개 뒤 한글이 아닌 글자)를 모두 본다.
 *   경계에서 "한글"은 완성형 음절과 자모를 모두 뜻한다(ㄱ하늘, 하늘ㅂ 은 가리지 않는다).
 *   인적·학적사항 항목: 줄마다 값을 "[블라인드]" 로 바꾸고(콜론이 없으면 줄 전체), 남기는 항목 이름 부분은 위 방법으로 가린다.
 *   값이 이미 [블라인드] 인 줄은 값을 그대로 두고(항목 이름에는 적용), 빈 줄은 그대로 둔다.
 * 상한: 학생 이름 20개(처음 구현이 읽던 이름은 상한과 상관없이 먼저 넣는다), 영문 이름은 낱말 8개·80자 이하일 때만 읽는다.
 *   인적·학적사항에서 읽은 학교·대학 이름은 80자 이하(공백 정리 뒤)일 때만, 종류마다 100개. 파생형을 만드는 이름은 종류마다 100개.
 *   상한은 넣는 시점에 적용한다. 문서에서 모은 값으로 정규식을 만들지 못하면 그 규칙만 빼고 계속한다(예외를 내지 않는다).
 *   글자 수(80자, 파생형 앞부분 2자 등)는 코드 포인트로 센다(확장 한자·이모지 한 글자는 1자). 구간 위치는 UTF-16 그대로다.
 * 가리지 못하는 것:
 *   - 축제명, 기숙사명, 교사 이름, 기업·기관명, 지역명처럼 문맥을 봐야 아는 것
 *   - 인적·학적사항에 성명 줄이 없거나 값이 이름 모양이 아닐 때의 이름, 성을 뺀 이름(민준이는), 영문 이름의 낱말 하나만 쓴 경우
 *   - 문서 어디에도 전체 이름이 없는 학교·대학의 줄임말·띄어 쓴 이름, "○○대학"(교 없이)만 쓴 경우
 *   - 상한을 넘은 이름의 파생형. 상한을 넘은 인적·학적사항의 이름 가운데 기본 꼴로 잡히지 않는 것은 기본 꼴에 걸리는 부분만 가려진다
 *   - text·subject 밖의 필드
 * 이름·줄임말이 흔한 낱말과 같고 뒤에 조사가 붙으면 그 낱말도 가려진다(이름이 "하늘"이면 "하늘의"). 새는 것보다 낫다고 본다.
 */
import type { Section } from "@/types/analysis";

export type MaskSummary = { type: string; count: number };
export type BlindResult<T extends Section> = { sections: T[]; masks: MaskSummary[] };

const BLINDED = "[블라인드]";

/** 가리는 정보의 종류와 표시 글자. 순서는 합친 구간의 종류를 정할 때 마지막으로 비교하는 순서다 */
type MaskType = "주민등록번호" | "전화번호" | "학교명" | "대학명" | "이름";
const LABEL_OF: Record<MaskType, string> = {
  주민등록번호: "[주민등록번호]",
  전화번호: "[전화번호]",
  학교명: "[학교명]",
  대학명: "[대학명]",
  이름: "[이름]",
};
const TYPE_ORDER: Record<MaskType, number> = { 주민등록번호: 0, 전화번호: 1, 학교명: 2, 대학명: 3, 이름: 4 };

/** 이미 있는 표시 글자. 이것과 겹치는 후보는 버린다 */
const LABELS = [BLINDED, ...Object.values(LABEL_OF)];

/** 경계에서 한글로 보는 글자: 완성형 음절, 호환 자모(U+3131~U+318E), 조합형 자모(U+1100~U+11FF) */
const HANGUL = "가-힣\\u3131-\\u318E\\u1100-\\u11FF";

/** 주민등록번호: 생년월일 6자리(월 01~12, 일 01~31) - 뒷자리 7자리(첫 글자 1~8 또는 가림 글자). 앞뒤가 숫자가 아닐 때만 */
const RESIDENT_NO_SOURCE =
  "(?<!\\d)\\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\\d|3[01])\\s*-\\s*[1-8*●○][\\d*●○]{6}(?!\\d)";

/**
 * 전화번호: 구분자가 있는 꼴(처음 구현과 같음) 또는 구분자 없는 꼴.
 * 구분자 없는 꼴은 01[016789] 로 시작하는 10~11자리, 그 밖에 0 + 1~9 로 시작하는 9~11자리이고 앞뒤가 숫자나 - 가 아닐 때만.
 */
const PHONE_SOURCE =
  "0\\d{1,2}[-.)\\s]\\s?\\d{3,4}[-.\\s]\\d{4}" +
  "|(?<![\\d-])(?:01[016789]\\d{7,8}|0(?!1[016789])[1-9]\\d{7,9})(?![\\d-])";

/** 마지막 회차용(앞뒤 경계 없음): 주민등록번호의 월·일·뒷자리 첫 글자 조건은 그대로, 구분자 없는 전화번호의 자릿수 조건은 그대로 */
const RESIDENT_NO_LOOSE_SOURCE = "\\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\\d|3[01])\\s*-\\s*[1-8*●○][\\d*●○]{6}";
const PHONE_LOOSE_SOURCE =
  "0\\d{1,2}[-.)\\s]\\s?\\d{3,4}[-.\\s]\\d{4}" + "|(?:01[016789]\\d{7,8}|0(?!1[016789])[1-9]\\d{7,9})";

/** 특정 학교·대학이 아니라 종류를 가리키는 말의 앞부분. 낱말 전체가 이 말 + 접미사이면 종류를 가리키는 낱말이다 */
const GENERIC_SCHOOL_WORDS = [
  "일반", "일반계", "특성화", "특수목적", "자율형사립", "자율형공립", "자율", "마이스터", "인문계", "전문계", "실업계",
  "남자", "여자", "공립", "사립", "국립", "대안", "해당", "다른", "타", "인근", "지역", "출신", "상급",
];
const GENERIC_UNIVERSITY_WORDS = [
  "종합", "국립", "사립", "공립", "일반", "지방", "지역", "수도권", "해외", "외국", "희망", "지원", "해당", "다른", "타", "4년제", "전문",
];
const GENERIC_SCHOOL = new RegExp(`^(?:${longestFirst(GENERIC_SCHOOL_WORDS)})(?:고등학교|중학교|초등학교)$`);
const GENERIC_UNIVERSITY = new RegExp(`^(?:${longestFirst(GENERIC_UNIVERSITY_WORDS)})대학교$`);

/**
 * 이름·줄임말 뒤에 붙어도 되는 조사·호칭. 낱말의 일부가 되기 쉬운 한 글자(나, 라, 고, 며, 야, 아 등)는 넣지 않는다.
 * 마지막 줄의 이나·에게서·한테서는 스펙의 최소 목록에 더한 것이다(두 글자 이상이라 낱말의 일부로 잘못 맞을 일이 적다).
 */
const PARTICLES = [
  "은", "는", "이", "가", "을", "를", "의", "와", "과", "도", "만", "에", "로",
  "에게", "한테", "께서", "에서", "으로", "처럼", "보다", "까지", "부터", "이랑", "하고", "이라고", "라고", "이며", "이고", "이다", "입니다",
  "군", "양", "씨", "님", "학생",
  "이나", "에게서", "한테서",
];
/** 뒤 경계: 글의 끝이거나, 한글이 아닌 글자이거나, 조사·호칭 1~2개 뒤에 글의 끝·한글이 아닌 글자 */
const TAIL = `(?=(?:${longestFirst(PARTICLES)}){0,2}(?![${HANGUL}]))`;
/** 앞 경계: 앞 글자가 한글(자모 포함)·영문자·숫자가 아님(글의 처음 포함) */
const WORD_START = `(?<![${HANGUL}A-Za-z0-9])`;

/** 학교·대학 기본 꼴 낱말과 파생형의 종류 */
type Kind = {
  type: "학교명" | "대학명";
  suffixes: string[];
  /** 접미사 앞에 붙는 글자 수의 최소·최대 */
  minPrefix: number;
  maxPrefix: number;
  generic: RegExp;
  /** 낱말 하나와 같은 꼴인지(인적·학적사항 이름을 낱말로 다룰지 글자 그대로 맞출지 정할 때) */
  word: RegExp;
  /** 접미사별 줄임말 (긴 꼴부터) */
  short: Record<string, string[]>;
};
const SCHOOL: Kind = {
  type: "학교명",
  suffixes: ["고등학교", "중학교", "초등학교"],
  minPrefix: 1,
  maxPrefix: 15,
  generic: GENERIC_SCHOOL,
  word: /^[가-힣A-Za-z0-9]{1,15}(?:고등학교|중학교|초등학교)$/,
  short: { 고등학교: ["고교", "고"], 중학교: ["중"], 초등학교: ["초교", "초"] },
};
const UNIVERSITY: Kind = {
  type: "대학명",
  suffixes: ["대학교"],
  minPrefix: 2,
  maxPrefix: 12,
  generic: GENERIC_UNIVERSITY,
  word: /^[가-힣A-Za-z0-9]{2,12}대학교$/,
  short: { 대학교: ["대학", "대"] },
};
const KINDS = [SCHOOL, UNIVERSITY];

/**
 * 상한. 학생 이름 20개(기준 커밋이 읽던 이름은 상한과 상관없이 먼저 넣는다). 영문 이름은 낱말(영문자가 이어진 덩어리) 8개·80자 이하일 때만 읽는다.
 * 학교·대학은 종류마다 (1) 인적·학적사항에서 읽은 이름 100개(80자 이하인 값만), (2) 파생형을 만드는 이름 100개
 * (인적·학적사항에서 읽은 이름이 먼저). 상한은 넣는 시점에 적용한다. 기본 꼴 낱말은 상한과 상관없이 후보다.
 * 글자 수는 코드 포인트로 센다(확장 한자·이모지 한 글자는 1자). 글을 자르고 구간 위치를 다루는 것은 UTF-16 그대로다.
 */
const MAX_NAMES = 20;
const MAX_ENGLISH_WORDS = 8;
const MAX_VALUE_LENGTH = 80;
const MAX_KNOWN = 100;
/**
 * 한 글에 되풀이하는 최대 횟수. 새로 바꿀 구간이 없으면 그 전에 멈춘다. 9번째 회차까지 마친 뒤에는 경계 조건을 지킨 채로
 * 한 번 더 후보를 모아 보고, 하나도 없으면 거기서 끝낸다. 하나라도 있을 때만 그 회차를 경계 조건 없이 다시 모아 가리고 끝낸다
 * (옆 글자가 가려지며 한 회차에 하나씩 풀리는 경계가 남아 다시 적용할 때 바뀌지 않게).
 */
const MAX_ROUNDS = 10;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 글자 그대로 맞추는 선택지를 긴 것부터 잇는다 */
function longestFirst(words: string[]): string {
  return [...words].sort((a, b) => b.length - a.length).map(escapeRegExp).join("|");
}

/** 낱말 사이 공백 수가 달라도 맞도록, 공백으로 나눈 낱말을 \s+ 로 잇는다 */
function wordsSource(s: string): string {
  return s.trim().split(/\s+/).map(escapeRegExp).join("\\s+");
}

/** 정규식을 만든다. 만들지 못하면(너무 큰 패턴 등) null 을 돌려주고, 그 규칙은 빠진다 */
function safeRegExp(source: string | null, flags: string): RegExp | null {
  if (source === null || source === "") return null;
  try {
    return new RegExp(source, flags);
  } catch {
    return null;
  }
}

const isIdentity = (s: Section) => s.fieldId === "S01" || s.category === "인적·학적사항";
/** 글자 수(코드 포인트) */
const codePointLength = (s: string) => [...s].length;
const nonSpaceLength = (s: string) => codePointLength(s.replace(/\s+/g, ""));

/** 기본 꼴 낱말의 앞부분에 오는 글자: 완성형 한글·영문자·숫자 */
function isWordChar(code: number): boolean {
  return (
    (code >= 0xac00 && code <= 0xd7a3) || (code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a) || (code >= 0x30 && code <= 0x39)
  );
}

/** 줄을 첫 콜론(":" 또는 전각 "：") 앞의 항목 이름과 뒤의 값으로 나눈다 */
function splitLine(line: string): { key: string; value: string } | null {
  const at = line.search(/[:：]/);
  return at === -1 ? null : { key: line.slice(0, at), value: line.slice(at + 1) };
}

/**
 * 괄호와 그 안을 뺀다. 여는 괄호("(", "（")부터 짝이 맞는 닫는 괄호(")", "）". 종류는 섞여도 됨)까지 깊이를 세며 빼고,
 * 닫히지 않으면 끝까지 뺀다. 여는 괄호 없이 나온 닫는 괄호는 남긴다.
 */
function removeParentheses(s: string): string {
  let out = "";
  let depth = 0;
  for (const ch of s) {
    if (ch === "(" || ch === "（") depth += 1;
    else if (depth > 0 && (ch === ")" || ch === "）")) depth -= 1;
    else if (depth === 0) out += ch;
  }
  return out;
}

/** 값의 첫 "/" 앞부분에서 괄호와 그 안을 빼고 앞뒤 공백을 뺀다 */
function leadingValue(value: string): string {
  return removeParentheses(value.split("/")[0]).trim();
}

/**
 * 학생 이름. text 는 공백을 뺀 한글 이름(또는 공백을 하나로 정리한 영문 이름),
 * spaced 는 성명 값에 띄어 적힌 한글 이름의 꼴(낱말을 공백 하나로 이은 것. 예: "남궁 민수")이다.
 */
type StudentName = { text: string; english: boolean; spaced: Set<string> };

/** 성명 값 뒤에 공백으로 붙는 성별을 가리키는 말 */
const GENDER_WORDS = new Set(["남", "여", "남자", "여자", "남성", "여성"]);
const KOREAN_NAME = /^[가-힣]{2,5}$/;

/**
 * 인적·학적사항 줄의 값에서 학생 이름을 읽는다(없으면 빈 배열). 값의 첫 "/" 앞부분(괄호 제거)을 공백으로 나눈 낱말들에서
 *   (가) 마지막 낱말이 성별(남, 여, 남자, 여자, 남성, 여성)이고 나머지를 붙인 것이 한글 2~5자면 그 나머지("김민준 남" → 김민준)
 *   (나) 낱말을 모두 붙인 것이 한글 2~5자면 그것("김 민준" → 김민준, "남궁 민수" → 남궁민수, "김 남" → 김남)
 * 둘 다 되면 둘 다 이름으로 삼는다(어느 쪽인지 알 수 없으므로 더 가리는 쪽). 띄어 적힌 꼴은 spaced 에 남겨 그 꼴로도 가린다.
 * 한글 이름이 아니면 영문 이름인지 본다: 낱말(영문자가 이어진 덩어리) 1~8개가 구분 글자(공백·-·'·. 로만 이루어진 글자 묶음.
 * 섞여도 된다. 예: " - ")로 이어지고, 끝에 "." 하나는 있어도 되고, 영문자가 2자 이상이고, 전체(공백을 하나로 정리한 것)가
 * 80자(코드 포인트) 이하일 때. Qev-Nori 는 두 낱말, "Nori - Qev - Luv - Miv - Piv" 는 다섯 낱말이다.
 */
function readNames(value: string): StudentName[] {
  const head = leadingValue(value);
  const words = head.split(/\s+/).filter((word) => word !== "");
  const korean: string[][] = [];
  const rest = words.slice(0, -1);
  if (rest.length > 0 && GENDER_WORDS.has(words[words.length - 1]) && KOREAN_NAME.test(rest.join(""))) korean.push(rest);
  if (KOREAN_NAME.test(words.join(""))) korean.push(words);
  if (korean.length > 0) {
    return korean.map((w) => ({ text: w.join(""), english: false, spaced: new Set(w.length > 1 ? [w.join(" ")] : []) }));
  }
  const english = words.join(" ");
  if (codePointLength(english) > MAX_VALUE_LENGTH) return [];
  const letters = english.replace(/[^A-Za-z]/g, "").length;
  if (letters < 2 || !/^[A-Za-z]+(?:[\s.'-]+[A-Za-z]+)*\.?$/.test(english)) return [];
  if (englishWords(english).length > MAX_ENGLISH_WORDS) return [];
  return [{ text: english, english: true, spaced: new Set() }];
}

/** 영문 이름의 낱말(영문자가 이어진 덩어리) */
function englishWords(name: string): string[] {
  return name.match(/[A-Za-z]+/g) ?? [];
}

/**
 * 기준 커밋의 괄호 제거식 value.replace(/\(.*?\)/g, "") 와 결과가 글자 그대로 같은 선형 처리. 글을 두 번 훑는다:
 * 먼저 오른쪽에서 왼쪽으로 한 번 훑어 위치마다 "그 뒤 가장 가까운 ")" 의 위치"(사이에 줄바꿈류 문자 \n·\r·U+2028·U+2029 가
 * 있으면 없음)를 만들고, 그다음 왼쪽에서 오른쪽으로 한 번 훑으며 "(" 에서 그 ")" 까지 빼고 그 다음부터 이어 본다.
 * 닫는 괄호가 없으면 "(" 를 남기고 다음 글자로 간다. 닫히지 않은 "(" 가 아주 많아도 느려지지 않는다(정규식은 다시 훑는다).
 */
function removeLegacyParentheses(value: string): string {
  const n = value.length;
  // nextClose[i]: i 부터 오른쪽으로 줄바꿈류 문자를 넘지 않고 처음 나오는 ")" 의 위치(없으면 -1)
  const nextClose = new Int32Array(n + 1).fill(-1);
  for (let i = n - 1; i >= 0; i--) {
    const ch = value[i];
    if (ch === "\n" || ch === "\r" || ch === " " || ch === " ") nextClose[i] = -1;
    else nextClose[i] = ch === ")" ? i : nextClose[i + 1];
  }
  let out = "";
  for (let i = 0; i < n; i++) {
    if (value[i] === "(" && nextClose[i + 1] !== -1) {
      i = nextClose[i + 1];
      continue;
    }
    out += value[i];
  }
  return out;
}

/**
 * 기준 커밋(처음 제공받은 구현)이 읽던 학생 이름: 첫 인적·학적사항 항목에서 항목 이름(ASCII 콜론 앞)에 "성명" 이 든 줄 가운데
 * 값(첫 "/" 앞, "(…)" 제거)이 한글 2~5자인 첫 줄. 이 이름은 상한과 상관없이 항상 가린다(보강 뒤에 덜 가리는 일이 없게).
 */
function legacyStudentName(identity: Section | undefined): string | null {
  if (!identity) return null;
  for (const line of identity.text.split("\n")) {
    const at = line.indexOf(":");
    if (at === -1 || !line.slice(0, at).includes("성명")) continue;
    const value = removeLegacyParentheses(line.slice(at + 1).split("/")[0]).trim();
    if (/^[가-힣]{2,5}$/.test(value)) return value;
  }
  return null;
}

/**
 * 인적·학적사항 줄의 값에서 학교·대학 이름을 읽는다(여러 낱말일 수 있다. 공백은 하나로 정리).
 * 80자 이하이고, 접미사(고등학교·중학교·초등학교·대학교)로 끊기지 않고 끝나고(가상고등 학 교 는 아님), 접미사 앞에 글자가 있고,
 * 종류를 가리키는 말이 아니어야 한다. "[" 나 "]" 가 든 값은 읽지 않는다.
 */
function readInstitution(value: string): { name: string; kind: Kind } | null {
  const head = leadingValue(value).replace(/\s+/g, " ");
  if (codePointLength(head) > MAX_VALUE_LENGTH || head.includes("[") || head.includes("]")) return null;
  const compact = head.replace(/\s+/g, "");
  for (const kind of KINDS) {
    for (const suffix of kind.suffixes) {
      if (!head.endsWith(suffix) || compact.length === suffix.length) continue;
      if (GENERIC_SCHOOL.test(compact) || GENERIC_UNIVERSITY.test(compact)) return null;
      return { name: head, kind };
    }
  }
  return null;
}

/** 상한까지 겹치지 않게 넣는다 */
function pushLimited(list: string[], value: string, max: number): void {
  if (list.length < max && !list.includes(value)) list.push(value);
}

type Word = { start: number; end: number; word: string };

/**
 * 기본 꼴 낱말을 모두 찾는다. 접미사가 나오는 곳마다 바로 앞에 이어진 한글·영문자·숫자를 될 수 있는 만큼(최대 maxPrefix)
 * 붙인 낱말 하나. 앞에 붙는 글자가 minPrefix 보다 적으면 낱말이 아니다. 낱말끼리는 겹칠 수 있다.
 */
function findWords(text: string, kind: Kind): Word[] {
  const words: Word[] = [];
  for (const suffix of kind.suffixes) {
    for (let at = text.indexOf(suffix); at !== -1; at = text.indexOf(suffix, at + 1)) {
      let start = at;
      while (start > 0 && at - start < kind.maxPrefix && isWordChar(text.charCodeAt(start - 1))) start -= 1;
      if (at - start >= kind.minPrefix) words.push({ start, end: at + suffix.length, word: text.slice(start, at + suffix.length) });
    }
  }
  return words;
}

/**
 * 파생형과 인적·학적사항 이름 글자 그대로 맞추기의 선택지 하나: 공백이 없는 글자 묶음(tokens)을 공백 한 개 이상(정규식 \s+)으로
 * 이은 꼴. tail 이면 끝에서 뒤 경계(TAIL)를 본다.
 */
type Phrase = { tokens: string[]; tail: boolean };

/** 글자 묶음을 공백 한 개 이상으로 잇는 선택지(정규식 wordsSource 와 같은 꼴) */
const phraseOf = (s: string, tail = false): Phrase => ({ tokens: s.trim().split(/\s+/), tail });

/** 선택지를 앞부분끼리 묶은 나무의 마디. children 은 다음 글자(UTF-16 코드 단위)별, space 는 공백 한 개 이상 뒤, ends 는 여기서 끝나는 선택지 */
type PhraseNode = { children: Map<number, PhraseNode>; space: PhraseNode | null; ends: { order: number; tail: boolean }[] };

/**
 * 선택지 목록을 맞추는 규칙. source 는 같은 선택지를 같은 순서로 이은 정규식 원본(alt1|alt2|…)이고, 찾는 후보는 그 정규식으로
 * 찾을 때(addMatches)와 위치·길이가 같다. start 면 앞 경계(WORD_START)를 본다.
 */
type PhraseRule = { source: string; root: PhraseNode; start: boolean };

const newPhraseNode = (): PhraseNode => ({ children: new Map(), space: null, ends: [] });

/** 선택지 목록으로 규칙을 만든다. 같은 선택지의 정규식을 만들 수 없으면(전과 같이) 그 규칙은 빠진다(null) */
function phraseRule(source: string | null, phrases: Phrase[], start: boolean): PhraseRule | null {
  if (source === null || safeRegExp(source, "g") === null) return null;
  const root = newPhraseNode();
  phrases.forEach(({ tokens, tail }, order) => {
    let node = root;
    tokens.forEach((token, i) => {
      if (i > 0) node = node.space ??= newPhraseNode();
      for (let k = 0; k < token.length; k++) {
        const code = token.charCodeAt(k);
        let child = node.children.get(code);
        if (!child) node.children.set(code, (child = newPhraseNode()));
        node = child;
      }
    });
    node.ends.push({ order, tail });
  });
  return { source, root, start };
}

/** 정규식 \s 와 같은 글자(공백·탭·줄바꿈류·전각 공백 등) */
function isSpace(code: number): boolean {
  return (
    code === 0x20 || (code >= 0x09 && code <= 0x0d) || code === 0xa0 || code === 0x1680 || (code >= 0x2000 && code <= 0x200a) ||
    code === 0x2028 || code === 0x2029 || code === 0x202f || code === 0x205f || code === 0x3000 || code === 0xfeff
  );
}

const WORD_START_AT = new RegExp(WORD_START, "y");
const TAIL_AT = new RegExp(TAIL, "y");
/** 위치 at 에서 (폭이 없는) 경계 조건이 맞는지 */
function holdsAt(re: RegExp, text: string, at: number): boolean {
  re.lastIndex = at;
  return re.test(text);
}

/**
 * 규칙이 맞는 곳을 모두 후보로 넣는다. 정규식 source 를 addMatches 로 찾은 것과 후보가 같다:
 * 정규식은 글자 위치마다(앞 경계를 보면 앞 경계가 맞는 곳만) 선택지를 앞에서부터 해 보고 처음 맞는 선택지를 쓴다.
 * 선택지 안의 \s+ 뒤에는 늘 공백이 아닌 글자가 오므로 \s+ 는 이어진 공백을 모두 먹고, 그래서 선택지마다 맞는 길이는 하나다.
 * 여기서는 위치마다 나무를 한 번 따라가며(공통 앞부분을 한 번만 본다) 끝나는 선택지를 모으고, 그 가운데 가장 앞선 선택지를 쓴다.
 */
function addPhraseMatches(rule: PhraseRule | null, text: string, type: MaskType, droppable: boolean, out: Candidate[]): void {
  if (!rule) return;
  const n = text.length;
  for (let p = 0; p < n; p++) {
    let node = rule.root.children.get(text.charCodeAt(p));
    if (!node || (rule.start && !holdsAt(WORD_START_AT, text, p))) continue;
    let pos = p + 1;
    let best = -1;
    let bestEnd = p;
    for (;;) {
      for (const end of node.ends) {
        if ((best === -1 || end.order < best) && (!end.tail || holdsAt(TAIL_AT, text, pos))) {
          best = end.order;
          bestEnd = pos;
        }
      }
      if (pos >= n) break;
      const code = text.charCodeAt(pos);
      if (isSpace(code)) {
        if (!node.space) break;
        node = node.space;
        do pos += 1;
        while (pos < n && isSpace(text.charCodeAt(pos)));
      } else {
        const child = node.children.get(code);
        if (!child) break;
        node = child;
        pos += 1;
      }
    }
    if (best !== -1) out.push({ start: p, end: bestEnd, type, droppable });
  }
}

/**
 * 파생형(띄어 쓴 꼴, 줄임말)을 긴 꼴부터 맞추는 규칙을 만든다. 이름이 없으면 null.
 * - 띄어 쓴 꼴(앞부분 + 공백 + 접미사): 앞 경계만(앞 글자가 한글(자모 포함)·영문자·숫자가 아님)
 * - 줄임말: 앞 경계 + 뒤 경계(끝 / 한글이 아닌 글자 / 조사 1~2개 뒤 한글이 아닌 글자)
 * 앞부분(이름에서 접미사를 뺀 것)이 2자 이상일 때만 만든다. 앞부분이 "여자" 로 끝나면 "여" 로 줄인 줄임말도 만든다.
 */
function derivedRule(names: string[], kind: Kind, loose = false): PhraseRule | null {
  // loose: 마지막 회차용. 앞 경계와 뒤 경계(조사 꼬리)를 두지 않는다
  const start = loose ? "" : WORD_START;
  const tail = loose ? "" : TAIL;
  const forms = new Map<string, { length: number; phrase: Phrase }>();
  const add = (source: string, length: number, phrase: Phrase) => {
    if (!forms.has(source)) forms.set(source, { length, phrase });
  };
  for (const name of names) {
    const suffix = kind.suffixes.find((s) => name.endsWith(s));
    if (!suffix) continue;
    const stem = name.slice(0, -suffix.length).trim();
    if (nonSpaceLength(stem) < 2) continue;
    add(`${start}${wordsSource(stem)}\\s+${suffix}`, stem.length + 1 + suffix.length, { tokens: [...phraseOf(stem).tokens, suffix], tail: false });
    const stems = [stem];
    if (stem.endsWith("여자") && nonSpaceLength(stem) - 1 >= 2) stems.push(`${stem.slice(0, -2)}여`);
    for (const s of stems) {
      for (const short of kind.short[suffix]) {
        const tokens = phraseOf(s).tokens;
        tokens[tokens.length - 1] += short;
        add(`${start}${wordsSource(s)}${short}${tail}`, s.length + short.length, { tokens, tail: !loose });
      }
    }
  }
  if (forms.size === 0) return null;
  const sorted = [...forms].sort((a, b) => b[1].length - a[1].length);
  return phraseRule(sorted.map(([source]) => source).join("|"), sorted.map(([, form]) => form.phrase), !loose);
}

/** 학생 이름을 맞추는 정규식 원본(한글, 영문). 이름이 없으면 null. loose 는 마지막 회차용(앞뒤 경계를 두지 않는다) */
function nameSources(names: StudentName[], loose = false): { korean: string | null; english: string | null } {
  // 한글: 붙여 쓴 꼴(3자 이상은 성 첫 글자 뒤 공백 하나도), 성명 값에 띄어 적힌 꼴(낱말 사이 공백 수는 달라도 됨).
  // 2자 이름은 어느 꼴이든 앞뒤 경계(앞이 한글이 아님, 뒤가 한글이 아니거나 조사·호칭 1~2개)를 둔다.
  const korean = names
    .filter((n) => !n.english)
    .sort((a, b) => b.text.length - a.text.length)
    .map(({ text, spaced }) => {
      const forms = [
        text.length >= 3 ? `${escapeRegExp(text[0])}[^\\S\\r\\n]?${escapeRegExp(text.slice(1))}` : escapeRegExp(text),
        ...[...spaced].map(wordsSource),
      ];
      const source = forms.length > 1 ? `(?:${forms.join("|")})` : forms[0];
      return text.length >= 3 || loose ? source : `(?<![${HANGUL}])${source}${TAIL}`;
    });
  // 영문: 적힌 그대로(공백이면 공백 수는 달라도 됨), 낱말(영문자 덩어리)이 둘이면 순서를 바꾼 꼴도.
  // 순서를 바꾼 꼴의 낱말 사이는 공백, 쉼표(앞뒤 공백 허용), 또는 성명에 적힌 그 구분 기호. 대소문자 무시, 앞뒤 영문자·숫자 경계.
  const english = names
    .filter((n) => n.english)
    .sort((a, b) => b.text.length - a.text.length)
    .map(({ text }) => {
      const forward = text.split(" ").map(escapeRegExp).join("\\s+");
      const two = /^([A-Za-z]+)([^A-Za-z]+)([A-Za-z]+)\.?$/.exec(text);
      const written = two ? two[2].split(/(\s+)/).map((part) => (/^\s+$/.test(part) ? "\\s+" : escapeRegExp(part))).join("") : "";
      const reversed = two ? `|${escapeRegExp(two[3])}(?:\\s*,\\s*|\\s+|${written})${escapeRegExp(two[1])}` : "";
      return loose ? `(?:${forward}${reversed})` : `(?<![A-Za-z0-9])(?:${forward}${reversed})(?![A-Za-z0-9])`;
    });
  return {
    korean: korean.length > 0 ? korean.join("|") : null,
    english: english.length > 0 ? english.join("|") : null,
  };
}

/** 후보 구간. droppable 은 종류를 가리키는 낱말 안쪽에 완전히 들어가면 버리는 후보(인적·학적사항 이름 글자 그대로, 파생형) */
type Candidate = { start: number; end: number; type: MaskType; droppable: boolean };

/** 정규식이 맞는 곳을 모두 후보로 넣는다. 겹치는 곳도 찾도록 맞은 자리 다음 글자부터 다시 찾는다 */
function addMatches(re: RegExp | null, text: string, type: MaskType, droppable: boolean, out: Candidate[]): void {
  if (!re) return;
  re.lastIndex = 0;
  for (let m = re.exec(text); m !== null; m = re.exec(text)) {
    if (m[0].length > 0) out.push({ start: m.index, end: m.index + m[0].length, type, droppable });
    re.lastIndex = m.index + 1;
  }
}

/** 한 문서에서 쓰는 규칙(정규식과 인적·학적사항 이름) */
/** 경계 조건이 있는 규칙. 회차마다 보통 규칙(strict)을 쓰고, 마지막(10번째) 회차에는 경계 없는 규칙(loose)을 쓴다 */
type BoundedRules = {
  residentNo: RegExp;
  phone: RegExp;
  koreanName: RegExp | null;
  englishName: RegExp | null;
  derived: Map<Kind, PhraseRule | null>;
};

type Rules = {
  label: RegExp;
  /** 종류별: 인적·학적사항에서 읽은 이름(낱말 판단용), 글자 그대로 맞출 이름 */
  fromIdentity: Map<Kind, Set<string>>;
  literal: Map<Kind, PhraseRule | null>;
  strict: BoundedRules;
  loose: BoundedRules;
};

/**
 * 글 하나에서 후보를 모두 모으고(구간 방식 1·2) 겹치는 것을 합쳐(3·4) 한 번 바꾼다. 바꿀 구간이 없으면 null.
 * found 는 바꾼 구간의 종류를 왼쪽부터 담는다. bounded 는 이번 회차의 경계 조건이 있는 규칙(보통 규칙 또는 마지막 회차의 경계 없는 규칙).
 */
function maskOnce(text: string, rules: Rules, bounded: BoundedRules): { text: string; found: MaskType[] } | null {
  const candidates: Candidate[] = [];
  addMatches(bounded.residentNo, text, "주민등록번호", false, candidates);
  addMatches(bounded.phone, text, "전화번호", false, candidates);
  addMatches(bounded.koreanName, text, "이름", false, candidates);
  addMatches(bounded.englishName, text, "이름", false, candidates);

  // 학생 이름·번호 후보가 덮는 위치(종류를 가리키는 낱말과 겹치는지 보려고)
  let personPrefix: Int32Array | null = null;
  if (candidates.length > 0) {
    const diff = new Int32Array(text.length + 1);
    for (const { start, end } of candidates) {
      diff[start] += 1;
      diff[end] -= 1;
    }
    personPrefix = new Int32Array(text.length + 1);
    for (let i = 0, depth = 0; i < text.length; i++) {
      depth += diff[i];
      personPrefix[i + 1] = personPrefix[i] + (depth > 0 ? 1 : 0);
    }
  }

  // 학교·대학 기본 꼴 낱말: 종류를 가리키는 낱말은 후보가 아니고 그 범위를 기억한다.
  // 다만 그 낱말과 겹치는 학생 이름·번호 후보가 하나라도 있으면 그 낱말을 통째로 후보로 삼는다
  // (이름이 종류어의 일부를 가리면 남은 글자는 더 이상 종류어가 아니다).
  const generic: { start: number; end: number }[] = [];
  for (const kind of KINDS) {
    const fromIdentity = rules.fromIdentity.get(kind) ?? new Set<string>();
    for (const { start, end, word } of findWords(text, kind)) {
      if (kind.generic.test(word)) {
        if (personPrefix && personPrefix[end] - personPrefix[start] > 0) {
          candidates.push({ start, end, type: kind.type, droppable: false });
        } else {
          generic.push({ start, end });
        }
        continue;
      }
      let cut = 0;
      if (!fromIdentity.has(word)) {
        // 인적·학적사항에서 읽은 이름으로 끝나면서 더 길면 그 이름 부분만(가장 긴 이름 기준)
        for (let i = 1; i < word.length; i++) {
          if (fromIdentity.has(word.slice(i))) {
            cut = i;
            break;
          }
        }
      }
      candidates.push({ start: start + cut, end, type: kind.type, droppable: false });
    }
    addPhraseMatches(rules.literal.get(kind) ?? null, text, kind.type, true, candidates);
  }
  for (const kind of KINDS) addPhraseMatches(bounded.derived.get(kind) ?? null, text, kind.type, true, candidates);
  if (candidates.length === 0) return null;

  // 버리는 후보: 이미 있는 표시 글자와 겹치는 것, 종류를 가리키는 낱말 안쪽에 완전히 들어가는 학교·대학 후보
  let labelPrefix: Int32Array | null = null;
  rules.label.lastIndex = 0;
  for (let m = rules.label.exec(text); m !== null; m = rules.label.exec(text)) {
    labelPrefix ??= new Int32Array(text.length + 1);
    for (let i = m.index; i < m.index + m[0].length; i++) labelPrefix[i + 1] = 1;
  }
  if (labelPrefix) for (let i = 1; i <= text.length; i++) labelPrefix[i] += labelPrefix[i - 1];
  let genericEnd: Int32Array | null = null;
  if (generic.length > 0) {
    genericEnd = new Int32Array(text.length + 1);
    for (const { start, end } of generic) for (let i = start; i < end; i++) if (genericEnd[i] < end) genericEnd[i] = end;
  }
  const kept = candidates.filter(({ start, end, droppable }) => {
    if (labelPrefix && labelPrefix[end] - labelPrefix[start] > 0) return false;
    if (droppable && genericEnd && genericEnd[start] >= end) return false;
    return true;
  });
  if (kept.length === 0) return null;

  // 겹치는 구간을 합친다. 먼저 시작하는 것, 시작이 같으면 긴 것, 그다음 종류 순서로 정렬해 첫 후보가 구간의 종류를 정한다
  kept.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start) || TYPE_ORDER[a.type] - TYPE_ORDER[b.type]);
  const groups: { start: number; end: number; type: MaskType }[] = [];
  for (const c of kept) {
    const last = groups[groups.length - 1];
    if (last && c.start < last.end) {
      if (c.end > last.end) last.end = c.end;
    } else {
      groups.push({ start: c.start, end: c.end, type: c.type });
    }
  }

  let out = "";
  let at = 0;
  for (const g of groups) {
    out += text.slice(at, g.start) + LABEL_OF[g.type];
    at = g.end;
  }
  out += text.slice(at);
  return { text: out, found: groups.map((g) => g.type) };
}

export function blind<T extends Section>(sections: T[]): BlindResult<T> {
  const counts = new Map<string, number>();
  const bump = (type: string) => counts.set(type, (counts.get(type) ?? 0) + 1);

  // (1) 문서 전체에서 학생 이름과 학교·대학 이름을 모은다
  const names: StudentName[] = [];
  const addName = (name: StudentName) => {
    // 같은 이름이 다른 줄에 다른 띄어쓰기로 적혀 있으면 띄어 적힌 꼴만 더한다
    const same = names.find((n) => n.english === name.english && n.text === name.text);
    if (same) name.spaced.forEach((s) => same.spaced.add(s));
    else if (names.length < MAX_NAMES) names.push(name);
  };
  const legacy = legacyStudentName(sections.find(isIdentity));
  if (legacy) names.push({ text: legacy, english: false, spaced: new Set() });

  const fromIdentity = new Map<Kind, string[]>(KINDS.map((k) => [k, []]));
  for (const section of sections.filter(isIdentity)) {
    for (const line of section.text.split("\n")) {
      const parts = splitLine(line);
      if (!parts) continue;
      const key = parts.key.replace(/\s+/g, "");
      if (key.includes("성명") || key.includes("이름")) readNames(parts.value).forEach(addName);
      if (key.includes("학교")) {
        const institution = readInstitution(parts.value);
        if (institution) pushLimited(fromIdentity.get(institution.kind) ?? [], institution.name, MAX_KNOWN);
      }
    }
  }

  // 파생형을 만드는 이름: 인적·학적사항에서 읽은 이름이 먼저, 그다음 문서 전체의 기본 꼴 낱말(종류를 가리키는 낱말 제외)
  const texts = sections.flatMap((s) => (typeof s.subject === "string" ? [s.text, s.subject] : [s.text]));
  const studentNames = nameSources(names);
  const looseNames = nameSources(names, true);
  const rules: Rules = {
    label: new RegExp(LABELS.map(escapeRegExp).join("|"), "g"),
    fromIdentity: new Map(),
    literal: new Map(),
    strict: {
      residentNo: new RegExp(RESIDENT_NO_SOURCE, "g"),
      phone: new RegExp(PHONE_SOURCE, "g"),
      koreanName: safeRegExp(studentNames.korean, "g"),
      englishName: safeRegExp(studentNames.english, "gi"),
      derived: new Map(),
    },
    // 마지막 회차용: 주민등록번호·구분자 없는 전화번호의 앞뒤 숫자 경계, 한글 2자 이름의 앞뒤 조건, 영문 이름의 앞뒤 경계,
    // 파생형의 앞뒤 조건을 두지 않는다(그 밖의 조건은 같다)
    loose: {
      residentNo: new RegExp(RESIDENT_NO_LOOSE_SOURCE, "g"),
      phone: new RegExp(PHONE_LOOSE_SOURCE, "g"),
      koreanName: safeRegExp(looseNames.korean, "g"),
      englishName: safeRegExp(looseNames.english, "gi"),
      derived: new Map(),
    },
  };
  for (const kind of KINDS) {
    const identityNames = fromIdentity.get(kind) ?? [];
    rules.fromIdentity.set(kind, new Set(identityNames));
    // 낱말 하나와 같은 꼴이 아닌 이름(여러 낱말, 기호, 앞부분이 너무 길거나 짧은 이름)은 글자 그대로 맞춘다
    const literal = identityNames.filter((name) => !kind.word.test(name)).sort((a, b) => b.length - a.length);
    rules.literal.set(kind, phraseRule(literal.length > 0 ? literal.map(wordsSource).join("|") : null, literal.map((name) => phraseOf(name)), false));
    const derivable = identityNames.slice(0, MAX_KNOWN);
    for (const text of texts) {
      if (derivable.length >= MAX_KNOWN) break;
      for (const { word } of findWords(text, kind)) {
        if (derivable.length >= MAX_KNOWN) break;
        if (!kind.generic.test(word)) pushLimited(derivable, word, MAX_KNOWN);
      }
    }
    rules.strict.derived.set(kind, derivedRule(derivable, kind));
    rules.loose.derived.set(kind, derivedRule(derivable, kind, true));
  }

  const maskText = (text: string) => {
    let out = text;
    for (let round = 0; round < MAX_ROUNDS; round++) {
      let next = maskOnce(out, rules, rules.strict);
      // 10번째 회차: 경계 조건을 지킨 채 모은 후보가 없으면 9번째 회차의 결과로 끝낸다.
      // 하나라도 있으면 그때만 이 회차를 경계 조건 없이 다시 모아 가리고 끝낸다
      if (next && round === MAX_ROUNDS - 1) next = maskOnce(out, rules, rules.loose);
      if (!next) break;
      next.found.forEach(bump);
      out = next.text;
    }
    return out;
  };

  // 인적·학적사항: 줄마다 값을 [블라인드] 로 바꾸고 남기는 항목 이름 부분도 가린다.
  // 값이 이미 [블라인드] 인 줄은 값 쪽을 그대로 두고 항목 이름만 가린다(인적·학적사항으로는 세지 않는다).
  // 빈 줄과 줄 전체가 [블라인드] 인 줄은 그대로 둔다. 콜론이 없는 줄은 줄 전체가 [블라인드] 다.
  const maskIdentity = (text: string) =>
    text
      .split("\n")
      .map((line) => {
        if (line.trim() === "" || line.trim() === BLINDED) return line;
        const parts = splitLine(line);
        if (!parts) {
          bump("인적·학적사항");
          return BLINDED;
        }
        const key = maskText(parts.key);
        if (parts.value.trim() === BLINDED) return `${key}${line.slice(parts.key.length)}`;
        bump("인적·학적사항");
        return `${key}: ${BLINDED}`;
      })
      .join("\n");

  // (2) 항목마다 가린다
  const result = sections.map((section): T => {
    const masked = { ...section, text: isIdentity(section) ? maskIdentity(section.text) : maskText(section.text) };
    return typeof section.subject === "string" ? { ...masked, subject: maskText(section.subject) } : masked;
  });

  return { sections: result, masks: [...counts].map(([type, count]) => ({ type, count })) };
}
