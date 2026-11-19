// 학생부 서식: 「학교생활기록 작성 및 관리지침」 [별지 제8호 서식] 학교생활세부사항기록부(학교생활기록부Ⅱ) <학점제를 적용받는 학생>.
// 학생부를 항목으로 나눌 때(AI 가 쪽을 읽을 때의 지시, 받은 항목의 확인), 분석할 때(근거 추출·AI 제안이 항목이 서식의 어디인지 아는 것),
// 화면에 항목 이름을 적을 때 모두 이 정의 하나를 쓴다. 서식이 바뀌면 여기만 고친다.
// 서식은 머리 부분(번호 없음)과 번호가 붙은 아홉 항목이다. 실제 학생부는 이 서식의 빈 칸에 기록이 채워진 문서다.
// 서버 전용 코드를 가져오지 않는 순수 모듈이다(화면, API 라우트, 스크립트가 같이 쓴다).

/** 서식의 이름 (AI 지시와 화면에 쓴다) */
export const RECORD_FORM_NAME = "학교생활세부사항기록부(학교생활기록부Ⅱ)";

/** 칸의 모양: 이름과 값이 짝을 이루는 칸 / 행이 여럿인 표 / 서술형 글 */
export type RecordFormKind = "fields" | "table" | "narrative";

/** 서식의 칸 하나 (학생부 항목 하나가 여기에 속한다) */
export type RecordFormPart = {
  /** 항목 사전의 ID. 학생부 항목의 fieldId 로 쓴다 */
  id: string;
  /** 서식의 항목 번호 (1~9). 번호 없는 머리 부분과 "기타" 는 0 */
  no: number;
  /** 그 번호의 항목 이름 (서식에 적힌 제목) */
  heading: string;
  /** 항목 안에서의 묶음 이름 (서식의 <…> 제목). 없으면 빈 글 */
  group: string;
  /** 학생부 항목의 category 로 쓰는 이름 (근거 추출·AI 제안·블라인드 처리·화면이 이 이름으로 항목을 고른다) */
  category: string;
  kind: RecordFormKind;
  /** 서식에 적힌 칸 이름 (왼쪽부터) */
  columns: readonly string[];
  /** 학생부 항목 하나가 되는 단위 */
  unit: string;
  /** 원문(text)을 적는 방법 */
  text: string;
  /** 과목(subject)에 적는 것. 적지 않는 칸은 빈 글 */
  subject: string;
  /** 시간(hours)을 적는 칸인지 (창의적 체험활동상황의 영역) */
  hours: boolean;
};

const TABLE_TEXT = "첫 줄은 머리글, 그다음은 행마다 한 줄이고 칸 사이는 \" | \" 입니다. 빈 칸은 비워 둡니다.";

