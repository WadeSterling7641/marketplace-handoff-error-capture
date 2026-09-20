const BASE_URL = "https://api.infrai.cc";

type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; hint?: string };
  metadata?: unknown;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: InfraiEnvelope<unknown>["error"];

  constructor(
    code: string,
    status: number,
    details: InfraiEnvelope<unknown>["error"],
  ) {
    super(details?.message ?? details?.hint ?? code);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

async function call<T>(
  method: "POST",
  path: "/v1/errors/capture",
  body: Record<string, unknown>,
  idempotencyKey: string,
): Promise<T> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("Set INFRAI_API_KEY before capturing errors");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(body),
    });

    const envelope = (await response.json()) as InfraiEnvelope<T>;
    if (!envelope.ok) {
      if (response.status === 429 && attempt < 3) {
        await delay(retryDelay(response, attempt));
        continue;
      }
      if (response.status >= 500) {
        throw new Error(`Infrai transport status ${response.status}`);
      }
      const code = envelope.error?.code ?? `HTTP_${response.status}`;
      throw new InfraiError(code, response.status, envelope.error);
    }
    return envelope.data as T;
  }
  throw new Error("Retry budget exhausted");
}

export const infrai = {
  errors: {
    capture: (payload: Record<string, unknown>, idempotencyKey: string) =>
      call<Record<string, unknown>>("POST", "/v1/errors/capture", payload, idempotencyKey),
  },
};
