// server/services/timeoutHelper.ts
export async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise
      .then((res) => { clearTimeout(timer); resolve(res); })
      .catch(() => { clearTimeout(timer); resolve(null); });
  });
}