/** 서식의 칸 목록 (서식에 나오는 순서). 맨 끝의 "기타" 는 서식의 어느 칸에도 맞지 않는 기록이다. */
export const RECORD_FORM_PARTS: readonly RecordFormPart[] = [
  {
    id: "S00.HEADER",
    no: 0,
    heading: "머리 부분",
    group: "",
    category: "인적·학적사항",
    kind: "fields",
    columns: ["학교", "졸업 대장 번호", "학년별 학과·반·번호·담임성명", "학년·학기별 전공·과정", "사진"],
    unit: "이 쪽의 머리 부분 전체를 항목 하나로",
    text: "한 줄에 하나씩 \"칸 이름: 값\" 꼴로 적습니다(예: \"학교: …\", \"1학년: 학과 … / 반 … / 번호 … / 담임성명 …\", \"1학년 1학기 전공·과정: …\"). 사진은 옮기지 않습니다.",
    subject: "",
    hours: false,
  },
  {
    id: "S01",
    no: 1,
    heading: "인적·학적사항",
    group: "",
    category: "인적·학적사항",
    kind: "fields",
    columns: ["학생정보(성명·성별·주민등록번호)", "주소", "학적사항", "특기사항"],
    unit: "이 쪽의 인적·학적사항 전체를 항목 하나로",
    text: "한 줄에 하나씩 \"칸 이름: 값\" 꼴로 적습니다(예: \"성명: …\", \"성별: …\", \"주민등록번호: …\", \"주소: …\"). 학적사항의 기록(졸업·입학·전입 등)은 한 건마다 \"학적사항: …\", 특기사항은 \"특기사항: …\" 으로 적습니다.",
    subject: "",
    hours: false,
  },
  {
    id: "S02.ATTENDANCE",
    no: 2,
    heading: "출결상황",
    group: "",
    category: "출결상황",
    kind: "table",
    columns: [
      "학년",
      "수업일수",
      "결석일수(질병·미인정·기타)",
      "지각(질병·미인정·기타)",
      "조퇴(질병·미인정·기타)",
      "결과(질병·미인정·기타)",
      "특기사항",
    ],
    unit: "표 전체를 항목 하나로",
    text: `${TABLE_TEXT} 머리글의 두 줄(결석일수 아래의 질병·미인정·기타 등)은 "결석 질병 | 결석 미인정 | 결석 기타" 처럼 한 줄로 풀어 적고, 학년마다 한 줄입니다.`,
    subject: "",
    hours: false,
  },
  {
    id: "S03.AWARD",
    no: 3,
    heading: "수상경력",
    group: "",
    category: "수상경력",
    kind: "table",
    columns: ["학년(학기)", "수상명", "등급(위)", "수상연월일", "수여기관", "참가대상(참가인원)"],
    unit: "표 전체를 항목 하나로",
    text: `${TABLE_TEXT} 수상 한 건마다 한 줄이고, 학년과 학기는 줄마다 채워 적습니다.`,
    subject: "",
    hours: false,
  },
  {
    id: "S04.CERT",
    no: 4,
    heading: "자격증 및 인증 취득상황",
    group: "자격증 및 인증 취득상황",
    category: "자격증 및 인증 취득상황",
    kind: "table",
    columns: ["구분", "명칭 또는 종류", "번호 또는 내용", "취득연월일", "발급기관"],
    unit: "표 전체를 항목 하나로",
    text: TABLE_TEXT,
    subject: "",
    hours: false,
  },
  {
    id: "S04.NCS",
    no: 4,
    heading: "자격증 및 인증 취득상황",
    group: "국가직무능력표준 이수상황",
    category: "국가직무능력표준 이수상황",
    kind: "table",
    columns: ["학년", "학기", "세분류", "능력단위(능력단위코드)", "이수시간", "원점수", "성취도", "비고"],
    unit: "표 전체를 항목 하나로",
    text: TABLE_TEXT,
    subject: "",
    hours: false,
  },
  {
    id: "S05.ACTION",
    no: 5,
    heading: "학교폭력 조치상황 관리",
    group: "",
    category: "학교폭력 조치상황 관리",
    kind: "table",
    columns: ["학년", "조치결정 일자", "조치사항"],
    unit: "표 전체를 항목 하나로",
    text: TABLE_TEXT,
    subject: "",
    hours: false,
  },
  {
    id: "S06.AUTO.remarks",
    no: 6,
    heading: "창의적 체험활동상황",
    group: "",
    category: "자율활동",
    kind: "narrative",
    columns: ["학년", "영역(자율활동)", "시간", "특기사항"],
    unit: "학년마다 항목 하나",
    text: "특기사항 본문만 적습니다. 영역 이름과 시간 수는 넣지 않습니다. 영역 이름이 \"자율·자치활동\" 으로 적힌 학생부도 이 칸입니다.",
    subject: "",
    hours: true,
  },
  {
    id: "S06.CLUB.remarks",
    no: 6,
    heading: "창의적 체험활동상황",
    group: "",
    category: "동아리활동",
    kind: "narrative",
    columns: ["학년", "영역(동아리활동)", "시간", "특기사항"],
    unit: "학년마다 항목 하나",
    text: "특기사항 본문만 적습니다. 영역 이름과 시간 수는 넣지 않습니다. 본문 안의 동아리 이름과 \"(자율동아리)\" 기록은 본문에 그대로 둡니다.",
    subject: "",
    hours: true,
  },
  {
    id: "S06.CAREER.remarks",
    no: 6,
    heading: "창의적 체험활동상황",
    group: "",
    category: "진로활동",
    kind: "narrative",
    columns: ["학년", "영역(진로활동)", "시간", "특기사항"],
    unit: "학년마다 항목 하나",
    text: "특기사항 본문만 적습니다. 영역 이름과 시간 수는 넣지 않습니다. \"희망분야\" 칸은 상급학교에 제공하지 않는 칸이라 옮기지 않습니다.",
    subject: "",
    hours: true,
  },
  {
    id: "S06.VOLUNTEER",
    no: 6,
    heading: "창의적 체험활동상황",
    group: "봉사활동실적",
    category: "봉사활동실적",
    kind: "table",
    columns: ["학년", "일자 또는 기간", "장소 또는 주관기관명", "활동내용", "시간", "누계시간"],
    unit: "학년마다 항목 하나",
    text: `${TABLE_TEXT} 봉사활동 한 건마다 한 줄입니다.`,
    subject: "",
    hours: false,
  },
  {
    id: "S07.BASE.SCORE",
    no: 7,
    heading: "교과학습발달상황",
    group: "",
    category: "교과 성적",
    kind: "table",
    columns: ["학기", "교과", "과목", "학점수", "원점수/과목평균(표준편차)", "성취도(수강자수)", "석차등급", "비고"],
    unit: "학년의 성적표 하나마다 항목 하나 (묶음 제목 없이 \"[1학년]\" 처럼 학년 제목 바로 아래에 있는 표)",
    text: `${TABLE_TEXT} 과목마다 한 줄이고 학기는 줄마다 채워 적습니다. "이수학점 합계" 줄이 있으면 마지막 줄로 적습니다.`,
    subject: "",
    hours: false,
  },
  {
    id: "S07.BASE.NOTE.text",
    no: 7,
    heading: "교과학습발달상황",
    group: "",
    category: "세부능력 및 특기사항",
    kind: "narrative",
    columns: ["과목", "세부능력 및 특기사항"],
    unit: "과목마다 항목 하나 (학년 제목 바로 아래의 성적표에 딸린 표)",
    text: "그 과목의 본문만 적습니다. 한 칸에 여러 과목이 \"과목: 내용\" 꼴로 이어져 있으면 과목마다 나눕니다.",
    subject: "과목 이름 (학기가 함께 적혀 있으면 \"(1학기)국어\" 처럼 적힌 그대로)",
    hours: false,
  },
  {
    id: "S07.CAREER.SCORE",
    no: 7,
    heading: "교과학습발달상황",
    group: "진로 선택 과목",
    category: "교과 성적",
    kind: "table",
    columns: ["학기", "교과", "과목", "학점수", "원점수/과목평균", "성취도(수강자수)", "성취도별 분포비율", "비고"],
    unit: "학년의 <진로 선택 과목> 성적표 하나마다 항목 하나",
    text: `${TABLE_TEXT} 과목마다 한 줄이고 학기는 줄마다 채워 적습니다. "이수학점 합계" 줄이 있으면 마지막 줄로 적습니다.`,
    subject: "",
    hours: false,
  },
  {
    id: "S07.CAREER.NOTE.text",
    no: 7,
    heading: "교과학습발달상황",
    group: "진로 선택 과목",
    category: "세부능력 및 특기사항",
    kind: "narrative",
    columns: ["과목", "세부능력 및 특기사항"],
    unit: "과목마다 항목 하나 (<진로 선택 과목> 성적표에 딸린 표)",
    text: "그 과목의 본문만 적습니다. 한 칸에 여러 과목이 \"과목: 내용\" 꼴로 이어져 있으면 과목마다 나눕니다.",
    subject: "과목 이름 (적힌 그대로)",
    hours: false,
  },
  {
    id: "S07.ART.SCORE",
    no: 7,
    heading: "교과학습발달상황",
    group: "체육·예술",
    category: "교과 성적",
    kind: "table",
    columns: ["학기", "교과", "과목", "학점수", "성취도", "비고"],
    unit: "학년의 <체육·예술> 성적표 하나마다 항목 하나",
    text: `${TABLE_TEXT} 과목마다 한 줄이고 학기는 줄마다 채워 적습니다. "이수학점 합계" 줄이 있으면 마지막 줄로 적습니다.`,
    subject: "",
    hours: false,
  },
  {
    id: "S07.ART.NOTE.text",
    no: 7,
    heading: "교과학습발달상황",
    group: "체육·예술",
    category: "세부능력 및 특기사항",
    kind: "narrative",
    columns: ["과목", "세부능력 및 특기사항"],
    unit: "과목마다 항목 하나 (<체육·예술> 성적표에 딸린 표)",
    text: "그 과목의 본문만 적습니다. 한 칸에 여러 과목이 \"과목: 내용\" 꼴로 이어져 있으면 과목마다 나눕니다.",
    subject: "과목 이름 (적힌 그대로)",
    hours: false,
  },
  {
    id: "S08.READING.text",
    no: 8,
    heading: "독서활동상황",
    group: "",
    category: "독서활동상황",
    kind: "narrative",
    columns: ["학년", "과목 또는 영역", "독서 활동 상황"],
    unit: "학년·과목(영역)마다 항목 하나",
    text: "독서 활동 상황 칸의 본문만 적습니다.",
    subject: "과목 또는 영역",
    hours: false,
  },
  {
    id: "S09.REVIEW.text",
    no: 9,
    heading: "행동특성 및 종합의견",
    group: "",
    category: "행동특성 및 종합의견",
    kind: "narrative",
    columns: ["학년", "행동특성 및 종합의견"],
    unit: "학년마다 항목 하나",
    text: "본문만 적습니다.",
    subject: "",
    hours: false,
  },
  {
    id: "ETC",
    no: 0,
    heading: "기타",
    group: "",
    category: "기타",
    kind: "narrative",
    columns: [],
    unit: "서식의 어느 칸에도 맞지 않는 기록마다 항목 하나",
    text: "첫머리에 그 기록의 제목을 적고 이어서 내용을 적습니다.",
    subject: "",
    hours: false,
  },
];

