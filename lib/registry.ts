import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"

export type RegistryFileEntry = {
  path: string
  type: string
  target?: string | undefined
}

export type RegistryItem = {
  name: string
  type: string
  title?: string | undefined
  description?: string | undefined
  registryDependencies?: string[] | undefined
  dependencies?: string[] | undefined
  files?: RegistryFileEntry[] | undefined
  categories?: string[] | undefined
}

type RegistryFile = {
  name?: string | undefined
  homepage?: string | undefined
  include?: string[] | undefined
  items?: RegistryItem[] | undefined
}

/**
 * Reads the source registry (root registry.json plus every `include`d file)
 * and returns the flattened item list. Mirrors what `shadcn build` writes to
 * public/r/registry.json, without requiring a build.
 */
export function loadRegistry(root = process.cwd()) {
  const rootFile = JSON.parse(
    readFileSync(join(root, "registry.json"), "utf8")
  ) as RegistryFile
  const items: RegistryItem[] = [...(rootFile.items ?? [])]
  for (const rel of rootFile.include ?? []) {
    const file = JSON.parse(
      readFileSync(join(root, rel), "utf8")
    ) as RegistryFile
    const dir = dirname(rel)
    for (const item of file.items ?? []) {
      items.push({
        ...item,
        files: item.files?.map((f) => ({ ...f, path: join(dir, f.path) })),
      })
    }
  }
  return { name: rootFile.name ?? "", homepage: rootFile.homepage ?? "", items }
}

/**
 * A `registry:ui` entry with no files is an alias: `@uifiles/<name>` resolves
 * to upstream shadcn/ui `<name>` against the consumer's style. Other file-less
 * items (the `registry:base` item carries config and tokens, not files) are
 * uifiles' own.
 */
export function isUpstreamAlias(item: RegistryItem) {
  return item.type === "registry:ui" && !item.files?.length
}

/**
 * The sections the catalog is read in: the docs home, the preview sidebar and
 * `/llms.txt` all list items by group, in this order. AI components fall into
 * the first four by their registry `categories`, the `chat` block into
 * `blocks`, the file-less shadcn/ui aliases into `primitives`, the
 * `registry:base` item into `base`; a component with none of the categories
 * lands in `other`, which the tests keep empty.
 */
export type CatalogGroupId =
  | "chat"
  | "agent"
  | "code"
  | "media"
  | "blocks"
  | "primitives"
  | "base"
  | "other"

export type CatalogGroup = {
  id: CatalogGroupId
  label: string
  /** One line under the label, written for someone choosing where to look. */
  description: string
  items: RegistryItem[]
}

export const CATALOG_GROUPS: Record<
  CatalogGroupId,
  { label: string; description: string }
> = {
  chat: {
    label: "Chat",
    description:
      "The composer, streamed responses, citations, sources and branching that a conversation is made of.",
  },
  agent: {
    label: "Agent",
    description:
      "Plans, tasks, tool calls, queues and approvals that show what an agent is doing and let a person step in.",
  },
  code: {
    label: "Code",
    description: "Highlighted code for chat and agent output.",
  },
  media: {
    label: "Media",
    description: "Images a model generated.",
  },
  blocks: {
    label: "Blocks",
    description:
      "Complete surfaces assembled from the components, installed as pages you then wire to your own route.",
  },
  primitives: {
    label: "Primitives",
    description:
      "Every shadcn/ui primitive under the @uifiles namespace, resolved upstream against your style.",
  },
  base: {
    label: "Design system",
    description:
      "The config, tokens and fonts every item is built on. Run it once with shadcn init.",
  },
  other: {
    label: "More components",
    description: "Components outside the groups above.",
  },
}

export const CATALOG_GROUP_ORDER: readonly CatalogGroupId[] = [
  "chat",
  "agent",
  "code",
  "media",
  "blocks",
  "primitives",
  "base",
  "other",
]

/**
 * Which registry category decides a component's group when it carries
 * several: every AI component is tagged `chat`, so the more specific tag wins.
 * Later entries take precedence.
 */
const CATEGORY_GROUPS: ReadonlyArray<
  [category: string, group: CatalogGroupId]
> = [
  ["chat", "chat"],
  ["media", "media"],
  ["code", "code"],
  ["agent", "agent"],
]

export function catalogGroupOf(item: RegistryItem): CatalogGroupId {
  if (item.type === "registry:base") return "base"
  if (item.type === "registry:block") return "blocks"
  if (isUpstreamAlias(item)) return "primitives"
  let group: CatalogGroupId = "other"
  const categories = item.categories ?? []
  for (const [category, candidate] of CATEGORY_GROUPS) {
    if (categories.includes(category)) group = candidate
  }
  return group
}

/** Sorts by the title people read, falling back to the name. */
function byTitle(a: RegistryItem, b: RegistryItem) {
  return (a.title ?? a.name).localeCompare(b.title ?? b.name, "en")
}

/**
 * The catalog in reading order: only the groups that have items, each with
 * its items sorted by title.
 */
export function catalogGroups(items: RegistryItem[]): CatalogGroup[] {
  const buckets = new Map<CatalogGroupId, RegistryItem[]>()
  for (const item of items) {
    const id = catalogGroupOf(item)
    const list = buckets.get(id) ?? []
    list.push(item)
    buckets.set(id, list)
  }
  return CATALOG_GROUP_ORDER.flatMap((id) => {
    const list = buckets.get(id)
    if (!list?.length) return []
    return [{ id, ...CATALOG_GROUPS[id], items: [...list].sort(byTitle) }]
  })
}

/**
 * Items rendered under `/preview/<name>`: everything that ships files except
 * the base item (`tests/unit/registry.test.ts` holds both directions of that
 * rule against `app/preview`).
 */
