import Anthropic from "@anthropic-ai/sdk";

// Claude API 호출 공용 모듈. 근거 추출(extractEvidence.ts)과 기준 생성(generateCriteria.ts)이 같이 쓴다.
// 클라이언트 생성, 60초 제한, stop_reason 확인, 글 블록을 JSON 으로 읽기, 오류 분류와 로그를 한곳에서 한다.
//
// 이 파일은 서버에서만 가져온다(API 라우트와 그 라우트가 쓰는 lib/pipeline 모듈, scripts/make-sample.ts).
// 화면 코드에서 가져오면 SDK 가 브라우저 번들에 들어가므로 가져오지 않는다.
// scripts/make-sample.ts 가 Node 로 직접(타입 제거 실행) 돌리므로 server-only 를 가져오지 않고,
// 값 import 는 상대 경로에 .ts 확장자를 붙인다.

/** 사용할 모델. 사용자가 이 모델 하나로 정했으므로 서버 측 fallbacks 는 쓰지 않는다. */
const MODEL = "claude-opus-5-5";

/** AI 호출 제한 시간(밀리초). 재시도하지 않으므로 전체 대기 시간도 이 값을 넘지 않는다. */
const TIMEOUT_MS = 60_000;

/** 생각 깊이. 이 모델은 thinking 을 끌 수 없고(항상 adaptive) effort 로만 조절한다. 기본값(medium)에 기대지 않고 호출마다 명시한다. */
export type Effort = NonNullable<Anthropic.OutputConfig["effort"]>;

/** 기능과 상관없이 같은 화면 문구. SDK 의 원래 오류 메시지는 화면에 넣지 않고, 원인은 서버 로그에만 남긴다. */
const COMMON_MESSAGES = {
  noApiKey: "서버에 AI API 키(AI_API_KEY)가 설정되지 않았습니다.",
  timeout: "AI 응답이 60초 안에 오지 않았습니다. 다시 시도해 주세요.",
  invalidApiKey: "서버의 AI API 키가 올바르지 않거나 사용할 수 없습니다. 관리자에게 알려 주세요.",
  rateLimited: "AI 호출 한도를 넘었습니다. 잠시 후 다시 시도해 주세요.",
  callFailed: "AI 호출에 실패했습니다. 잠시 후 다시 시도해 주세요.",
  truncated: "AI 응답이 너무 길어 중간에 끊겼습니다. 다시 시도해 주세요.",
  invalidResponse: "AI 응답을 해석하지 못했습니다. 다시 시도해 주세요.",
} as const;

/**
 * AI 호출 실패. message 는 화면에 그대로 보여 줄 한국어 문구다.
 * API 라우트는 이 오류를 상태 코드 502 와 { error: message } 로 바꾼다.
 */
export class AiCallError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiCallError";
  }
}

/**
 * 서버의 AI API 키(AI_API_KEY, 앞뒤 공백 제거)를 읽는다. 없으면 "[logTag] AI_API_KEY 가 설정되지 않음" 을
 * 로그에 남기고 AiCallError(키 없음)를 던진다.
 */
export function readApiKey(logTag: string): string {
  const apiKey = (process.env.AI_API_KEY ?? "").trim();
  if (apiKey === "") {
    console.error(`[${logTag}] AI_API_KEY 가 설정되지 않음`);
    throw new AiCallError(COMMON_MESSAGES.noApiKey);
  }
  return apiKey;
}

export type ClaudeJsonRequest = {
  /** 로그 줄 앞에 붙는 이름 (예: "extractEvidence" → "[extractEvidence] …") */
  logTag: string;
  apiKey: string;
  effort: Effort;
  /** 응답 최대 토큰. 생각 토큰도 여기에 포함된다. */
  maxTokens: number;
  /** 지시 */
  system: string;
  /** 자료 (toTaggedJson 으로 감싼 JSON) */
  userMessage: string;
  /** structured outputs 로 강제하는 응답 모양 (JSON schema) */
  schema: Record<string, unknown>;
  /** AI 가 거절했을 때 화면에 보여 줄 문구. 기능마다 다르다. */
  refusalMessage: string;
};

export type ClaudeJsonResponse = {
  /** 응답의 글 블록을 이어 붙여 JSON 으로 읽은 값 (모양 확인은 호출한 쪽이 한다) */
  data: unknown;
  /** AI 호출에 걸린 시간(초) */
  seconds: number;
  /** 로그용 토큰 수. 숫자가 아니면 "정보 없음". */
  inputTokens: string;
  outputTokens: string;
  stopReason: string | null;
};

