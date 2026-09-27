import { spawnSync } from "node:child_process"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, relative } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  type ConsoleGuard,
  createConsoleGuard,
  type GuardHooks,
  installConsoleGuard,
  registerConsoleGuard,
} from "@/tests/console-guard"

const root = process.cwd()

describe("console guard (tests/console-guard.ts)", () => {
  const fakeConsole = () => ({ error: vi.fn(), warn: vi.fn() })

  /** The message stop() throws, or "" when it passes. */
  function stopMessage(guard: ConsoleGuard): string {
    try {
      guard.stop()
    } catch (error) {
      return (error as Error).message
    }
    return ""
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("throws at stop() with every console.error and console.warn message recorded since start()", () => {
    const target = fakeConsole()
    const guard = createConsoleGuard(target)
    guard.start()
    target.error("boom", { id: 1 })
    target.warn(new Error("careful"))
    expect(() => guard.stop()).toThrow(
      /console\.error: boom \{"id":1\}[\s\S]*console\.warn: Error: careful/
    )
  })

  it("installs one wrapper per level that forwards to the original method and stays between tests", () => {
    const target = fakeConsole()
    const { error, warn } = target
    const guard = createConsoleGuard(target)
    const wrapper = target.error
    expect(wrapper).not.toBe(error)
    guard.start()
    target.error("x")
    expect(error).toHaveBeenCalledWith("x")
    expect(() => guard.stop()).toThrow(/x/)
    expect(target.error).toBe(wrapper)
    // Between tests the wrapper forwards without recording.
    target.warn("between tests")
    expect(warn).toHaveBeenCalledWith("between tests")
    guard.start()
    expect(() => guard.stop()).not.toThrow()
  })

  it("allow(level) exempts only that level, for the current start()/stop() window", () => {
    const target = fakeConsole()
    const guard = createConsoleGuard(target)
    guard.start()
    guard.allow("warn")
    target.warn("expected")
    expect(() => guard.stop()).not.toThrow()

    guard.start()
    guard.allow("warn")
    target.error("not expected")
    expect(() => guard.stop()).toThrow(/not expected/)

    guard.start()
    target.warn("no longer allowed")
    expect(() => guard.stop()).toThrow(/no longer allowed/)
  })

  it("allow() with no levels exempts both", () => {
    const target = fakeConsole()
    const guard = createConsoleGuard(target)
    guard.start()
    guard.allow()
    target.error("a")
    target.warn("b")
    expect(() => guard.stop()).not.toThrow()
  })

  it("passes silently when nothing was logged", () => {
    const guard = createConsoleGuard(fakeConsole())
    guard.start()
    expect(() => guard.stop()).not.toThrow()
  })

  it("charges the calls a spy's mock implementation swallowed to the test", () => {
    const guard = createConsoleGuard(fakeConsole())
    guard.start()
    const spy = vi.spyOn(guard.console, "error").mockImplementation(() => {})
    guard.console.error("hidden by the mock")
    expect(spy).toHaveBeenCalledTimes(1)
    expect(() => guard.stop()).toThrow(
      /console\.error \(swallowed by a mock implementation\): hidden by the mock/
    )
  })

  // Vitest runs afterEach hooks in reverse registration order (sequence.hooks
  // "stack"), and a describe's own hooks before its parent's in any order, so
  // a test file's `afterEach(() => vi.restoreAllMocks())` runs before the
  // setup file's check and puts the wrapper back first.
  it("still charges the calls a swallowing spy hid when the test file restores mocks in its own afterEach", async () => {
    const target = fakeConsole()
    const guard = createConsoleGuard(target)
    const before: Array<() => void | Promise<void>> = []
    const after: Array<() => void | Promise<void>> = []
    const hooks: GuardHooks = {
      beforeEach: (fn) => before.push(fn),
      afterEach: (fn) => after.push(fn),
    }
    registerConsoleGuard(guard, hooks, () => {})
    // The test file's module-level hook, registered after the setup file's.
    after.push(() => {
      vi.restoreAllMocks()
    })

    for (const hook of before) await hook()
    vi.spyOn(guard.console, "error").mockImplementation(() => {})
    guard.console.error("hidden by the mock, restored before the guard checks")

    const errors: string[] = []
    for (const hook of [...after].reverse()) {
      try {
        await hook()
      } catch (error) {
        errors.push((error as Error).message)
      }
    }
    expect(errors.join("\n")).toMatch(
      /swallowed by a mock implementation\): hidden by the mock, restored before the guard checks/
    )
  })

  it("still charges them when the test restores the spy itself with mockRestore(), which clears the spy's record", () => {
    const target = fakeConsole()
    const guard = createConsoleGuard(target)
    guard.start()
    const spy = vi.spyOn(guard.console, "warn").mockImplementation(() => {})
    guard.console.warn("hidden, then restored")
    spy.mockRestore()
    expect(spy.mock.calls).toEqual([])
    expect(stopMessage(guard)).toMatch(
      /console\.warn \(swallowed by a mock implementation\): hidden, then restored/
    )
  })

  // A module that captured the console object before the setup swapped in
  // the proxy logs on the raw object; the spy is known from its installation.
  it("knows a spy from the moment it is installed, even when the code that logs holds the raw console object", () => {
    const target = fakeConsole()
    const guard = createConsoleGuard(target)
    guard.start()
    const spy = vi.spyOn(guard.console, "error").mockImplementation(() => {})
    target.error("logged on the raw object")
    spy.mockRestore()
    expect(stopMessage(guard)).toMatch(
      /swallowed by a mock implementation\): logged on the raw object/
    )
  })

  it("keeps what a swallowing spy received on both sides of a mockClear()", () => {
    const guard = createConsoleGuard(fakeConsole())
    guard.start()
    const spy = vi.spyOn(guard.console, "error").mockImplementation(() => {})
    guard.console.error("before the clear")
    spy.mockClear()
    guard.console.error("after the clear")
    spy.mockRestore()
    const message = stopMessage(guard)
    expect(message).toContain("before the clear")
    expect(message).toContain("after the clear")
  })

  it("charges a spy installed before the test (in a beforeAll) only with what it swallowed during the test", () => {
    const guard = createConsoleGuard(fakeConsole())
    vi.spyOn(guard.console, "error").mockImplementation(() => {})
    guard.console.error("in beforeAll")
    guard.start()
    guard.console.error("in the test")
    const message = stopMessage(guard)
    expect(message).toMatch(/swallowed by a mock implementation\): in the test/)
    expect(message).not.toContain("in beforeAll")
  })

  it("keeps allowConsole semantics for a swallowing spy on an allowed level", () => {
    const guard = createConsoleGuard(fakeConsole())
    guard.start()
    guard.allow("error")
    vi.spyOn(guard.console, "error").mockImplementation(() => {})
    guard.console.error("asserted through the spy")
    expect(() => guard.stop()).not.toThrow()
  })

  it("counts a call once when a pass-through spy forwards it to the wrapper", () => {
    const guard = createConsoleGuard(fakeConsole())
    guard.start()
    guard.console.warn("before the spy")
    const spy = vi.spyOn(guard.console, "warn")
    guard.console.warn("through the spy")
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
    const message = stopMessage(guard)
    expect(message.match(/console\.warn/g)).toHaveLength(2)
    expect(message).toContain("before the spy")
    expect(message).toContain("through the spy")
    expect(message).not.toContain("swallowed")
  })

  it("recovers only the calls a one-shot mock implementation swallowed", () => {
    const guard = createConsoleGuard(fakeConsole())
    guard.start()
    vi.spyOn(guard.console, "error").mockImplementationOnce(() => {})
    guard.console.error("swallowed once")
    guard.console.error("forwarded afterwards")
    const message = stopMessage(guard)
    expect(message.match(/console\.error/g)).toHaveLength(2)
    expect(message).toMatch(
      /swallowed by a mock implementation\): swallowed once/
    )
    expect(message).toMatch(/console\.error: forwarded afterwards/)
  })

  // With sequence.hooks "list" (or an afterEach registered after the check)
  // the spy is restored after stop(): it puts back the wrapper it wrapped,
  // which must record the next test's calls once, not twice.
  it("leaves one live wrapper when a spy is restored after the check, so the next test records each call once", () => {
    const target = fakeConsole()
    const guard = createConsoleGuard(target)
    const wrapper = target.error
    guard.start()
    const spy = vi.spyOn(guard.console, "error")
    expect(() => guard.stop()).not.toThrow()
    spy.mockRestore()
    expect(target.error).toBe(wrapper)

    guard.start()
    guard.console.error("once")
    expect(stopMessage(guard).match(/console\.error/g)).toHaveLength(1)
  })

  it("fails a test that replaced a console method with a plain function, unless the level is allowed", () => {
    const target: Pick<Console, "error" | "warn"> = fakeConsole()
    const guard = createConsoleGuard(target)
    const wrapper = target.error
    guard.start()
    guard.console.error = () => {}
    guard.console.error("lost")
    expect(() => guard.stop()).toThrow(
      /console\.error was replaced during the test/
    )
    expect(target.error).toBe(wrapper)

    guard.start()
    guard.allow("error")
    guard.console.error = () => {}
    expect(() => guard.stop()).not.toThrow()
  })

  it("fails every test while a console method replaced before it (in a beforeAll) is still in place", () => {
    const target: Pick<Console, "error" | "warn"> = fakeConsole()
    const guard = createConsoleGuard(target)
    const wrapper = target.error
    guard.console.error = () => {}
    guard.start()
    expect(() => guard.stop()).toThrow(
      /console\.error was replaced before the test \(in a beforeAll\?\)/
    )
    guard.console.error = wrapper
    guard.start()
    expect(() => guard.stop()).not.toThrow()
  })

  // React swaps every console method for a no-op while it builds a component
  // stack (disableLogs/reenableLogs) and puts them back at once.
  it("does not flag a replacement that is put back before the test ends", () => {
    const guard = createConsoleGuard(fakeConsole())
    guard.start()
    const previous = guard.console.error
    Object.defineProperties(guard.console, {
      error: { configurable: true, value: () => {}, writable: true },
    })
    Object.defineProperties(guard.console, {
      error: { configurable: true, value: previous, writable: true },
    })
    expect(() => guard.stop()).not.toThrow()
  })

  it("installConsoleGuard puts the guard's proxy in place of the host's console and wires both hooks", () => {
    const original = fakeConsole()
    const host = { console: original as unknown as Console }
    const before: Array<() => void | Promise<void>> = []
    const after: Array<() => void | Promise<void>> = []
    const hosted = installConsoleGuard(
      {
        beforeEach: (fn) => before.push(fn),
        afterEach: (fn) => after.push(fn),
      },
      () => {},
      host
    )
    expect(host.console).toBe(hosted.console)
    expect(host.console).not.toBe(original)
    expect(before).toHaveLength(1)
    expect(after).toHaveLength(1)
    hosted.start()
    vi.spyOn(host.console, "warn").mockImplementation(() => {})
    host.console.warn("through the host")
    vi.restoreAllMocks()
    expect(stopMessage(hosted)).toMatch(
      /swallowed by a mock implementation\): through the host/
    )
  })

  it("registers a beforeEach that starts and an afterEach that unmounts before it checks, charging unmount output to the test that rendered", async () => {
    const target = fakeConsole()
    const guard = createConsoleGuard(target)
    const before: Array<() => void | Promise<void>> = []
    const after: Array<() => void | Promise<void>> = []
    const hooks: GuardHooks = {
      beforeEach: (fn) => before.push(fn),
      afterEach: (fn) => after.push(fn),
    }
    const order: string[] = []
    let unmounts = 0
    registerConsoleGuard(guard, hooks, async () => {
      order.push("cleanup")
      if (unmounts++ === 0) target.error("logged on unmount")
    })
    expect(before).toHaveLength(1)
    expect(after).toHaveLength(1)

    await before[0]?.()
    order.push("test body")
    await expect(after[0]?.()).rejects.toThrow(/logged on unmount/)
    expect(order).toEqual(["test body", "cleanup"])

    // The next test starts clean: nothing from that unmount is carried over.
    await before[0]?.()
    await expect(after[0]?.()).resolves.toBeUndefined()
  })

  it("stops the guard even when the unmount throws, so the next test is not nested", async () => {
    const target = fakeConsole()
    const guard = createConsoleGuard(target)
    const after: Array<() => void | Promise<void>> = []
    registerConsoleGuard(
      guard,
      { beforeEach: (fn) => void fn(), afterEach: (fn) => after.push(fn) },
      () => {
        throw new Error("unmount failed")
      }
    )
    guard.start()
    target.error("recorded before the unmount failed")
    await expect(after[0]?.()).rejects.toThrow(/unmount failed/)
    // The window is closed: a call now is forwarded, not recorded.
    target.error("after the window")
    guard.start()
    expect(() => guard.stop()).not.toThrow()
  })
})

