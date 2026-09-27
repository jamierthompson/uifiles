import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import {
  chmodSync,
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
import { join, relative } from "node:path"
import type { Page } from "@playwright/test"
import { afterEach, describe, expect, it, vi } from "vitest"
import { gotoHydrated } from "@/e2e/helpers"
import { expectsPublicOrigin, isLocalRequest, publicOrigin } from "@/e2e/origin"
import { baseUrl } from "@/lib/registry"

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), "utf8")

describe("playwright.config.ts", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it("serves the production build with the github and html reporters, one retry and two workers in CI", async () => {
    vi.stubEnv("CI", "true")
    vi.resetModules()
    const { default: config } = await import("@/playwright.config")
    const server = Array.isArray(config.webServer)
      ? config.webServer[0]
      : config.webServer
    expect(server?.command).toBe("pnpm start")
    expect(server?.reuseExistingServer).toBe(false)
    expect(config.retries).toBe(1)
    expect(config.workers).toBe(2)
    expect(config.forbidOnly).toBe(true)
    expect(config.reporter).toEqual([["github"], ["html", { open: "never" }]])
  })

  it("builds the registry and runs the dev server locally, reusing one that is up", async () => {
    vi.stubEnv("CI", "")
    delete process.env.CI
    vi.resetModules()
    const { default: config } = await import("@/playwright.config")
    const server = Array.isArray(config.webServer)
      ? config.webServer[0]
      : config.webServer
    expect(server?.command).toBe("pnpm registry:build && pnpm dev")
    expect(server?.reuseExistingServer).toBe(true)
    expect(config.retries).toBe(0)
    expect(config.workers).toBeUndefined()
    expect(config.reporter).toBe("list")
  })

  it("runs every spec on Chromium at desktop and at 375 px phone width", async () => {
    const { default: config } = await import("@/playwright.config")
    const projects = (config.projects ?? []).map((project) => ({
      name: project.name,
      browser: project.use?.defaultBrowserType,
      viewport: project.use?.viewport,
      testIgnore: project.testIgnore,
      testMatch: project.testMatch,
    }))
    expect(projects).toEqual([
      {
        name: "chromium",
        browser: "chromium",
        viewport: { width: 1280, height: 720 },
        testIgnore: undefined,
        testMatch: undefined,
      },
      {
        name: "chromium-mobile",
        browser: "chromium",
        viewport: { width: 375, height: 812 },
        testIgnore: undefined,
        testMatch: undefined,
      },
    ])
  })
})

