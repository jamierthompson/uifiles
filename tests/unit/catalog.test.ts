import { describe, expect, it } from "vitest"
import {
  CATALOG_GROUP_ORDER,
  CATALOG_GROUPS,
  catalogGroupOf,
  catalogGroups,
  hasPreviewPage,
  isUpstreamAlias,
  loadRegistry,
  PRIMITIVE_GROUPS,
  previewGroups,
  primitiveGroups,
  type RegistryItem,
} from "@/lib/registry"
import {
  dependencyLink,
  GITHUB_URL,
  initCommand,
  installCommand,
  previewEntry,
  previewHref,
  registryJsonHref,
  shadcnDocsHref,
  sourceHref,
} from "@/lib/site"

const registry = loadRegistry()
const byName = (name: string) => {
  const item = registry.items.find((i) => i.name === name)
  if (!item) throw new Error(`registry has no item "${name}"`)
  return item
}
const component = (
  name: string,
  categories?: string[] | undefined
): RegistryItem => ({
  name,
  type: "registry:component",
  title: name,
  files: [{ path: `registry/ai/${name}.tsx`, type: "registry:component" }],
  ...(categories && { categories }),
})

describe("catalog groups (lib/registry.ts)", () => {
  it("places every kind of item: base, block, alias, and a component by its most specific category", () => {
    expect(catalogGroupOf(byName("base"))).toBe("base")
    expect(catalogGroupOf(byName("chat"))).toBe("blocks")
    expect(catalogGroupOf(byName("button"))).toBe("primitives")
    expect(catalogGroupOf(byName("response"))).toBe("chat")
    expect(catalogGroupOf(byName("tool"))).toBe("agent")
    expect(catalogGroupOf(byName("code-block"))).toBe("code")
    expect(catalogGroupOf(byName("image"))).toBe("media")
  })

  it("lets the specific category win over chat, in the order agent, code, media", () => {
    expect(catalogGroupOf(component("x", ["ai", "chat", "agent"]))).toBe(
      "agent"
    )
    expect(
      catalogGroupOf(component("x", ["ai", "chat", "code", "agent"]))
    ).toBe("agent")
    expect(
      catalogGroupOf(component("x", ["ai", "chat", "media", "code"]))
    ).toBe("code")
    expect(catalogGroupOf(component("x", ["media"]))).toBe("media")
  })

  it("sends a component with no known category to 'other', and a forked alias out of primitives", () => {
    expect(catalogGroupOf(component("x"))).toBe("other")
    expect(catalogGroupOf(component("x", ["ai"]))).toBe("other")
    const fork: RegistryItem = {
      name: "button",
      type: "registry:ui",
      files: [{ path: "button.tsx", type: "registry:ui" }],
    }
    expect(catalogGroupOf(fork)).toBe("other")
  })

  it("groups the registry in reading order with no empty group, every item once, sorted by title", () => {
    const groups = catalogGroups(registry.items)
    expect(groups.map((group) => group.id)).toEqual([
      "chat",
      "agent",
      "code",
      "media",
      "blocks",
      "primitives",
      "base",
    ])
    expect(groups.every((group) => group.items.length > 0)).toBe(true)
    const names = groups.flatMap((group) => group.items.map((i) => i.name))
    expect(names.length).toBe(registry.items.length)
    expect(new Set(names).size).toBe(registry.items.length)
    for (const group of groups) {
      const titles = group.items.map((item) => item.title ?? item.name)
      expect(titles, group.id).toEqual(
        [...titles].sort((a, b) => a.localeCompare(b, "en"))
      )
      expect(group.label).toBe(CATALOG_GROUPS[group.id].label)
      expect(group.description).toBe(CATALOG_GROUPS[group.id].description)
    }
  })

  it("keeps 'other' empty for the shipped registry, and last in the order", () => {
    expect(catalogGroups(registry.items).some((g) => g.id === "other")).toBe(
      false
    )
    expect(CATALOG_GROUP_ORDER.at(-1)).toBe("other")
    const withOther = catalogGroups([...registry.items, component("zzz")])
    expect(withOther.at(-1)?.id).toBe("other")
    expect(withOther.at(-1)?.items.map((i) => i.name)).toEqual(["zzz"])
  })

  it("previews every item that ships files except the base, and previewGroups lists only those", () => {
    expect(hasPreviewPage(byName("base"))).toBe(false)
    expect(hasPreviewPage(byName("button"))).toBe(false)
    expect(hasPreviewPage(byName("response"))).toBe(true)
    expect(hasPreviewPage(byName("chat"))).toBe(true)
    const groups = previewGroups(registry.items)
    expect(groups.map((group) => group.id)).toEqual([
      "chat",
      "agent",
      "code",
      "media",
      "blocks",
    ])
    const names = groups.flatMap((group) => group.items.map((i) => i.name))
    expect(names.sort()).toEqual(
      registry.items
        .filter(hasPreviewPage)
        .map((i) => i.name)
        .sort()
    )
  })
})