/** 서식의 어느 칸에도 맞지 않는 기록의 칸 ID */
export const RECORD_FORM_OTHER_ID = "ETC";

/** 칸 ID 목록 (AI 가 쪽을 읽을 때 고르는 값) */
export const RECORD_FORM_PART_IDS: readonly string[] = RECORD_FORM_PARTS.map((part) => part.id);

const PART_BY_ID = new Map(RECORD_FORM_PARTS.map((part) => [part.id, part]));

/** 그 ID 의 칸. 서식에 없는 ID 면 undefined */
export function recordFormPart(id: string | undefined): RecordFormPart | undefined {
  return id === undefined ? undefined : PART_BY_ID.get(id);
}

/** 학생부 항목의 category 로 쓰는 이름 전체 (서식에 나오는 순서, 겹치지 않게) */
export const RECORD_FORM_CATEGORIES: readonly string[] = [...new Set(RECORD_FORM_PARTS.map((part) => part.category))];

/** 서술형 항목의 category (근거 추출과 AI 제안이 AI 에 보내는 항목). "기타" 는 넣지 않는다 */
export const RECORD_FORM_NARRATIVE_CATEGORIES: readonly string[] = [
  ...new Set(
    RECORD_FORM_PARTS.filter((part) => part.kind === "narrative" && part.id !== RECORD_FORM_OTHER_ID).map(
      (part) => part.category,
    ),
  ),
];

