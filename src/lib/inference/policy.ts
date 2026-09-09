export function inferenceAllowed(
  accountId: string,
  allowed: string | undefined,
) {
  return !!allowed
    ?.split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .includes(accountId.toLowerCase());
}
export const inferenceLimits = {
  accountDaily: 40,
  siteDaily: 200,
  criticalDaily: 2,
  requestsPerMinute: 6,
};
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
