export type StructuredLogFields = Record<
  string,
  string | number | boolean | null | undefined
>;

export function structuredLog(
  event: string,
  fields: StructuredLogFields = {},
): string {
  return JSON.stringify({ event, ...fields });
}

export function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Unknown error';
  return message
    .replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s@/]+@/gi, '$1[REDACTED]@')
    .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(
      /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
      '[REDACTED_JWT]',
    )
    .slice(0, 2000);
}
