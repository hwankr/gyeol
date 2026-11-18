/**
 * 블라인드 처리: 지원자를 식별할 수 있는 정보를 가린다.
 *
 * AI에 보내기 전, 그리고 화면에 보내기 전에 서버에서 실행한다.
 * 가려진 자리에는 "[이름]", "[학교명]" 같은 표시가 들어가고, 원래 값은 결과에 남지 않는다.
 *
 * 규칙으로 찾을 수 있는 것만 가린다:
 *   - 인적·학적사항 항목의 값 전체
 *   - 인적·학적사항에서 읽은 학생 이름이 다른 항목에 나온 경우
 *   - 학교 이름(○○고등학교, ○○중학교, ○○초등학교), 대학 이름(○○대학교)
 *   - 주민등록번호, 전화번호 모양의 숫자
 * 축제명, 기숙사명, 교사 이름, 기업·기관명처럼 문맥을 봐야 아는 것은 가리지 못한다.
 */
import type { Section } from "@/types/analysis";

export type MaskSummary = { type: string; count: number };
export type BlindResult<T extends Section> = { sections: T[]; masks: MaskSummary[] };

const SCHOOL = /[가-힣A-Za-z0-9]{1,15}(?:고등학교|중학교|초등학교)/g;
const UNIVERSITY = /[가-힣A-Za-z]{2,12}대학교/g;
const RESIDENT_NO = /\d{6}\s*-\s*[\d*●○]{7}/g;
const PHONE = /0\d{1,2}[-.)\s]\s?\d{3,4}[-.\s]\d{4}/g;

/** 특정 학교가 아니라 학교의 종류를 가리키는 말은 가리지 않는다 */
const GENERIC_SCHOOL = /^(일반|일반계|특성화|특수목적|자율형사립|자율형공립|자율|마이스터|인문계|전문계|실업계|남자|여자|공립|사립|국립|대안|해당|다른|타|인근|지역|출신|상급)(고등학교|중학교|초등학교)$/;
const GENERIC_UNIVERSITY = /^(종합|국립|사립|공립|일반|지방|지역|수도권|해외|외국|희망|지원|해당|다른|타|4년제|전문)대학교$/;

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const isIdentity = (s: Section) => s.fieldId === "S01" || s.category === "인적·학적사항";

/** 인적·학적사항에서 학생 이름을 읽는다. "성명 / 성별: 홍길동(가명) / 남" 같은 줄을 기대한다 */
function readStudentName(identity: Section | undefined): string | null {
  if (!identity) return null;
  for (const line of identity.text.split("\n")) {
    const at = line.indexOf(":");
    if (at === -1 || !line.slice(0, at).includes("성명")) continue;
    const value = line.slice(at + 1).split("/")[0].replace(/\(.*?\)/g, "").trim();
    if (/^[가-힣]{2,5}$/.test(value)) return value;
  }
  return null;
}

export function blind<T extends Section>(sections: T[]): BlindResult<T> {
  const counts = new Map<string, number>();
  const bump = (type: string, n = 1) => counts.set(type, (counts.get(type) ?? 0) + n);

  const name = readStudentName(sections.find(isIdentity));
  const nameRule = name ? new RegExp(escapeRegExp(name), "g") : null;

  const maskText = (text: string) => {
    let out = text;
    const apply = (rule: RegExp, label: string, type: string, keep?: (m: string) => boolean) => {
      out = out.replace(rule, (m) => {
        if (keep?.(m)) return m;
        bump(type);
        return label;
      });
    };
    apply(RESIDENT_NO, "[주민등록번호]", "주민등록번호");
    apply(PHONE, "[전화번호]", "전화번호");
    if (nameRule) apply(nameRule, "[이름]", "이름");
    apply(SCHOOL, "[학교명]", "학교명", (m) => GENERIC_SCHOOL.test(m));
    apply(UNIVERSITY, "[대학명]", "대학명", (m) => GENERIC_UNIVERSITY.test(m));
    return out;
  };

  const result = sections.map((section) => {
    if (isIdentity(section)) {
      // 인적·학적사항은 항목 이름만 남기고 값을 모두 가린다
      const lines = section.text.split("\n").map((line) => {
        const at = line.indexOf(":");
        if (line.includes("[블라인드]")) return line;
        bump("인적·학적사항");
        return at === -1 ? "[블라인드]" : `${line.slice(0, at)}: [블라인드]`;
      });
      return { ...section, text: lines.join("\n") };
    }
    return { ...section, text: maskText(section.text) };
  });

  return { sections: result, masks: [...counts].map(([type, count]) => ({ type, count })) };
}
