// Copies the :root / .dark token blocks and the @theme radius scale from
// app/globals.css into registry/base/registry.json so the base item and the
// repo's own stylesheet never drift. Run by `pnpm registry:build`.
//
//   node scripts/sync-tokens.ts [globals.css] [registry.json]
//
// Exits 1 without writing when the stylesheet fails the token invariants.
//
// Cascade: a token declared more than once resolves the way the browser
// resolves normal declarations. An unlayered `:root`/`.dark` rule beats one
// inside `@layer` whatever their order in the file, and between rules of
// the same layering the later one wins. A token declared in two different
// layers is refused (ranking named layers needs the `@layer` statement
// order, which is not tracked), as is `--x: { … }` (a block value the
// walker cannot represent). `!important` is copied into the value and does
// not change the ranking. An unquoted `url(…)` is read up to its closing
// parenthesis, so `;`, `{` and `/*` inside it are part of the value.
import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

export type Tokens = Record<string, string>

/** Tokens every wrapper in components/ui reads; both modes must define them. */
export const REQUIRED_TOKENS = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "border",
  "input",
  "ring",
] as const

/** Below this many tokens per mode the parser has lost a block, not a token. */
export const MIN_TOKENS_PER_MODE = 24

/** Tokens that exist in one mode only. */
const LIGHT_ONLY = new Set(["radius"])

export class TokenError extends Error {}

const collapse = (text: string) => text.replace(/\s+/g, " ").trim()

/**
 * Walks a stylesheet and reports every `--custom-property: value` declaration
 * with the preludes of the blocks that enclose it, outermost first. Comments
 * are dropped, strings are skipped, braces are matched, and a declaration may
 * span lines or end with a comment.
 */
