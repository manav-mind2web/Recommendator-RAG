export interface Violation {
  type: "unapproved-id" | "unapproved-url";
  value: string;
  snippet: string;
}

/**
 * In-memory ring buffer of recent violations. In production this would be a
 * durable audit log; here it is console output plus a small buffer the tests can
 * assert against.
 */
const RING_SIZE = 200;
const ring: Violation[] = [];

export function logViolation(violation: Violation): void {
  ring.push(violation);
  if (ring.length > RING_SIZE) ring.shift();
  // eslint-disable-next-line no-console
  console.warn(
    `[grounding-violation] ${violation.type}: ${JSON.stringify(violation.value)} — ${violation.snippet}`,
  );
}

export function recentViolations(): Violation[] {
  return [...ring];
}

export function clearViolations(): void {
  ring.length = 0;
}
