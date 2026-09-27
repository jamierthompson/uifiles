import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join } from "node:path"
import { registryItemSchema, registrySchema } from "shadcn/schema"
import { describe, expect, it } from "vitest"
import { loadRegistry, type RegistryItem } from "@/lib/registry"

const root = process.cwd()
const registry = loadRegistry(root)
const names = new Set(registry.items.map((item) => item.name))
const uiNames = new Set(
  registry.items
    .filter((item) => item.type === "registry:ui")
    .map((item) => item.name)
)

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
}
const installed: Record<string, string> = {
  ...pkg.devDependencies,
  ...pkg.dependencies,
}

const aiComponents = readdirSync(join(root, "registry/ai"))
  .filter((file) => file.endsWith(".tsx"))
  .map((file) => file.replace(/\.tsx$/, ""))
  .sort()

const previewDirs = readdirSync(join(root, "app/preview"))
  .filter((name) => statSync(join(root, "app/preview", name)).isDirectory())
  .sort()

/** `streamdown@^2.6` -> ["streamdown", "^2.6"]; `@streamdown/cjk@^1` -> ["@streamdown/cjk", "^1"]. */
function splitDependency(dep: string): [name: string, range: string] {
  const at = dep.lastIndexOf("@")
  return at > 0 ? [dep.slice(0, at), dep.slice(at + 1)] : [dep, ""]
}

/**
 * Bare packages a source imports: no relative, `@/` alias or `node:`
 * specifiers. Only statement-level `import`/`export ... from`, side-effect
 * imports and dynamic `import()` count, so a package named in a comment or a
 * string is not an import.
 */
function importedPackages(source: string): Set<string> {
  const packages = new Set<string>()
  const re =
    /^\s*(?:import|export)\b[^;]*?\bfrom\s+["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)|^\s*import\s+["']([^"']+)["']/gm
  for (const match of source.matchAll(re)) {
    const spec = match[1] ?? match[2] ?? match[3]
    if (
      !spec ||
      spec.startsWith(".") ||
      spec.startsWith("@/") ||
      spec.startsWith("node:")
    ) {
      continue
    }
    packages.add(packageOf(spec))
  }
  return packages
}

/** `katex/dist/katex.min.css` -> `katex`; `@streamdown/code` -> `@streamdown/code`. */
function packageOf(spec: string): string {
  const parts = spec.split("/")
  return spec.startsWith("@") ? parts.slice(0, 2).join("/") : (parts[0] ?? spec)
}

type CssTree = { [key: string]: string | CssTree }
const cssOf = (item: RegistryItem): CssTree =>
  (item as { css?: CssTree }).css ?? {}

/**
 * Packages an item's `css` loads through an `@import "<package>/…"` or
 * `@plugin "<package>"` key, which the CLI writes into the consumer's CSS
 * file (`response` declares `katex` only for the stylesheet its css imports;
 * shadcn's registry docs require a plugin's package in `dependencies`).
 */