describe("primitive groups (lib/registry.ts)", () => {
  const aliases = registry.items.filter(isUpstreamAlias).map((i) => i.name)

  it("maps every alias exactly once and names nothing that is not an alias, so a new primitive is placed on purpose", () => {
    const mapped = PRIMITIVE_GROUPS.flatMap((group) => group.names)
    expect(new Set(mapped).size).toBe(mapped.length)
    expect([...mapped].sort()).toEqual([...aliases].sort())
    const groups = primitiveGroups(registry.items)
    expect(groups.some((group) => group.label === "Other")).toBe(false)
    expect(groups.map((group) => group.label)).toEqual(
      PRIMITIVE_GROUPS.map((group) => group.label)
    )
    expect(groups.flatMap((g) => g.items).length).toBe(aliases.length)
  })

  it("keeps the map's order within a group, skips a name the registry lacks, drops an empty group and collects the rest under Other", () => {
    const groups = primitiveGroups([
      byName("card"),
      byName("button"),
      byName("input"),
      { name: "not-mapped", type: "registry:ui" },
      byName("response"),
    ])
    expect(
      groups.map((group) => [group.label, group.items.map((i) => i.name)])
    ).toEqual([
      ["Buttons & inputs", ["button", "input"]],
      ["Layout", ["card"]],
      ["Other", ["not-mapped"]],
    ])
  })
})

describe("site helpers (lib/site.ts)", () => {
  it("builds the install commands and hrefs the pages show", () => {
    expect(initCommand("https://uifiles.dev")).toBe(
      "pnpm dlx shadcn@latest init https://uifiles.dev/r/base.json"
    )
    expect(installCommand("button")).toBe(
      "pnpm dlx shadcn@latest add @uifiles/button"
    )
    expect(previewHref("branch")).toBe("/preview/branch")
    expect(registryJsonHref("branch")).toBe("/r/branch.json")
    expect(shadcnDocsHref("hover-card")).toBe(
      "https://ui.shadcn.com/docs/components/hover-card"
    )
  })

  it("links a single-file item to its file and a multi-file item to the directory its files share", () => {
    expect(sourceHref(byName("branch"))).toBe(
      `${GITHUB_URL}/blob/main/registry/ai/branch.tsx`
    )
    expect(sourceHref(byName("chat"))).toBe(
      `${GITHUB_URL}/tree/main/registry/blocks/chat`
    )
    expect(sourceHref(byName("button"))).toBeUndefined()
    expect(sourceHref(byName("base"))).toBeUndefined()
    const split: RegistryItem = {
      name: "split",
      type: "registry:block",
      files: [
        { path: "registry/blocks/a/x.tsx", type: "registry:component" },
        { path: "registry/blocks/b/y.tsx", type: "registry:component" },
      ],
    }
    expect(sourceHref(split)).toBe(`${GITHUB_URL}/tree/main/registry/blocks`)
    const nested: RegistryItem = {
      name: "nested",
      type: "registry:block",
      files: [
        { path: "registry/blocks/a/x.tsx", type: "registry:component" },
        { path: "registry/blocks/a/lib/y.ts", type: "registry:lib" },
      ],
    }
    expect(sourceHref(nested)).toBe(`${GITHUB_URL}/tree/main/registry/blocks/a`)
  })

  it("points an @uifiles dependency at its preview and a bare one at the shadcn docs", () => {
    expect(dependencyLink("@uifiles/response")).toEqual({
      label: "@uifiles/response",
      href: "/preview/response",
      external: false,
    })
    expect(dependencyLink("collapsible")).toEqual({
      label: "collapsible",
      href: "https://ui.shadcn.com/docs/components/collapsible",
      external: true,
    })
  })

  it("maps an item to what the preview shell shows, omitting a source it has none of", () => {
    const reasoning = previewEntry(byName("reasoning"))
    expect(reasoning).toEqual({
      name: "reasoning",
      title: "Reasoning",
      description: byName("reasoning").description,
      kind: "component",
      href: "/preview/reasoning",
      install: "pnpm dlx shadcn@latest add @uifiles/reasoning",
      jsonHref: "/r/reasoning.json",
      sourceHref: `${GITHUB_URL}/blob/main/registry/ai/reasoning.tsx`,
      dependsOn: [
        dependencyLink("collapsible"),
        dependencyLink("@uifiles/response"),
      ],
    })
    expect(previewEntry(byName("chat")).kind).toBe("block")
    const bare = previewEntry({ name: "bare", type: "registry:component" })
    expect(bare).toEqual({
      name: "bare",
      title: "bare",
      description: "",
      kind: "component",
      href: "/preview/bare",
      install: "pnpm dlx shadcn@latest add @uifiles/bare",
      jsonHref: "/r/bare.json",
      dependsOn: [],
    })
    expect("sourceHref" in bare).toBe(false)
  })
})
