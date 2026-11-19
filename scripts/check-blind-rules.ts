// 블라인드 규칙 사례 검사. 실행(저장소 루트에서): npx --yes tsx scripts/check-blind-rules.ts
// (node scripts/check-blind-rules.ts 로도 같은 결과가 나온다.)
//
// 지어낸 입력으로 blind(lib/pipeline/blind.ts)를 돌려, 사례마다 기대한 출력(text, subject, masks)과 비교한다.
// 검사하는 것: 인적·학적사항 가리기, 학생 이름(한글·영문, 띄어 쓴 성명, 전각 콜론, 두 글자 이름의 경계),
// 학교·대학 이름(기본 꼴, 종류를 가리키는 말, 여러 낱말 이름, 띄어 쓴 꼴, 줄임말, 앞에 붙은 낱말),
// 주민등록번호·전화번호, 과목명(subject), 규칙의 한계(가리지 못하는 것이 그대로 남는지), 빈 입력.
// 사례마다 멱등(출력을 다시 blind 에 넣으면 text·subject 가 그대로이고 masks 가 [])과 입력을 바꾸지 않는지도 본다.
//
// 가상 학생부(samples/virtual-student-record.pdf)는 이름·학교명이 AI 에 보내지 않는 항목(인적·학적사항, 봉사활동실적)에만 있어서,
// scripts/check-blind.ts 로는 서술형 항목(자율활동 등)의 이름·학교명이 가려지는지 확인되지 않는다. 이 사례들이 그 경로를 대신 확인한다.
// 사례의 이름·학교·대학은 모두 지어낸 것이다(실제 인물·학교·대학이 아니다). 그래서 실패하면 기대와 실제를 그대로 출력한다.
//
// 사례마다 "통과"/"실패" 와 사례 이름을 한 줄씩 출력한다. 전부 통과하면 종료 코드 0, 하나라도 실패하면 1.
// node 로 직접(타입 제거 실행) 돌도록 값 import 는 상대 경로에 .ts 확장자를 붙인다.
import type { Section } from "@/types/analysis";
import { blind } from "../lib/pipeline/blind.ts";

type Masks = { type: string; count: number }[];

/** 사례: 인적·학적사항(identity)·자율활동 본문(body)·그 항목의 과목(subject) 입력과 기대 출력. 기대 출력을 적지 않은 필드는 입력 그대로다 */
type RuleCase = {
  name: string;
  identity?: string;
  body?: string;
  subject?: string;
  expect: { identity?: string; body?: string; subject?: string; masks: Masks };
};

/** 항목을 직접 주는 사례(빈 입력 등) */
type RawCase = { name: string; sections: Section[]; expect: { sections: Section[]; masks: Masks } };

const m = (type: string, count: number) => ({ type, count });
const IDENTITY = "인적·학적사항";
/** G4 에 쓰는 지어낸 영문 성명 20개 (Nori Aev … Nori Tev) */
const FAKE_ENGLISH_NAMES = Array.from({ length: 20 }, (_, i) => `Nori ${String.fromCharCode(65 + i)}ev`);
/** H8 에 쓰는 아주 긴 값: 지어낸 영문 낱말 10,000개, 낱말 10,000개 뒤에 " 가상고등학교" */
const LONG_ENGLISH_NAME = Array.from({ length: 10000 }, (_, i) => `Nori${String.fromCharCode(97 + (i % 26))}`).join(" ");
const LONG_SCHOOL_VALUE = `${Array.from({ length: 10000 }, () => "예시").join(" ")} 가상고등학교`;
/**
 * K4·K5 의 본문: 학교 이름(예시A고등학교 …)을 ", " 로 나열한 뒤 ". " 다음에 같은 학교들의 띄어 쓴 꼴(예시A 고등학교 …)을 붙여 쓰고
 * " / 하늘색" 으로 끝낸다. 띄어 쓴 꼴은 앞 글자가 가려져야 앞 경계가 풀리므로 한 회차에 하나씩 가려진다(학교 수 = 회차 수).
 */
const rounds = (letters: string) =>
  `${[...letters].map((c) => `예시${c}고등학교`).join(", ")}. ${[...letters].map((c) => `예시${c} 고등학교`).join("")} / 하늘색`;

