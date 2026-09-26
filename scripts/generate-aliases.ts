// Regenerates registry/ui/registry.json: one zero-file alias item per
// shadcn/ui `registry:ui` component. `@uifiles/button` resolves upstream
// `button` against the consumer's style. When a component is forked, add
// `files` to its entry here and keep the name; forks are preserved across runs.
import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"

const INDEX = "https://ui.shadcn.com/r/index.json"
const LLMS = "https://ui.shadcn.com/llms.txt"

// Newer items are missing from llms.txt; keep their descriptions here.
const EXTRA: Record<string, string> = {
  attachment: "File and image attachment display for chat and forms.",
  bubble: "Chat bubble surface for message content and reactions.",
  marker:
    "Inline conversation markers: status updates, system notes, labeled separators.",
  message: "Chat message row with avatar, header, content and footer slots.",
  "message-scroller":
    "Chat transcript container that follows streaming output only while the reader is at the live edge.",
  questionnaire:
    "Multi-step question flow: single choice, multiple choice, freeform, skippable.",
  combobox: "Searchable select with autocomplete.",
  direction: "Text direction provider for RTL support.",
  form: "Form primitives for react-hook-form.",
}

type IndexItem = {
  name: string
  type: string
  title?: string
  description?: string
}

const index = (await (await fetch(INDEX)).json()) as IndexItem[]
const llms = await (await fetch(LLMS)).text()
const docDescriptions = new Map<string, string>()
for (const m of llms.matchAll(
  /^- \[[^\]]+\]\(https:\/\/ui\.shadcn\.com\/docs\/components\/([\w-]+)\): (.+)$/gm
)) {
  docDescriptions.set(m[1], m[2].trim())
}

const path = "registry/ui/registry.json"
let existing: { items: Array<Record<string, unknown> & { name: string }> } = {
  items: [],
}
try {
  existing = JSON.parse(readFileSync(path, "utf8"))
} catch {}
const forks = new Map(
  existing.items
    .filter((i) => Array.isArray(i.files) && i.files.length > 0)
    .map((i) => [i.name, i])
)

const items = index
  .filter((i) => i.type === "registry:ui")
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((i) => {
    const fork = forks.get(i.name)
    if (fork) return fork
    const description =
      i.description ?? docDescriptions.get(i.name) ?? EXTRA[i.name]
    if (!description)
      throw new Error(`No description for ${i.name}; add it to EXTRA`)
    return {
      name: i.name,
      type: "registry:ui",
      title:
        i.title ??
        i.name
          .split("-")
          .map((w) => w[0].toUpperCase() + w.slice(1))
          .join(" "),
      description: `${description} Upstream shadcn/ui component, resolved against your style.`,
      registryDependencies: [i.name],
      files: [],
    }
  })

writeFileSync(
  path,
  `${JSON.stringify({ $schema: "https://ui.shadcn.com/schema/registry.json", items }, null, 2)}\n`
)
console.log(`generate-aliases: ${items.length} items (${forks.size} forked)`)

execFileSync("pnpm", [
  "exec",
  "prettier",
  "--write",
  "--log-level",
  "silent",
  path,
])
