# 서비스명(미정)

학생부 서류평가 보조 서비스의 화면 뼈대(와이어프레임)다. 학생부 PDF 업로드 → 항목별 분리 → 역량별 근거 문장 추출 → 근거를 누르면 원문의 해당 위치로 이동하는 흐름을 확인하는 용도다.
AI 는 근거를 찾아 보여 주기만 하고 점수나 합격 여부는 판단하지 않는다. 지금은 PDF 파싱·AI 호출 없이 전부 가짜 데이터로 동작한다.

## 실행

Node 24 이상, npm 을 쓴다.

```text
npm install
npm run dev -- -p 3100      # 개발 서버 (http://localhost:3100)
npm run build && npm run start -- -p 3100
```

- `/` 업로드 화면: PDF 를 고르고 "분석 시작" (가짜 API 가 1.5초 뒤 결과를 돌려준다), 또는 "샘플 데이터로 보기"
- `/result` 분석 결과 화면: 왼쪽 학생부 원문, 오른쪽 역량별 근거. 결과는 브라우저 sessionStorage 에 저장된다.
- `POST /api/analyze`: `multipart/form-data` 의 `file` 필드로 PDF 를 받아 `AnalysisResult` JSON 을 돌려준다.

## 체크 명령

전부 종료 코드 0 이어야 한다.

```text
npm run build        # 빌드 + 타입 검사
npx tsc --noEmit     # 타입 검사
npm run lint         # ESLint
npm run check:mock   # 가짜 데이터 검사 (모든 quote 가 해당 항목 text 안에 글자 그대로 있는지 등)
```

`check:mock` 은 새 의존성 없이 Node 의 타입 제거 실행으로 `scripts/checkMock.ts` 를 바로 실행한다.
그래서 `lib/` 안의 모듈끼리 값을 가져올 때는 `./constants.ts` 처럼 상대 경로에 `.ts` 확장자를 붙인다(`import type` 은 `@/` 경로를 써도 된다).

## 폴더 구조

```text
app/
  layout.tsx              공통 레이아웃 (와이어프레임 띠, lang="ko", 문서 제목)
  page.tsx                업로드 화면 연결부 (useUpload → UploadScreen)
  result/page.tsx         결과 화면 연결부 (useStoredResult, useResultView → ResultScreen)
  api/analyze/route.ts    POST /api/analyze (가짜 지연 후 파이프라인 호출)
components/               화면 컴포넌트. props 를 그리고 콜백만 호출한다 (디자인은 여기만 고치면 된다)
  Area.tsx                영역 상자 (1px 회색 테두리 + "영역: 이름")
  UploadScreen.tsx        업로드 화면
  ResultScreen.tsx        결과 화면, 결과 없음 안내
hooks/                    화면 상태
  useUpload.ts            파일 선택·분석 요청·결과 저장 후 이동
  useStoredResult.ts      sessionStorage 의 결과 읽기 (hydration 안전)
  useResultView.ts        현재 탭, 선택한 근거, 원문 단 스크롤
lib/
  constants.ts            역량 목록, 항목명 목록, 서비스명, 띠 문구, sessionStorage 키
  resultView.ts           역량별 개수, 원문을 일반/밑줄/강조 구간으로 나누기, 화면용 값 만들기
  validateResult.ts       결과 모양 검사, 가짜 데이터 내용 검사
  resultStorage.ts        sessionStorage 저장·불러오기
  analyzeClient.ts        POST /api/analyze 호출
  pdf.ts                  PDF 파일인지 확인 (이름·형식만)
  mock/sampleResult.ts    가상 학생 1명의 가짜 학생부 데이터
  pipeline/               분석 파이프라인 (지금은 가짜)
scripts/checkMock.ts      npm run check:mock 실행 스크립트
types/analysis.ts         데이터 형식 (Section, Evidence, AnalysisResult)
```

## 실제 구현을 끼워 넣을 곳 (TODO)

각 함수 본문에 `// TODO: 실제 구현` 주석이 있다. 시그니처는 그대로 두고 본문만 바꾸면 된다.

- `lib/pipeline/parsePdf.ts` — PDF 에서 텍스트를 뽑아 항목명·학년·과목별 `Section[]` 으로 나눈다.
- `lib/pipeline/blind.ts` — 원문에서 이름·학교명·주민등록번호·주소 같은 식별 정보를 `●●●` 로 가린다.
- `lib/pipeline/extractEvidence.ts` — 항목 원문에서 역량별 근거 문장과 이유를 뽑는다. quote 는 원문에 글자 그대로 있어야 한다.
- `app/api/analyze/route.ts` — 1.5초 가짜 지연(`FAKE_DELAY_MS`)을 지운다.