/**
 * Runs `probe` (a test file) in a child Vitest whose setup file installs the
 * guard with the call tests/setup.ts makes, so the real runner decides the
 * hook order. The child runs in a temp dir that links node_modules.
 */
function runGuardProbe(
  probe: string,
  extraArgs: string[] = [],
  extraEnv: Record<string, string> = {}
) {
  const dir = mkdtempSync(join(tmpdir(), "uifiles-guard-"))
  try {
    symlinkSync(join(root, "node_modules"), join(dir, "node_modules"))
    writeFileSync(
      join(dir, "setup.ts"),
      `import { afterEach, beforeEach } from "vitest"
import { installConsoleGuard } from ${JSON.stringify(join(root, "tests/console-guard.ts"))}
installConsoleGuard({ beforeEach, afterEach }, () => {})
`
    )
    writeFileSync(join(dir, "probe.test.ts"), probe)
    writeFileSync(
      join(dir, "vitest.config.mjs"),
      `export default { test: { include: ["probe.test.ts"], setupFiles: ["./setup.ts"], environment: "node" } }\n`
    )
    const env: Record<string, string | undefined> = {}
    for (const [key, value] of Object.entries(process.env)) {
      // The parent's Vitest variables would make the child think it is a worker.
      if (!key.startsWith("VITEST")) env[key] = value
    }
    // CI runners set FORCE_COLOR (or CI), which makes the child's reporter wrap
    // its summary in escape codes; the assertions read it as plain text.
    env.NO_COLOR = "1"
    Object.assign(env, extraEnv)
    const result = spawnSync(
      process.execPath,
      [
        join(root, "node_modules/vitest/vitest.mjs"),
        "run",
        "--config",
        join(dir, "vitest.config.mjs"),
        ...extraArgs,
      ],
      { cwd: dir, encoding: "utf8", env: env as NodeJS.ProcessEnv }
    )
    return { status: result.status, out: result.stdout + result.stderr }
  } finally {
    // rmSync removes the node_modules symlink, not the tree it points at.
    rmSync(dir, { recursive: true, force: true })
  }
}

