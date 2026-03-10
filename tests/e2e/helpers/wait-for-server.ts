/**
 * Polls a URL until it returns a non-error HTTP response or the timeout is
 * exceeded.  Intended for use in `test.beforeAll` to give ephemeral PR
 * deployments a chance to become ready before the first test runs.
 */
export async function waitForServer(
  url: string,
  { retries = 10, intervalMs = 3_000 }: { retries?: number; intervalMs?: number } = {},
): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5_000) })
      if (res.ok || res.status < 500) {
        return
      }
    } catch {
      // Network error or timeout — keep retrying
    }
    if (attempt < retries) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }
  }
  throw new Error(
    `Server at ${url} did not become ready after ${retries} attempts (${(retries * intervalMs) / 1_000}s)`,
  )
}
