export interface BackoffOptions {
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterFactor?: number;
}

export function calculateBackoffMs(
  attemptNumber: number,
  opts: BackoffOptions = {},
): number {
  const base = opts.baseDelayMs ?? 1000;
  const max = opts.maxDelayMs ?? 30_000;
  const jitter = opts.jitterFactor ?? 0.2;

  const exponential = base * Math.pow(2, attemptNumber - 1);
  const capped = Math.min(exponential, max);
  const noise = capped * jitter * (Math.random() * 2 - 1);
  return Math.max(0, Math.round(capped + noise));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