describe("console guard under the real runner's hook order", () => {
  const probe = `import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => {
  vi.restoreAllMocks()
})

it("restored by the file's afterEach", () => {
  vi.spyOn(console, "error").mockImplementation(() => {})
  console.error("hidden A: file-level restore")
})

describe("nested", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })
  it("restored by a describe-level afterEach", () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    console.error("hidden B: describe-level restore")
  })
})

it("restored by the test with mockRestore()", () => {
  const spy = vi.spyOn(console, "warn").mockImplementation(() => {})
  console.warn("hidden C: mockRestore")
  spy.mockRestore()
})

it("a pass-through spy on a silent test", () => {
  expect(vi.spyOn(console, "error")).not.toHaveBeenCalled()
})

it("a silent test after the others", () => {
  expect(1).toBe(1)
})
`

  for (const [order, args] of [
    ["stack (the default)", []],
    ["list", ["--sequence.hooks=list"]],
  ] as const) {
    it(`fails every test whose swallowing spy was restored before the check, with sequence.hooks ${order}`, () => {
      const { status, out } = runGuardProbe(probe, [...args])
      expect(status, out).toBe(1)
      expect(out).toMatch(/Tests\s+3 failed \| 2 passed/)
      expect(out).toMatch(
        /console\.error \(swallowed by a mock implementation\): hidden A: file-level restore/
      )
      expect(out).toMatch(
        /console\.error \(swallowed by a mock implementation\): hidden B: describe-level restore/
      )
      expect(out).toMatch(
        /console\.warn \(swallowed by a mock implementation\): hidden C: mockRestore/
      )
    })
  }

  it("reads the probe's summary as plain text even when the environment forces colour", () => {
    const { status, out } = runGuardProbe(probe, [], { FORCE_COLOR: "1" })
    expect(status, out).toBe(1)
    expect(out).not.toContain("\u001b[")
    expect(out).toMatch(/Tests\s+3 failed \| 2 passed/)
  })
})