describe("e2e/origin.ts", () => {
  it("publicOrigin prefers NEXT_PUBLIC_BASE_URL, then the server under test, without a trailing slash", () => {
    expect(
      publicOrigin("http://localhost:3000", {
        NEXT_PUBLIC_BASE_URL: "https://uifiles.dev/",
      })
    ).toBe("https://uifiles.dev")
    expect(publicOrigin("http://localhost:3000/", {})).toBe(
      "http://localhost:3000"
    )
    expect(publicOrigin(undefined, {})).toBe("http://localhost:3000")
    expect(
      publicOrigin("http://localhost:3000", { NEXT_PUBLIC_BASE_URL: " " })
    ).toBe("http://localhost:3000")
  })

  it("publicOrigin fails in CI when NEXT_PUBLIC_BASE_URL is unset, instead of turning the no-localhost assertions into no-ops", () => {
    expect(() => publicOrigin("http://localhost:3000", { CI: "true" })).toThrow(
      /NEXT_PUBLIC_BASE_URL is not set/
    )
    expect(() =>
      publicOrigin("http://localhost:3000", {
        CI: "true",
        NEXT_PUBLIC_BASE_URL: "",
      })
    ).toThrow(/NEXT_PUBLIC_BASE_URL is not set/)
    expect(
      publicOrigin("http://localhost:3000", {
        CI: "true",
        NEXT_PUBLIC_BASE_URL: "https://uifiles.dev",
      })
    ).toBe("https://uifiles.dev")
  })

  // .env.example sets the localhost origin; exporting it in a shell for a
  // local e2e run must not demand a page free of localhost.
  it("expectsPublicOrigin is true in CI and locally once the origin is a public host", () => {
    expect(expectsPublicOrigin({})).toBe(false)
    expect(expectsPublicOrigin({ NEXT_PUBLIC_BASE_URL: "" })).toBe(false)
    expect(expectsPublicOrigin({ NEXT_PUBLIC_BASE_URL: " " })).toBe(false)
    expect(expectsPublicOrigin({ CI: "true" })).toBe(true)
    expect(
      expectsPublicOrigin({
        CI: "true",
        NEXT_PUBLIC_BASE_URL: "http://localhost:3000",
      })
    ).toBe(true)
    expect(
      expectsPublicOrigin({ NEXT_PUBLIC_BASE_URL: "https://uifiles.dev" })
    ).toBe(true)
    for (const local of [
      "http://localhost:3000",
      "http://localhost:3000/",
      "http://127.0.0.1:3000",
      "http://[::1]:3000",
      "http://app.localhost:3000",
    ]) {
      expect(expectsPublicOrigin({ NEXT_PUBLIC_BASE_URL: local }), local).toBe(
        false
      )
    }
  })

  // Both callers need a boolean: the route filter (Playwright always hands
  // it a parsed URL) and expectsPublicOrigin, which reads the variable as
  // typed. A host without a scheme names no loopback origin, so the
  // no-localhost assertions stay on; baseUrl() already fails the build on it.
  it("isLocalRequest and expectsPublicOrigin answer, not throw, for a value that is not an absolute URL", () => {
    for (const value of ["uifiles.dev", "localhost", "not a url", ""]) {
      expect(isLocalRequest(value), value).toBe(false)
    }
    expect(expectsPublicOrigin({ NEXT_PUBLIC_BASE_URL: "uifiles.dev" })).toBe(
      true
    )
  })

  it("publicOrigin rejects a NEXT_PUBLIC_BASE_URL that is not an absolute URL with the message the build gives", () => {
    for (const value of ["uifiles.dev", "//uifiles.dev", "https://"]) {
      const env = { NEXT_PUBLIC_BASE_URL: value }
      const message = `NEXT_PUBLIC_BASE_URL must be an absolute URL such as https://uifiles.dev; got "${value}"`
      expect(() => baseUrl(env), value).toThrow(message)
      expect(() => publicOrigin("http://localhost:3000", env), value).toThrow(
        message
      )
    }
  })

  it("isLocalRequest keeps loopback hosts and blocks every other origin", () => {
    for (const url of [
      "http://localhost:3000/preview/chat",
      "http://app.localhost:3000/",
      "http://127.0.0.1:3000/r/registry.json",
      "http://[::1]:3000/",
    ]) {
      expect(isLocalRequest(url), url).toBe(true)
    }
    for (const url of [
      "https://models.dev/logos/openai.svg",
      "https://fonts.googleapis.com/css2",
      "http://localhost.evil.test/",
      "https://uifiles.dev/",
    ]) {
      expect(isLocalRequest(url), url).toBe(false)
    }
  })
})

describe("e2e/helpers.ts gotoHydrated", () => {
  it("installs the external-request block before the first navigation, aborting only foreign hosts", async () => {
    const calls: string[] = []
    let matcher: ((url: URL) => boolean) | undefined
    let handler:
      | ((route: { abort: (code?: string) => Promise<void> }) => unknown)
      | undefined
    const page = {
      route: async (
        match: (url: URL) => boolean,
        fn: (route: { abort: (code?: string) => Promise<void> }) => unknown
      ) => {
        calls.push("route")
        matcher = match
        handler = fn
      },
      goto: async () => {
        calls.push("goto")
        throw new Error("stop here")
      },
    } as unknown as Page
    await expect(gotoHydrated(page, "/")).rejects.toThrow("stop here")
    expect(calls).toEqual(["route", "goto"])
    expect(matcher?.(new URL("https://models.dev/logos/openai.svg"))).toBe(true)
    expect(matcher?.(new URL("http://localhost:3000/logos/openai.svg"))).toBe(
      false
    )
    const abort = vi.fn(async () => {})
    await handler?.({ abort })
    expect(abort).toHaveBeenCalledWith("blockedbyclient")
  })
})

