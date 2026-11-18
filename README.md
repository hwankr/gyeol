# GYEOL

GYEOL 은 학생부 서류평가 보조 서비스다. 지금은 화면 뼈대(와이어프레임) 단계다. 학생부 PDF 업로드 → 항목별 분리 → 학과별 평가 기준마다 근거 구절 추출 → 근거를 누르면 원문의 해당 위치로 이동하는 흐름을 확인하는 용도다.
AI 는 근거를 찾아 보여 주기만 하고 점수, 등급, 합격 가능성, 학생 간 우열은 판단하지 않는다. PDF 파싱은 `unpdf` 로 하고, 근거는 Claude API(`claude-opus-5-5`, 공식 SDK `@anthropic-ai/sdk`)로 찾는다.
평가 기준은 학과마다 `lib/criteria/` 에 둔다. 지금은 경영학과 하나(임시 값)다.
지원 범위: 글자가 들어 있는 텍스트 PDF 만 읽는다. 스캔본이나 쪽 전체가 이미지인 PDF 는 오류 문구를 돌려준다.

## 실행

Node 24 이상, npm 을 쓴다.

```text
npm install
npx next dev -p 3100        # 개발 서버 (http://localhost:3100)
npm run build               # 프로덕션 빌드
npx next start -p 3100      # 빌드한 것을 실행 (http://localhost:3100)
```

포트를 줄 때는 `npx next …` 를 직접 쓴다. Windows PowerShell 에서는 `npm run dev -- -p 3100` 의 `--` 가 사라져 포트가 전달되지 않고, `&&` 로 명령을 잇는 것도 PowerShell 5.1 에서는 되지 않는다.

### 환경 변수

저장소 루트의 `.env.local`(git 제외)에 아래 두 값을 둔다. 값은 저장소나 문서에 적지 않는다. 배포 환경(예: Vercel 프로젝트 설정)에도 같은 이름으로 설정해야 한다.

| 이름 | 용도 |
| --- | --- |
| `AI_API_KEY` | Claude API 키. 서버(`lib/pipeline/extractEvidence.ts`)에서만 읽고 브라우저로 보내지 않는다. 없으면, 요청이 접속 코드·파일·학과 확인과 PDF 파싱을 통과해 근거 추출 단계에 도달했을 때 학생부 내용과 상관없이(서술형 항목이 없는 PDF 도) 502 와 `서버에 AI API 키(AI_API_KEY)가 설정되지 않았습니다.` 를 돌려준다. 그 전 단계에서 걸리면 그 단계의 상태 코드(401·400·413, 서버에 `ACCESS_CODE` 가 없으면 500)가 먼저 나온다. |
| `ACCESS_CODE` | 접속 코드. 업로드 화면의 "접속 코드" 입력란에 넣은 값과 같아야 분석한다(공개 주소에서 AI 호출 비용을 막기 위한 간단한 보호). 서버에 없으면 폼을 읽은 뒤 모든 분석 요청이 500 으로 거부된다(폼을 읽지 못하면 400 이 먼저 나온다). |

`next dev`/`next start` 는 `.env.local` 을 자동으로 읽는다. 앞뒤 공백을 뺀 값이 비어 있으면 없는 것으로 본다.

### 화면과 API

- `/` 업로드 화면
  - "학과 선택"(지금은 경영학과)과 그 학과의 기준 목록(이름, 설명. 읽기 전용)
  - PDF 를 고르고 "접속 코드"를 넣은 뒤 "분석 시작": 파싱하고 Claude API 로 근거를 찾아 결과 화면으로 이동한다. 실패하면 서버가 준 문구(접속 코드 오류, 키 없음, AI 호출 실패 등)를 그대로 보여 준다. 접속 코드를 비우고 누르면 요청 없이 `접속 코드를 입력해 주세요.` 를 보여 준다. 10MB 를 넘는 파일은 고를 때 걸러 낸다.
  - "샘플 데이터로 보기": API 를 부르지 않고 미리 만든 결과(`lib/mock/sample-result.json`)를 바로 연다. 학과 선택·접속 코드와 상관없다.
