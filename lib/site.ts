import type { RegistryItem } from "@/lib/registry"

/** The repository, linked from the header, the footer and every preview's source link. */
export const GITHUB_URL = "https://github.com/jamiethompsondesign/uifiles"

/** The branch the source links point at. */
const GITHUB_BRANCH = "main"

/** Where an upstream shadcn/ui alias is documented. */
const SHADCN_DOCS = "https://ui.shadcn.com/docs/components"

export const SITE_NAME = "uifiles"

export const SITE_DESCRIPTION =
  "A shadcn/ui registry on Base UI: every shadcn primitive under one namespace, AI components ported from Vercel AI Elements, and the tokens that tie them together."

/** `shadcn init` against the hosted base item; `origin` comes from `baseUrl()`. */
export function initCommand(origin: string) {
  return `pnpm dlx shadcn@latest init ${origin}/r/base.json`
}

/** `shadcn add` for one item, once `@uifiles` is in the consumer's components.json. */
export function installCommand(name: string) {
  return `pnpm dlx shadcn@latest add @uifiles/${name}`
}

export function previewHref(name: string) {
  return `/preview/${name}`
}

export function registryJsonHref(name: string) {
  return `/r/${name}.json`
}

export function shadcnDocsHref(name: string) {
  return `${SHADCN_DOCS}/${name}`
}

/**
 * The item's source on GitHub: the file when it ships one, the directory the
 * files share when it ships several (a block), nothing for a file-less item.
 */
export function sourceHref(item: RegistryItem): string | undefined {
  const paths = (item.files ?? []).map((file) => file.path)
  const [first] = paths
  if (!first) return undefined
  if (paths.length === 1) {
    return `${GITHUB_URL}/blob/${GITHUB_BRANCH}/${first}`
  }
  const segments = first.split("/")
  let common = segments.length - 1
  for (const path of paths) {
    const parts = path.split("/")
    let shared = 0
    while (
      shared < common &&
      shared < parts.length - 1 &&
      parts[shared] === segments[shared]
    ) {
      shared += 1
    }
    common = shared
  }
  return `${GITHUB_URL}/tree/${GITHUB_BRANCH}/${segments.slice(0, common).join("/")}`
}

export type DependencyLink = { label: string; href: string; external: boolean }

/**
 * Where a `registryDependencies` entry leads: an `@uifiles/<name>` to its
 * preview, a bare name (upstream shadcn/ui) to the shadcn docs.
 */
export function dependencyLink(dependency: string): DependencyLink {
  if (dependency.startsWith("@uifiles/")) {
    const name = dependency.slice("@uifiles/".length)
    return { label: dependency, href: previewHref(name), external: false }
  }
  return {
    label: dependency,
    href: shadcnDocsHref(dependency),
    external: true,
  }
}

/** What the preview shell needs to know about an item; serialisable, so a server layout can hand it to the client shell. */
export type PreviewEntry = {
  name: string
  title: string
  description: string
  kind: "component" | "block"
  href: string
  install: string
  jsonHref: string
  sourceHref?: string | undefined
  dependsOn: DependencyLink[]
}

export type PreviewGroup = {
  id: string
  label: string
  description: string
  items: PreviewEntry[]
}

export function previewEntry(item: RegistryItem): PreviewEntry {
  const source = sourceHref(item)
  return {
    name: item.name,
    title: item.title ?? item.name,
    description: item.description ?? "",
    kind: item.type === "registry:block" ? "block" : "component",
    href: previewHref(item.name),
    install: installCommand(item.name),
    jsonHref: registryJsonHref(item.name),
    ...(source !== undefined && { sourceHref: source }),
    dependsOn: (item.registryDependencies ?? []).map(dependencyLink),
  }
}
