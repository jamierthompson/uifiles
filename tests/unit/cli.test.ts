// The `uifiles` CLI (packages/uifiles): `uifiles init` writes the @uifiles
// registry into a project's components.json. The command's logic is tested
// through its exports; the published bin is built with the real compiler into
// a temp directory and run, so the emitted file is proven to work too.
import { spawnSync } from "node:child_process"
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { afterEach, describe, expect, it } from "vitest"
import {
  CONFIG_FILE,
  DEFAULT_ORIGIN,
  InitError,
  initRegistry,
  isMain,
  NAMESPACE,
  registryUrl,
  run,
  SHADCN_ADD,
  SHADCN_INIT,
} from "@/packages/uifiles/src/cli"

const root = process.cwd()
const pkgDir = join(root, "packages/uifiles")
const URL_TEMPLATE = "https://uifiles.dev/r/{name}.json"

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true })
})

/** A temp project holding the given components.json text (none when omitted). */
function project(config?: string) {
  const dir = mkdtempSync(join(tmpdir(), "uifiles-cli-"))
  dirs.push(dir)
  if (config !== undefined) writeFileSync(join(dir, CONFIG_FILE), config)
  return dir
}

const readConfig = (dir: string) => readFileSync(join(dir, CONFIG_FILE), "utf8")
const parseConfig = (dir: string) =>
  JSON.parse(readConfig(dir)) as Record<string, unknown>

const BARE = `{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "base-nova",
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
`

/** Runs the command the way the bin does, capturing both streams. */
function cli(argv: string[], cwd: string) {
  const out: string[] = []
  const err: string[] = []
  const code = run(argv, {
    cwd,
    stdout: { write: (chunk: string) => out.push(chunk) },
    stderr: { write: (chunk: string) => err.push(chunk) },
  })
  return {
    code,
    out: out.join("").replace(/\n$/, ""),
    err: err.join("").replace(/\n$/, ""),
  }
}

describe("registryUrl", () => {
  it("builds <origin>/r/{name}.json, dropping a trailing slash and keeping a path prefix", () => {
    expect(registryUrl()).toBe(URL_TEMPLATE)
    expect(registryUrl("https://uifiles.dev/")).toBe(URL_TEMPLATE)
    expect(registryUrl("http://localhost:3000")).toBe(
      "http://localhost:3000/r/{name}.json"
    )
    expect(registryUrl("https://example.com/ui/?x=1#y")).toBe(
      "https://example.com/ui/r/{name}.json"
    )
  })

  it("rejects a relative URL, a non-http scheme and a template that already carries {name}", () => {
    expect(() => registryUrl("uifiles.dev")).toThrow(InitError)
    expect(() => registryUrl("uifiles.dev")).toThrow(
      /absolute URL such as https:\/\/uifiles\.dev; got "uifiles\.dev"/
    )
    expect(() => registryUrl("ftp://uifiles.dev")).toThrow(/http or https URL/)
    expect(() => registryUrl("https://uifiles.dev/r/{name}.json")).toThrow(
      /not a URL template/
    )
  })

  it("defaults to the origin the registry's own catalog advertises", () => {
    const { homepage } = JSON.parse(
      readFileSync(join(root, "registry.json"), "utf8")
    ) as { homepage: string }
    expect(DEFAULT_ORIGIN).toBe(homepage)
    expect(SHADCN_INIT).toBe(
      `pnpm dlx shadcn@latest init ${homepage}/r/base.json`
    )
  })
})