describe("package.json and .npmrc", () => {
  const pkg = JSON.parse(read("package.json")) as {
    version: string
    license: string
    description: string
    homepage: string
    repository: { type: string; url: string }
    bugs: { url: string }
    engines: { node: string }
    scripts: Record<string, string>
    dependencies: Record<string, string>
    devDependencies: Record<string, string>
  }

  it("carries the metadata every tool that reads it shows", () => {
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/)
    expect(pkg.license).toBe("MIT")
    expect(pkg.description.length).toBeGreaterThan(40)
    expect(pkg.homepage).toBe("https://uifiles.dev")
    expect(pkg.repository).toEqual({
      type: "git",
      url: "git+https://github.com/jamierthompson/uifiles.git",
    })
    expect(pkg.bugs.url).toBe(
      "https://github.com/jamierthompson/uifiles/issues"
    )
  })

  it("keeps the shadcn CLI out of runtime dependencies and exposes a coverage script", () => {
    expect(pkg.dependencies.shadcn).toBeUndefined()
    expect(pkg.devDependencies.shadcn).toBeDefined()
    expect(pkg.devDependencies["@vitest/coverage-v8"]).toBe(
      pkg.devDependencies.vitest
    )
    expect(pkg.scripts["test:coverage"]).toBe("vitest run --coverage")
  })

  it("enforces the Node engine range so type stripping in scripts/*.ts is guaranteed", () => {
    expect(pkg.engines.node).toBe(">=24")
    expect(read(".npmrc")).toMatch(/^engine-strict=true$/m)
    expect(read(".nvmrc").trim()).toBe("24")
  })
})

/**
 * Runs one unit test file in a child Vitest whose cwd is a directory that
 * mirrors the repo through symlinks but has no `public/`, i.e. no built
 * registry.
 */