export function hasPreviewPage(item: RegistryItem) {
  return item.type !== "registry:base" && (item.files?.length ?? 0) > 0
}

/** The preview sidebar and the home's component sections: previewable items, grouped. */
export function previewGroups(items: RegistryItem[]): CatalogGroup[] {
  return catalogGroups(items.filter(hasPreviewPage))
}

/**
 * The shadcn/ui aliases in sections, so the 63 of them can be scanned. The
 * map is by hand: a primitive that is not in it lands in "Other", and the
 * unit tests fail on that so a new alias is placed on purpose.
 */
export const PRIMITIVE_GROUPS: ReadonlyArray<{
  label: string
  names: readonly string[]
}> = [
  {
    label: "Buttons & inputs",
    names: [
      "button",
      "button-group",
      "toggle",
      "toggle-group",
      "input",
      "input-group",
      "input-otp",
      "textarea",
      "checkbox",
      "radio-group",
      "switch",
      "slider",
      "select",
      "native-select",
      "combobox",
      "calendar",
      "field",
      "form",
      "label",
    ],
  },
  {
    label: "Overlays & menus",
    names: [
      "dialog",
      "alert-dialog",
      "sheet",
      "drawer",
      "popover",
      "hover-card",
      "tooltip",
      "dropdown-menu",
      "context-menu",
      "menubar",
      "command",
    ],
  },
  {
    label: "Navigation",
    names: ["breadcrumb", "navigation-menu", "pagination", "sidebar", "tabs"],
  },
  {
    label: "Layout",
    names: [
      "accordion",
      "aspect-ratio",
      "card",
      "collapsible",
      "item",
      "resizable",
      "scroll-area",
      "separator",
    ],
  },
  {
    label: "Data display",
    names: ["avatar", "badge", "carousel", "chart", "kbd", "table"],
  },
  {
    label: "Feedback",
    names: [
      "alert",
      "empty",
      "progress",
      "skeleton",
      "spinner",
      "sonner",
      "toast",
    ],
  },
  {
    label: "Chat",
    names: [
      "message",
      "message-scroller",
      "bubble",
      "attachment",
      "marker",
      "questionnaire",
    ],
  },
  { label: "Utilities", names: ["direction"] },
]

export type PrimitiveGroup = { label: string; items: RegistryItem[] }

/** The aliases among `items` in `PRIMITIVE_GROUPS` order, plus "Other" for any the map lacks. */
export function primitiveGroups(items: RegistryItem[]): PrimitiveGroup[] {
  const aliases = items.filter(isUpstreamAlias)
  const byName = new Map(aliases.map((item) => [item.name, item]))
  const placed = new Set<string>()
  const groups: PrimitiveGroup[] = []
  for (const group of PRIMITIVE_GROUPS) {
    const list = group.names.flatMap((name) => {
      const item = byName.get(name)
      if (!item) return []
      placed.add(name)
      return [item]
    })
    if (list.length) groups.push({ label: group.label, items: list })
  }
  const other = aliases.filter((item) => !placed.has(item.name))
  if (other.length) groups.push({ label: "Other", items: other })
  return groups
}

const LOCAL_ORIGIN = "http://localhost:3000"

/**
 * The environment `baseUrl()` reads (`NEXT_PUBLIC_BASE_URL`, `VERCEL_ENV`,
 * `VERCEL_PROJECT_PRODUCTION_URL`, `VERCEL_URL`); `process.env` satisfies it.
 */
export type SiteEnv = Readonly<Record<string, string | undefined>>

function nonEmpty(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function fromVercelHost(host: string | undefined) {
  const value = nonEmpty(host)
  if (!value) return undefined
  return /^https?:\/\//.test(value) ? value : `https://${value}`
}

function isLocalOrigin(origin: string) {
  const { hostname } = new URL(origin)
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "[::1]"
  )
}

let warnedLocalProductionBuild = false

/**
 * The public origin baked into `/` and `/llms.txt` at build time. Resolution:
 * `NEXT_PUBLIC_BASE_URL`, then Vercel's `VERCEL_PROJECT_PRODUCTION_URL` and
 * `VERCEL_URL` (host names without a scheme), then localhost for local dev.
 * A production build on Vercel that would still advertise localhost fails
 * rather than publishing install commands nobody can run; a production build
 * anywhere else (`next build` sets `NODE_ENV=production`) warns once, since a
 * local `pnpm build` is legitimate and a self-hosted deploy is not.
 */
export function baseUrl(env: SiteEnv = process.env) {
  const origin =
    nonEmpty(env.NEXT_PUBLIC_BASE_URL) ??
    fromVercelHost(env.VERCEL_PROJECT_PRODUCTION_URL) ??
    fromVercelHost(env.VERCEL_URL) ??
    LOCAL_ORIGIN
  let parsed: URL
  try {
    parsed = new URL(origin)
  } catch {
    throw new Error(
      `NEXT_PUBLIC_BASE_URL must be an absolute URL such as https://uifiles.dev; got "${origin}"`
    )
  }
  if (isLocalOrigin(origin)) {
    if (env.VERCEL_ENV === "production") {
      throw new Error(
        `Refusing to build for production with the public origin "${origin}": set NEXT_PUBLIC_BASE_URL to the deployed site's origin`
      )
    }
    if (
      env.NODE_ENV === "production" &&
      !env.VERCEL &&
      !warnedLocalProductionBuild
    ) {
      warnedLocalProductionBuild = true
      console.warn(
        `\nWARNING: production build with the public origin "${origin}". The install commands on / and every link in /llms.txt will point at it. A hosted deploy must set NEXT_PUBLIC_BASE_URL to its own origin (see .env.example).\n`
      )
    }
  }
  return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, "")
}
