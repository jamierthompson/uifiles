/**
 * Runner-free helpers for the Playwright suite: no `@playwright/test`
 * import, so the unit project can test them.
 */

export type Env = Readonly<Record<string, string | undefined>>

/**
 * The origin the build baked into `/` and `/llms.txt`, else the server under
 * test. CI sets `NEXT_PUBLIC_BASE_URL` for the build and the e2e step alike;
 * if it is missing there, the no-localhost assertions would pass against a
 * localhost build, so the run fails here instead of going quiet.
 */
export function publicOrigin(
  baseURL: string | undefined,
  env: Env = process.env
): string {
  const explicit = env.NEXT_PUBLIC_BASE_URL?.trim()
  if (env.CI && !explicit) {
    throw new Error(
      "NEXT_PUBLIC_BASE_URL is not set: CI must set it for the whole job (build and e2e), or the no-localhost assertions check nothing"
    )
  }
  if (explicit && !URL.canParse(explicit)) {
    // lib/registry.ts baseUrl() fails the build with the same message.
    throw new Error(
      `NEXT_PUBLIC_BASE_URL must be an absolute URL such as https://uifiles.dev; got "${explicit}"`
    )
  }
  return (explicit || baseURL || "http://localhost:3000").replace(/\/$/, "")
}

/**
 * Whether the pages under test must be free of localhost URLs: always in CI,
 * locally once the origin set for the build is a public host. The
 * `.env.example` value is localhost, so exporting it for a local run expects
 * the localhost URLs the build then prints.
 */
export function expectsPublicOrigin(env: Env = process.env): boolean {
  if (env.CI) return true
  const explicit = env.NEXT_PUBLIC_BASE_URL?.trim()
  return explicit !== undefined && explicit !== "" && !isLocalRequest(explicit)
}

/**
 * A request to the server under test, as opposed to a third-party host. A
 * value that is not an absolute URL (a scheme-less `NEXT_PUBLIC_BASE_URL`
 * such as `uifiles.dev`) names no loopback host, so it is not local.
 */
export function isLocalRequest(url: string): boolean {
  if (!URL.canParse(url)) return false
  const { hostname } = new URL(url)
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]"
  )
}
