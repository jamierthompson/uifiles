// The design-token layer: app/globals.css, registry/base cssVars and the
// script that copies one into the other. Contrast is computed the way axe
// does it (oklch -> sRGB, gamut-clipped, alpha composited in gamma space).
import { spawnSync } from "node:child_process"
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  collectTokens,
  extractCssVars,
  TokenError,
} from "@/scripts/sync-tokens"

const root = process.cwd()
const cssPath = join(root, "app/globals.css")
const registryPath = join(root, "registry/base/registry.json")
const css = readFileSync(cssPath, "utf8")
const { light, dark, theme } = extractCssVars(css)

// --- WCAG 2.x contrast for oklch tokens -------------------------------------
type Rgb = [number, number, number]
type Tokens = Record<string, string>

function parseOklch(value: string) {
  const m = value.match(
    /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)(%?))?\s*\)/
  )
  if (!m) throw new Error(`not oklch: ${value}`)
  const alpha = m[4] === undefined ? 1 : m[5] ? +m[4] / 100 : +m[4]
  return { L: Number(m[1]), C: Number(m[2]), h: Number(m[3]), alpha }
}
const clamp = (x: number) => Math.min(1, Math.max(0, x))
const gamma = (c: number) =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055
const linear = (c: number) =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4

/** oklch -> gamma-encoded sRGB (0..1), gamut-clipped per channel like Chromium and axe. */
function srgb(value: string): Rgb {
  const { L, C, h } = parseOklch(value)
  const hr = (h * Math.PI) / 180
  const a = C * Math.cos(hr)
  const b = C * Math.sin(hr)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((c) => gamma(clamp(c))) as Rgb
}
const quantize = (c: Rgb) =>
  c.map((v) => Math.round(clamp(v) * 255) / 255) as Rgb

/** Composites `token` (with an optional Tailwind `/NN` alpha) over `under` in gamma sRGB. */
function over(spec: string, mode: Tokens, under: Rgb, eightBit: boolean): Rgb {
  const [name, pct] = spec.split("/") as [string, string | undefined]
  const value = mode[name]
  if (!value) throw new Error(`no token ${name}`)
  const alpha = parseOklch(value).alpha * (pct ? +pct / 100 : 1)
  const c = srgb(value)
  const out = c.map((v, i) => alpha * v + (1 - alpha) * (under[i] ?? 0)) as Rgb
  return eightBit ? quantize(out) : out
}
const luminance = ([r, g, b]: Rgb) =>
  0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
function contrast(fg: Rgb, bg: Rgb) {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((x, y) => y - x) as [
    number,
    number,
  ]
  return (hi + 0.05) / (lo + 0.05)
}
/**
 * Contrast of `fg` on a stack of surfaces painted over the page background,
 * outermost first. `eightBit` rounds every painted layer to 8 bits.
 */
function ratio(fg: string, surfaces: string[], mode: Tokens, eightBit = false) {
  let bg: Rgb = [1, 1, 1]
  for (const s of ["background", ...surfaces]) bg = over(s, mode, bg, eightBit)
  return contrast(over(fg, mode, bg, eightBit), bg)
}

const modes = { light, dark } as const
type Mode = keyof typeof modes

// --- helpers ------------------------------------------------------------------
function walk(dir: string, out: string[] = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) walk(p, out)
    else if (/\.(tsx|ts)$/.test(entry.name)) out.push(p)
  }
  return out
}
const registrySources = walk(join(root, "registry"))

type Literal = { line: number; text: string }

/**
 * Every string literal in a TS/TSX source with the line it starts on. Walks
 * the characters so a `/*` inside a string (a glob such as `dist/*.js`) is
 * not taken for a comment, and comments are never scanned.
 */
function stringLiterals(source: string): Literal[] {
  const out: Literal[] = []
  let line = 1
  for (let i = 0; i < source.length; i++) {
    const char = source[i]
    const next = source[i + 1]
    if (char === "\n") {
      line++
    } else if (char === "/" && next === "/") {
      const end = source.indexOf("\n", i)
      i = (end < 0 ? source.length : end) - 1
    } else if (char === "/" && next === "*") {
      const end = source.indexOf("*/", i + 2)
      const stop = end < 0 ? source.length : end + 2
      line += source.slice(i, stop).split("\n").length - 1
      i = stop - 1
    } else if (char === '"' || char === "'" || char === "`") {
      const start = line
      let j = i + 1
      while (j < source.length && source[j] !== char) {
        if (source[j] === "\\") j++
        if (source[j] === "\n") line++
        j++
      }
      out.push({ line: start, text: source.slice(i + 1, j) })
      i = j
    }
  }
  return out
}

function scanRegistry(pattern: RegExp): string[] {
  const hits: string[] = []
  for (const file of registrySources) {
    for (const literal of stringLiterals(readFileSync(file, "utf8"))) {
      if (pattern.test(literal.text))
        hits.push(`${file.replace(`${root}/`, "")}:${literal.line}`)
    }
  }
  return hits
}