- `/result` 분석 결과 화면: 상단에 학과 이름, 왼쪽 학생부 원문, 오른쪽 기준별 근거(탭은 그 학과의 기준 순서). 근거를 누르면 원문 단이 해당 위치로 스크롤되고 인용 구절이 강조된다. 결과는 브라우저 sessionStorage 에 저장된다(접속 코드는 저장하지 않는다).
- `POST /api/analyze`: `multipart/form-data` 로 받는다. 성공하면 `AnalysisResult` JSON(`criteria`, `sections`, `evidences`), 오류는 모두 `{ "error": "<문구>" }` 를 돌려준다.

  | 필드 | 내용 |
  | --- | --- |
  | `file` | 학생부 PDF (10MB 이하, 정확히 10MB 는 허용) |
  | `criteriaId` | 학과 기준 id (예: `business`) |
  | `accessCode` | 접속 코드 |

  | 상태 코드 | 경우 (확인 순서대로) |
  | --- | --- |
  | 400 | 폼을 읽지 못함 |
  | 500 | 서버에 `ACCESS_CODE` 가 설정되지 않음 |
  | 401 | 접속 코드가 없거나 다름 (파일 처리·AI 호출보다 먼저 확인) |
  | 400 | 파일이 없음, PDF 가 아님 |
  | 413 | 파일이 10MB 를 넘음 |
  | 400 | `criteriaId` 가 없거나 목록에 없음 (`학과를 선택해 주세요.`) |
  | 400 | PDF 파싱 실패 (파서의 문구 그대로) |
  | 502 | 근거 추출 실패: `AI_API_KEY` 없음, AI 호출 실패, 60초 초과, AI 거절, 잘린 응답, 응답 해석 실패 |

  10MB 는 앱의 제한이다. Vercel 에 배포하면 플랫폼의 요청 본문 한도(4.5MB, multipart 포함)가 먼저 적용되어, 그보다 큰 PDF 는 앱에 닿기 전에 413 으로 막힌다.
  이때 응답에 앱의 문구가 없으므로 업로드 화면은 `파일이 너무 커서 서버가 받지 못했습니다. 더 작은 PDF 로 다시 시도해 주세요.` 를 보여 준다. 앱이 직접 돌려주는 10MB 초과 413 은 이 문구가 아니라 `파일이 너무 큽니다. 10MB 이하의 PDF 만 올릴 수 있습니다.` 를 보여 주므로, 화면 문구로 어느 쪽(앱 / 플랫폼)이 막았는지 구별할 수 있다.
  배포 환경에서 4.5MB 보다 큰 PDF 를 받으려면 업로드 경로를 바꿔야 한다(예: 저장소로 직접 업로드한 뒤 서버가 다시 검사). 후속 과제다.

### 근거 추출 (`lib/pipeline/extractEvidence.ts`)

- 서술형 항목(자율활동, 동아리활동, 진로활동, 세부능력 및 특기사항, 독서활동상황, 행동특성 및 종합의견)만 학과 기준과 함께 한 번의 호출로 보낸다. 원문은 자르거나 요약하지 않는다.
- `AI_API_KEY` 확인을 가장 먼저 한다. 키가 없으면 학생부 내용과 상관없이 실패(502)다. 키가 있고 서술형 항목(또는 기준)이 하나도 없으면 AI 를 부르지 않고 근거 없이(`evidences: []`) 결과를 돌려준다.
- 응답 모양은 structured outputs(`output_config.format`, JSON schema)로 강제하고, effort 는 `low`, 제한 시간은 재시도 없이 60초다.
- 받은 근거는 코드로 다시 확인한다: 기준 id·항목 id 가 실제로 있는지, 인용이 그 항목 원문에 있는지(`lib/pipeline/locateQuote.ts`). 찾은 인용은 원문에 적힌 그대로의 구절로 바꾸고, 확인을 통과하지 못한 근거는 버린다. 통과·버림 개수와 AI 호출 시간을 서버 로그에 한 줄로 남긴다(학생부 본문·인용·이유는 로그에 남기지 않는다).

## 체크 명령

전부 종료 코드 0 이어야 한다.

```text
npm run build        # 빌드 + 타입 검사
npx tsc --noEmit     # 타입 검사
npm run lint         # ESLint
npm run check:mock   # 샘플 데이터 검사 (필드 형식, 모든 quote 가 해당 항목 text 안에 글자 그대로 있는지 등)
npx tsx scripts/check-parse.ts   # 가상 학생부 PDF 파싱 검사 (다른 PDF 는 경로를 인자로 준다)
```

`npx tsx scripts/check-parse.ts` 는 첫 줄에 `파싱 성공: 항목 57개, 경고 0개 (samples/virtual-student-record.pdf)` 를 출력하고, 이어서 항목별 개수와 경고 목록을 출력한다.
파싱에 실패하면(예: 이미지로 된 PDF) 오류 문구를 출력하고 종료 코드 1 로 끝난다. `tsx` 는 프로젝트 의존성이 아니라 `npx` 로 그때그때 받는다. `node scripts/check-parse.ts` 로도 같은 결과가 나온다.

`check:mock` 은 새 의존성 없이 Node 의 타입 제거 실행으로 `scripts/checkMock.ts` 를 바로 실행한다(`check-parse.ts`, `make-sample.ts` 도 Node 로 바로 돌 수 있게 같은 규칙을 따른다).
그래서 `lib/` 안의 모듈끼리 값을 가져올 때는 `./constants.ts` 처럼 상대 경로에 `.ts` 확장자를 붙인다(`import type` 은 `@/` 경로를 써도 된다).

