// Reports drift between the upstream sources our ports were made from and
// what upstream serves today. Exit codes: 0 unchanged; 1 at least one source
// changed (the weekly workflow files or comments on an `upstream` issue); 2
// nothing changed but at least one source could not be checked (404, another
// status or a network error; logged only). Checks:
//   - registry/ai/upstream.lock.json  vs  https://elements.ai-sdk.dev/api/registry/<name>.json
//   - forked registry/ui items        vs  https://ui.shadcn.com/r/styles/base-nova/<name>.json
//
// Lock structure, keyed by the shipped registry/ai item:
//   { "<item>": { "source": "<upstream registry JSON URL>",
//                 "sha256": "<hash of its files[0].content>",
//                 "fetchedAt": "YYYY-MM-DD",
//                 "upstream": "<upstream item, when its name differs>" } }
// `upstream` marks items extracted from a differently named upstream file
// (message.tsx -> branch, response); they share one source and hash, which is
// fetched once.
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"

type LockEntry = {
  source: string
  sha256: string
  fetchedAt: string
  upstream?: string
}
type Lock = Record<string, LockEntry>
type Item = { name: string; files?: Array<{ content?: string }> }
type Fetched = { ok: true; content: string } | { ok: false; reason: string }

const sha = (s: string) => createHash("sha256").update(s).digest("hex")
const changed: string[] = []
const missing: string[] = []
const unreachable: string[] = []

const inFlight = new Map<string, Promise<Fetched>>()
function fetchContent(url: string): Promise<Fetched> {
  let pending = inFlight.get(url)
  if (!pending) {
    pending = (async (): Promise<Fetched> => {
      try {
        const res = await fetch(url)
        if (!res.ok) return { ok: false, reason: String(res.status) }
        const item = (await res.json()) as Item
        return { ok: true, content: item.files?.[0]?.content ?? "" }
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        return { ok: false, reason }
      }
    })()
    inFlight.set(url, pending)
  }
  return pending
}

function compare(label: string, result: Fetched, expectedSha: string) {
  if (!result.ok) {
    const bucket = result.reason === "404" ? missing : unreachable
    bucket.push(`${label} (${result.reason})`)
    return
  }
  if (sha(result.content) !== expectedSha) changed.push(label)
}

const lock = JSON.parse(
  readFileSync("registry/ai/upstream.lock.json", "utf8")
) as Lock
for (const [name, entry] of Object.entries(lock)) {
  const label = entry.upstream
    ? `ai/${name} (from upstream ${entry.upstream})`
    : `ai/${name}`
  compare(label, await fetchContent(entry.source), entry.sha256)
}

const ui = JSON.parse(readFileSync("registry/ui/registry.json", "utf8")) as {
  items: Item[]
}
for (const item of ui.items) {
  if (!item.files?.length) continue
  const result = await fetchContent(
    `https://ui.shadcn.com/r/styles/base-nova/${item.name}.json`
  )
  const ours = readFileSync(`registry/ui/${item.name}.tsx`, "utf8")
  compare(`ui/${item.name} (fork; compare by hand)`, result, sha(ours))
}

if (changed.length) console.log(`Upstream changed:\n  ${changed.join("\n  ")}`)
if (missing.length)
  console.log(`Upstream missing (404):\n  ${missing.join("\n  ")}`)
if (unreachable.length)
  console.log(`Upstream unreachable:\n  ${unreachable.join("\n  ")}`)
if (!changed.length && !missing.length && !unreachable.length)
  console.log("Upstream unchanged.")
process.exit(changed.length ? 1 : missing.length || unreachable.length ? 2 : 0)
