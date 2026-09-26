import { describe, expect, it } from "vitest"
import { loadRegistry } from "@/lib/registry"

describe("source registry", () => {
  const registry = loadRegistry()

  it("has unique item names", () => {
    const names = registry.items.map((i) => i.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it("gives every item a description agents can search on", () => {
    for (const item of registry.items) {
      expect(item.description, item.name).toMatch(/\S{10,}/)
    }
  })

  it("references forked primitives by namespace, never by bare name", () => {
    const forked = new Set(
      registry.items
        .filter((i) => i.type === "registry:ui" && (i.files?.length ?? 0) > 0)
        .map((i) => i.name)
    )
    for (const item of registry.items) {
      if (forked.has(item.name)) continue
      for (const dep of item.registryDependencies ?? []) {
        expect(
          forked.has(dep),
          `${item.name} depends on bare "${dep}" but @uifiles/${dep} is forked`
        ).toBe(false)
      }
    }
  })

  it("aliases every shadcn/ui primitive", () => {
    const ui = registry.items.filter((i) => i.type === "registry:ui")
    expect(ui.length).toBeGreaterThanOrEqual(63)
    for (const item of ui) {
      if (!item.files?.length)
        expect(item.registryDependencies).toEqual([item.name])
    }
  })
})
