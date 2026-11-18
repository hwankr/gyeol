import { createHash, timingSafeEqual } from "node:crypto";

// 접속 코드 확인. /api/analyze 와 /api/criteria 가 같이 쓴다.
// 공개 주소에서 아무나 AI 호출 비용을 쓰지 못하게, 파일을 읽거나 AI 를 부르기 전에 확인한다.
// node:crypto 를 쓰는 서버 전용 모듈이라서 화면 코드에서 가져오지 않는다. 접속 코드 값은 로그에 남기지 않는다.

/** 접속 코드 확인 실패: 응답 상태 코드와 화면 문구 */
export type AccessCodeFailure = {
  status: 500 | 401;
  message: string;
};

/**
 * 보낸 접속 코드(sent, 앞뒤 공백은 뺀다)를 서버의 ACCESS_CODE(앞뒤 공백 제거)와 비교한다. 맞으면 null.
 * - 서버에 ACCESS_CODE 가 없음(빈 값 포함) → 500. "[logTag] ACCESS_CODE 가 설정되지 않아 요청을 거부함" 을 로그에 남긴다.
 * - 보낸 코드가 문자열이 아니거나(없음 포함) 다름 → 401.
 */
export function checkAccessCode(sent: unknown, logTag: string): AccessCodeFailure | null {
  const expectedCode = (process.env.ACCESS_CODE ?? "").trim();
  if (expectedCode === "") {
    console.error(`[${logTag}] ACCESS_CODE 가 설정되지 않아 요청을 거부함`);
    return { status: 500, message: "서버에 접속 코드(ACCESS_CODE)가 설정되지 않았습니다." };
  }
  if (typeof sent !== "string" || !isSameCode(sent.trim(), expectedCode)) {
    return { status: 401, message: "접속 코드가 올바르지 않습니다." };
  }
  return null;
}

/**
 * 접속 코드 비교. 걸리는 시간으로 코드를 짐작하지 못하게 timingSafeEqual 로 비교한다.
 * 길이가 달라도 예외 없이 false 가 되도록 양쪽을 SHA-256 으로 같은 길이로 만든 뒤 비교한다.
 */
function isSameCode(sent: string, expected: string): boolean {
  const sentHash = createHash("sha256").update(sent, "utf8").digest();
  const expectedHash = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(sentHash, expectedHash);
}