const CASES: RuleCase[] = [
  {
    name: "N1 이름과 조사",
    identity: "성명 / 성별: 김민준(가명) / 남",
    body: "김민준은 김민준과 발표했다.",
    expect: { identity: "성명 / 성별: [블라인드]", body: "[이름]은 [이름]과 발표했다.", masks: [m(IDENTITY, 1), m("이름", 2)] },
  },
  {
    name: "N2 띄어 쓴 성명",
    identity: "성명: 김 민준",
    body: "김민준이 기록함. 김 민준이 발표함.",
    expect: { identity: "성명: [블라인드]", body: "[이름]이 기록함. [이름]이 발표함.", masks: [m(IDENTITY, 1), m("이름", 2)] },
  },
  {
    name: "N3 전각 콜론",
    identity: "성명：김민준",
    body: "김민준이 발표했다.",
    expect: { identity: "성명: [블라인드]", body: "[이름]이 발표했다.", masks: [m(IDENTITY, 1), m("이름", 1)] },
  },
  {
    name: "N4 띄어 쓴 항목 이름, 괄호",
    identity: "성 명: 김민준(金民俊)",
    body: "김민준의 발표",
    expect: { identity: "성 명: [블라인드]", body: "[이름]의 발표", masks: [m(IDENTITY, 1), m("이름", 1)] },
  },
  {
    name: "N5 영문 이름",
    identity: "성명: Nori Qev",
    body: "Nori Qev가 기록함. NORI  QEV 와 Qev Nori 는 같은 사람이다. Norikov 는 다른 낱말이다.",
    expect: {
      identity: "성명: [블라인드]",
      body: "[이름]가 기록함. [이름] 와 [이름] 는 같은 사람이다. Norikov 는 다른 낱말이다.",
      masks: [m(IDENTITY, 1), m("이름", 3)],
    },
  },
  {
    name: "N5-2 영문 이름(쉼표로 순서를 바꾼 꼴)",
    identity: "성명: Nori Qev",
    body: "Qev, Nori 가 정리함.",
    expect: { identity: "성명: [블라인드]", body: "[이름] 가 정리함.", masks: [m(IDENTITY, 1), m("이름", 1)] },
  },
  {
    name: "N6 두 글자 이름",
    identity: "성명: 하늘",
    body: "하늘색과 하늘의 색을 비교함. 하늘이 발표함. 가을하늘을 그림. 하늘 학생이 정리함. 하늘에서는 조용함.",
    expect: {
      identity: "성명: [블라인드]",
      body: "하늘색과 [이름]의 색을 비교함. [이름]이 발표함. 가을하늘을 그림. [이름] 학생이 정리함. [이름]에서는 조용함.",
      masks: [m(IDENTITY, 1), m("이름", 4)],
    },
  },
  {
    name: "N6-2 두 글자 이름 뒤에 목록에 더한 조사(이나, 한테서, 에게서)",
    identity: "성명: 하늘",
    body: "하늘이나 하늘한테서 들은 말을 하늘에게서 전해 들음.",
    expect: {
      identity: "성명: [블라인드]",
      body: "[이름]이나 [이름]한테서 들은 말을 [이름]에게서 전해 들음.",
      masks: [m(IDENTITY, 1), m("이름", 3)],
    },
  },
  {
    name: "N7 표시와 값이 섞인 줄",
    identity: "성명 / 성별: 김민준 / [블라인드]",
    body: "김민준은 발표했다.",
    expect: { identity: "성명 / 성별: [블라인드]", body: "[이름]은 발표했다.", masks: [m(IDENTITY, 1), m("이름", 1)] },
  },
  {
    name: "N8 이미 가린 인적사항",
    identity: "성명 / 성별: [블라인드]\n[블라인드]",
    body: "발표했다.",
    expect: { masks: [] },
  },
  {
    name: "N9 (한계) 성명 줄 없음",
    identity: "학교: 가상고등학교",
    body: "김민준이 기록함.",
    expect: { identity: "학교: [블라인드]", masks: [m(IDENTITY, 1)] },
  },
  {
    name: "N10 (한계) 성을 뺀 이름",
    identity: "성명: 김민준",
    body: "민준이는 성실함.",
    expect: { identity: "성명: [블라인드]", masks: [m(IDENTITY, 1)] },
  },
  {
    name: "N11 성명에 적힌 띄어쓰기",
    identity: "성명: 남궁 민수",
    body: "남궁 민수가 발표함. 남궁민수의 기록. 남 궁민수도 참여함.",
    expect: {
      identity: "성명: [블라인드]",
      body: "[이름]가 발표함. [이름]의 기록. [이름]도 참여함.",
      masks: [m(IDENTITY, 1), m("이름", 3)],
    },
  },
  {
    name: "N12 성명 뒤에 붙은 성별",
    identity: "성명: 김민준 남",
    body: "김민준이 발표함.",
    expect: { identity: "성명: [블라인드]", body: "[이름]이 발표함.", masks: [m(IDENTITY, 1), m("이름", 1)] },
  },
  {
    name: "N13 두 글자 이름을 띄어 적은 경우",
    identity: "성명: 김 남",
    body: "김남이 발표함. 김 남 학생이 정리함. 김남매가 함께 옴.",
    expect: {
      identity: "성명: [블라인드]",
      body: "[이름]이 발표함. [이름] 학생이 정리함. 김남매가 함께 옴.",
      masks: [m(IDENTITY, 1), m("이름", 2)],
    },
  },
  {
    name: "S1 기본",
    body: "가상고등학교와 가상중학교, 가상초등학교를 방문함. 일반고등학교와 특성화고등학교의 차이를 조사함.",
    expect: {
      body: "[학교명]와 [학교명], [학교명]를 방문함. 일반고등학교와 특성화고등학교의 차이를 조사함.",
      masks: [m("학교명", 3)],
    },
  },
  {
    name: "S2 띄어 쓴 꼴과 줄임말",
    identity: "학교 / 학과: 가상고등학교 / 일반학과",
    body: "가상 고등학교 축제에 참여함. 가상고 대표로 출전함. 가상고교 학생회에서 활동함. 가상고의 전통을 조사함.",
    expect: {
      identity: "학교 / 학과: [블라인드]",
      body: "[학교명] 축제에 참여함. [학교명] 대표로 출전함. [학교명] 학생회에서 활동함. [학교명]의 전통을 조사함.",
      masks: [m(IDENTITY, 1), m("학교명", 4)],
    },
  },
  {
    name: "S3 줄임말과 같은 글자로 시작하는 낱말",
    identity: "학교 / 학과: 가상고등학교 / 일반학과",
    body: "가상고객을 설정하고 가상현실을 체험함. 가상 구매 사례를 분석함.",
    expect: { identity: "학교 / 학과: [블라인드]", masks: [m(IDENTITY, 1)] },
  },
  {
    name: "S4 여러 낱말로 된 학교 이름",
    identity: "학교 / 학과: 예시 가상고등학교 / 일반학과",
    body: "예시 가상고등학교에 재학 중이다. 가상고등학교 대표로 출전함.",
    expect: {
      identity: "학교 / 학과: [블라인드]",
      body: "[학교명]에 재학 중이다. [학교명] 대표로 출전함.",
      masks: [m(IDENTITY, 1), m("학교명", 2)],
    },
  },
  {
    name: "S5 앞에 붙은 낱말",
    identity: "학교: 가상고등학교",
    body: "재학한가상고등학교를 방문함.",
    expect: { identity: "학교: [블라인드]", body: "재학한[학교명]를 방문함.", masks: [m(IDENTITY, 1), m("학교명", 1)] },
  },
  {
    name: "S6 (한계) 전체 이름이 없는 줄임말",
    body: "가상고 대표로 출전함. 가상 고등학교 축제.",
    expect: { masks: [] },
  },
  {
    name: "S7 여자고등학교",
    identity: "학교: 가상여자고등학교",
    body: "가상여고 대표로 출전함. 가상여자고 학생회.",
    expect: { identity: "학교: [블라인드]", body: "[학교명] 대표로 출전함. [학교명] 학생회.", masks: [m(IDENTITY, 1), m("학교명", 2)] },
  },
  {
    name: "S8 본문에서 찾은 전체 이름",
    body: "가상중학교를 졸업함. 가상중 재학 시절 봉사활동을 시작함.",
    expect: { body: "[학교명]를 졸업함. [학교명] 재학 시절 봉사활동을 시작함.", masks: [m("학교명", 2)] },
  },
  {
    name: "S9 종류를 가리키는 학교 이름은 줄임말을 만들지 않음",
    identity: "학교: 일반고등학교",
    body: "일반고 학생과 일반 고등학교 진학 상담을 함.",
    expect: { identity: "학교: [블라인드]", masks: [m(IDENTITY, 1)] },
  },
  {
    name: "U1 기본",
    body: "예시대학교에 진학을 희망함. 국립대학교와 사립대학교를 비교함.",
    expect: { body: "[대학명]에 진학을 희망함. 국립대학교와 사립대학교를 비교함.", masks: [m("대학명", 1)] },
  },
  {
    name: "U2 종류를 가리키는 말",
    body: "4년제대학교 / 국립대학교 / 일반고등학교 / 4년제 대학교",
    expect: { masks: [] },
  },
  {
    name: "U3 띄어 쓴 꼴과 줄임말",
    body: "예시대학교 탐방. 예시 대학교 교수 강연. 예시대 캠프 참가. 예시대학 연구실 방문. 예시대의 전공 안내.",
    expect: {
      body: "[대학명] 탐방. [대학명] 교수 강연. [대학명] 캠프 참가. [대학명] 연구실 방문. [대학명]의 전공 안내.",
      masks: [m("대학명", 5)],
    },
  },
  {
    name: "U4 (한계) 전체 이름이 없는 줄임말",
    body: "예시대 캠프 참가. 예시대학 연구실 방문.",
    expect: { masks: [] },
  },
  {
    name: "P1 구분자 있는 전화번호",
    body: "연락처 010-1234-5678, 02) 123-4567, 031.123.4567",
    expect: { body: "연락처 [전화번호], [전화번호], [전화번호]", masks: [m("전화번호", 3)] },
  },
  {
    name: "P2 구분자 없는 전화번호",
    body: "전화 01012345678, 0212345678, 07012345678",
    expect: { body: "전화 [전화번호], [전화번호], [전화번호]", masks: [m("전화번호", 3)] },
  },
  {
    name: "P3 전화번호가 아닌 숫자",
    body: "학번 2024123456, 날짜 20240304, 일련번호 1234567890123, 점수 0.12345678",
    expect: { masks: [] },
  },
  {
    name: "R1 주민등록번호",
    body: "050101-3123456 / 050101-3****** / 050101 - 4123456",
    expect: { body: "[주민등록번호] / [주민등록번호] / [주민등록번호]", masks: [m("주민등록번호", 3)] },
  },
  {
    name: "R2 주민등록번호가 아닌 번호",
    body: "품목번호 000000-0000000, 991332-1234567, 050101-9123456",
    expect: { masks: [] },
  },
  {
    name: "F1 과목명의 학교",
    subject: "가상고등학교 공동수업",
    body: "가상고등학교 공동수업에 참여함.",
    expect: { subject: "[학교명] 공동수업", body: "[학교명] 공동수업에 참여함.", masks: [m("학교명", 2)] },
  },
  {
    name: "F2 과목명의 이름",
    identity: "성명: 김민준",
    subject: "김민준 탐구",
    body: "탐구함.",
    expect: { identity: "성명: [블라인드]", subject: "[이름] 탐구", masks: [m(IDENTITY, 1), m("이름", 1)] },
  },
  {
    name: "C0 서술형 항목에 섞인 경우",
    identity: "성명 / 성별: 김민준(가명) / 남\n학교 / 학과: 가상고등학교 / 일반학과",
    body: "연결검증 김민준은 가상고등학교에서 예시대학교에 010-1234-5678로 문의했다.",
    expect: {
      identity: "성명 / 성별: [블라인드]\n학교 / 학과: [블라인드]",
      body: "연결검증 [이름]은 [학교명]에서 [대학명]에 [전화번호]로 문의했다.",
      // 한 글 안에서는 왼쪽 구간부터 센다(구간 방식): 이름 → 학교명 → 대학명 → 전화번호
      masks: [m(IDENTITY, 2), m("이름", 1), m("학교명", 1), m("대학명", 1), m("전화번호", 1)],
    },
  },
  {
    name: "L1 (한계) 문맥 기반 고유명",
    identity: "학교: 가상고등학교",
    body: "가상솔빛제와 가상솔빛관을 방문함.",
    expect: { identity: "학교: [블라인드]", masks: [m(IDENTITY, 1)] },
  },
  {
    name: "X1 이웃한 표시(학교 이름을 먼저 가린 뒤 그 표시 앞의 두 글자 이름도 가림)",
    identity: "성명: 하늘\n학교: 가상고등학교",
    body: "하늘가상고등학교 행사에 참여함.",
    expect: {
      identity: "성명: [블라인드]\n학교: [블라인드]",
      body: "[이름][학교명] 행사에 참여함.",
      masks: [m(IDENTITY, 2), m("학교명", 1), m("이름", 1)],
    },
  },
  {
    name: "G1 대학 이름 안의 이름",
    identity: "성명: 김 민준",
    body: "예시김민준대학교 교류",
    expect: { identity: "성명: [블라인드]", body: "[대학명] 교류", masks: [m(IDENTITY, 1), m("대학명", 1)] },
  },
  {
    name: "G2 대학 이름 앞의 학교 줄임말",
    identity: "학교: 가상고등학교",
    body: "가상고A대학교 교류",
    expect: { identity: "학교: [블라인드]", body: "[대학명] 교류", masks: [m(IDENTITY, 1), m("대학명", 1)] },
  },
  {
    name: "G3 섞인 괄호",
    identity: "성명: 김민준(가명（기록용）)",
    body: "김민준이 발표했다.",
    expect: { identity: "성명: [블라인드]", body: "[이름]이 발표했다.", masks: [m(IDENTITY, 1), m("이름", 1)] },
  },
  {
    name: "G4 이름 상한(기준 커밋이 읽던 이름은 상한과 상관없이 가림)",
    identity: [...FAKE_ENGLISH_NAMES.map((n) => `성명: ${n}`), "성명: 김민준"].join("\n"),
    body: "김민준이 기록함.",
    expect: {
      identity: Array.from({ length: FAKE_ENGLISH_NAMES.length + 1 }, () => "성명: [블라인드]").join("\n"),
      body: "[이름]이 기록함.",
      masks: [m(IDENTITY, FAKE_ENGLISH_NAMES.length + 1), m("이름", 1)],
    },
  },
  {
    name: "G5 항목 이름에 든 학교 이름",
    identity: "학교: 가상고등학교\n예시가상고등학교 확인: 완료",
    body: "예시가상고 공동수업",
    expect: {
      identity: "학교: [블라인드]\n예시[학교명] 확인: [블라인드]",
      body: "[학교명] 공동수업",
      masks: [m(IDENTITY, 2), m("학교명", 2)],
    },
  },
  {
    name: "G6 종류를 가리키는 말의 안쪽",
    body: "문계고등학교 / 전문계고등학교와 인문계고등학교 / 년제대학교 / 4년제대학교",
    expect: {
      body: "[학교명] / 전문계고등학교와 인문계고등학교 / [대학명] / 4년제대학교",
      masks: [m("학교명", 1), m("대학명", 1)],
    },
  },
  {
    name: "G7 자모 경계",
    identity: "성명: 하늘\n학교: 가상고등학교",
    body: "ㄱ하늘 / 하늘ㅂ / ㄱ가상고 / ㄱ가상 고등학교",
    expect: { identity: "성명: [블라인드]\n학교: [블라인드]", masks: [m(IDENTITY, 2)] },
  },
  {
    name: "G8 끊긴 접미사",
    identity: "학교: 가상고등 학 교",
    body: "가상고등 학 교 방문",
    expect: { identity: "학교: [블라인드]", masks: [m(IDENTITY, 1)] },
  },
  {
    name: "G9 인적·학적사항에 적힌 긴 이름(적힌 그대로 통째로 가림)",
    identity: "학교: 재학한가상고등학교",
    body: "가상고등학교 및 재학한가상고등학교",
    expect: { identity: "학교: [블라인드]", body: "[학교명] 및 [학교명]", masks: [m(IDENTITY, 1), m("학교명", 2)] },
  },
  {
    name: "G10 본문에서 찾은 이름끼리는 앞 낱말을 남기지 않음",
    body: "가상고등학교 및 재학한가상고등학교 / 예시대학교 및 탐방한예시대학교",
    expect: { body: "[학교명] 및 [학교명] / [대학명] 및 [대학명]", masks: [m("학교명", 2), m("대학명", 2)] },
  },
  {
    name: "G11 항목 이름에 든 이름과 번호",
    identity: "성명: 김민준\n김민준 연락처 010-1234-5678: 확인",
    expect: {
      identity: "성명: [블라인드]\n[이름] 연락처 [전화번호]: [블라인드]",
      // 항목 이름 안에서는 왼쪽 구간부터 센다(구간 방식): 이름 → 전화번호
      masks: [m(IDENTITY, 2), m("이름", 1), m("전화번호", 1)],
    },
  },
  {
    name: "H1 번호가 든 학교 낱말",
    body: "예시01012345678중학교 방문",
    expect: { body: "[학교명] 방문", masks: [m("학교명", 1)] },
  },
  {
    name: "H2 학교 낱말 끝과 겹치는 이름",
    identity: "성명: 교가람",
    body: "가상고등학교가람 방문",
    expect: { identity: "성명: [블라인드]", body: "[학교명] 방문", masks: [m(IDENTITY, 1), m("학교명", 1)] },
  },
  {
    name: "H3 이름과 인적·학적사항 학교 이름이 겹침",
    identity: "성명: 모래예시\n학교: 예시가상고등학교",
    body: "모래예시가상고등학교 방문",
    expect: { identity: "성명: [블라인드]\n학교: [블라인드]", body: "[이름] 방문", masks: [m(IDENTITY, 2), m("이름", 1)] },
  },
  {
    name: "H4 종류어로 시작하는 긴 이름",
    body: "국립대학교부설가상중학교 / 일반고등학교중학교",
    expect: { body: "[학교명] / [학교명]", masks: [m("학교명", 2)] },
  },
  {
    name: "H5 인적·학적사항 이름에 이어진 더 긴 낱말",
    identity: "학교: 가대학교",
    body: "가대학교X대학교 교류",
    expect: { identity: "학교: [블라인드]", body: "[대학명] 교류", masks: [m(IDENTITY, 1), m("대학명", 1)] },
  },
  {
    name: "H5-2 여러 낱말 이름에 이어진 더 긴 낱말",
    identity: "학교: 예시 가상대학교",
    body: "예시 가상대학교X대학교 교류",
    expect: { identity: "학교: [블라인드]", body: "[대학명] 교류", masks: [m(IDENTITY, 1), m("대학명", 1)] },
  },
  {
    name: "H6 학교와 대학이 함께 든 인적·학적사항 이름",
    identity: "학교: 예시중학교 부설가상대학교",
    body: "예시중학교 부설가상대학교 방문",
    expect: { identity: "학교: [블라인드]", body: "[대학명] 방문", masks: [m(IDENTITY, 1), m("대학명", 1)] },
  },
  {
    name: "H6-2 기호가 든 인적·학적사항 이름",
    identity: "학교: 가상중학교 부설+예시대학교",
    body: "가상중학교 부설+예시대학교 방문",
    expect: { identity: "학교: [블라인드]", body: "[대학명] 방문", masks: [m(IDENTITY, 1), m("대학명", 1)] },
  },
  {
    name: "H7 이름이 든 학교의 띄어 쓴 꼴",
    identity: "성명: 김민준\n학교: 김민준가상고등학교",
    body: "김민준가상 고등학교 방문",
    expect: { identity: "성명: [블라인드]\n학교: [블라인드]", body: "[학교명] 방문", masks: [m(IDENTITY, 2), m("학교명", 1)] },
  },
  {
    name: "H8 아주 긴 값(영문 성명 낱말 10,000개, 학교 값 낱말 10,000개)",
    identity: `성명: ${LONG_ENGLISH_NAME}\n학교: ${LONG_SCHOOL_VALUE}`,
    body: "가상고등학교 방문",
    expect: { identity: "성명: [블라인드]\n학교: [블라인드]", body: "[학교명] 방문", masks: [m(IDENTITY, 2), m("학교명", 1)] },
  },
  {
    name: "J1 종류어 양끝에 걸친 두 이름",
    identity: "성명: 특수목\n이름: 학교모래",
    body: "특수목적고등학교모래 방문",
    expect: { identity: "성명: [블라인드]\n이름: [블라인드]", body: "[학교명] 방문", masks: [m(IDENTITY, 2), m("학교명", 1)] },
  },
  {
    name: "J2 종류어와 같은 글자로 시작하는 이름",
    identity: "성명: 인문계",
    body: "인문계고등학교 진학. 인문계 학생이 발표함. 일반고등학교 진학.",
    expect: {
      identity: "성명: [블라인드]",
      body: "[학교명] 진학. [이름] 학생이 발표함. 일반고등학교 진학.",
      masks: [m(IDENTITY, 1), m("학교명", 1), m("이름", 1)],
    },
  },
  {
    name: "J3 붙여 쓴 주민등록번호 12개(10번째 회차는 경계 없이)",
    body: "050101-3******".repeat(12),
    expect: { body: "[주민등록번호]".repeat(12), masks: [m("주민등록번호", 12)] },
  },
  {
    name: "J4 붙여 쓴 띄어 쓴 학교 이름 12개(10번째 회차는 경계 없이)",
    identity: "학교: 가상고등학교",
    body: "가상 고등학교".repeat(12),
    expect: { identity: "학교: [블라인드]", body: "[학교명]".repeat(12), masks: [m(IDENTITY, 1), m("학교명", 12)] },
  },
  {
    name: "J5 기호로 이은 영문 이름",
    identity: "성명: Qev-Nori",
    body: "Qev-Nori / Nori Qev / Nori, Qev / Nori-Qev / Norikov",
    expect: { identity: "성명: [블라인드]", body: "[이름] / [이름] / [이름] / [이름] / Norikov", masks: [m(IDENTITY, 1), m("이름", 4)] },
  },
  {
    name: "J6 영문 낱말 수 상한(낱말 9개는 이름으로 읽지 않음)",
    identity: "성명: Q-E-V-N-X-A-M-B-O",
    body: "Q-E-V-N-X-A-M-B-O 가 발표함.",
    expect: { identity: "성명: [블라인드]", masks: [m(IDENTITY, 1)] },
  },
  {
    name: "J7 확장 한자가 든 학교 이름",
    identity: "학교: 𠀀가상중학교",
    body: "𠀀가상중학교 방문. 𠀀가상중 대표.",
    expect: { identity: "학교: [블라인드]", body: "[학교명] 방문. [학교명] 대표.", masks: [m(IDENTITY, 1), m("학교명", 2)] },
  },
  {
    name: "J8 한 글자 앞부분은 줄임말을 만들지 않음",
    identity: "학교: 𠀀중학교",
    body: "𠀀중학교 방문. 𠀀중 대표.",
    expect: { identity: "학교: [블라인드]", body: "[학교명] 방문. 𠀀중 대표.", masks: [m(IDENTITY, 1), m("학교명", 1)] },
  },
  {
    name: "J9 원문에 있던 표시는 건드리지 않음",
    identity: "성명: 학교명",
    body: "[학교명] 방문. 학교명 학생이 발표함.",
    expect: { identity: "성명: [블라인드]", body: "[학교명] 방문. [이름] 학생이 발표함.", masks: [m(IDENTITY, 1), m("이름", 1)] },
  },
  {
    name: "K1 기호 양옆에 공백이 있는 영문 이름",
    identity: "성명: Nori - Qev - Luv - Miv - Piv",
    body: "Nori - Qev - Luv - Miv - Piv 가 발표함.",
    subject: "Nori - Qev - Luv - Miv - Piv 탐구",
    expect: { identity: "성명: [블라인드]", body: "[이름] 가 발표함.", subject: "[이름] 탐구", masks: [m(IDENTITY, 1), m("이름", 2)] },
  },
  {
    name: "K2 여덟 낱말 영문 이름과 전각 콜론 줄",
    identity: "성명: Nori Qev - Luv Miv Piv Ruv Vev Wov\nNori Qev - Luv Miv Piv Ruv Vev Wov 기록：확인",
    body: "Nori Qev - Luv Miv Piv Ruv Vev Wov 가 기록함.",
    expect: {
      identity: "성명: [블라인드]\n[이름] 기록: [블라인드]",
      body: "[이름] 가 기록함.",
      masks: [m(IDENTITY, 2), m("이름", 2)],
    },
  },
  {
    name: "K3 아홉 낱말은 이름이 아님",
    identity: "성명: Nori Qev - Luv Miv Piv Ruv Vev Wov Xav",
    body: "Nori Qev - Luv Miv Piv Ruv Vev Wov Xav 가 기록함.",
    expect: { identity: "성명: [블라인드]", masks: [m(IDENTITY, 1)] },
  },
  {
    name: "K4 정확히 아홉 번 만에 끝나는 글(하늘색은 그대로)",
    identity: "성명: 하늘",
    body: rounds("ABCDEFGHI"),
    expect: {
      identity: "성명: [블라인드]",
      body: `${Array(9).fill("[학교명]").join(", ")}. ${"[학교명]".repeat(9)} / 하늘색`,
      masks: [m(IDENTITY, 1), m("학교명", 18)],
    },
  },
  {
    name: "K5 열 번이 필요한 글(마지막 회차는 경계 없이)",
    identity: "성명: 하늘",
    body: rounds("ABCDEFGHIJ"),
    expect: {
      identity: "성명: [블라인드]",
      body: `${Array(10).fill("[학교명]").join(", ")}. ${"[학교명]".repeat(10)} / [이름]색`,
      masks: [m(IDENTITY, 1), m("학교명", 20), m("이름", 1)],
    },
  },
];