/** Every .ts/.tsx file under `dir`, recursively. */
function listSources(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) files.push(...listSources(full))
    else if (/\.tsx?$/.test(entry)) files.push(full)
  }
  return files
}

/** The file a local specifier names: `@/…` from the root, `./…` and `../…` from the importer. */
function resolveLocal(root: string, from: string, spec: string) {
  const base = spec.startsWith("@/")
    ? join(root, spec.slice(2))
    : join(dirname(from), spec)
  return ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]
    .map((suffix) => base + suffix)
    .find((path) => existsSync(path) && statSync(path).isFile())
}

/**
 * One whole type-only from-statement, which TypeScript erases, so the browser
 * never requests its module: `import type { A } from "x"` (the braces may
 * span lines), `import type A from "x"`, `import type * as A from "x"`,
 * `export type { A } from "x"` and `export type * from "x"`. Nothing else: an
 * `export type A = …` alias is not one (erasing from it to the next quoted
 * string would swallow the value imports after it), and an inline
 * `import { type A } from "x"` still counts as a use of "x".
 */
const TYPE_ONLY_STATEMENT =
  /^(?:import|export)\s+type\s+(?:\{[^}]*\}|\*(?:\s+as\s+[\w$]+)?|[\w$]+)\s+from\s+"[^"]*"/gm