/** 표·칸 모양 항목의 category (원문이 줄마다 한 행이다) */
export const RECORD_FORM_LINED_CATEGORIES: readonly string[] = [
  ...new Set(RECORD_FORM_PARTS.filter((part) => part.kind !== "narrative").map((part) => part.category)),
];

/**
 * 항목이 서식의 어디인지를 한 줄로: "7. 교과학습발달상황 > 진로 선택 과목 > 세부능력 및 특기사항".
 * 번호 없는 칸(머리 부분, 기타)은 번호 없이 적고, 묶음이 없거나 항목 이름과 겹치는 부분은 뺀다.
 * 서식에 없는 ID 면 null (칸을 알 수 없는 예전 항목).
 */
export function recordFormPath(fieldId: string | undefined): string | null {
  const part = recordFormPart(fieldId);
  if (part === undefined) return null;
  const head = part.no === 0 ? part.heading : `${part.no}. ${part.heading}`;
  const names = [head, part.group, part.category].filter(
    (name, index, list) => name !== "" && !list.slice(0, index).some((earlier) => earlier.endsWith(name)),
  );
  return names.join(" > ");
}

/**
 * 화면의 항목 제목에 더할 묶음 이름: 교과학습발달상황의 "진로 선택 과목"·"체육·예술" 처럼 category 만으로는 알 수 없는 묶음.
 * 묶음이 없거나 category 와 같은 이름이면(봉사활동실적 등) null.
 */
