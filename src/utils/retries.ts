function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retries `fn` up to `retries` times. When `isRetryable` is given, only retries
 * when the thrown error satisfies it; otherwise throws immediately.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  isRetryable?: (err: unknown) => boolean
): Promise<T> {
  let lastError: unknown;

  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (isRetryable && !isRetryable(err)) {
        throw err;
      }
      await sleep(2 ** i * 100);
    }
  }

  throw lastError;
}