const identitySection = (text: string): Section => ({
  id: "s1",
  category: "인적·학적사항",
  grade: null,
  page: 1,
  text,
  fieldId: "S01",
});

const bodySection = (text: string, subject?: string): Section => ({
  id: "s2",
  category: "자율활동",
  grade: 1,
  page: 2,
  ...(subject === undefined ? {} : { subject }),
  text,
  fieldId: "S06.AUTO.remarks",
  hours: 10,
});

const RAW_CASES: RawCase[] = [
  { name: "E0-1 빈 입력 blind([])", sections: [], expect: { sections: [], masks: [] } },
  {
    name: "E0-2 text 가 빈 문자열인 항목",
    sections: [bodySection("")],
    expect: { sections: [bodySection("")], masks: [] },
  },
  {
    name: "E0-3 인적·학적사항이 없는 문서",
    sections: [bodySection("발표했다."), { ...bodySection("정리함.", "국어"), id: "s3" }],
    expect: { sections: [bodySection("발표했다."), { ...bodySection("정리함.", "국어"), id: "s3" }], masks: [] },
  },
  {
    name: "E0-4 text 가 빈 문자열인 인적·학적사항(빈 줄은 가리지 않음)",
    sections: [identitySection(""), bodySection("발표했다.")],
    expect: { sections: [identitySection(""), bodySection("발표했다.")], masks: [] },
  },
];

