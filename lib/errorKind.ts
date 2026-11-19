// 서버 로그에 남길 오류 설명. API 라우트(app/api/analyze, app/api/record-page)가 예상하지 못한 오류를 로그에 남길 때 같이 쓴다.

/**
 * 서버 로그에 남길 오류 설명: "종류 <이름>" 하나만 돌려준다. 이름은 오류 객체의 name 을 한 번만 읽어, 문자열이고 아래 목록에 있을 때만
 * 그 값을 쓴다. 그 밖(목록에 없는 이름, Error 가 아닌 값, 읽다가 예외가 나는 getter·Proxy)은 "알 수 없음". 어떤 값에도 예외를 던지지 않는다.
 * 목록(코드에 적어 둔 이름만): 자바스크립트 기본 오류, 이 앱이 쓰는 PDF 라이브러리(pdf.js)의 오류, 요청 취소·시간 초과 오류.
 * 목록에 없는 이름은 식별자 모양이어도(지어낸 영문 성명일 수도 있다) 남기지 않는다.
 * 오류의 message, 스택, 오류 객체 전체(cause 등)는 읽지도 남기지도 않는다. 학생부를 다루다 난 오류의 문구와 스택 머리말에는
 * 가리기 전 학생부 내용(이름·학교명 등)이 섞일 수 있어서다. 값을 문자열로 바꾸지도 않는다.
 * "Error 인가"는 instanceof Error 로 본다(pdf.js 예외는 BaseException.prototype = Error() 인 옛 방식 상속이라 Error.isError 는 false 다. 실측).
 * 함수 하나만 떼어 시험할 수 있도록 목록을 함수 안에 둔다.
 */
export function describeErrorForLog(error: unknown): string {
  const loggable = [
    "Error", "TypeError", "RangeError", "SyntaxError", "ReferenceError", "EvalError", "URIError", "AggregateError",
    "InvalidPDFException", "PasswordException", "FormatError", "MissingPDFException", "UnexpectedResponseException",
    "UnknownErrorException", "AbortException",
    "AbortError", "TimeoutError",
  ];
  try {
    if (!(error instanceof Error)) return "종류 알 수 없음";
    const name: unknown = error.name;
    return typeof name === "string" && loggable.includes(name) ? `종류 ${name}` : "종류 알 수 없음";
  } catch {
    return "종류 알 수 없음";
  }
}