const committed = readFileSync(registryPath, "utf8")

/**
 * The repo's Prettier options, for a fixture outside the repo. Prettier
 * resolves its config from the formatted file's directory, and a fixture in
 * the repo would be skipped under .gitignore; plugins (and their options)
 * only format other languages and would not resolve from a temp dir.
 */
const prettierConfig = JSON.stringify(
  Object.fromEntries(
    Object.entries(
      JSON.parse(readFileSync(join(root, ".prettierrc"), "utf8")) as Record<
        string,
        unknown
      >
    ).filter(([key]) => key !== "plugins" && !key.startsWith("tailwind"))
  )
)

/** Runs the real script against copies of the given files; returns exit code, stderr and the resulting JSON text. */
function runSyncTokens(
  globals: string | Buffer,
  registry: string | Buffer = committed,
  cssName = "globals.css"
) {
  const dir = mkdtempSync(join(tmpdir(), "uifiles-sync-"))
  try {
    const cssCopy = join(dir, cssName)
    const jsonCopy = join(dir, "registry.json")
    if (cssName === "globals.css") writeFileSync(cssCopy, globals)
    writeFileSync(jsonCopy, registry)
    writeFileSync(join(dir, ".prettierrc"), prettierConfig)
    const result = spawnSync(
      process.execPath,
      [join(root, "scripts/sync-tokens.ts"), cssCopy, jsonCopy],
      { cwd: root, encoding: "utf8" }
    )
    return {
      status: result.status,
      stderr: result.stderr,
      stdout: result.stdout,
      json: readFileSync(jsonCopy, "utf8"),
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

// --- tests --------------------------------------------------------------------
describe("token layer", () => {
  it("defines every light token in dark (except --radius) and vice versa", () => {
    const l = new Set(Object.keys(light).filter((k) => k !== "radius"))
    const d = new Set(Object.keys(dark))
    expect([...l].filter((k) => !d.has(k))).toEqual([])
    expect([...d].filter((k) => !l.has(k))).toEqual([])
    expect(light).toHaveProperty("radius")
  })

  it("maps every @theme inline --color-* to a defined token", () => {
    const colors = Object.entries(collectTokens(css, "@theme inline")).filter(
      ([k]) => k.startsWith("color-")
    )
    expect(colors.length).toBeGreaterThan(20)
    for (const [key, value] of colors) {
      const ref = value.match(/^var\(--([\w-]+)\)$/)?.[1] ?? ""
      expect(ref, `${key} is not a var() reference`).not.toBe("")
      expect(light, `--color-${key} -> --${ref}`).toHaveProperty(ref)
    }
  })

  it("registry/base cssVars equal app/globals.css, key order included", () => {
    const base = JSON.parse(readFileSync(registryPath, "utf8")).items[0]
    expect(JSON.stringify(base.cssVars)).toBe(
      JSON.stringify({ theme, light, dark })
    )
  })

  it("sync-tokens is a no-op on the clean tree", () => {
    const run = runSyncTokens(css)
    expect(run.status, run.stderr).toBe(0)
    expect(run.stdout).toMatch(/^sync-tokens: \d+ light, \d+ dark, \d+ theme/)
    expect(run.json).toBe(committed)
  })

  it("formats the registry with Prettier, not with JSON.stringify", () => {
    // Prettier keeps a short array on one line; JSON.stringify never does.
    const raw = `${JSON.stringify(JSON.parse(committed), null, 2)}\n`
    expect(raw).not.toBe(committed)
    expect(committed).toMatch(/"registryDependencies": \["[^\n]*\]/)
    const run = runSyncTokens(css, raw)
    expect(run.status, run.stderr).toBe(0)
    expect(run.json).toBe(committed)
  })

  it("produces the committed JSON from a BOM-prefixed CRLF copy of the stylesheet", () => {
    const run = runSyncTokens(`\uFEFF${css.replace(/\n/g, "\r\n")}`)
    expect(run.status, run.stderr).toBe(0)
    expect(run.json).toBe(committed)
  })

  it("ships the animation utilities and runtime packages the base stylesheet and wrappers import", () => {
    const base = JSON.parse(committed).items[0]
    expect(css).toMatch(/^@import "tw-animate-css";$/m)
    expect(base.devDependencies).toContain("tw-animate-css")
    for (const dep of [
      "cn",
      "class-variance-authority",
      "lucide-react",
      "@base-ui/react",
    ]) {
      expect(base.dependencies).toContain(dep)
    }
    expect(base.registryDependencies).toContain("utils")
  })

  it("nests the reduced-motion guard the way the CLI css updater expects", () => {
    // processAtRule -> processAtRule (nested @media) -> processRule with
    // string declarations; an object-valued declaration would be treated as
    // a nested selector.
    const base = JSON.parse(committed).items[0]
    const guard =
      base.css["@layer base"]["@media (prefers-reduced-motion: reduce)"]
    expect(Object.keys(guard)).toEqual(["*, ::before, ::after"])
    for (const value of Object.values(guard["*, ::before, ::after"])) {
      expect(typeof value).toBe("string")
      expect(value).toMatch(/!important$/)
    }
  })

  it("ships the reduced-motion guard in both the stylesheet and the base item", () => {
    const base = JSON.parse(readFileSync(registryPath, "utf8")).items[0]
    const guard =
      base.css["@layer base"]["@media (prefers-reduced-motion: reduce)"]
    expect(guard["*, ::before, ::after"]).toEqual({
      "animation-duration": "0.01ms !important",
      "animation-iteration-count": "1 !important",
      "transition-duration": "0.01ms !important",
      "scroll-behavior": "auto !important",
    })
    // Tolerates one comment before the first declaration (the lint suppression).
    expect(css).toMatch(
      /@layer base \{[\s\S]*@media \(prefers-reduced-motion: reduce\) \{\s*\*,\s*::before,\s*::after \{\s*(?:\/\*[\s\S]*?\*\/\s*)?animation-duration: 0\.01ms !important;/
    )
  })

  it("keeps the base item framework-agnostic and free of the CLI itself", () => {
    const base = JSON.parse(readFileSync(registryPath, "utf8")).items[0]
    expect(base.dependencies).not.toContain("next-themes")
    expect(base.devDependencies).not.toContain("shadcn")
    expect(base.docs).toMatch(/dark.*<html>/i)
  })
})

describe("stylesheet imports", () => {
  it("loads the KaTeX stylesheet streamdown's math output needs", () => {
    // Without it every formula renders twice: KaTeX's HTML plus the MathML
    // fallback that katex.min.css visually hides.
    expect(css).toMatch(/^@import "katex\/dist\/katex\.min\.css";$/m)
    expect(css).toMatch(/^@import "streamdown\/styles\.css";$/m)
  })

  it("points Tailwind at streamdown's classes and nothing else", () => {
    const sources = [...css.matchAll(/^@source "([^"]+)";$/gm)].map((m) => m[1])
    expect(sources).toEqual(["../node_modules/streamdown/dist/*.js"])
  })

  it("ships the response item the stylesheet's two imports and its .katex-display rule", () => {
    // The CLI writes the item's css field into the consumer's globals.css;
    // only the @source line, relative to that file, stays a manual step.
    const { items } = JSON.parse(
      readFileSync(join(root, "registry/ai/registry.json"), "utf8")
    ) as { items: Array<{ name: string; css?: Record<string, unknown> }> }
    const shipped = items.find((item) => item.name === "response")?.css ?? {}
    const imports = Object.keys(shipped).filter((key) =>
      key.startsWith("@import ")
    )
    expect(imports.sort()).toEqual([
      '@import "katex/dist/katex.min.css"',
      '@import "streamdown/styles.css"',
    ])
    for (const line of imports) {
      expect(css.split("\n")).toContain(`${line};`)
    }
    const rule = /^ {2}\.katex-display \{\n([^}]*)\n {2}\}$/m.exec(css)?.[1]
    expect(rule, "app/globals.css has a .katex-display rule").toBeDefined()
    const declarations = Object.fromEntries(
      (rule ?? "")
        .split(";")
        .map((declaration) => declaration.trim())
        .filter(Boolean)
        .map((declaration) => {
          const [property = "", ...value] = declaration.split(":")
          return [property.trim(), value.join(":").trim()]
        })
    )
    expect(shipped["@layer base"]).toEqual({ ".katex-display": declarations })
  })
})

describe("scripts/sync-tokens.ts parser", () => {
  const darkRing = "  --ring: oklch(0.556 0 0);\n  --chart-1: oklch(0.87 0 0);"
  const edit = (from: string, to: string) => {
    const edited = css.replace(from, to)
    expect(edited, `fixture anchor "${from}" not found`).not.toBe(css)
    return edited
  }

  it("keeps a token whose line ends with a comment", () => {
    const out = extractCssVars(
      edit(
        darkRing,
        "  --ring: oklch(0.556 0 0); /* focus */\n  --chart-1: oklch(0.87 0 0);"
      )
    )
    expect(out.dark.ring).toBe("oklch(0.556 0 0)")
    expect(Object.keys(out.dark)).toEqual(Object.keys(dark))
  })

  it("skips a nested at-rule and keeps the tokens after it", () => {
    const out = extractCssVars(
      edit(
        "  --muted-foreground: oklch(0.708 0 0);\n  --accent: oklch(0.269 0 0);",
        "  --muted-foreground: oklch(0.708 0 0);\n  @media (forced-colors: active) {\n    --ring: Highlight;\n  }\n  --accent: oklch(0.269 0 0);"
      )
    )
    expect(out.dark.ring).toBe(dark.ring)
    expect(out.dark["sidebar-ring"]).toBe(dark["sidebar-ring"])
    expect(Object.keys(out.dark)).toEqual(Object.keys(dark))
  })

  it("ignores a comment that contains a closing brace", () => {
    const out = extractCssVars(
      edit(
        ":root {\n  --background:",
        ":root {\n  /* page } bg */\n  --background:"
      )
    )
    expect(out.light).toEqual(light)
  })

  it("collapses a declaration that spans lines", () => {
    const out = extractCssVars(
      edit("  --radius: 0.625rem;", "  --radius:\n    0.625rem;")
    )
    expect(out.light.radius).toBe("0.625rem")
  })

  it("lets the unlayered :root beat a later :root inside @layer and a later unlayered .dark win", () => {
    const appended = `${css}\n@layer base {\n  :root {\n    --background: oklch(0.99 0 0);\n  }\n}\n.dark {\n  --background: oklch(0.1 0 0);\n}\n`
    const out = extractCssVars(appended)
    expect(out.light.background).toBe(light.background)
    expect(out.dark.background).toBe("oklch(0.1 0 0)")
    expect(Object.keys(out.light)).toEqual(Object.keys(light))
  })

  it("lets an unlayered :root win over a :root inside @layer whatever their order", () => {
    // Unlayered normal declarations outrank layered ones in the cascade.
    expect(
      collectTokens(
        ":root {\n  --a: 1;\n}\n@layer base {\n  :root {\n    --a: 2;\n  }\n}\n",
        ":root"
      ).a
    ).toBe("1")
    expect(
      collectTokens(
        "@layer base {\n  :root {\n    --a: 2;\n  }\n}\n:root {\n  --a: 1;\n}\n",
        ":root"
      ).a
    ).toBe("1")
  })

  it("lets the later of two equally layered blocks win", () => {
    expect(
      collectTokens(":root { --a: 1; }\n:root { --a: 2; --b: 1; }", ":root")
    ).toEqual({ a: "2", b: "1" })
    expect(
      collectTokens(
        "@layer base { :root { --a: 1; } }\n@layer base { :root { --a: 2; } }",
        ":root"
      )
    ).toEqual({ a: "2" })
  })

  it("refuses a token declared in two different layers", () => {
    expect(() =>
      collectTokens(
        "@layer base { :root { --a: 1; } }\n@layer theme { :root { --a: 2; } }",
        ":root"
      )
    ).toThrow(/--a is declared in both `@layer base` and `@layer theme`/)
    expect(() =>
      collectTokens(
        "@layer base { :root { --a: 1; } }\n@layer theme { :root { --a: 2; } }",
        ":root"
      )
    ).toThrow(TokenError)
  })

  it("keeps a token whose value carries !important and strings with structural characters", () => {
    const tokens = collectTokens(
      [
        ":root {",
        '  --quote: "a;b}c";',
        '  --escaped: "say \\"hi\\"; done";',
        "  --loud: oklch(0.5 0 0) !important;",
        "  --a: 1;",
        "}",
      ].join("\n"),
      ":root"
    )
    expect(tokens).toEqual({
      quote: '"a;b}c"',
      escaped: '"say \\"hi\\"; done"',
      loud: "oklch(0.5 0 0) !important",
      a: "1",
    })
  })

  it("ignores a token declared only inside an at-rule nested in :root and one under a nested selector", () => {
    const tokens = collectTokens(
      ":root {\n  --a: 1;\n  @layer x {\n    --b: 2;\n  }\n  & .x {\n    --c: 3;\n  }\n  --d: 4;\n}",
      ":root"
    )
    expect(tokens).toEqual({ a: "1", d: "4" })
  })

  it("reads an unquoted url() whole, with ; and /* inside it, and a quoted one through the string", () => {
    const tokens = collectTokens(
      [
        ":root {",
        "  --data: url(data:text/plain;base64,QUJD) no-repeat;",
        "  --glob: url(http://h/*x*/y);",
        '  --quoted: url("a)b;c");',
        '  --spaced: url( "a)b" );',
        "  --after: 1; /* url( in a comment */",
        "}",
      ].join("\n"),
      ":root"
    )
    expect(tokens).toEqual({
      data: "url(data:text/plain;base64,QUJD) no-repeat",
      glob: "url(http://h/*x*/y)",
      quoted: 'url("a)b;c")',
      spaced: 'url( "a)b" )',
      after: "1",
    })
    expect(() => collectTokens(":root { --u: url(open; }", ":root")).toThrow(
      /unterminated url\(\)/
    )
  })

  it("refuses a block value instead of dropping the token", () => {
    expect(() => collectTokens(":root {\n  --x: {};\n}", ":root")).toThrow(
      /unsupported block value in `--x: {`/
    )
    expect(() =>
      collectTokens(":root {\n  --x: { a: b };\n  --y: 1;\n}", ":root")
    ).toThrow(TokenError)
  })

  it("matches :root in a selector list and not inside @media", () => {
    const listed = collectTokens(
      ":root,\n.light {\n  --a: 1;\n}\n@media (prefers-color-scheme: dark) {\n  :root {\n    --a: 2;\n    --b: 3;\n  }\n}",
      ":root"
    )
    expect(listed).toEqual({ a: "1" })
  })

  it("does not read a string as CSS structure", () => {
    expect(
      collectTokens(':root {\n  --quote: "}";\n  --a: 1;\n}', ":root")
    ).toEqual({ quote: '"}"', a: "1" })
  })

  it("rejects light/dark drift and unbalanced braces", () => {
    expect(() =>
      extractCssVars(edit(darkRing, "  --chart-1: oklch(0.87 0 0);"))
    ).toThrow(TokenError)
    expect(() =>
      extractCssVars(edit(darkRing, "  --chart-1: oklch(0.87 0 0);"))
    ).toThrow(/not \.dark: --ring/)
    expect(() => extractCssVars(`${css}\n.dark {\n  --x: 1;`)).toThrow(
      /unclosed block/
    )
    expect(() => collectTokens(":root { --a: 1; } }", ":root")).toThrow(
      /unbalanced/
    )
  })

  it("exits non-zero without writing when the stylesheet drifts", () => {
    const run = runSyncTokens(edit(darkRing, "  --chart-1: oklch(0.87 0 0);"))
    expect(run.status).toBe(1)
    expect(run.stderr).toMatch(/^sync-tokens: .*fails the token invariants/)
    expect(run.stderr).toMatch(/not \.dark: --ring/)
    expect(run.json).toBe(committed)
  })

  it("exits 1 and leaves the registry untouched when the stylesheet cannot be read", () => {
    const run = runSyncTokens("", committed, "missing.css")
    expect(run.status).toBe(1)
    expect(run.stderr).toMatch(/^sync-tokens: .*missing\.css: /)
    expect(run.json).toBe(committed)
  })

  it("exits 1 and leaves the registry untouched when it holds no base item", () => {
    const registry = '{ "items": [{ "name": "other" }] }\n'
    const run = runSyncTokens(css, registry)
    expect(run.status).toBe(1)
    expect(run.stderr).toMatch(/no "base" item/)
    expect(run.json).toBe(registry)
  })

  it("reports every invariant problem at once when a mode loses most of its tokens", () => {
    const stripped = css.replace(
      /\.dark \{[\s\S]*?\n\}/,
      ".dark {\n  --background: oklch(0.145 0 0);\n}"
    )
    expect(stripped).not.toBe(css)
    expect(() => extractCssVars(stripped)).toThrow(
      /dark declares 1 tokens, fewer than 24[\s\S]*dark is missing --foreground[\s\S]*defined in :root but not \.dark/
    )
  })

  it("survives the robustness fixtures end to end", () => {
    const edited = edit(
      darkRing,
      "  --ring: oklch(0.556 0 0); /* focus */\n  --chart-1: oklch(0.87 0 0);"
    ).replace(
      ":root {\n  --background:",
      ":root {\n  /* page } bg */\n  --background:"
    )
    const run = runSyncTokens(edited)
    expect(run.status, run.stderr).toBe(0)
    expect(run.json).toBe(committed)
  })

  it("lets an unlayered declaration win over two different layers without refusing", () => {
    // The browser resolves this to 1 whatever the layer order, so nothing
    // is ambiguous and the script does not need the @layer statement order.
    expect(
      collectTokens(
        ":root { --a: 1; }\n@layer a { :root { --a: 2; } }\n@layer b { :root { --a: 3; } }",
        ":root"
      )
    ).toEqual({ a: "1" })
    expect(
      collectTokens(
        "@layer a { :root { --a: 2; } }\n:root { --a: 1; }\n@layer b { :root { --a: 3; } }",
        ":root"
      )
    ).toEqual({ a: "1" })
  })

  it("refuses a token declared in a layer and in one of its sublayers", () => {
    // A parent layer's own declarations beat its sublayers; the walker does
    // not rank named layers, so it refuses rather than guess.
    expect(() =>
      collectTokens(
        "@layer a { @layer b { :root { --a: 2; } } }\n@layer a { :root { --a: 1; } }",
        ":root"
      )
    ).toThrow(/--a is declared in both `@layer a @layer b` and `@layer a`/)
  })

  it("copies !important into the value without ranking it, as the header says", () => {
    // Documented limitation: the browser would let the important layered
    // declaration win here; the script keeps source order.
    expect(
      collectTokens(
        ":root { --a: 1 !important; }\n@layer base { :root { --a: 2 !important; } }",
        ":root"
      )
    ).toEqual({ a: "1 !important" })
  })

  it("reads an unquoted data: url() with ; and , inside it whole", () => {
    expect(
      collectTokens(
        ":root { --a: url(data:image/svg+xml;charset=utf-8,%3Csvg%3E) center; --b: 2; }",
        ":root"
      )
    ).toEqual({
      a: "url(data:image/svg+xml;charset=utf-8,%3Csvg%3E) center",
      b: "2",
    })
  })

  it("exits 1 and leaves the registry untouched when the registry JSON is malformed", () => {
    const malformed = '{ "items": [ { "name": "base" '
    const run = runSyncTokens(css, malformed)
    expect(run.status).toBe(1)
    expect(run.stderr).toMatch(/^sync-tokens: .*globals\.css: /)
    expect(run.json).toBe(malformed)
  })

  it("collects no .dark tokens from a .dark block nested in a prefers-color-scheme media query", () => {
    // A rule under a conditional at-rule is left out, so a consumer who moves
    // .dark under @media gets the invariant error, not a silent partial copy.
    const moved = css.replace(
      /\n\.dark \{([\s\S]*?)\n\}/,
      "\n@media (prefers-color-scheme: dark) {\n.dark {$1\n}\n}"
    )
    expect(moved).not.toBe(css)
    expect(collectTokens(moved, ".dark")).toEqual({})
  })
})

describe("class hygiene in registry sources", () => {
  const palette =
    /\b(bg|text|border|ring|fill|stroke|divide|outline|shadow|from|to|via|decoration|accent|caret|placeholder)-(white|black|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3})(?:\/\d+)?\b/
  const literal =
    /\b(bg|text|border|ring|fill|stroke)-\[#|\[(color|background):/
  const alphaText =
    /\btext-(foreground|muted-foreground|primary|primary-foreground|secondary-foreground|accent-foreground|card-foreground|popover-foreground|destructive|sidebar-foreground)\/\d+\b/

  it("uses no palette classes or literal colors (AGENTS.md)", () => {
    expect(scanRegistry(palette)).toEqual([])
    expect(scanRegistry(literal)).toEqual([])
  })

  it("never fades text with an alpha suffix", () => {
    expect(scanRegistry(alphaText)).toEqual([])
  })

  it("scans class strings only, not prose in comments", () => {
    const source = [
      "// upstream used text-muted-foreground/50 here",
      "/* bg-red-500",
      "   spans lines */",
      'const glob = "dist/*.js" // not a comment opener',
      "cn(`text-muted-foreground`, 'bg-muted')",
      "",
    ].join("\n")
    expect(stringLiterals(source)).toEqual([
      { line: 4, text: "dist/*.js" },
      { line: 5, text: "text-muted-foreground" },
      { line: 5, text: "bg-muted" },
    ])
  })
})

describe("contrast (WCAG 2.x, gamma-space compositing)", () => {
  const text = 4.5
  const ui = 3
  type Row = [
    fg: string,
    surfaces: string[],
    need: number,
    note: string,
    modes?: Mode[],
  ]
  const rows: Row[] = [
    // token pairs
    ["foreground", ["background"], text, "body text"],
    ["card-foreground", ["card"], text, "card text"],
    ["popover-foreground", ["popover"], text, "popover text"],
    ["primary-foreground", ["primary"], text, "button default"],
    ["secondary-foreground", ["secondary"], text, "button secondary"],
    ["muted-foreground", ["muted"], text, "kbd, muted panels"],
    ["muted-foreground", ["background"], text, "descriptions"],
    ["muted-foreground", ["card"], text, "card descriptions"],
    ["muted-foreground", ["secondary"], text, "secondary descriptions"],
    ["muted-foreground", ["accent"], text, "accent descriptions"],
    ["muted-foreground", ["popover"], text, "menu labels"],
    ["accent-foreground", ["accent"], text, "menu item focus"],
    ["primary", ["background"], text, "link variant, tool icons"],
    ["primary", ["muted"], text, "link on muted"],
    ["destructive", ["background"], text, "text-destructive"],
    ["destructive", ["card"], text, "alert destructive title"],
    ["destructive", ["muted"], text, "destructive on muted"],
    ["destructive", ["popover"], text, "destructive menu item"],
    ["border", ["background"], ui, "borders on background"],
    ["border", ["card"], ui, "borders on card"],
    ["border", ["muted"], ui, "borders on muted"],
    ["input", ["background"], ui, "field boundary (1.4.11)"],
    ["input", ["card"], ui, "field boundary on card"],
    ["ring", ["background"], ui, "focus-visible:border-ring"],
    ["ring", ["card"], ui, "focus border on card"],
    ["ring", ["muted"], ui, "focus border on muted"],
    ["sidebar-foreground", ["sidebar"], text, "sidebar text"],
    [
      "sidebar-primary-foreground",
      ["sidebar-primary"],
      text,
      "sidebar primary",
    ],
    ["sidebar-accent-foreground", ["sidebar-accent"], text, "sidebar accent"],
    ["sidebar-border", ["sidebar"], ui, "sidebar border"],
    ["sidebar-ring", ["sidebar"], ui, "sidebar focus"],
    ["muted-foreground", ["sidebar"], text, "sidebar descriptions"],
    [
      "muted-foreground",
      ["sidebar-accent"],
      text,
      "sidebar accent descriptions",
    ],
    ["chart-1", ["background"], ui, "chart series 1"],
    ["chart-2", ["background"], ui, "chart series 2"],
    ["chart-3", ["background"], ui, "chart series 3"],
    ["chart-4", ["background"], ui, "chart series 4"],
    ["chart-5", ["background"], ui, "chart series 5"],
    ["chart-1", ["chart-2"], ui, "adjacent series 1/2"],
    ["chart-2", ["chart-3"], ui, "adjacent series 2/3"],
    ["chart-3", ["chart-4"], ui, "adjacent series 3/4"],
    ["chart-4", ["chart-5"], ui, "adjacent series 4/5"],
    // class combinations in components/ui and registry/ai
    [
      "destructive",
      ["destructive/10"],
      text,
      "button/badge/bubble destructive at rest",
      ["light"],
    ],
    [
      "destructive",
      ["destructive/20"],
      text,
      "button/badge/bubble destructive hover",
      ["light"],
    ],
    [
      "destructive",
      ["destructive/20"],
      text,
      "button/badge/bubble destructive at rest",
      ["dark"],
    ],
    [
      "destructive",
      ["destructive/30"],
      text,
      "button/badge/bubble destructive hover",
      ["dark"],
    ],
    [
      "destructive",
      ["popover", "destructive/10"],
      text,
      "dropdown destructive item focus",
      ["light"],
    ],
    [
      "destructive",
      ["popover", "destructive/20"],
      text,
      "dropdown destructive item focus",
      ["dark"],
    ],
    ["destructive", ["card", "destructive/10"], text, "attachment error media"],
    ["destructive/90", ["card"], text, "alert destructive description"],
    ["destructive/80", ["card"], text, "attachment error description"],
    ["destructive", ["card"], text, "tool error output"],
    ["foreground", ["card", "muted/50"], text, "tool output"],
    ["muted-foreground", ["card", "muted/50"], text, "code-block header"],
    ["muted-foreground", ["card"], text, "code-block line numbers"],
    [
      "background",
      ["foreground", "background/20"],
      text,
      "kbd in tooltip",
      ["light"],
    ],
    [
      "background",
      ["foreground", "background/10"],
      text,
      "kbd in tooltip",
      ["dark"],
    ],
    ["background", ["foreground"], text, "tooltip"],
    ["muted-foreground", ["background"], text, "input placeholder", ["light"]],
    ["muted-foreground", ["input/30"], text, "input placeholder", ["dark"]],
    ["input", ["input/30"], ui, "input border on its dark field", ["dark"]],
    ["ring/50", ["background"], ui, "focus halo ring-ring/50"],
    ["primary-foreground", ["primary/80"], text, "button default hover"],
    ["primary-foreground", ["card", "primary/80"], text, "badge link hover"],
    [
      "secondary-foreground",
      ["secondary/80"],
      text,
      "badge secondary link hover",
    ],
  ]

  /**
   * Combinations known to sit below their threshold, each waiting on a design
   * decision recorded in docs/architecture.md §4 or on a transient state.
   * Every entry must still fail, so the list cannot outlive the debt it
   * documents.
   */
  const awaitingOwnerDecision: Record<string, string> = {
    "light border on background":
      "1px borders at 1.26:1; a 3:1 border is a visible redesign",
    "light border on card": "same as border on background",
    "light border on muted": "same as border on background",
    "light input on background":
      "--input at 0.922; oklch(0.66 0 0) is the lightest value that passes",
    "light input on card": "same as input on background",
    "light sidebar-border on sidebar":
      "sidebar tokens are inherited from Nova pending an owner decision",
    "light sidebar-ring on sidebar":
      "sidebar tokens are inherited from Nova pending an owner decision",
    "light chart-1 on background":
      "chart ramp is inherited from Nova pending an owner decision",
    "light chart-2 on chart-3": "chart ramp adjacent steps",
    "light chart-3 on chart-4": "chart ramp adjacent steps",
    "light chart-4 on chart-5": "chart ramp adjacent steps",
    "light ring/50 on background":
      "halo is decoration; the 1px border-ring carries the indicator",
    "dark border on background": "oklch(1 0 0 / 10%) borders; 34% would pass",
    "dark border on card": "same as border on background",
    "dark border on muted": "same as border on background",
    "dark input on background": "oklch(1 0 0 / 15%); 35% would pass",
    "dark input on card": "same as input on background",
    "dark input on input/30": "same as input on background",
    "dark sidebar-border on sidebar":
      "sidebar tokens are inherited from Nova pending an owner decision",
    "dark chart-3 on background":
      "chart ramp is inherited from Nova pending an owner decision",
    "dark chart-4 on background":
      "chart ramp is inherited from Nova pending an owner decision",
    "dark chart-5 on background":
      "chart ramp is inherited from Nova pending an owner decision",
    "dark chart-2 on chart-3": "chart ramp adjacent steps",
    "dark chart-3 on chart-4": "chart ramp adjacent steps",
    "dark chart-4 on chart-5": "chart ramp adjacent steps",
    "dark ring/50 on background":
      "halo is decoration; the 1px border-ring carries the indicator",
  }

  const cases = rows.flatMap(([fg, surfaces, need, note, only]) =>
    (only ?? (["light", "dark"] as Mode[])).map((mode) => {
      const key = `${mode} ${fg} on ${surfaces.join(" > ")}`
      return { key, mode, fg, surfaces, need, note }
    })
  )

  it.each(cases)("$key ($note)", ({ key, mode, fg, surfaces, need }) => {
    const value = ratio(fg, surfaces, modes[mode])
    if (key in awaitingOwnerDecision) {
      expect(
        value,
        `${key} now passes; remove it from awaitingOwnerDecision`
      ).toBeLessThan(need)
    } else {
      expect(value).toBeGreaterThanOrEqual(need)
      expect(ratio(fg, surfaces, modes[mode], true)).toBeGreaterThanOrEqual(
        need
      )
    }
  })

  it("lists only real combinations in awaitingOwnerDecision", () => {
    const keys = new Set(cases.map((c) => c.key))
    expect(
      Object.keys(awaitingOwnerDecision).filter((k) => !keys.has(k))
    ).toEqual([])
  })

  it("light text-destructive clears AA at rest, on the /10 and /20 hover tints and through /80 and /90 alpha with margin", () => {
    expect(light.destructive).toBe("oklch(0.45 0.245 27.325)")
    for (const [fg, surfaces] of [
      ["destructive", ["background"]],
      ["destructive", ["destructive/10"]],
      ["destructive", ["destructive/20"]],
      ["destructive", ["card", "destructive/20"]],
      ["destructive", ["card", "destructive/10"]],
      ["destructive/80", ["card"]],
      ["destructive/90", ["card"]],
    ] as const) {
      expect(ratio(fg, [...surfaces], light)).toBeGreaterThanOrEqual(4.6)
      expect(ratio(fg, [...surfaces], light, true)).toBeGreaterThanOrEqual(4.6)
    }
    expect(ratio("destructive", ["background"], light)).toBeGreaterThanOrEqual(
      5.5
    )
  })

  it("dark text-destructive clears AA at rest, on the /20 tint, on the /30 hover tint and through /80 alpha", () => {
    expect(dark.destructive).toBe("oklch(0.74 0.191 22.216)")
    for (const [fg, surfaces] of [
      ["destructive", ["background"]],
      ["destructive", ["destructive/20"]],
      ["destructive", ["destructive/30"]],
      ["destructive", ["popover", "destructive/20"]],
      ["destructive/80", ["card"]],
      ["destructive/90", ["card"]],
    ] as const) {
      expect(ratio(fg, [...surfaces], dark)).toBeGreaterThanOrEqual(4.5)
      expect(ratio(fg, [...surfaces], dark, true)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it("light ring is the lightest gray step that clears 3:1 on every light surface", () => {
    expect(light.ring).toBe("oklch(0.64 0 0)")
    for (const surface of [
      "background",
      "card",
      "popover",
      "muted",
      "secondary",
      "accent",
      "sidebar",
    ]) {
      expect(ratio("ring", [surface], light)).toBeGreaterThanOrEqual(3)
    }
    expect(
      ratio("ring", ["muted"], { ...light, ring: "oklch(0.65 0 0)" })
    ).toBeLessThan(3)
    expect(ratio("ring", ["background"], dark)).toBeGreaterThanOrEqual(3)
  })

  it("light muted-foreground meets AA on muted/secondary/accent (architecture §4 departure)", () => {
    expect(light["muted-foreground"]).toBe("oklch(0.53 0 0)")
    expect(
      ratio("muted-foreground", ["muted"], {
        ...light,
        "muted-foreground": "oklch(0.556 0 0)",
      })
    ).toBeLessThan(4.5)
  })

  it("sanity: the model reproduces axe's numbers for the old light destructive token", () => {
    const nova = { ...light, destructive: "oklch(0.577 0.245 27.325)" }
    expect(ratio("destructive", ["destructive/10"], nova)).toBeCloseTo(3.99, 1)
    expect(ratio("destructive/80", ["card"], nova)).toBeCloseTo(4.12, 1)
    expect(ratio("destructive", ["background"], nova)).toBeCloseTo(4.76, 1)
  })
})
