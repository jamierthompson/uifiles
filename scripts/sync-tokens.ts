// Copies the :root / .dark token blocks and the @theme radius scale from
// app/globals.css into registry/base/registry.json so the base item and the
// repo's own stylesheet never drift. Run by `pnpm registry:build`.
import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"

const css = readFileSync("app/globals.css", "utf8")

function block(selector: string): Record<string, string> {
  const re = new RegExp(`${selector.replace(".", "\\.")}\\s*\\{([^}]*)\\}`)
  const body = css.match(re)?.[1]
  if (!body) throw new Error(`No ${selector} block in app/globals.css`)
  const out: Record<string, string> = {}
  for (const line of body.split("\n")) {
    const m = line.match(/^\s*--([\w-]+):\s*(.+?);\s*$/)
    if (m) out[m[1]] = m[2]
  }
  return out
}

const light = block(":root")
const dark = block(".dark")
const theme = Object.fromEntries(
  Object.entries(block("@theme inline")).filter(
    ([k, v]) =>
      k.startsWith("radius-") ||
      (k.startsWith("font-") && !v.startsWith("var("))
  )
)

const path = "registry/base/registry.json"
const registry = JSON.parse(readFileSync(path, "utf8"))
const base = registry.items.find((i: { name: string }) => i.name === "base")
base.cssVars = { theme, light, dark }
writeFileSync(path, `${JSON.stringify(registry, null, 2)}\n`)
execFileSync("pnpm", [
  "exec",
  "prettier",
  "--write",
  "--log-level",
  "silent",
  path,
])
console.log(
  `sync-tokens: ${Object.keys(light).length} light, ${Object.keys(dark).length} dark, ${Object.keys(theme).length} theme vars`
)