describe("initRegistry", () => {
  it("adds @uifiles to a components.json without registries, as its last key, keeping the indentation and the final newline", () => {
    const dir = project(BARE)
    const result = initRegistry({ cwd: dir })
    expect(result).toEqual({
      status: "added",
      file: join(dir, CONFIG_FILE),
      url: URL_TEMPLATE,
    })
    const text = readConfig(dir)
    expect(text).toBe(
      BARE.replace(
        /\n}\n$/,
        `,\n  "registries": {\n    "@uifiles": "${URL_TEMPLATE}"\n  }\n}\n`
      )
    )
    expect(Object.keys(parseConfig(dir)).at(-1)).toBe("registries")
  })

  it("adds @uifiles beside the registries a project already has, keeping their order", () => {
    const dir = project(
      JSON.stringify(
        {
          style: "base-nova",
          registries: { "@acme": "https://acme.com/r/{name}.json" },
          iconLibrary: "lucide",
        },
        null,
        2
      )
    )
    expect(initRegistry({ cwd: dir }).status).toBe("added")
    const config = parseConfig(dir)
    expect(Object.keys(config)).toEqual(["style", "registries", "iconLibrary"])
    expect(config.registries).toEqual({
      "@acme": "https://acme.com/r/{name}.json",
      "@uifiles": URL_TEMPLATE,
    })
  })

  it("does nothing when @uifiles already points at the URL", () => {
    const dir = project(BARE)
    initRegistry({ cwd: dir })
    const before = readConfig(dir)
    expect(initRegistry({ cwd: dir })).toEqual({
      status: "unchanged",
      file: join(dir, CONFIG_FILE),
      url: URL_TEMPLATE,
    })
    expect(readConfig(dir)).toBe(before)
  })

  it("keeps an @uifiles entry that points elsewhere unless force is set, and then reports what it replaced", () => {
    const local = "http://localhost:3000/r/{name}.json"
    const dir = project(
      JSON.stringify({ registries: { "@uifiles": local } }, null, 2)
    )
    expect(initRegistry({ cwd: dir })).toEqual({
      status: "kept",
      file: join(dir, CONFIG_FILE),
      url: URL_TEMPLATE,
      current: local,
    })
    expect(parseConfig(dir).registries).toEqual({ "@uifiles": local })
    expect(initRegistry({ cwd: dir, force: true })).toEqual({
      status: "replaced",
      file: join(dir, CONFIG_FILE),
      url: URL_TEMPLATE,
      previous: local,
    })
    expect(parseConfig(dir).registries).toEqual({ "@uifiles": URL_TEMPLATE })
  })

  it("treats an object entry (url plus headers) as pointing elsewhere", () => {
    const entry = { url: URL_TEMPLATE, headers: { Authorization: "x" } }
    const dir = project(JSON.stringify({ registries: { "@uifiles": entry } }))
    const result = initRegistry({ cwd: dir })
    expect(result.status).toBe("kept")
    expect(result).toHaveProperty("current", entry)
  })

  it("preserves tab indentation and a missing final newline", () => {
    const dir = project('{\n\t"style": "base-nova"\n}')
    initRegistry({ cwd: dir })
    expect(readConfig(dir)).toBe(
      `{\n\t"style": "base-nova",\n\t"registries": {\n\t\t"@uifiles": "${URL_TEMPLATE}"\n\t}\n}`
    )
  })

  it("indents a single-line file with two spaces", () => {
    const dir = project('{"style":"base-nova"}\n')
    initRegistry({ cwd: dir })
    expect(readConfig(dir)).toBe(
      `{\n  "style": "base-nova",\n  "registries": {\n    "@uifiles": "${URL_TEMPLATE}"\n  }\n}\n`
    )
  })

  it("writes the URL of a custom origin", () => {
    const dir = project(BARE)
    const result = initRegistry({ cwd: dir, origin: "http://localhost:3000/" })
    expect(result.url).toBe("http://localhost:3000/r/{name}.json")
    expect(parseConfig(dir).registries).toEqual({
      "@uifiles": "http://localhost:3000/r/{name}.json",
    })
  })

  it("fails, naming the shadcn init command, when there is no components.json, and writes nothing", () => {
    const dir = project()
    let error: unknown
    try {
      initRegistry({ cwd: dir })
    } catch (caught) {
      error = caught
    }
    expect(error).toBeInstanceOf(InitError)
    const message = (error as Error).message
    expect(message).toContain(`No ${CONFIG_FILE} in ${dir}`)
    expect(message).toContain(SHADCN_INIT)
    expect(message).toContain("--cwd")
    expect(() => readConfig(dir)).toThrow()
  })

  it("fails on a file that is not JSON, not an object, or has registries that are not an object, and leaves it untouched", () => {
    for (const [text, pattern] of [
      ["{ not json", /is not valid JSON: /],
      ['["base-nova"]', /must hold a JSON object/],
      ["null", /must hold a JSON object/],
      [
        '{ "registries": "https://x" }',
        /"registries" value that is not an object/,
      ],
      [
        '{ "registries": ["@uifiles"] }',
        /"registries" value that is not an object/,
      ],
    ] as const) {
      const dir = project(text)
      expect(() => initRegistry({ cwd: dir }), text).toThrow(InitError)
      expect(() => initRegistry({ cwd: dir }), text).toThrow(pattern)
      expect(readConfig(dir), text).toBe(text)
    }
  })

  it("rejects a bad origin before touching the file", () => {
    const dir = project(BARE)
    expect(() => initRegistry({ cwd: dir, origin: "nope" })).toThrow(InitError)
    expect(readConfig(dir)).toBe(BARE)
  })
})

