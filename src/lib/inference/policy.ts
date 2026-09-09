export function inferenceAllowed(
  accountId: string,
  allowed: string | undefined,
  publicAccess?: string,
) {
  if (!accountId.trim()) return false;
  if (publicAccess === 'true') return true;
  return !!allowed
    ?.split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .includes(accountId.toLowerCase());
}
export const creditsExhaustedMessage =
  'Sorry, AI credits are exhausted. Please try again later.';
export class CreditsExhaustedError extends Error {
  constructor() {
    super(creditsExhaustedMessage);
  }
}
export function creditsExhausted(status: number, payload: unknown): boolean {
  if (status === 402) return true;
  if (!payload || typeof payload !== 'object') return false;
  const data = payload as Record<string, unknown>;
  const error = data.error;
  const detail =
    error && typeof error === 'object'
      ? (error as Record<string, unknown>)
      : data;
  const text = [
    typeof error === 'string' ? error : '',
    detail.code,
    detail.type,
    detail.message,
    detail.reason,
  ]
    .filter((x): x is string => typeof x === 'string')
    .join(' ')
    .toLowerCase();
  return /insufficient[_ -](?:credits?|quota|balance)|(?:credits?|balance)[_ -](?:exhausted|depleted)|(?:out of|no remaining)[_ -]credits?|credit balance is too low|billing[_ -]hard[_ -]limit[_ -]reached/.test(
    text,
  );
}
export async function providerFailure(
  response: Response,
  prefix: string,
): Promise<Error> {
  const detail: unknown = await response.json().catch(() => null);
  return creditsExhausted(response.status, detail)
    ? new CreditsExhaustedError()
    : new Error(prefix + ' HTTP ' + response.status);
}
export async function readBounded(request: Request, maxBytes: number) {
  if (Number(request.headers.get('content-length')) > maxBytes)
    throw new Error('Request too large');
  if (!request.body) return '';
  const reader = request.body.getReader(),
    chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error('Request too large');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(bytes);
}
