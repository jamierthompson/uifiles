/**
 * The fail-on-console guard behind `tests/setup.ts`, kept free of browser-only
 * imports so the unit project can exercise it against a fake console.
 */
import { type MockInstance, vi } from "vitest"

export type ConsoleLevel = "error" | "warn"

const LEVELS: readonly ConsoleLevel[] = ["error", "warn"]

type ConsoleTarget = Pick<Console, ConsoleLevel>
type ConsoleMethod = ConsoleTarget[ConsoleLevel]

export type ConsoleGuard<T extends ConsoleTarget = ConsoleTarget> = {
  /**
   * The target behind a proxy that reports every mock installed on it or read
   * from it at a guarded level. Code that spies through this object (the
   * setup makes it `globalThis.console`) cannot hide calls from the guard.
   */
  readonly console: T
  /** Opens the window for one test: clears the record and the allowances. */
  start(): void
  /** Lets the current test log at these levels (both when omitted). */
  allow(...levels: ConsoleLevel[]): void
  /** Closes the window, puts back what start() found, and throws when an unallowed call was recorded. */
  stop(): void
}

type Call = { level: ConsoleLevel; message: string; swallowed: boolean }

/**
 * A mock seen at a guarded level during the window, with every `mock.calls`
 * array it used and the index each one counts from. `mockClear()` (which
 * `mockRestore()` runs) swaps in a new array, so the old one still holds
 * what the mock received before the clear.
 */
type Tracked = { level: ConsoleLevel; arrays: Map<unknown[][], number> }

function format(args: readonly unknown[]): string {
  return args
    .map((arg) => {
      if (arg instanceof Error) return arg.stack ?? arg.message
      if (typeof arg === "string") return arg
      try {
        return JSON.stringify(arg)
      } catch {
        return String(arg)
      }
    })
    .join(" ")
}

const isLevel = (key: PropertyKey): key is ConsoleLevel =>
  key === "error" || key === "warn"

/**
 * Installs one wrapper per level on `target` for the guard's lifetime; each
 * forwards to the method it replaced and records calls while a window is
 * open. A spy (`vi.spyOn(console, …)`) wraps the wrapper; one that forwards
 * reaches it, and the call it forwarded is marked as seen. A spy with a mock
 * implementation swallows the call, and its own record is the only trace, so
 * the guard keeps every spy it meets through `console` and charges the calls
 * that never reached a wrapper to the test, even when the spy was restored
 * before the check (by the test, or by an `afterEach` that runs before the
 * guard's).
 */
export function createConsoleGuard<T extends ConsoleTarget>(
  target: T
): ConsoleGuard<T> {
  let open = false
  let allowed = new Set<ConsoleLevel>()
  let calls: Call[] = []
  let spies = new Map<MockInstance, Tracked>()
  let reached = new WeakSet<unknown[]>()
  const atStart = {} as Record<ConsoleLevel, ConsoleMethod>
  const wrappers = {} as Record<ConsoleLevel, ConsoleMethod>

  function remember(level: ConsoleLevel, value: unknown, fromNow = false) {
    if (!open || !vi.isMockFunction(value)) return
    let tracked = spies.get(value)
    if (!tracked) {
      tracked = { level, arrays: new Map() }
      spies.set(value, tracked)
    }
    const array = value.mock.calls
    if (!tracked.arrays.has(array)) {
      tracked.arrays.set(array, fromNow ? array.length : 0)
    }
  }

  for (const level of LEVELS) {
    const original = target[level]
    const wrapper = (...args: unknown[]) => {
      if (open) {
        const current = target[level]
        if (current !== wrapper) {
          // Reached through something installed over the wrapper: mark the
          // call each spy is in the middle of as seen, so it is not charged
          // twice.
          remember(level, current)
          for (const [spy, tracked] of spies) {
            if (tracked.level !== level) continue
            const last = spy.mock.calls.at(-1)
            if (last && spy.mock.results.at(-1)?.type === "incomplete") {
              reached.add(last)
            }
          }
        }
        calls.push({ level, message: format(args), swallowed: false })
      }
      return original.apply(target, args)
    }
    wrappers[level] = wrapper
    target[level] = wrapper
  }

  const observed = new Proxy(target, {
    defineProperty(object, key, descriptor) {
      if (isLevel(key)) remember(key, descriptor.value)
      return Reflect.defineProperty(object, key, descriptor)
    },
    get(object, key) {
      const value: unknown = Reflect.get(object, key)
      if (isLevel(key)) remember(key, value)
      return value
    },
  })

  return {
    console: observed,
    start() {
      allowed = new Set()
      calls = []
      spies = new Map()
      reached = new WeakSet()
      open = true
      for (const level of LEVELS) {
        atStart[level] = target[level]
        // A spy installed before the test (in a beforeAll): only what it
        // receives from now on belongs to this test.
        remember(level, target[level], true)
      }
    },
    allow(...levels) {
      for (const level of levels.length > 0 ? levels : LEVELS) {
        allowed.add(level)
      }
    },
    stop() {
      const replaced: Array<[ConsoleLevel, "before" | "during"]> = []
      for (const level of LEVELS) {
        const current = target[level]
        if (current !== wrappers[level]) {
          if (vi.isMockFunction(current)) remember(level, current)
          else {
            replaced.push([
              level,
              current === atStart[level] ? "before" : "during",
            ])
          }
        }
        target[level] = atStart[level]
      }
      open = false
      for (const [, tracked] of spies) {
        for (const [array, from] of tracked.arrays) {
          for (const args of array.slice(from)) {
            if (reached.has(args)) continue
            calls.push({
              level: tracked.level,
              message: format(args),
              swallowed: true,
            })
          }
        }
      }
      const lines = calls
        .filter((call) => !allowed.has(call.level))
        .map(
          (call) =>
            `  console.${call.level}${call.swallowed ? " (swallowed by a mock implementation)" : ""}: ${call.message}`
        )
      for (const [level, when] of replaced) {
        if (allowed.has(level)) continue
        lines.push(
          `  console.${level} was replaced ${when === "before" ? "before the test (in a beforeAll?)" : "during the test"}, so its calls cannot be checked`
        )
      }
      if (lines.length === 0) return
      throw new Error(
        `Console output during the test (call allowConsole() in a test that asserts it; never replace console methods with a mock implementation):\n${lines.join("\n")}`
      )
    },
  }
}

export type GuardHooks = {
  beforeEach: (fn: () => void | Promise<void>) => void
  afterEach: (fn: () => void | Promise<void>) => void
}

/**
 * Wires the guard around every test. The teardown unmounts the test's tree
 * (`cleanup`) before it checks, so output logged on unmount is charged to the
 * test that rendered the tree, not to the next one whose `beforeEach` would
 * otherwise trigger the unmount.
 */
export function registerConsoleGuard(
  guard: ConsoleGuard,
  hooks: GuardHooks,
  cleanup: () => void | Promise<void>
): void {
  hooks.beforeEach(() => guard.start())
  hooks.afterEach(async () => {
    try {
      await cleanup()
    } finally {
      guard.stop()
    }
  })
}

/**
 * What `tests/setup.ts` runs once per test file: guards `host.console`,
 * makes the guard's proxy the host's `console` (so a test's
 * `vi.spyOn(console, …)` goes through it), and wires the hooks.
 */
export function installConsoleGuard(
  hooks: GuardHooks,
  cleanup: () => void | Promise<void>,
  host: { console: Console } = globalThis
): ConsoleGuard<Console> {
  const guard = createConsoleGuard(host.console)
  host.console = guard.console
  registerConsoleGuard(guard, hooks, cleanup)
  return guard
}