## 샘플 데이터 다시 만들기

```text
npm run make:sample
```

저장소 루트에서 실행한다. 가상 학생부 PDF(`samples/virtual-student-record.pdf`)를 경영학과 기준으로 실제 파이프라인(`parsePdf` → `blind` → `extractEvidence`)에 한 번 돌려 `lib/mock/sample-result.json` 에 저장한다.
Claude API 를 한 번 부르므로 비용이 든다(가상 학생부 기준 약 16~17초). `AI_API_KEY` 가 프로세스 환경에 없으면 `.env.local` 을 읽어 온다. 저장 전에 결과를 검사해 문제가 있으면 저장하지 않고 종료 코드 1 로 끝난다.
출력은 항목 수, 근거 통과·버림 개수, 기준별 근거 수, 걸린 시간이다. `npx tsx scripts/make-sample.ts` 로도 같은 결과가 나온다. `sample-result.json` 은 손으로 고치지 않는다.

## 폴더 구조

```text
app/
  layout.tsx              공통 레이아웃 (lang="ko", 문서 제목, 화면 높이 고정)
  page.tsx                업로드 화면 연결부 (useUpload → UploadScreen)
  result/page.tsx         결과 화면 연결부 (useStoredResult, useResultView → ResultScreen)
  api/analyze/route.ts    POST /api/analyze (접속 코드 확인 → parsePdf → blind → extractEvidence)
components/               화면 컴포넌트. props 를 그리고 콜백만 호출한다 (디자인은 여기만 고치면 된다)
  Area.tsx                영역 상자 (1px 회색 테두리 + "영역: 이름")
  UploadScreen.tsx        업로드 화면 (학과 선택, 기준 목록, 파일, 접속 코드)
  ResultScreen.tsx        결과 화면, 결과 없음 안내
hooks/                    화면 상태
  useUpload.ts            학과 선택·파일 선택·접속 코드·분석 요청·결과 저장 후 이동
  useStoredResult.ts      sessionStorage 의 결과 읽기 (hydration 안전)
  useResultView.ts        현재 탭(기준), 선택한 근거, 원문 단 스크롤
lib/
  constants.ts            서비스명, sessionStorage 키
  criteria/               학과별 평가 기준 (화면과 서버가 같이 쓴다)
    business.ts           경영학과 기준 (임시 값)
    index.ts              전체 학과 목록, id 로 찾기
  resultView.ts           기준별 개수, 원문을 일반/밑줄/강조 구간으로 나누기, 화면용 값 만들기
  validateResult.ts       결과 모양 검사, 결과 내용 검사 (근거 quote 가 원문에 글자 그대로 있는지 등)
  resultStorage.ts        sessionStorage 저장·불러오기
  analyzeClient.ts        POST /api/analyze 호출 (file, criteriaId, accessCode)
  pdf.ts                  PDF 파일인지 확인 (이름·형식만), 최대 크기(10MB)
  mock/
    sample-result.json    가상 학생부를 경영학과 기준으로 실제 파이프라인에 돌린 결과 (npm run make:sample)
    sampleResult.ts       "샘플 데이터로 보기" 결과 (위 파일 그대로)
  pipeline/               분석 파이프라인
    parsePdf.ts           PDF → 항목(Section[]) 실제 파서 (unpdf, 서버에서만 가져온다)
    blind.ts              식별 정보 가리기 (아직 구현 전)
    extractEvidence.ts    근거 추출 (Claude API, 서버에서만 가져온다)
    locateQuote.ts        AI 가 인용한 구절을 원문에서 찾기 (제공받은 검증된 코드, 고치지 않는다)
samples/
  virtual-student-record.pdf  가상(합성) 학생부 PDF, 12쪽. 실제 인물·학교가 아니다
scripts/
  checkMock.ts            npm run check:mock 실행 스크립트
  check-parse.ts          PDF 파싱 검사 스크립트 (npx tsx scripts/check-parse.ts)
  make-sample.ts          샘플 결과 만들기 (npm run make:sample, Claude API 호출)
types/analysis.ts         데이터 형식 (Section, Criterion, DepartmentCriteria, Evidence, AnalysisResult)
```

## 실제 구현을 끼워 넣을 곳 (TODO)

PDF 파싱(`lib/pipeline/parsePdf.ts`)과 근거 추출(`lib/pipeline/extractEvidence.ts`)은 실제 구현으로 바뀌었다. 남은 곳은 아래 하나다. 시그니처는 그대로 두고 본문만 바꾸면 된다.

- `lib/pipeline/blind.ts` (`// TODO: 실제 구현`) — 원문에서 이름·학교명·주민등록번호·주소 같은 식별 정보를 `●●●` 로 가린다. 지금은 받은 항목을 그대로 돌려준다.
  근거의 quote 가 가린 뒤의 원문과 글자 그대로 맞도록 근거 추출보다 먼저 실행한다.