/**
 * A file reader that throws when asked for a path it already read. The walk
 * reads each file once, so a walk that lost its cycle guard fails on the
 * second read instead of looping: a test timeout cannot interrupt a
 * synchronous loop.
 */
function readEachOnce(): (path: string) => string {
  const done = new Set<string>()
  return (path) => {
    if (done.has(path)) throw new Error(`read twice: ${path}`)
    done.add(path)
    return readFileSync(path, "utf8")
  }
}

type ImportWalk = {
  /** Every file the walk read, relative to the root. */
  reached: string[]
  /** The bare specifiers those files import, sorted; type-only statements are skipped. */
  bare: string[]
  /** `file: specifier` for each local import that names no file. */
  unresolved: string[]
}

/**
 * Reads every .ts/.tsx file under the `seeds` directories of `root` and
 * follows their local imports (`@/…`, `./…`, `../…`, extensionless or an
 * index file) into the rest of the tree, each file once. A local import of a
 * non-TypeScript file (a stylesheet) resolves but is not read.
 */
function walkImports(
  root: string,
  seeds: readonly string[],
  read: (path: string) => string
): ImportWalk {
  const pending = seeds.flatMap((dir) => listSources(join(root, dir)))
  const reached = new Set<string>()
  const bare = new Set<string>()
  const unresolved: string[] = []
  for (let file = pending.pop(); file !== undefined; file = pending.pop()) {
    if (reached.has(file)) continue
    reached.add(file)
    const source = read(file).replace(TYPE_ONLY_STATEMENT, "")
    for (const match of source.matchAll(/from\s+"([^"]+)"/g)) {
      const spec = match[1]
      if (spec === undefined) continue
      if (spec.startsWith("@/") || spec.startsWith(".")) {
        const local = resolveLocal(root, file, spec)
        if (local === undefined) {
          unresolved.push(`${relative(root, file)}: ${spec}`)
        } else if (/\.tsx?$/.test(local)) pending.push(local)
      } else bare.add(spec)
    }
  }
  return {
    reached: [...reached].map((file) => relative(root, file)),
    bare: [...bare].sort(),
    unresolved,
  }
}