describe("run", () => {
  it("prints the usage on --help and the package version on --version, exiting 0", () => {
    const dir = project()
    const help = cli(["--help"], dir)
    expect(help.code).toBe(0)
    expect(help.err).toBe("")
    expect(help.out).toContain(
      "uifiles init [--cwd <dir>] [--url <origin>] [--force]"
    )
    expect(help.out).toContain(SHADCN_INIT)
    expect(cli(["-h"], dir).out).toBe(help.out)
    const { version } = JSON.parse(
      readFileSync(join(pkgDir, "package.json"), "utf8")
    ) as { version: string }
    expect(cli(["--version"], dir)).toEqual({ code: 0, out: version, err: "" })
    expect(cli(["-v"], dir).out).toBe(version)
  })

  it("exits 1 with the reason and the usage when the command is missing, unknown or has extra arguments, or an option is unknown or lacks its value", () => {
    const dir = project(BARE)
    for (const [argv, reason] of [
      [[], "Missing command."],
      [["frob"], "Unknown command: frob"],
      [["init", "extra"], "Unknown command: init extra"],
      [["init", "--nope"], "Unknown option '--nope'"],
      [["init", "--url"], "Option '--url <value>' argument missing"],
    ] as const) {
      const result = cli([...argv], dir)
      expect(result.code, argv.join(" ")).toBe(1)
      expect(result.out, argv.join(" ")).toBe("")
      expect(result.err, argv.join(" ")).toContain(reason)
      expect(result.err, argv.join(" ")).toContain("Usage")
    }
    expect(readConfig(dir)).toBe(BARE)
  })

  it("reports an added entry with the file relative to the working directory and the add command", () => {
    const dir = project(BARE)
    const result = cli(["init"], dir)
    expect(result).toEqual({
      code: 0,
      out: `Added "${NAMESPACE}": "${URL_TEMPLATE}" to ${CONFIG_FILE}.\nAdd components with: ${SHADCN_ADD}`,
      err: "",
    })
    expect(parseConfig(dir).registries).toEqual({ "@uifiles": URL_TEMPLATE })
  })

  it("resolves --cwd against the working directory and names the file by that path", () => {
    const dir = project()
    mkdirSync(join(dir, "apps/web"), { recursive: true })
    writeFileSync(join(dir, "apps/web", CONFIG_FILE), BARE)
    const result = cli(["init", "--cwd", "apps/web"], dir)
    expect(result.code).toBe(0)
    expect(result.out).toContain(`to apps/web/${CONFIG_FILE}.`)
    expect(parseConfig(join(dir, "apps/web")).registries).toEqual({
      "@uifiles": URL_TEMPLATE,
    })
  })

  it("reports an unchanged, a kept and a replaced entry, each on stdout with exit 0", () => {
    const dir = project(BARE)
    cli(["init"], dir)
    expect(cli(["init"], dir)).toEqual({
      code: 0,
      out: `${CONFIG_FILE} already points ${NAMESPACE} at ${URL_TEMPLATE}; nothing to do.`,
      err: "",
    })
    const local = "http://localhost:3000/r/{name}.json"
    expect(cli(["init", "--url", "http://localhost:3000"], dir)).toEqual({
      code: 0,
      out: `${CONFIG_FILE} points ${NAMESPACE} at "${URL_TEMPLATE}"; left as is. Pass --force to replace it with ${local}.`,
      err: "",
    })
    expect(parseConfig(dir).registries).toEqual({ "@uifiles": URL_TEMPLATE })
    expect(
      cli(["init", "--url", "http://localhost:3000", "--force"], dir)
    ).toEqual({
      code: 0,
      out: `Replaced ${NAMESPACE} in ${CONFIG_FILE}: "${URL_TEMPLATE}" is now ${local}.`,
      err: "",
    })
    expect(parseConfig(dir).registries).toEqual({ "@uifiles": local })
  })

  it("exits 1 with the init error on stderr and nothing on stdout", () => {
    const dir = project()
    const missing = cli(["init"], dir)
    expect(missing.code).toBe(1)
    expect(missing.out).toBe("")
    expect(missing.err).toContain(`No ${CONFIG_FILE} in ${dir}`)
    expect(missing.err).toContain(SHADCN_INIT)
    const badUrl = cli(["init", "--url", "uifiles.dev"], project(BARE))
    expect(badUrl.code).toBe(1)
    expect(badUrl.err).toMatch(/--url must be an absolute URL/)
  })

  it("lets an unexpected error through with its stack, rather than reporting it as a usage error", () => {
    const dir = project()
    // A directory named components.json: exists, but cannot be read as a file.
    mkdirSync(join(dir, CONFIG_FILE))
    expect(() => cli(["init"], dir)).toThrow(/EISDIR/)
  })
})

