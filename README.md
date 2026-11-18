# 서비스명(미정)

학생부 서류평가 보조 서비스의 화면 뼈대(와이어프레임)다. 학생부 PDF 업로드 → 항목별 분리 → 역량별 근거 문장 추출 → 근거를 누르면 원문의 해당 위치로 이동하는 흐름을 확인하는 용도다.
AI 는 근거를 찾아 보여 주기만 하고 점수나 합격 여부는 판단하지 않는다. 지금은 PDF 파싱은 실제로 하고(`unpdf`), 근거는 AI 를 연결하지 않은 임시 규칙으로 만든다.
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

- `/` 업로드 화면: PDF 를 고르고 "분석 시작"(PDF 를 파싱하고 임시 근거를 붙여 결과를 돌려준다. 읽지 못하면 오류 문구를 그대로 보여 준다), 또는 "샘플 데이터로 보기"(API 를 부르지 않고 가상 학생부 샘플을 바로 연다)
- `/result` 분석 결과 화면: 왼쪽 학생부 원문, 오른쪽 역량별 근거. 결과는 브라우저 sessionStorage 에 저장된다.
- `POST /api/analyze`: `multipart/form-data` 의 `file` 필드로 PDF 를 받아 `AnalysisResult` JSON 을 돌려준다. 파일이 없거나 PDF 가 아니거나 파싱에 실패하면 상태 코드 400 과 `{ "error": "<문구>" }` 를 돌려준다.

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

`check:mock` 은 새 의존성 없이 Node 의 타입 제거 실행으로 `scripts/checkMock.ts` 를 바로 실행한다(`check-parse.ts` 도 Node 로 바로 돌 수 있게 같은 규칙을 따른다).
그래서 `lib/` 안의 모듈끼리 값을 가져올 때는 `./constants.ts` 처럼 상대 경로에 `.ts` 확장자를 붙인다(`import type` 은 `@/` 경로를 써도 된다).

## 폴더 구조

```text
app/
  layout.tsx              공통 레이아웃 (lang="ko", 문서 제목, 화면 높이 고정)
  page.tsx                업로드 화면 연결부 (useUpload → UploadScreen)
  result/page.tsx         결과 화면 연결부 (useStoredResult, useResultView → ResultScreen)
  api/analyze/route.ts    POST /api/analyze (parsePdf → blind → extractEvidence, 파싱 오류는 400)
components/               화면 컴포넌트. props 를 그리고 콜백만 호출한다 (디자인은 여기만 고치면 된다)
  Area.tsx                영역 상자 (1px 회색 테두리 + "영역: 이름")
  UploadScreen.tsx        업로드 화면
  ResultScreen.tsx        결과 화면, 결과 없음 안내
hooks/                    화면 상태
  useUpload.ts            파일 선택·분석 요청·결과 저장 후 이동
  useStoredResult.ts      sessionStorage 의 결과 읽기 (hydration 안전)
  useResultView.ts        현재 탭, 선택한 근거, 원문 단 스크롤
lib/
  constants.ts            역량 목록, 서비스명, sessionStorage 키
  resultView.ts           역량별 개수, 원문을 일반/밑줄/강조 구간으로 나누기, 화면용 값 만들기
  validateResult.ts       결과 모양 검사, 결과 내용 검사 (근거 quote 가 원문에 글자 그대로 있는지 등)
  resultStorage.ts        sessionStorage 저장·불러오기
  analyzeClient.ts        POST /api/analyze 호출
  pdf.ts                  PDF 파일인지 확인 (이름·형식만)
  mock/
    sample-sections.json  가상 학생부 PDF 를 파서로 파싱한 결과 (항목 57개)
    sampleResult.ts       "샘플 데이터로 보기" 결과 (위 항목 + 임시 근거)
  pipeline/               분석 파이프라인
    parsePdf.ts           PDF → 항목(Section[]) 실제 파서 (unpdf, 서버에서만 가져온다)
    blind.ts              식별 정보 가리기 (아직 구현 전)
    extractEvidence.ts    근거 추출 (AI 연결 전 임시 규칙)
samples/
  virtual-student-record.pdf  가상(합성) 학생부 PDF, 12쪽. 실제 인물·학교가 아니다
scripts/
  checkMock.ts            npm run check:mock 실행 스크립트
  check-parse.ts          PDF 파싱 검사 스크립트 (npx tsx scripts/check-parse.ts)
types/analysis.ts         데이터 형식 (Section, Evidence, AnalysisResult)
```

## 실제 구현을 끼워 넣을 곳 (TODO)

PDF 파싱(`lib/pipeline/parsePdf.ts`)은 실제 구현으로 바뀌었다. 남은 곳은 아래 둘이다. 시그니처는 그대로 두고 본문만 바꾸면 된다.

- `lib/pipeline/blind.ts` (`// TODO: 실제 구현`) — 원문에서 이름·학교명·주민등록번호·주소 같은 식별 정보를 `●●●` 로 가린다. 지금은 받은 항목을 그대로 돌려준다.
- `lib/pipeline/extractEvidence.ts` (`// TODO: 실제 AI 호출로 교체`) — 항목 원문에서 역량별 근거 문장과 이유를 뽑는다. quote 는 원문에 글자 그대로 있어야 한다.
  지금은 서술형 항목 5개마다 하나씩, 원문 첫 줄 앞 40글자를 근거로 삼는 임시 규칙(`buildPlaceholderEvidences`)이다. 샘플 데이터도 같은 함수로 근거를 만든다.