describe("the import walk behind the pre-bundling check", () => {
  const roots: string[] = []

  /** Writes `files` (path → source) under a fresh temp root and returns it. */
  function tree(files: Record<string, string>): string {
    const dir = mkdtempSync(join(tmpdir(), "uifiles-imports-"))
    roots.push(dir)
    for (const [path, source] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, path)), { recursive: true })
      writeFileSync(join(dir, path), source)
    }
    return dir
  }

  afterEach(() => {
    for (const dir of roots.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("stops at an import cycle, reading each file once", () => {
    const dir = tree({
      "seed/a.ts": 'import { b } from "../lib/b"\nexport const a = b\n',
      "lib/b.ts": [
        'import { a } from "../seed/a"',
        'import { c } from "cycle-pkg"',
        "export const b = c",
        "",
      ].join("\n"),
    })
    const walk = walkImports(dir, ["seed"], readEachOnce())
    expect([...walk.reached].sort()).toEqual(["lib/b.ts", "seed/a.ts"])
    expect(walk.bare).toEqual(["cycle-pkg"])
    expect(walk.unresolved).toEqual([])
  })

  it("reports a local import that names no file", () => {
    const dir = tree({
      "seed/a.ts": 'import { x } from "./nope"\nimport { y } from "@/nope"\n',
    })
    const walk = walkImports(dir, ["seed"], readEachOnce())
    expect(walk.unresolved).toEqual(["seed/a.ts: ./nope", "seed/a.ts: @/nope"])
    expect(walk.bare).toEqual([])
  })

  it("skips a whole type-only import or re-export statement, and still reports a value import that follows an `export type` alias", () => {
    const dir = tree({
      "seed/page.tsx": [
        'import type { Metadata } from "type-named"',
        'import type Default from "type-default"',
        'import type * as Namespace from "type-namespace"',
        "import type {",
        "  First,",
        "  Second,",
        '} from "type-multiline"',
        'export type { Reexported } from "type-reexport"',
        'export type * from "type-star"',
        "export type Probe = { id: number }",
        'import Link from "value-after-alias"',
        "export type Alias = Probe",
        'export { thing } from "value-reexport"',
        "",
      ].join("\n"),
    })
    expect(walkImports(dir, ["seed"], readEachOnce()).bare).toEqual([
      "value-after-alias",
      "value-reexport",
    ])
  })

  it('counts an inline `import { type X } from "pkg"` as a use of pkg: only a whole type-only statement is skipped', () => {
    const dir = tree({
      "seed/a.ts": [
        'import { type Shape, make } from "mixed-pkg"',
        'import { type OnlyType } from "inline-type-pkg"',
        "",
      ].join("\n"),
    })
    expect(walkImports(dir, ["seed"], readEachOnce()).bare).toEqual([
      "inline-type-pkg",
      "mixed-pkg",
    ])
  })

  it("follows `@/` and `../` imports out of the seed directory to a bare specifier", () => {
    const dir = tree({
      "tests/browser/page.test.tsx": 'import { Page } from "@/lib"\n',
      "lib/index.ts": 'export { Page } from "../app/page"\n',
      "app/page.tsx":
        'import Link from "next/link"\nexport const Page = Link\n',
    })
    const walk = walkImports(dir, ["tests/browser"], readEachOnce())
    expect(walk.bare).toEqual(["next/link"])
    expect([...walk.reached].sort()).toEqual([
      "app/page.tsx",
      "lib/index.ts",
      "tests/browser/page.test.tsx",
    ])
    expect(walk.unresolved).toEqual([])
  })

  it("sees a bare specifier only under a seed directory or in a file one imports, so a dropped seed hides its imports", () => {
    const dir = tree({
      "one/a.ts": 'import { a } from "pkg-one"\n',
      "two/b.ts": 'import { b } from "pkg-two"\n',
    })
    expect(walkImports(dir, ["one", "two"], readEachOnce()).bare).toEqual([
      "pkg-one",
      "pkg-two",
    ])
    expect(walkImports(dir, ["one"], readEachOnce()).bare).toEqual(["pkg-one"])
  })
})

describe("vitest.config.ts optimizeDeps.include", () => {
  const config = readFileSync(join(root, "vitest.config.ts"), "utf8")
  const includeBlock = /include:\s*\[([^\]]*)\]/.exec(config)?.[1] ?? ""
  const include = [...includeBlock.matchAll(/"([^"]+)"/g)]
    .map((match) => match[1])
    .filter((spec): spec is string => spec !== undefined)

  const packageRoot = (spec: string) =>
    spec.startsWith("@")
      ? spec.split("/").slice(0, 2).join("/")
      : (spec.split("/")[0] ?? spec)

  it("names only installed packages (a typo would silently re-optimize mid-run)", () => {
    expect(include.length).toBeGreaterThan(0)
    expect(
      include.filter(
        (spec) => !existsSync(join(root, "node_modules", packageRoot(spec)))
      )
    ).toEqual([])
  })

  // Vite pre-bundles what the list names, once per cache; a specifier outside
  // it is bundled only when Vite meets it, and one first met mid-run (a
  // subpath such as react-dom/server reached by one file) triggers a re-bundle
  // that invalidates in-flight test-file imports. So every bare specifier a
  // browser test can reach is listed, subpaths included: all of registry/**
  // and components/**, every browser test, and every local module those
  // import, which brings in the app/** preview pages and demos that some
  // tests render and the tests/*.ts helpers. The rest of app/** (next/link,
  // next/font) runs only under Next. Only the runner's own modules are
  // served by Vitest itself.
  it("lists every bare specifier that registry/**, components/**, tests/browser/** and the local modules they import (app/** included) import, subpaths included", () => {
    const walk = walkImports(
      root,
      ["registry", "components", "tests/browser"],
      readEachOnce()
    )
    // Not vacuous: the walk read every file under the three seed directories
    // (named again here, not shared with the call, so a seed dropped from the
    // call fails), went on into the modules they import, and resolved every
    // local import.
    const unread = ["registry", "components", "tests/browser"]
      .flatMap((dir) => listSources(join(root, dir)))
      .map((file) => relative(root, file))
      .filter((file) => !walk.reached.includes(file))
    expect(unread, "seed files the walk did not read").toEqual([])
    expect(
      walk.reached.filter(
        (file) => !/^(?:registry|components|tests\/browser)\//.test(file)
      ),
      "files reached only through local imports"
    ).not.toEqual([])
    expect(walk.unresolved, "local imports the walk could not follow").toEqual(
      []
    )
    const served = /^vitest(\/browser)?$/
    expect(
      walk.bare.filter(
        (spec) =>
          !spec.startsWith("node:") &&
          !served.test(spec) &&
          !include.includes(spec)
      )
    ).toEqual([])
  })

  it("names the react-dom subpaths the server-rendering and hydration tests import", () => {
    expect(include).toEqual(
      expect.arrayContaining([
        "react-dom",
        "react-dom/client",
        "react-dom/server",
      ])
    )
  })
})