/**
 * Claude API 를 한 번 부르고 응답의 글 블록을 JSON 으로 읽어 돌려준다.
 * - 스트리밍 없이, 재시도 없이(maxRetries 0), 응답 본문을 읽는 시간까지 합쳐 60초 제한.
 * - thinking 은 지정하지 않고(이 모델은 항상 adaptive) effort 를 명시한다. 응답 모양은 structured outputs 로 강제한다.
 * - 호출 실패·시간 초과·응답 모양 이상·거절·잘린 응답·JSON 해석 실패는 원인을 "[logTag] …" 로그 한 줄로 남기고
 *   화면 문구를 담은 AiCallError 를 던진다. 로그에는 상태·종류·시간·토큰 수만 남기고 요청·응답 본문은 남기지 않는다.
 */
export async function callClaudeJson(request: ClaudeJsonRequest): Promise<ClaudeJsonResponse> {
  const { logTag } = request;
  // logLevel "off": SDK 자체 로그를 끈다. ANTHROPIC_LOG=debug 가 설정돼 있어도 SDK 가 요청·응답 본문
  // (학생부 원문, 학과가 적은 문장 등)을 로그로 내보내지 않게 한다. 앱의 [logTag] 로그(개수·시간·상태)는 그대로 남는다.
  const client = new Anthropic({
    apiKey: request.apiKey,
    timeout: TIMEOUT_MS,
    maxRetries: 0,
    logLevel: "off",
  });
  // SDK 의 timeout 은 응답 헤더가 올 때까지만 잰다. 본문을 읽는 시간까지 합쳐 60초를 넘지 않도록 신호도 함께 건다.
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  const startedAt = performance.now();

  let response: Anthropic.Message;
  try {
    response = await client.messages.create(
      {
        model: MODEL,
        max_tokens: request.maxTokens,
        // thinking 은 지정하지 않는다(이 모델은 항상 adaptive). 깊이는 effort 로만 조절한다.
        output_config: {
          effort: request.effort,
          format: { type: "json_schema", schema: request.schema },
        },
        system: request.system,
        messages: [{ role: "user", content: request.userMessage }],
      },
      { signal, timeout: TIMEOUT_MS, maxRetries: 0 },
    );
  } catch (error) {
    throw toAiCallError(logTag, error, signal, secondsSince(startedAt));
  }
  const seconds = secondsSince(startedAt);

  // 응답 모양이 예상과 다르면(content 가 배열이 아님 등) 읽다가 예외가 나지 않도록 쓰기 전에 확인한다.
  if (!isMessageShape(response)) {
    console.error(
      `[${logTag}] AI 응답 모양이 예상과 다름 (종류 invalid_response), AI 호출 ${formatSeconds(seconds)}`,
    );
    throw new AiCallError(COMMON_MESSAGES.invalidResponse);
  }

  // 응답 내용을 읽기 전에 멈춘 이유부터 확인한다.
  if (response.stop_reason === "refusal") {
    console.error(
      `[${logTag}] AI 가 응답을 거절함 (분류 ${response.stop_details?.category ?? "없음"}), AI 호출 ${formatSeconds(seconds)}`,
    );
    throw new AiCallError(request.refusalMessage);
  }
  if (response.stop_reason === "max_tokens" || response.stop_reason === "model_context_window_exceeded") {
    console.error(
      `[${logTag}] AI 응답이 잘림 (stop_reason ${response.stop_reason}, 출력 토큰 ${formatTokens(response.usage.output_tokens)}), AI 호출 ${formatSeconds(seconds)}`,
    );
    throw new AiCallError(COMMON_MESSAGES.truncated);
  }

  const result: ClaudeJsonResponse = {
    data: undefined,
    seconds,
    inputTokens: formatTokens(response.usage.input_tokens),
    outputTokens: formatTokens(response.usage.output_tokens),
    stopReason: response.stop_reason ?? null,
  };

  const text = response.content
    .flatMap((block) =>
      typeof block === "object" && block !== null && block.type === "text" && typeof block.text === "string"
        ? [block.text]
        : [],
    )
    .join("");
  try {
    result.data = JSON.parse(text);
  } catch {
    throw invalidResponseError(logTag, result);
  }
  return result;
}

/**
 * 응답 JSON 의 모양이 예상과 다를 때 쓰는 오류. "[logTag] AI 응답을 해석하지 못함 (stop_reason …), AI 호출 …초" 를
 * 로그에 남기고 화면 문구(응답 해석 실패)의 AiCallError 를 돌려준다. JSON 으로 읽지 못한 경우와 같은 로그·문구다.
 */
export function invalidResponseError(logTag: string, response: ClaudeJsonResponse): AiCallError {
  console.error(
    `[${logTag}] AI 응답을 해석하지 못함 (stop_reason ${response.stopReason ?? "없음"}), AI 호출 ${formatSeconds(response.seconds)}`,
  );
  return new AiCallError(COMMON_MESSAGES.invalidResponse);
}

