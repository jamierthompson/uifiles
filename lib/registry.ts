import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"

export type RegistryItem = {
  name: string
  type: string
  title?: string
  description?: string
  registryDependencies?: string[]
  dependencies?: string[]
  files?: Array<{ path: string; type: string; target?: string }>
  categories?: string[]
}

type RegistryFile = {
  name?: string
  homepage?: string
  include?: string[]
  items?: RegistryItem[]
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
  return [...groups.entries()].sort(
    ([a], [b]) =>
      Object.keys(TYPE_LABELS).indexOf(a) - Object.keys(TYPE_LABELS).indexOf(b)
  )
}

export function baseUrl() {
  return (process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    ""
  )
}
