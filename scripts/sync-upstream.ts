// Reports drift between the upstream sources our ports were made from and
// what upstream serves today. Exit code 1 when anything changed, so CI can
// open a PR. Checks:
//   - registry/ai/upstream.lock.json  vs  https://elements.ai-sdk.dev/api/registry/<name>.json
//   - forked registry/ui items        vs  https://ui.shadcn.com/r/styles/base-nova/<name>.json
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"

type Lock = Record<
  string,
  { source: string; sha256: string; fetchedAt: string }
>
type Item = { name: string; files?: Array<{ content?: string }> }

const sha = (s: string) => createHash("sha256").update(s).digest("hex")
const changed: string[] = []
const missing: string[] = []

const lock = JSON.parse(
  readFileSync("registry/ai/upstream.lock.json", "utf8")
) as Lock
for (const [name, entry] of Object.entries(lock)) {
  const res = await fetch(entry.source)
  if (!res.ok) {
    missing.push(`${name} (${res.status})`)
    continue
  }
  const item = (await res.json()) as Item
  const content = item.files?.[0]?.content ?? ""
  if (sha(content) !== entry.sha256) changed.push(`ai/${name}`)
}

const ui = JSON.parse(readFileSync("registry/ui/registry.json", "utf8")) as {
  items: Item[]
}
for (const item of ui.items) {
  if (!item.files?.length) continue
  const res = await fetch(
    `https://ui.shadcn.com/r/styles/base-nova/${item.name}.json`
  )
  if (!res.ok) {
    missing.push(`ui/${item.name} (${res.status})`)
    continue
  }
  const upstream = (await res.json()) as Item
  const ours = readFileSync(`registry/ui/${item.name}.tsx`, "utf8")
  if (sha(upstream.files?.[0]?.content ?? "") !== sha(ours))
    changed.push(`ui/${item.name} (fork; compare by hand)`)
}

if (changed.length) console.log(`Upstream changed:\n  ${changed.join("\n  ")}`)
if (missing.length) console.log(`Upstream missing:\n  ${missing.join("\n  ")}`)
if (!changed.length && !missing.length) console.log("Upstream unchanged.")
process.exit(changed.length || missing.length ? 1 : 0)