function cssImportedPackages(item: RegistryItem): Set<string> {
  const packages = new Set<string>()
  for (const key of Object.keys(cssOf(item))) {
    const spec = /^@(?:import|plugin)\s+(?:url\(\s*)?["']([^"']+)["']/.exec(
      key
    )?.[1]
    if (!spec || spec.startsWith(".") || spec.startsWith("/")) continue
    if (/^[a-z][\w+.-]*:/i.test(spec)) continue
    packages.add(packageOf(spec))
  }
  return packages
}

/**
 * Declared packages that none of an item's files import and no `@import` or
 * `@plugin` key of its `css` loads: the CLI would install them into every
 * consumer's package.json for nothing.
 */
function staleDependencies(
  item: RegistryItem,
  read: (path: string) => string
): string[] {
  const used = cssImportedPackages(item)
  for (const file of item.files ?? []) {
    for (const name of importedPackages(read(file.path))) used.add(name)
  }
  return (item.dependencies ?? [])
    .map((dep) => splitDependency(dep)[0])
    .filter((name) => !used.has(name))
    .map(
      (name) =>
        `${item.name} declares "${name}", which no file imports and no css @import or @plugin loads`
    )
}

/**
 * Every rule or statement an item's `css` ships, as its path of keys
 * (`@layer base > .katex-display`, `@import "katex/dist/katex.min.css"`)
 * mapped to what it styles: the same path without the `@layer` wrappers
 * around it. A layer moves a rule in the cascade but does not change what it
 * matches, so `.katex-display` and `@layer base > .katex-display` are one
 * rule, and the unlayered copy wins.
 */
function cssRules(tree: CssTree, parents: string[] = []): Map<string, string> {
  const rules = new Map<string, string>()
  const unlayered = (path: string[]) =>
    path.filter((key, i) => i === path.length - 1 || !/^@layer\b/.test(key))
  const add = (path: string[]) =>
    rules.set(path.join(" > "), unlayered(path).join(" > "))
  for (const [key, value] of Object.entries(tree)) {
    const path = [...parents, key]
    if (typeof value === "string") add(parents)
    else if (Object.keys(value).length === 0) add(path)
    else for (const [full, rule] of cssRules(value, path)) rules.set(full, rule)
  }
  return rules
}

/**
 * Rules an item repeats from an `@uifiles/*` dependency, direct or
 * transitive. The CLI deep-merges the `css` of every item it resolves for an
 * install, so the dependency's copy already reaches the consumer.
 */
function repeatedCssRules(items: RegistryItem[]): string[] {
  const byName = new Map(items.map((item) => [item.name, item]))
  const uifilesDependencies = (item: RegistryItem) =>
    (item.registryDependencies ?? [])
      .filter((dep) => dep.startsWith("@uifiles/"))
      .map((dep) => dep.slice("@uifiles/".length))
  const problems: string[] = []
  for (const item of items) {
    const own = cssRules(cssOf(item))
    if (own.size === 0) continue
    const seen = new Set<string>()
    const queue = uifilesDependencies(item)
    while (queue.length > 0) {
      const name = queue.shift()
      if (name === undefined || seen.has(name) || name === item.name) continue
      seen.add(name)
      const dependency = byName.get(name)
      if (!dependency) continue
      queue.push(...uifilesDependencies(dependency))
      const theirs = [...cssRules(cssOf(dependency))]
      for (const [mine, rule] of own) {
        const shipped = theirs.find(([, other]) => other === rule)?.[0]
        if (shipped === undefined) continue
        problems.push(
          `${item.name} repeats \`${mine}\`, which @uifiles/${name} ships` +
            (shipped === mine ? "" : ` as \`${shipped}\``)
        )
      }
    }
  }
  return problems
}

/**
 * Bare packages an item's files import without declaring. React is the
 * consumer's; `next` is theirs too, but only a `registry:page` may assume it,
 * since a component ships to Vite and Remix projects as well.
 */
function undeclaredImports(
  item: RegistryItem,
  read: (path: string) => string
): string[] {
  const declared = new Set(
    (item.dependencies ?? []).map((dep) => splitDependency(dep)[0])
  )
  const problems: string[] = []
  for (const file of item.files ?? []) {
    const exempt =
      file.type === "registry:page"
        ? ["react", "react-dom", "next"]
        : ["react", "react-dom"]
    for (const name of importedPackages(read(file.path))) {
      if (exempt.includes(name) || declared.has(name)) continue
      problems.push(`${item.name} imports "${name}" in ${file.path}`)
    }
  }
  return problems
}

/** `item -> dep` for every bare dependency on a forked (`files`-bearing) registry:ui item. */
function bareDependenciesOnForks(items: RegistryItem[]): string[] {
  const forked = new Set(
    items
      .filter(
        (item) => item.type === "registry:ui" && (item.files?.length ?? 0) > 0
      )
      .map((item) => item.name)
  )
  return items
    .filter((item) => !forked.has(item.name))
    .flatMap((item) =>
      (item.registryDependencies ?? [])
        .filter((dep) => forked.has(dep))
        .map((dep) => `${item.name} -> ${dep}`)
    )
}

describe("source registry", () => {
  it("has unique item names", () => {
    const all = registry.items.map((item) => item.name)
    expect(new Set(all).size).toBe(all.length)
  })

  it("gives every item a description agents can search on: a sentence of at least 40 characters", () => {
    for (const item of registry.items) {
      expect(item.description, item.name).toMatch(/^\S[\s\S]{38,}\.$/)
      expect(
        item.description?.split(/\s+/).length,
        item.name
      ).toBeGreaterThanOrEqual(5)
    }
  })

  // The directory and the MCP server show these strings as they are: a
  // runaway description or a docs string with a stray line break or an
  // unbalanced quote or backtick renders broken there.
  it("keeps every description under 900 characters, gives every item a title, and keeps every docs string one paragraph with balanced quotes and backticks", () => {
    for (const item of registry.items) {
      expect(item.description?.length ?? 0, item.name).toBeLessThanOrEqual(900)
      expect(item.title, `${item.name} has a title`).toBeTruthy()
      const docs = (item as { docs?: string }).docs
      if (docs === undefined) continue
      expect(docs, `${item.name} docs is one paragraph`).not.toContain("\n")
      expect((docs.match(/"/g) ?? []).length % 2, `${item.name} quotes`).toBe(0)
      expect(
        (docs.match(/`/g) ?? []).length % 2,
        `${item.name} backticks`
      ).toBe(0)
    }
  })

  it("aliases every shadcn/ui primitive with a zero-file entry that depends on the bare name", () => {
    const ui = registry.items.filter((item) => item.type === "registry:ui")
    expect(ui.length).toBeGreaterThanOrEqual(63)
    for (const item of ui) {
      if (!item.files?.length) {
        expect(item.registryDependencies, item.name).toEqual([item.name])
      }
    }
  })
})

describe("registryDependencies", () => {
  it("every @uifiles/<name> dependency names an item in this registry", () => {
    for (const item of registry.items) {
      for (const dep of item.registryDependencies ?? []) {
        if (!dep.startsWith("@uifiles/")) continue
        expect(
          names.has(dep.slice("@uifiles/".length)),
          `${item.name} -> ${dep}`
        ).toBe(true)
      }
    }
  })

  // Bare names resolve upstream against the consumer's style; a typo or a
  // docs-only name is a 404 for every consumer and a failed weekly CLI check
  // for the registry health monitor.
  it("every bare dependency is a known upstream shadcn item", () => {
    const known = (dep: string) =>
      uiNames.has(dep) || dep === "utils" || dep.startsWith("font-")
    for (const item of registry.items) {
      for (const dep of item.registryDependencies ?? []) {
        if (dep.startsWith("@") || dep.includes("/")) continue
        expect(known(dep), `${item.name} -> bare "${dep}"`).toBe(true)
      }
    }
  })

  it("no item depends on a forked primitive by its bare name", () => {
    expect(bareDependenciesOnForks(registry.items)).toEqual([])
  })

  it("the bare-name rule fires once a primitive is forked", () => {
    const items = structuredClone(registry.items)
    const button = items.find((item) => item.name === "button")
    if (!button) throw new Error("button alias missing")
    button.files = [{ path: "registry/ui/button.tsx", type: "registry:ui" }]
    const violations = bareDependenciesOnForks(items)
    expect(violations).toContain("branch -> button")
    expect(violations.length).toBeGreaterThanOrEqual(8)
  })
})

describe("files", () => {
  it("every files[].path exists on disk", () => {
    for (const item of registry.items) {
      for (const file of item.files ?? []) {
        expect(
          existsSync(join(root, file.path)),
          `${item.name}: ${file.path}`
        ).toBe(true)
      }
    }
  })

  // The CLI keeps the last item that claims a target (deduplicateFilesByTarget).
  it("no two items write the same target", () => {
    const seen = new Map<string, string>()
    for (const item of registry.items) {
      for (const file of item.files ?? []) {
        if (!file.target) continue
        expect(
          seen.get(file.target),
          `${file.target} claimed by ${seen.get(file.target)} and ${item.name}`
        ).toBeUndefined()
        seen.set(file.target, item.name)
      }
    }
  })

  // The CLI places a file by its explicit target, so the type is what the MCP
  // `view` output and the directory show; keep it honest.
  it("types every file by where its target lands: lib/ is registry:lib, app/ is registry:page", () => {
    for (const item of registry.items) {
      for (const file of item.files ?? []) {
        const target = file.target ?? ""
        const label = `${item.name}: ${file.path} -> ${target}`
        if (target.startsWith("lib/"))
          expect(file.type, label).toBe("registry:lib")
        if (target.startsWith("hooks/"))
          expect(file.type, label).toBe("registry:hook")
        if (target.startsWith("app/"))
          expect(file.type, label).toBe("registry:page")
        if (target.startsWith("components/")) {
          expect(
            ["registry:component", "registry:ui", "registry:block"],
            label
          ).toContain(file.type)
        }
      }
    }
  })

  it("every registry/ai/*.tsx is declared in registry/ai/registry.json", () => {
    const declared = new Set(
      registry.items
        .flatMap((item) => item.files ?? [])
        .map((file) =>
          file.path.replace(/^registry\/ai\//, "").replace(/\.tsx$/, "")
        )
    )
    expect(aiComponents.filter((name) => !declared.has(name))).toEqual([])
  })

  // The CLI (4.21) first rewrites `@/registry/ai/x` to `@/components/x`, then
  // repairs it by basename against the files planned for the same install,
  // which only holds when the providing item is in the dependency tree.
  it("cross-item imports resolve to a declared @uifiles dependency's target", () => {
    const targetsByItem = new Map(
      registry.items.map((item) => [
        item.name,
        (item.files ?? [])
          .map((file) => file.target?.replace(/\.tsx?$/, ""))
          .filter((target): target is string => target !== undefined),
      ])
    )
    const rewrite = (spec: string) =>
      spec
        .replace(/^@\/registry\/(.+)\/components/, "@/components")
        .replace(/^@\/registry\/(.+)\/lib/, "@/lib")
        .replace(/^@\/registry\/(.+)\/hooks/, "@/hooks")
        .replace(/^@\/registry\/[^/]+/, "@/components")
        .replace(/^@\//, "")
    const providerOf = (
      importer: string,
      target: string
    ): string | undefined => {
      const exact = [...targetsByItem].find(
        ([name, targets]) => name !== importer && targets.includes(target)
      )
      if (exact) return exact[0]
      const base = target.split("/").pop()
      return [...targetsByItem].find(
        ([name, targets]) =>
          name !== importer && targets.some((t) => t.endsWith(`/${base}`))
      )?.[0]
    }
    for (const item of registry.items) {
      const declared = new Set(
        (item.registryDependencies ?? [])
          .filter((dep) => dep.startsWith("@uifiles/"))
          .map((dep) => dep.slice("@uifiles/".length))
      )
      for (const file of item.files ?? []) {
        const source = readFileSync(join(root, file.path), "utf8")
        for (const match of source.matchAll(
          /from\s+["'](@\/registry\/[^"']+|\.\/[^"']+)["']/g
        )) {
          const spec = match[1]
          if (!spec) continue
          const target = spec.startsWith("./")
            ? `${dirname(file.target ?? "")}/${spec.slice(2)}`
            : rewrite(spec)
          if (targetsByItem.get(item.name)?.includes(target)) continue
          const provider = providerOf(item.name, target)
          expect(
            provider !== undefined && declared.has(provider),
            `${item.name}/${file.path} imports "${spec}" -> ${target}; provider=${provider ?? "none"}, declared=${[...declared].join(",")}`
          ).toBe(true)
        }
      }
    }
  })
})

describe("npm dependencies", () => {
  it("every declared dependency is installed here with a compatible major, and minor when pinned", () => {
    for (const item of registry.items) {
      const declared = [
        ...(item.dependencies ?? []),
        ...((item as { devDependencies?: string[] }).devDependencies ?? []),
      ]
      for (const dep of declared) {
        const [name, range] = splitDependency(dep)
        const have = installed[name]
        expect(have, `${item.name}: ${dep} not in package.json`).toBeDefined()
        if (!range || !have) continue
        const [wantMajor, wantMinor] = range.replace(/^[\^~]/, "").split(".")
        const [haveMajor, haveMinor] = have.replace(/^[\^~]/, "").split(".")
        expect(haveMajor, `${item.name}: ${dep} vs installed ${have}`).toBe(
          wantMajor
        )
        if (wantMinor !== undefined) {
          expect(
            Number(haveMinor),
            `${item.name}: ${dep} vs installed ${have}`
          ).toBeGreaterThanOrEqual(Number(wantMinor))
        }
      }
    }
  })

  // The CLI installs only what `dependencies` lists and never rewrites a bare
  // import such as "cn", so an undeclared package is a build break for any
  // consumer whose project does not already have it.
  it("every bare package a registry file imports is declared in the item's dependencies", () => {
    const problems = registry.items.flatMap((item) =>
      undeclaredImports(item, (path) => readFileSync(join(root, path), "utf8"))
    )
    expect(problems).toEqual([])
  })

  // The reverse: a dependency nothing uses is installed into every
  // consumer's package.json for nothing, and it outlives the code that needed
  // it. A file-less item (the base) declares what its style installs, not what
  // it ships, so only items with files are held to it.
  it("every dependency of an item that ships files is imported by one of its files or loaded by an @import or @plugin key of its css", () => {
    const problems = registry.items
      .filter((item) => (item.files?.length ?? 0) > 0)
      .flatMap((item) =>
        staleDependencies(item, (path) =>
          readFileSync(join(root, path), "utf8")
        )
      )
    expect(problems).toEqual([])
  })

  it("the stale-dependency rule names the item and the package, and counts a css @import or @plugin key as a use", () => {
    const sources: Record<string, string> = {
      "x/widget.tsx":
        'import { cn } from "cn"\nimport { Streamdown } from "streamdown"',
    }
    const read = (path: string) => sources[path] ?? ""
    const item: RegistryItem = {
      name: "x",
      type: "registry:component",
      dependencies: ["cn", "streamdown@^2.6", "katex@^0.16", "nanoid@^6"],
      files: [{ path: "x/widget.tsx", type: "registry:component" }],
    }
    expect(staleDependencies(item, read)).toEqual([
      'x declares "katex", which no file imports and no css @import or @plugin loads',
      'x declares "nanoid", which no file imports and no css @import or @plugin loads',
    ])
    // The CLI writes the @import into the consumer's CSS, which then needs
    // the package installed; a URL import names no package.
    Object.assign(item, {
      css: {
        '@import "katex/dist/katex.min.css"': {},
        '@import url("https://fonts.example/nanoid.css")': {},
      } satisfies CssTree,
    })
    expect(staleDependencies(item, read)).toEqual([
      'x declares "nanoid", which no file imports and no css @import or @plugin loads',
    ])
    // A Tailwind plugin key loads its package the same way, and shadcn's
    // registry docs require the package in `dependencies`; a file plugin
    // names no package.
    Object.assign(item, {
      dependencies: ["cn", "streamdown@^2.6", "@tailwindcss/typography@^0.5"],
      css: {
        '@plugin "@tailwindcss/typography"': {},
        '@plugin "./custom-plugin.js"': {},
      } satisfies CssTree,
    })
    expect(staleDependencies(item, read)).toEqual([])
  })

  it("exempts next only in a registry:page file: a component that imports next/* breaks non-Next consumers", () => {
    const sources: Record<string, string> = {
      "x/page.tsx":
        'import Link from "next/link"\nexport default () => <Link href="/" />',
      "x/widget.tsx": 'import Link from "next/link"\nimport { cn } from "cn"',
    }
    const read = (path: string) => sources[path] ?? ""
    const item: RegistryItem = {
      name: "x",
      type: "registry:block",
      dependencies: ["cn"],
      files: [
        { path: "x/page.tsx", type: "registry:page", target: "app/x/page.tsx" },
        { path: "x/widget.tsx", type: "registry:component" },
      ],
    }
    expect(undeclaredImports(item, read)).toEqual([
      'x imports "next" in x/widget.tsx',
    ])
  })

  it("every @/components/ui/<x> import in a registry source is a declared bare registryDependency", () => {
    const problems: string[] = []
    for (const item of registry.items) {
      const declared = new Set(item.registryDependencies ?? [])
      for (const file of item.files ?? []) {
        const source = readFileSync(join(root, file.path), "utf8")
        for (const match of source.matchAll(
          /from\s+"@\/components\/ui\/([\w-]+)"/g
        )) {
          const name = match[1] ?? ""
          if (!declared.has(name)) problems.push(`${item.name} -> ${name}`)
        }
      }
    }
    expect(problems).toEqual([])
  })
})

describe("css", () => {
  // shadcn's registry resolver deep-merges the css of every item an install
  // resolves (packages/shadcn/src/registry/resolver.ts), so reasoning and chat
  // get @uifiles/response's stylesheet imports and .katex-display rule with
  // it. A repeat adds nothing but a second copy that can drift.
  it("no item repeats a css rule that one of its @uifiles dependencies already ships", () => {
    expect(repeatedCssRules(registry.items)).toEqual([])
  })

  it("the repeat rule follows @uifiles dependencies transitively, names the rule and sees through @layer wrappers", () => {
    const item = (
      name: string,
      registryDependencies: string[],
      css?: CssTree
    ): RegistryItem =>
      Object.assign(
        { name, type: "registry:component", registryDependencies },
        css && { css }
      )
    const katexDisplay: CssTree = {
      "@layer base": { ".katex-display": { overflow: "auto hidden" } },
    }
    const stylesheet: CssTree = { '@import "katex/dist/katex.min.css"': {} }
    const response = item("response", [], { ...stylesheet, ...katexDisplay })
    // A different declaration on the same selector is still a second copy.
    const reasoning = item("reasoning", ["collapsible", "@uifiles/response"], {
      "@layer base": { ".katex-display": { "overflow-x": "auto" } },
    })
    // chat reaches response directly and through reasoning: one report.
    const chat = item(
      "chat",
      ["@uifiles/reasoning", "@uifiles/response"],
      stylesheet
    )
    // agent reaches response only through reasoning.
    const agent = item("agent", ["@uifiles/reasoning"], stylesheet)
    // The same rule on an item that does not depend on response is its own.
    const tool = item("tool", ["@uifiles/code-block"], katexDisplay)
    // Outside the layer it is still the same rule, and the worse copy: an
    // unlayered rule beats every layered one in the cascade. Another layer
    // only moves it; a media query makes it a different rule.
    const canvas = item("canvas", ["@uifiles/response"], {
      ".katex-display": { overflow: "visible" },
      "@layer components": { ".katex-display": { "padding-block": "0" } },
      "@media print": { ".katex-display": { overflow: "visible" } },
    })
    expect(
      repeatedCssRules([response, reasoning, chat, agent, tool, canvas])
    ).toEqual([
      "reasoning repeats `@layer base > .katex-display`, which @uifiles/response ships",
      'chat repeats `@import "katex/dist/katex.min.css"`, which @uifiles/response ships',
      'agent repeats `@import "katex/dist/katex.min.css"`, which @uifiles/response ships',
      "canvas repeats `.katex-display`, which @uifiles/response ships as `@layer base > .katex-display`",
      "canvas repeats `@layer components > .katex-display`, which @uifiles/response ships as `@layer base > .katex-display`",
    ])
  })
})

describe("upstream lock (registry/ai/upstream.lock.json)", () => {
  type LockEntry = {
    source: string
    sha256: string
    fetchedAt: string
    upstream?: string
  }
  const lock = JSON.parse(
    readFileSync(join(root, "registry/ai/upstream.lock.json"), "utf8")
  ) as Record<string, LockEntry>

  it("keys exactly the shipped registry/ai items", () => {
    const shipped = registry.items
      .filter((item) =>
        item.files?.some((file) => file.path.startsWith("registry/ai/"))
      )
      .map((item) => item.name)
      .sort()
    expect(Object.keys(lock).sort()).toEqual(shipped)
  })

  it("records the upstream source, its sha256 and a fetch date; extracted items name their upstream file", () => {
    for (const [name, entry] of Object.entries(lock)) {
      expect(entry.source, name).toMatch(
        /^https:\/\/elements\.ai-sdk\.dev\/api\/registry\/[\w-]+\.json$/
      )
      expect(entry.sha256, name).toMatch(/^[0-9a-f]{64}$/)
      expect(entry.fetchedAt, name).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      if (entry.upstream !== undefined) expect(entry.upstream).not.toBe(name)
      expect(
        entry.source.endsWith(`/${entry.upstream ?? name}.json`),
        name
      ).toBe(true)
    }
  })
})

describe("each new component ships with (AGENTS.md)", () => {
  it("every registry/ai/*.tsx has a browser test at tests/browser/ai/<name>.test.tsx", () => {
    const missing = aiComponents.filter(
      (name) => !existsSync(join(root, "tests/browser/ai", `${name}.test.tsx`))
    )
    expect(missing).toEqual([])
  })

  it("every registry/ai/*.tsx has a preview page at app/preview/<name>/page.tsx", () => {
    const missing = aiComponents.filter(
      (name) => !existsSync(join(root, "app/preview", name, "page.tsx"))
    )
    expect(missing).toEqual([])
  })

  it("every item that ships files (except the base) has a preview page", () => {
    const withFiles = registry.items
      .filter(
        (item) => (item.files?.length ?? 0) > 0 && item.type !== "registry:base"
      )
      .map((item) => item.name)
    expect(withFiles.filter((name) => !previewDirs.includes(name))).toEqual([])
  })

  it("every preview page corresponds to a registry item", () => {
    expect(previewDirs.filter((dir) => !names.has(dir))).toEqual([])
  })
})

describe("built output (public/r)", () => {
  const dir = join(root, "public/r")
  const built = existsSync(join(dir, "registry.json"))
  // public/r is gitignored. Locally the checks wait for `pnpm registry:build`;
  // in CI that step precedes the tests, so a missing build is a wiring error
  // and the checks fail instead of skipping.
  const inCI = Boolean(process.env.CI)
  const expectBuilt = () =>
    expect(
      built,
      "public/r/registry.json is missing: run pnpm registry:build before the tests (ci.yml does)"
    ).toBe(true)

  // Directory requirement 4 applies to the index: `shadcn build` strips file
  // content there and keeps it in <name>.json, which the CLI installs from.
  it.skipIf(!built && !inCI)(
    "the index validates with the CLI schema, lists exactly the source items and carries no file content",
    () => {
      expectBuilt()
      const index = JSON.parse(
        readFileSync(join(dir, "registry.json"), "utf8")
      ) as {
        name: string
        homepage: string
        items: Array<{ name: string; files?: Array<{ content?: string }> }>
      }
      const parsed = registrySchema.safeParse(index)
      expect(
        parsed.success,
        JSON.stringify(parsed.success ? null : parsed.error.issues.slice(0, 3))
      ).toBe(true)
      expect(
        index.items.filter((item) =>
          item.files?.some((file) => "content" in file)
        )
      ).toEqual([])
      const builtNames = index.items.map((item) => item.name)
      expect(new Set(builtNames).size).toBe(builtNames.length)
      expect([...builtNames].sort()).toEqual([...names].sort())
      expect(index.name).toBe("uifiles")
      expect(index.homepage).toMatch(/^https:\/\//)
    }
  )

  it.skipIf(!built && !inCI)(
    "every item file validates, matches its name and carries content",
    () => {
      expectBuilt()
      for (const name of names) {
        const json = JSON.parse(
          readFileSync(join(dir, `${name}.json`), "utf8")
        ) as {
          name: string
          files?: Array<{ path: string; content?: unknown }>
        }
        const parsed = registryItemSchema.safeParse(json)
        expect(parsed.success, name).toBe(true)
        expect(json.name).toBe(name)
        for (const file of json.files ?? []) {
          expect(typeof file.content, `${name}: ${file.path}`).toBe("string")
        }
      }
    }
  )
})

describe("llms.txt route", () => {
  it("lists every registry item with a link to its /r/<name>.json and its description", async () => {
    const { GET } = await import("@/app/llms.txt/route")
    const text = await GET().text()
    for (const item of registry.items) {
      expect(text, item.name).toContain(`/r/${item.name}.json`)
      if (item.description) expect(text, item.name).toContain(item.description)
    }
  })
})