export function recordFormGroup(fieldId: string | undefined): string | null {
  const part = recordFormPart(fieldId);
  if (part === undefined || part.group === "" || part.group === part.category) return null;
  return part.group;
}

/**
 * AI 에 주는 서식 설명 (쪽 읽기용): 번호마다 칸 ID, 칸 이름, 항목 하나의 단위, 원문·과목을 적는 방법.
 * 쪽 읽기 지시(lib/pipeline/readRecordPage.ts)의 한 절로 들어간다.
 */
export function describeRecordFormForReading(): string {
  const lines: string[] = [];
  let heading = "";
  for (const part of RECORD_FORM_PARTS) {
    if (part.heading !== heading) {
      heading = part.heading;
      lines.push(part.no === 0 ? `### ${part.heading}` : `### ${part.no}. ${part.heading}`);
    }
    const name = part.group !== "" && part.group !== part.category ? `<${part.group}> ${part.category}` : part.category;
    lines.push(`- fieldId "${part.id}" (${name})`);
    if (part.columns.length > 0) lines.push(`  - 서식의 칸: ${part.columns.join(" | ")}`);
    lines.push(`  - 항목: ${part.unit}`);
    lines.push(`  - text: ${part.text}`);
    if (part.subject !== "") lines.push(`  - subject: ${part.subject}`);
    if (part.hours) lines.push("  - hours: 시간 칸에 적힌 수");
  }
  return lines.join("\n");
}

/**
 * AI 에 주는 서식 설명 (분석용): 학생부 항목이 서식의 어느 칸에서 온 것인지 읽는 법.
 * 근거 추출(lib/pipeline/extractEvidence.ts)과 AI 제안(lib/pipeline/assessRecord.ts)의 지시에 들어간다.
 */
export function describeRecordFormForAnalysis(): string {
  const scoreParts = RECORD_FORM_PARTS.filter((part) => part.category === "교과 성적");
  return [
    `학생부는 「학교생활기록 작성 및 관리지침」 별지 제8호 서식 "${RECORD_FORM_NAME}"(학점제를 적용받는 학생)의 칸에 기록이 채워진 문서입니다. 항목마다 그 기록이 서식의 어디에서 왔는지가 form 에 적혀 있습니다(예: "7. 교과학습발달상황 > 진로 선택 과목 > 세부능력 및 특기사항"). form 이 없는 항목은 항목명(category)으로 봅니다.`,
    "- 6. 창의적 체험활동상황: 학년마다 자율활동·동아리활동·진로활동의 특기사항이 있고(hours 는 그 영역의 시간), 봉사활동실적은 표입니다.",
    "- 7. 교과학습발달상황: 학년마다 성적표와 그에 딸린 과목별 세부능력 및 특기사항이 세 묶음으로 나옵니다(묶음 제목 없는 과목, 진로 선택 과목, 체육·예술).",
    ...scoreParts.map(
      (part) => `  - ${part.group === "" ? "성적표" : `<${part.group}> 성적표`}의 칸: ${part.columns.join(" | ")}`,
    ),
    "  - 학점수는 그 과목의 이수 학점, 원점수/과목평균(표준편차)은 학생의 점수와 수강자 전체의 평균·표준편차, 성취도는 A~E(체육·예술은 A~C 또는 P), 석차등급은 수강자 안에서의 등급(숫자가 작을수록 높음), 성취도별 분포비율은 수강자 가운데 각 성취도를 받은 비율입니다.",
    "- 8. 독서활동상황과 9. 행동특성 및 종합의견은 학년마다 적힌 서술형 기록입니다.",
  ].join("\n");
}