function walkDeclarations(
  css: string,
  visit: (preludes: readonly string[], name: string, value: string) => void
): void {
  const preludes: string[] = []
  let buffer = ""
  const emit = () => {
    const match = collapse(buffer).match(/^--([\w-]+)\s*:\s*(.*)$/)
    if (match) visit(preludes, match[1] as string, (match[2] as string).trim())
    buffer = ""
  }
  for (let i = 0; i < css.length; i++) {
    const char = css[i] as string
    if (char === "/" && css[i + 1] === "*") {
      const end = css.indexOf("*/", i + 2)
      if (end < 0) throw new TokenError("unterminated comment")
      i = end + 1
      continue
    }
    if (char === '"' || char === "'") {
      let end = i + 1
      while (end < css.length && css[end] !== char) {
        if (css[end] === "\\") end++
        end++
      }
      if (end >= css.length) throw new TokenError("unterminated string")
      buffer += css.slice(i, end + 1)
      i = end
      continue
    }
    if (char === "(" && /url$/i.test(buffer)) {
      const quote = css.slice(i + 1).match(/^\s*(['"]?)/)?.[1]
      if (quote === "") {
        // Unquoted url(): the URL runs to the closing parenthesis and may
        // hold characters the walker would otherwise act on.
        const end = css.indexOf(")", i + 1)
        if (end < 0) throw new TokenError("unterminated url()")
        buffer += css.slice(i, end + 1)
        i = end
        continue
      }
    }
    if (char === "{") {
      const prelude = collapse(buffer)
      if (/^--[\w-]+\s*:/.test(prelude))
        throw new TokenError(`unsupported block value in \`${prelude} {\``)
      preludes.push(prelude)
      buffer = ""
    } else if (char === ";") {
      emit()
    } else if (char === "}") {
      emit()
      if (preludes.length === 0) throw new TokenError("unbalanced `}`")
      preludes.pop()
    } else {
      buffer += char
    }
  }
  if (preludes.length > 0)
    throw new TokenError(`unclosed block \`${preludes.at(-1)} {\``)
}

/** True when `prelude` is a selector list that includes `selector` as a whole entry. */
const selects = (prelude: string, selector: string) =>
  prelude.split(",").some((part) => part.trim() === selector)

/**
 * Custom properties declared directly in every `selector` rule, merged the
 * way the cascade resolves them: an unlayered declaration beats one inside
 * `@layer` whatever their order, otherwise the later one wins, and a token
 * declared in two different layers is refused. A rule nested in a
 * conditional at-rule (`@media`, `@supports`, …) or under another selector
 * is left out, as are declarations inside at-rules nested in the block.
 */
export function collectTokens(css: string, selector: string): Tokens {
  const tokens: Tokens = {}
  /** The `@layer` chain each token was last taken from; "" when unlayered. */
  const layers = new Map<string, string>()
  walkDeclarations(css, (preludes, name, value) => {
    const inner = preludes.at(-1)
    if (inner === undefined) return
    const isTheme = selector.startsWith("@")
    if (isTheme ? inner !== selector : !selects(inner, selector)) return
    const outer = preludes.slice(0, -1)
    if (outer.some((prelude) => !prelude.startsWith("@layer"))) return
    const layer = outer.join(" ")
    const previous = layers.get(name)
    if (previous !== undefined && previous !== layer) {
      if (previous === "") return
      if (layer !== "")
        throw new TokenError(
          `--${name} is declared in both \`${previous}\` and \`${layer}\`; declare it in one layer`
        )
    }
    layers.set(name, layer)
    tokens[name] = value
  })
  return tokens
}

export type CssVars = { theme: Tokens; light: Tokens; dark: Tokens }

/** Extracts the base item's cssVars from a stylesheet, or throws TokenError. */
export function extractCssVars(css: string): CssVars {
  const light = collectTokens(css, ":root")
  const dark = collectTokens(css, ".dark")
  const theme = Object.fromEntries(
    Object.entries(collectTokens(css, "@theme inline")).filter(
      ([key, value]) =>
        key.startsWith("radius-") ||
        (key.startsWith("font-") && !value.startsWith("var("))
    )
  )
  const problems: string[] = []
  for (const [mode, tokens] of [
    ["light", light],
    ["dark", dark],
  ] as const) {
    const count = Object.keys(tokens).length
    if (count < MIN_TOKENS_PER_MODE)
      problems.push(
        `${mode} declares ${count} tokens, fewer than ${MIN_TOKENS_PER_MODE}`
      )
    const missing = REQUIRED_TOKENS.filter((name) => !(name in tokens))
    if (missing.length > 0)
      problems.push(`${mode} is missing --${missing.join(", --")}`)
  }
  if (!("radius" in light)) problems.push("light is missing --radius")
  const darkOnly = Object.keys(dark).filter((name) => !(name in light))
  const lightOnly = Object.keys(light).filter(
    (name) => !(name in dark) && !LIGHT_ONLY.has(name)
  )
  if (lightOnly.length > 0)
    problems.push(`defined in :root but not .dark: --${lightOnly.join(", --")}`)
  if (darkOnly.length > 0)
    problems.push(`defined in .dark but not :root: --${darkOnly.join(", --")}`)
  if (!Object.keys(theme).some((key) => key.startsWith("radius-")))
    problems.push("@theme inline declares no --radius-* scale")
  if (problems.length > 0)
    throw new TokenError(
      `the stylesheet fails the token invariants:\n  - ${problems.join("\n  - ")}`
    )
  return { theme, light, dark }
}

type Registry = {
  items: Array<{ name: string; cssVars?: CssVars; [key: string]: unknown }>
}

function main(cssPath: string, registryPath: string): void {
  const cssVars = extractCssVars(readFileSync(cssPath, "utf8"))
  const registry = JSON.parse(readFileSync(registryPath, "utf8")) as Registry
  const base = registry.items.find((item) => item.name === "base")
  if (!base) throw new TokenError(`no "base" item in ${registryPath}`)
  base.cssVars = cssVars
  writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`)
  execFileSync("pnpm", [
    "exec",
    "prettier",
    "--write",
    "--log-level",
    "silent",
    registryPath,
  ])
  const { light, dark, theme } = cssVars
  console.log(
    `sync-tokens: ${Object.keys(light).length} light, ${Object.keys(dark).length} dark, ${Object.keys(theme).length} theme vars`
  )
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [
    cssPath = "app/globals.css",
    registryPath = "registry/base/registry.json",
  ] = process.argv.slice(2)
  try {
    main(cssPath, registryPath)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`sync-tokens: ${cssPath}: ${message}`)
    process.exit(1)
  }
}