function runWithoutBuild(
  file: string,
  filter: string,
  env: Record<string, string>
) {
  const dir = mkdtempSync(join(tmpdir(), "uifiles-no-build-"))
  try {
    for (const entry of [
      "registry.json",
      "registry",
      "package.json",
      "app",
      "tests",
      "lib",
      "components",
    ]) {
      symlinkSync(join(root, entry), join(dir, entry))
    }
    const childEnv: Record<string, string | undefined> = {}
    for (const [key, value] of Object.entries(process.env)) {
      // The parent's Vitest variables would make the child think it is a worker.
      if (!key.startsWith("VITEST")) childEnv[key] = value
    }
    // CI runners set FORCE_COLOR (or CI), which makes the child's reporter wrap
    // its summary in escape codes; the assertions below read it as plain text.
    childEnv.NO_COLOR = "1"
    const result = spawnSync(
      process.execPath,
      [
        join(root, "node_modules/vitest/vitest.mjs"),
        "run",
        "--config",
        join(root, "vitest.config.ts"),
        "--project",
        "unit",
        file,
        "-t",
        filter,
      ],
      {
        cwd: dir,
        encoding: "utf8",
        env: { ...childEnv, ...env } as NodeJS.ProcessEnv,
      }
    )
    return { status: result.status, out: result.stdout + result.stderr }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe("built-output checks (tests/unit/registry.test.ts)", () => {
  it("fail in CI when public/r is missing, naming the registry:build step, and skip locally", () => {
    const ci = runWithoutBuild("tests/unit/registry.test.ts", "built output", {
      CI: "true",
    })
    expect(ci.status, ci.out).toBe(1)
    expect(ci.out).toContain(
      "public/r/registry.json is missing: run pnpm registry:build before the tests"
    )
    expect(ci.out).toMatch(/2 failed/)

    const local = runWithoutBuild(
      "tests/unit/registry.test.ts",
      "built output",
      { CI: "" }
    )
    expect(local.status, local.out).toBe(0)
    expect(local.out).toMatch(/Tests\s+\d+ skipped/)
    expect(local.out).not.toMatch(/failed/)
  })

  it("reads the child's summary as plain text even when the environment forces colour", () => {
    const local = runWithoutBuild(
      "tests/unit/registry.test.ts",
      "built output",
      {
        CI: "",
        FORCE_COLOR: "1",
      }
    )
    expect(local.status, local.out).toBe(0)
    expect(local.out).not.toContain("\u001b[")
    expect(local.out).toMatch(/Tests\s+\d+ skipped/)
  })
})

describe("scripts/sync-upstream.ts", () => {
  const script = join(root, "scripts/sync-upstream.ts")
  const stub = `
const mode = process.env.MODE ?? "match"
let calls = 0
globalThis.fetch = async (url) => {
  calls++
  const name = String(url).split("/").pop().replace(".json", "")
  if (mode === "error") throw new TypeError("fetch failed")
  if (mode === "missing") return new Response("nope", { status: 404 })
  if (mode === "mixed" && name === "task") return new Response("nope", { status: 404 })
  if (mode === "mixed" && name === "plan") throw new TypeError("fetch failed")
  const content = mode === "changed" || (mode === "mixed" && name === "tool") ? "CHANGED" : "content-of-" + name
  return new Response(JSON.stringify({ files: [{ content }] }), { status: 200 })
}
process.on("exit", () => console.log("[stub] calls=" + calls))
`

  function run(mode: string) {
    const dir = mkdtempSync(join(tmpdir(), "uifiles-sync-upstream-"))
    try {
      mkdirSync(join(dir, "registry/ai"), { recursive: true })
      mkdirSync(join(dir, "registry/ui"), { recursive: true })
      const lock = JSON.parse(read("registry/ai/upstream.lock.json")) as Record<
        string,
        { source: string; sha256: string }
      >
      for (const entry of Object.values(lock)) {
        const name = entry.source.split("/").pop()?.replace(".json", "") ?? ""
        entry.sha256 = createHash("sha256")
          .update(`content-of-${name}`)
          .digest("hex")
      }
      writeFileSync(
        join(dir, "registry/ai/upstream.lock.json"),
        JSON.stringify(lock)
      )
      writeFileSync(
        join(dir, "registry/ui/registry.json"),
        read("registry/ui/registry.json")
      )
      const stubPath = join(dir, "stub-fetch.mjs")
      writeFileSync(stubPath, stub)
      const result = spawnSync(
        process.execPath,
        ["--import", stubPath, script],
        {
          cwd: dir,
          encoding: "utf8",
          env: { ...process.env, MODE: mode },
        }
      )
      const calls = Number(/\[stub\] calls=(\d+)/.exec(result.stdout)?.[1])
      return {
        status: result.status,
        out: result.stdout + result.stderr,
        calls,
      }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }

  it("exits 0 and fetches each distinct source once when nothing changed", () => {
    const { status, out, calls } = run("match")
    expect(out).toContain("Upstream unchanged.")
    expect(status).toBe(0)
    const entries = Object.keys(
      JSON.parse(read("registry/ai/upstream.lock.json")) as object
    ).length
    expect(entries).toBe(18)
    expect(calls).toBe(17)
  })

  it("exits 1 when a source changed, naming the item and the upstream file it was cut from", () => {
    const { status, out } = run("changed")
    expect(status).toBe(1)
    expect(out).toMatch(/Upstream changed:\n\s+ai\//)
    expect(out).toContain("ai/response (from upstream message)")
  })

  it("exits 2 when nothing changed but a source is missing (404) or unreachable", () => {
    const missing = run("missing")
    expect(missing.status).toBe(2)
    expect(missing.out).toMatch(/Upstream missing \(404\):/)
    const unreachable = run("error")
    expect(unreachable.status).toBe(2)
    expect(unreachable.out).toMatch(
      /Upstream unreachable:\n\s+ai\/[\w-]+.* \(fetch failed\)/
    )
  })

  it("a change wins over a missing or unreachable source, and each is listed under its own heading", () => {
    const { status, out } = run("mixed")
    expect(status).toBe(1)
    expect(out).toMatch(/Upstream changed:\n\s+ai\/tool\n/)
    expect(out).toMatch(/Upstream missing \(404\):\n\s+ai\/task \(404\)/)
    expect(out).toMatch(/Upstream unreachable:\n\s+ai\/plan \(fetch failed\)/)
  })
})

describe("scripts/generate-aliases.ts", () => {
  const script = join(root, "scripts/generate-aliases.ts")
  const index = [
    { name: "input-otp", type: "registry:ui" },
    { name: "hover-card", type: "registry:ui" },
    { name: "button", type: "registry:ui", title: "Button" },
    {
      name: "alert-dialog",
      type: "registry:ui",
      description: "A modal that interrupts the user.",
    },
    { name: "dashboard-01", type: "registry:block" },
  ]
  const llms = [
    "- [Input OTP](https://ui.shadcn.com/docs/components/input-otp): One-time password input.",
    "- [Hover Card](https://ui.shadcn.com/docs/components/hover-card): Preview on hover.",
    "- [Button](https://ui.shadcn.com/docs/components/button): Clickable button.",
  ].join("\n")

  function run(extraIndex: object[] = []) {
    const dir = mkdtempSync(join(tmpdir(), "uifiles-generate-aliases-"))
    try {
      mkdirSync(join(dir, "registry/ui"), { recursive: true })
      mkdirSync(join(dir, "bin"))
      // The script formats its output with `pnpm exec prettier`; a no-op pnpm
      // keeps the run hermetic.
      const pnpm = join(dir, "bin/pnpm")
      writeFileSync(pnpm, "#!/bin/sh\nexit 0\n")
      chmodSync(pnpm, 0o755)
      writeFileSync(
        join(dir, "registry/ui/registry.json"),
        JSON.stringify({
          items: [
            {
              name: "button",
              type: "registry:ui",
              title: "Forked button",
              description: "Our own button.",
              files: [{ path: "button.tsx", type: "registry:ui" }],
            },
          ],
        })
      )
      const stubPath = join(dir, "stub-fetch.mjs")
      writeFileSync(
        stubPath,
        `const index = ${JSON.stringify([...index, ...extraIndex])}
const llms = ${JSON.stringify(llms)}
globalThis.fetch = async (url) =>
  new Response(String(url).endsWith("index.json") ? JSON.stringify(index) : llms)
`
      )
      const result = spawnSync(
        process.execPath,
        ["--import", stubPath, script],
        {
          cwd: dir,
          encoding: "utf8",
          env: {
            ...process.env,
            PATH: `${join(dir, "bin")}:${process.env.PATH}`,
          },
        }
      )
      let items: Array<Record<string, unknown> & { name: string }> = []
      try {
        items = (
          JSON.parse(
            readFileSync(join(dir, "registry/ui/registry.json"), "utf8")
          ) as {
            items: typeof items
          }
        ).items
      } catch {}
      return {
        status: result.status,
        out: result.stdout + result.stderr,
        items,
      }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }

  it("emits one sorted alias per upstream registry:ui item, keeping forks and upstream titles", () => {
    const { status, out, items } = run()
    expect(status, out).toBe(0)
    expect(items.map((item) => item.name)).toEqual([
      "alert-dialog",
      "button",
      "hover-card",
      "input-otp",
    ])
    const byName = Object.fromEntries(items.map((item) => [item.name, item]))
    expect(byName.button).toMatchObject({
      title: "Forked button",
      files: [{ path: "button.tsx" }],
    })
    expect(byName["input-otp"]).toMatchObject({
      title: "Input OTP",
      registryDependencies: ["input-otp"],
      files: [],
      description:
        "One-time password input. Upstream shadcn/ui component, resolved against your style.",
    })
    expect(byName["hover-card"]?.title).toBe("Hover Card")
    expect(byName["alert-dialog"]?.description).toMatch(
      /^A modal that interrupts the user\. Upstream/
    )
    expect(out).toContain("generate-aliases: 4 items (1 forked)")
  })

  it("fails, naming the item, when an upstream item has no description anywhere", () => {
    const { status, out } = run([{ name: "mystery", type: "registry:ui" }])
    expect(status).not.toBe(0)
    expect(out).toContain("No description for mystery; add it to EXTRA")
  })
})

/**
 * The console-guard bypass a reviewer should never have to spot: a spy on a
 * console method given an implementation that swallows the call. The guard
 * charges such calls at runtime; this names the file and line at review
 * time. A spy without an implementation (to assert a message) is fine.
 */
const SILENCERS =
  "mock(?:Implementation|ImplementationOnce|ReturnValue|ReturnValueOnce|ResolvedValue|ResolvedValueOnce|RejectedValue|RejectedValueOnce|Throw|ThrowOnce|ReturnThis)|withImplementation"
const CONSOLE = String.raw`(?:(?:globalThis|window|self)\s*\.\s*)?console`

function consoleSilencers(source: string): string[] {
  const found: string[] = []
  const lineOf = (index: number) => source.slice(0, index).split("\n").length
  const chained = new RegExp(
    String.raw`spyOn\(\s*${CONSOLE}\s*,[^)]*\)(?:\s*\.\s*\w+\([^()]*\))*\s*\.\s*(?:${SILENCERS})\s*\(`,
    "g"
  )
  for (const match of source.matchAll(chained)) {
    found.push(`line ${lineOf(match.index)}: ${match[0]}`)
  }
  const mocked = new RegExp(
    String.raw`vi\.mocked\(\s*${CONSOLE}\s*\.\s*\w+\s*\)\s*\.\s*(?:${SILENCERS})\s*\(`,
    "g"
  )
  for (const match of source.matchAll(mocked)) {
    found.push(`line ${lineOf(match.index)}: ${match[0]}`)
  }
  // A named console spy, from its declaration up to the next declaration of
  // the same name (another test may reuse the name for another spy).
  const named = new RegExp(
    String.raw`\b(?:const|let|var|using)\s+(\w+)\s*=\s*vi\.spyOn\(\s*${CONSOLE}\s*,`,
    "g"
  )
  for (const match of source.matchAll(named)) {
    const name = match[1] ?? ""
    const start = match.index + match[0].length
    const redeclared = new RegExp(
      String.raw`\b(?:const|let|var|using)\s+${name}\s*=`
    ).exec(source.slice(start))
    const scope = source.slice(
      start,
      redeclared ? start + redeclared.index : undefined
    )
    const use = new RegExp(
      String.raw`\b${name}\s*\.\s*(?:${SILENCERS})\s*\(`,
      "g"
    )
    for (const hit of scope.matchAll(use)) {
      found.push(`line ${lineOf(start + hit.index)}: ${hit[0]}`)
    }
  }
  return found
}

describe("browser tests and the console guard", () => {
  it("recognises a console spy given a swallowing implementation, and nothing else", () => {
    for (const source of [
      `vi.spyOn(console, "error").mockImplementation(() => {})`,
      `vi.spyOn(console, 'warn')\n  .mockImplementationOnce(() => undefined)`,
      `vi.spyOn(globalThis.console, "error").mockName("quiet").mockReturnValue(undefined)`,
      `const spy = vi.spyOn(console, "error")\nspy.mockImplementation(() => {})`,
      `let warn = vi.spyOn(window.console, "warn"); warn.withImplementation(() => {}, run)`,
      `using spy = vi.spyOn(console, "error")\nspy.mockReturnValueOnce(undefined)`,
      `vi.mocked(console.error).mockImplementation(() => {})`,
    ]) {
      expect(consoleSilencers(source), source).toHaveLength(1)
    }
    for (const source of [
      `const spy = vi.spyOn(console, "error")\nexpect(spy).toHaveBeenCalledOnce()`,
      `vi.spyOn(console, "warn")`,
      `vi.spyOn(video, "play").mockImplementation(() => Promise.resolve())`,
      `const error = vi.spyOn(console, "error")\nconst play = vi.spyOn(video, "play")\nplay.mockImplementation(() => {})`,
      `const spy = vi.spyOn(console, "error")\nexpect(spy).not.toHaveBeenCalled()\nconst spy = vi.spyOn(video, "play")\nspy.mockImplementation(() => {})`,
      `spy.mockRestore()`,
    ]) {
      expect(consoleSilencers(source), source).toEqual([])
    }
  })

  it("no browser test silences console.error or console.warn with a mock implementation", () => {
    const files: string[] = []
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) walk(full)
        else if (/\.[cm]?[jt]sx?$/.test(entry)) files.push(full)
      }
    }
    walk(join(root, "tests/browser"))
    expect(files.length).toBeGreaterThan(10)
    const offenders = files.flatMap((file) =>
      consoleSilencers(readFileSync(file, "utf8")).map(
        (hit) => `${relative(root, file)} ${hit}`
      )
    )
    expect(offenders).toEqual([])
  })
})