/**
 * 태그 안에 넣을 JSON. 문자열 속 "<" 를 JSON 이스케이프 < (역슬래시와 u003c, 여섯 글자)로 적어
 * (JSON 으로는 같은 값), 자료에 태그처럼 보이는 글자가 있어도 감싼 태그가 깨지지 않게 한다.
 */
export function toTaggedJson(value: unknown): string {
  return JSON.stringify(value, null, 2).replaceAll("<", "\\u003c");
}

export function formatSeconds(seconds: number): string {
  return `${seconds.toFixed(1)}초`;
}

/** SDK 가 돌려준 응답이 읽을 수 있는 모양인지: 객체이고 content 는 배열, usage 는 객체. */
function isMessageShape(value: unknown): value is Anthropic.Message {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return Array.isArray(record.content) && typeof record.usage === "object" && record.usage !== null;
}

/**
 * 로그에 남기는 오류 종류. 프로덕션 빌드에서는 클래스 이름이 축약되므로(예: "e") 클래스 이름 대신 이 고정 문자열을 쓴다.
 */
type ErrorKind =
  | "timeout"
  | "authentication"
  | "rate_limit"
  | "connection"
  | "invalid_response"
  | "api"
  | "unknown";

/** 오류 종류별 서버 로그 문장과 화면 문구 */
const ERROR_KINDS: Record<ErrorKind, { log: string; message: string }> = {
  timeout: { log: "AI 호출 시간 초과", message: COMMON_MESSAGES.timeout },
  authentication: { log: "AI API 키 인증 실패", message: COMMON_MESSAGES.invalidApiKey },
  rate_limit: { log: "AI 호출 한도 초과", message: COMMON_MESSAGES.rateLimited },
  connection: { log: "AI 서버에 연결하지 못함", message: COMMON_MESSAGES.callFailed },
  invalid_response: { log: "AI 응답을 해석하지 못함", message: COMMON_MESSAGES.invalidResponse },
  api: { log: "AI 호출 실패", message: COMMON_MESSAGES.callFailed },
  unknown: { log: "AI 호출 중 예상하지 못한 오류", message: COMMON_MESSAGES.callFailed },
};

/**
 * AI 호출 중 생긴 오류를 화면용 문구의 AiCallError 로 바꾼다.
 * SDK 의 오류 클래스로 나누고(메시지 문자열은 보지 않는다), 원인은 서버 로그에만 남긴다.
 */
function toAiCallError(logTag: string, error: unknown, signal: AbortSignal, seconds: number): AiCallError {
  const kind = classifyError(error, signal);
  console.error(
    `[${logTag}] ${ERROR_KINDS[kind].log} (종류 ${kind}${describeError(error)}, ${formatSeconds(seconds)})`,
  );
  return new AiCallError(ERROR_KINDS[kind].message);
}

function classifyError(error: unknown, signal: AbortSignal): ErrorKind {
  // 60초 신호가 울렸거나 SDK 가 응답 헤더를 기다리다 시간이 다 된 경우
  if (signal.aborted || error instanceof Anthropic.APIConnectionTimeoutError) return "timeout";
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return "authentication";
  }
  if (error instanceof Anthropic.RateLimitError) return "rate_limit";
  // APIConnectionError(연결 실패)는 APIError 의 하위 클래스라서 APIError 보다 먼저 확인한다.
  if (error instanceof Anthropic.APIConnectionError) return "connection";
  if (error instanceof Anthropic.APIError) return "api";
  // SDK 가 성공 응답(HTTP 200) 본문을 JSON 으로 읽다가 실패하면 SyntaxError 를 그대로 던진다.
  if (error instanceof SyntaxError) return "invalid_response";
  return "unknown";
}

/** 로그용 오류 설명: 상태 코드, 오류 유형, 요청 id (SDK API 오류일 때만). 메시지 본문은 넣지 않는다. */
function describeError(error: unknown): string {
  if (!(error instanceof Anthropic.APIError)) return "";
  return [
    "",
    `status ${error.status ?? "없음"}`,
    `type ${error.type ?? "없음"}`,
    `request ${error.requestID ?? "없음"}`,
  ].join(", ");
}

function secondsSince(startedAt: number): number {
  return (performance.now() - startedAt) / 1000;
}

/** 로그용 토큰 수. 숫자가 아니면(응답에 빠졌거나 형식이 다르면) undefined 대신 "정보 없음". 응답을 실패로 보지는 않는다. */
function formatTokens(value: unknown): string {
  return typeof value === "number" ? String(value) : "정보 없음";
}
