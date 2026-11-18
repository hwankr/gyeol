// 화면에서 API 를 부를 때 같이 쓰는 것 (lib/analyzeClient.ts, lib/criteriaClient.ts). 브라우저에서만 쓴다.

/** 서버에 연결하지 못했을 때 보여 주는 문구 */
export const CONNECTION_ERROR = "서버에 연결하지 못했습니다. 다시 시도해 주세요.";

/**
 * 요청이 취소(AbortSignal)되었을 때 던지는 오류.
 * 서버 연결 실패 같은 일반 오류와 구분하려고 따로 둔다. 화면에 보여 줄 문구가 아니다.
 */
export class RequestCanceledError extends Error {
  constructor() {
    super("요청이 취소되었습니다.");
    this.name = "RequestCanceledError";
  }
}

/** 응답 본문의 error 문구. 문자열이고 공백을 뺀 길이가 0 보다 클 때만 원형 그대로 돌려준다. 그 밖에는 null. */
export function readErrorMessage(data: unknown): string | null {
  if (
    typeof data === "object" &&
    data !== null &&
    "error" in data &&
    typeof data.error === "string" &&
    data.error.trim().length > 0
  ) {
    return data.error;
  }
  return null;
}
