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

export const TYPE_LABELS: Record<string, string> = {
  "registry:base": "Design system",
  "registry:theme": "Themes",
  "registry:font": "Fonts",
  "registry:ui": "UI primitives",
  "registry:component": "Components",
  "registry:block": "Blocks",
  "registry:hook": "Hooks",
  "registry:lib": "Utilities",
  "registry:item": "Project files",
}

export function groupByType(items: RegistryItem[]) {
  const groups = new Map<string, RegistryItem[]>()
  for (const item of items) {
    const list = groups.get(item.type) ?? []
    list.push(item)
    groups.set(item.type, list)
  }
  const order = Object.keys(TYPE_LABELS)
  const rank = (type: string) => {
    const index = order.indexOf(type)
    return index === -1 ? order.length : index
  }
  return [...groups.entries()].sort(([a], [b]) => rank(a) - rank(b))
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
