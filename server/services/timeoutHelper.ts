/**
 * Wraps a promise with a timeout.
 * Returns null if it doesn't resolve in time.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number
): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  try {
    const timeoutPromise = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), ms);
    });

    const result = await Promise.race([promise, timeoutPromise]);

    return result as T | null;
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