/** 사례를 입력 항목과 기대 항목으로 바꾼다 */
function toRaw(c: RuleCase): RawCase {
  const input: Section[] = [];
  const expected: Section[] = [];
  if (c.identity !== undefined) {
    input.push(identitySection(c.identity));
    expected.push(identitySection(c.expect.identity ?? c.identity));
  }
  if (c.body !== undefined) {
    input.push(bodySection(c.body, c.subject));
    expected.push(bodySection(c.expect.body ?? c.body, c.subject === undefined ? undefined : (c.expect.subject ?? c.subject)));
  }
  return { name: c.name, sections: input, expect: { sections: expected, masks: c.expect.masks } };
}

/** 필드 이름(없는 필드 포함)과 값까지 같은지 본다 */
function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => sameValue(x, b[i]));
  }
  if (typeof a === "object" && a !== null && typeof b === "object" && b !== null) {
    const ka = Object.keys(a).sort();
    const kb = Object.keys(b).sort();
    return (
      sameValue(ka, kb) &&
      ka.every((k) => sameValue((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
    );
  }
  return Object.is(a, b);
}

/** 사례 하나를 돌려 문제 목록을 돌려준다(없으면 통과) */
function runCase(c: RawCase): string[] {
  const problems: string[] = [];
  const before = JSON.stringify(c.sections);
  let actual: { sections: Section[]; masks: Masks };
  try {
    actual = blind(c.sections);
  } catch (error) {
    return [`예외: ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`];
  }
  if (!sameValue(actual.sections, c.expect.sections)) {
    problems.push(`항목이 기대와 다름\n    기대: ${JSON.stringify(c.expect.sections)}\n    실제: ${JSON.stringify(actual.sections)}`);
  }
  if (!sameValue(actual.masks, c.expect.masks)) {
    problems.push(`masks 가 기대와 다름\n    기대: ${JSON.stringify(c.expect.masks)}\n    실제: ${JSON.stringify(actual.masks)}`);
  }
  if (JSON.stringify(c.sections) !== before) problems.push("입력 항목이 바뀜");

  let again: { sections: Section[]; masks: Masks };
  try {
    again = blind(actual.sections);
  } catch (error) {
    // 두 번째 적용에서 난 예외도 이 사례의 실패로 기록하고 다음 사례로 넘어간다
    problems.push(`멱등 확인 중 예외: ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`);
    return problems;
  }
  if (!sameValue(again.sections, actual.sections)) {
    problems.push(`멱등 아님: 다시 적용하면 항목이 바뀜\n    처음: ${JSON.stringify(actual.sections)}\n    다시: ${JSON.stringify(again.sections)}`);
  }
  if (again.masks.length !== 0) problems.push(`멱등 아님: 다시 적용한 masks 가 [] 가 아님 ${JSON.stringify(again.masks)}`);
  return problems;
}

function main(): number {
  const all = [...CASES.map(toRaw), ...RAW_CASES];
  let failed = 0;
  for (const c of all) {
    const problems = runCase(c);
    if (problems.length === 0) {
      console.log(`통과  ${c.name}`);
      continue;
    }
    failed += 1;
    console.log(`실패  ${c.name}`);
    for (const problem of problems) console.log(`  - ${problem}`);
  }
  console.log("");
  if (failed > 0) {
    console.log(`블라인드 규칙 사례 ${all.length}개 중 ${failed}개 실패`);
    return 1;
  }
  console.log(`블라인드 규칙 사례 ${all.length}개 모두 통과`);
  return 0;
}

process.exitCode = main();