describe("the published package (packages/uifiles)", () => {
  const pkg = JSON.parse(
    readFileSync(join(pkgDir, "package.json"), "utf8")
  ) as {
    name: string
    version: string
    description: string
    license: string
    type: string
    bin: Record<string, string>
    files: string[]
    engines: { node: string }
    repository: { url: string; directory: string }
    scripts: Record<string, string>
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }

  it("publishes dist/cli.js as the uifiles bin, from an ESM package with no dependencies", () => {
    expect(pkg.name).toBe("uifiles")
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/)
    expect(pkg.description).toContain("uifiles init")
    expect(pkg.license).toBe("MIT")
    expect(pkg.type).toBe("module")
    expect(pkg.bin).toEqual({ uifiles: "./dist/cli.js" })
    expect(pkg.files).toEqual(["dist"])
    expect(pkg.engines.node).toBe(">=20")
    expect(pkg.repository.url).toBe(
      "git+https://github.com/jamiethompsondesign/uifiles.git"
    )
    expect(pkg.repository.directory).toBe("packages/uifiles")
    expect(pkg.dependencies).toBeUndefined()
    expect(pkg.devDependencies).toBeUndefined()
    expect(pkg.scripts.prepublishOnly).toBe("pnpm build")
    expect(pkg.scripts.build).toBe("tsc -p .")
    expect(readFileSync(join(pkgDir, "LICENSE"), "utf8")).toBe(
      readFileSync(join(root, "LICENSE"), "utf8")
    )
    expect(readFileSync(join(pkgDir, "README.md"), "utf8")).toContain(
      "uifiles init"
    )
  })

  it("is a workspace package the root builds with `pnpm cli:build`, with its build output ignored everywhere", () => {
    const rootPkg = JSON.parse(
      readFileSync(join(root, "package.json"), "utf8")
    ) as {
      name: string
      scripts: Record<string, string>
    }
    expect(rootPkg.name).not.toBe(pkg.name)
    expect(rootPkg.scripts["cli:build"]).toBe("pnpm --filter uifiles build")
    expect(readFileSync(join(root, "pnpm-workspace.yaml"), "utf8")).toContain(
      'packages:\n  - "packages/*"\n'
    )
    expect(readFileSync(join(root, ".gitignore"), "utf8")).toMatch(
      /^\/packages\/\*\/dist\/$/m
    )
    expect(readFileSync(join(root, ".prettierignore"), "utf8")).toMatch(
      /^packages\/\*\/dist\/$/m
    )
    expect(readFileSync(join(root, "biome.json"), "utf8")).toContain(
      '"!packages/*/dist"'
    )
    expect(readFileSync(join(root, "tsconfig.json"), "utf8")).toContain(
      '"packages/*/dist"'
    )
  })

  it("compiles to a dist/cli.js that starts with the shebang and runs init end to end", () => {
    const dir = project()
    const built = join(dir, "pkg")
    mkdirSync(built)
    cpSync(join(pkgDir, "package.json"), join(built, "package.json"))
    const build = spawnSync(
      process.execPath,
      [
        join(root, "node_modules/typescript/bin/tsc"),
        "-p",
        pkgDir,
        "--outDir",
        join(built, "dist"),
      ],
      { encoding: "utf8" }
    )
    expect(build.stdout + build.stderr).toBe("")
    expect(build.status).toBe(0)
    const bin = join(built, "dist/cli.js")
    const emitted = readFileSync(bin, "utf8")
    expect(emitted.startsWith("#!/usr/bin/env node\n")).toBe(true)
    expect(emitted).not.toMatch(/^(import|export) type /m)

    const version = spawnSync(process.execPath, [bin, "--version"], {
      encoding: "utf8",
    })
    expect(version.stderr).toBe("")
    expect(version.stdout).toBe(`${pkg.version}\n`)
    expect(version.status).toBe(0)

    const consumer = project(BARE)
    const init = spawnSync(process.execPath, [bin, "init"], {
      cwd: consumer,
      encoding: "utf8",
    })
    expect(init.stderr).toBe("")
    expect(init.stdout).toContain(`Added "${NAMESPACE}": "${URL_TEMPLATE}"`)
    expect(init.status).toBe(0)
    expect(parseConfig(consumer).registries).toEqual({
      "@uifiles": URL_TEMPLATE,
    })

    const missing = spawnSync(process.execPath, [bin, "init"], {
      cwd: dir,
      encoding: "utf8",
    })
    expect(missing.stdout).toBe("")
    expect(missing.stderr).toContain(SHADCN_INIT)
    expect(missing.status).toBe(1)
  })

  it("runs as the bin only when Node was started on it, comparing the entry by real path", () => {
    const source = join(pkgDir, "src/cli.ts")
    const url = pathToFileURL(source).href
    expect(isMain(source, url)).toBe(true)
    const link = join(project(), "cli.ts")
    symlinkSync(source, link)
    expect(isMain(link, url)).toBe(true)
    expect(isMain(join(pkgDir, "package.json"), url)).toBe(false)
    expect(isMain(join(pkgDir, "src/missing.ts"), url)).toBe(false)
    expect(isMain(undefined, url)).toBe(false)
    expect(isMain("", url)).toBe(false)
    // Under Vitest the entry is the runner, so importing the module above ran
    // nothing against this repository's components.json.
    expect(isMain()).toBe(false)
    expect(process.exitCode).toBeUndefined()
    const config = JSON.parse(
      readFileSync(join(root, CONFIG_FILE), "utf8")
    ) as { registries: Record<string, string> }
    expect(config.registries["@uifiles"]).toBe(
      "http://localhost:3000/r/{name}.json"
    )
  })
})
