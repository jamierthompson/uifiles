/**
 * Browser-project setup: a test that logs through `console.error` or
 * `console.warn` (React act, key and hydration warnings, Base UI prop
 * warnings) fails at its end with the messages, the way upstream AI Elements
 * runs vitest-fail-on-console. A test that asserts a warning opts out with
 * `allowConsole()`. A spy with a mock implementation does not opt out: the
 * global `console` is the guard's proxy, so every spy installed through it is
 * known, and the calls it swallowed are charged to the test even when the spy
 * is restored before the check.
 */
import { afterEach, beforeEach } from "vitest"
import { commands } from "vitest/browser"
import { cleanup } from "vitest-browser-react"
import {
  type ConsoleGuard,
  type ConsoleLevel,
  installConsoleGuard,
} from "./console-guard"

export type { ConsoleLevel }

// Vitest loads this file twice in the browser: as the setup file and again
// through a test's `@/tests/setup` import. One guard on globalThis serves both
// instances, so the console is proxied and the hooks register once.
const store = globalThis as unknown as {
  __uifilesConsoleGuard?: ConsoleGuard
  __uifilesPointerParking?: true
}
store.__uifilesConsoleGuard ??= installConsoleGuard(
  { beforeEach, afterEach },
  cleanup
)
const guard: ConsoleGuard = store.__uifilesConsoleGuard

// Every test starts with the pointer off the page, so no fixture inherits a
// hover from wherever the previous test or file left it.
if (!store.__uifilesPointerParking) {
  store.__uifilesPointerParking = true
  beforeEach(() => commands.parkPointer())
}

/**
 * Opts the current test out of the console guard for these levels (both when
 * omitted). Use it only in a test that asserts the warning.
 */
export function allowConsole(...levels: ConsoleLevel[]): void {
  guard.allow(...levels)
}
