import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { PreviewShell } from "@/app/_components/preview-shell"
import { GET as llmsTxt } from "@/app/llms.txt/route"
import HomePage from "@/app/page"
import PreviewLayout from "@/app/preview/layout"
import PreviewIndex from "@/app/preview/page"
import robots from "@/app/robots"
import {
  baseUrl,
  hasPreviewPage,
  isUpstreamAlias,
  loadRegistry,
  previewGroups,
  type RegistryItem,
  type SiteEnv,
} from "@/lib/registry"
import { type PreviewGroup, previewEntry } from "@/lib/site"

// The preview shell reads the current item from the route segment, which
// only the App Router provides; each test below sets it.
const route = vi.hoisted(() => ({ segment: null as string | null }))
vi.mock("next/navigation", () => ({
  useSelectedLayoutSegment: () => route.segment,
}))

const root = process.cwd()
const read = (rel: string) => readFileSync(join(root, rel), "utf8")
const exists = (rel: string) => existsSync(join(root, rel))
const dirs = (rel: string) =>
  readdirSync(join(root, rel))
    .filter((n) => statSync(join(root, rel, n)).isDirectory())
    .sort()

const registry = loadRegistry()
const byName = (name: string) => {
  const item = registry.items.find((i) => i.name === name)
  if (!item) throw new Error(`registry has no item "${name}"`)
  return item
}
const aiItems = registry.items.filter((i) =>
  i.files?.some((f) => f.path.startsWith("registry/ai/"))
)

const NO_ENV: SiteEnv = {}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(tsx?|md|json|ya?ml)$/.test(entry)) out.push(full)
  }
  return out
}

describe("baseUrl()", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it("uses NEXT_PUBLIC_BASE_URL and strips a trailing slash", () => {
    expect(baseUrl({ NEXT_PUBLIC_BASE_URL: "https://uifiles.dev/" })).toBe(
      "https://uifiles.dev"
    )
    expect(baseUrl({ NEXT_PUBLIC_BASE_URL: "https://uifiles.dev" })).toBe(
      "https://uifiles.dev"
    )
  })

  it("prefers the explicit origin over every Vercel variable", () => {
    expect(
      baseUrl({
        NEXT_PUBLIC_BASE_URL: "https://uifiles.dev",
        VERCEL_ENV: "production",
        VERCEL_PROJECT_PRODUCTION_URL: "uifiles.vercel.app",
        VERCEL_URL: "uifiles-abc123.vercel.app",
      })
    ).toBe("https://uifiles.dev")
  })

  it("derives https from the Vercel production domain when NEXT_PUBLIC_BASE_URL is unset", () => {
    expect(
      baseUrl({
        VERCEL: "1",
        VERCEL_ENV: "production",
        VERCEL_PROJECT_PRODUCTION_URL: "uifiles.dev",
        VERCEL_URL: "uifiles-abc123.vercel.app",
      })
    ).toBe("https://uifiles.dev")
  })

  it("falls back to VERCEL_URL on a preview deploy without a production domain", () => {
    expect(
      baseUrl({
        VERCEL_ENV: "preview",
        VERCEL_URL: "uifiles-abc123.vercel.app",
      })
    ).toBe("https://uifiles-abc123.vercel.app")
  })

  it("treats an empty or blank NEXT_PUBLIC_BASE_URL as unset", () => {
    expect(
      baseUrl({ NEXT_PUBLIC_BASE_URL: "", VERCEL_URL: "uifiles.vercel.app" })
    ).toBe("https://uifiles.vercel.app")
    expect(baseUrl({ NEXT_PUBLIC_BASE_URL: "  " })).toBe(
      "http://localhost:3000"
    )
  })

  it("defaults to localhost for local development", () => {
    expect(baseUrl(NO_ENV)).toBe("http://localhost:3000")
  })

  it("fails a production build that would advertise localhost", () => {
    expect(() => baseUrl({ VERCEL_ENV: "production" })).toThrow(
      /NEXT_PUBLIC_BASE_URL/
    )
    expect(() =>
      baseUrl({
        VERCEL_ENV: "production",
        NEXT_PUBLIC_BASE_URL: "http://localhost:3000",
        VERCEL_PROJECT_PRODUCTION_URL: "uifiles.dev",
      })
    ).toThrow(/localhost/)
  })

  it("allows localhost outside production", () => {
    expect(
      baseUrl({
        VERCEL_ENV: "preview",
        NEXT_PUBLIC_BASE_URL: "http://localhost:3000",
      })
    ).toBe("http://localhost:3000")
  })

  it("rejects a value that is not an absolute URL", () => {
    expect(() => baseUrl({ NEXT_PUBLIC_BASE_URL: "uifiles.dev" })).toThrow(
      /absolute URL/
    )
  })

  it("reads process.env when no environment is given", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://example.test/")
    expect(baseUrl()).toBe("https://example.test")
  })

  it("keeps a path prefix and drops a query or fragment", () => {
    expect(
      baseUrl({ NEXT_PUBLIC_BASE_URL: "https://uifiles.dev/registry/" })
    ).toBe("https://uifiles.dev/registry")
    expect(
      baseUrl({ NEXT_PUBLIC_BASE_URL: "https://uifiles.dev/?utm=1#top" })
    ).toBe("https://uifiles.dev")
  })

  it("refuses every loopback spelling in a production build", () => {
    for (const origin of [
      "http://127.0.0.1:3000",
      "http://[::1]:3000",
      "http://app.localhost:3000",
      "http://0.0.0.0:3000",
    ]) {
      expect(
        () =>
          baseUrl({ VERCEL_ENV: "production", NEXT_PUBLIC_BASE_URL: origin }),
        origin
      ).toThrow(/Refusing to build for production/)
    }
  })

  it("accepts a Vercel host that already carries a scheme and an explicit http origin outside production", () => {
    expect(baseUrl({ VERCEL_URL: "https://uifiles-abc.vercel.app" })).toBe(
      "https://uifiles-abc.vercel.app"
    )
    expect(
      baseUrl({
        VERCEL_ENV: "preview",
        NEXT_PUBLIC_BASE_URL: "http://uifiles.test:8080",
      })
    ).toBe("http://uifiles.test:8080")
  })
})

// The warning is once per process: a module-level flag trips on the first
// warning, so each test imports lib/registry afresh and ends with a call that
// must warn, which shows the silence before it was not the flag's doing.
describe("baseUrl() production warning", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  async function freshBaseUrl() {
    vi.resetModules()
    return (await import("@/lib/registry")).baseUrl
  }

  // `next build` sets NODE_ENV=production everywhere; only Vercel can tell a
  // production deploy from a local build, so off Vercel the build warns once
  // and continues rather than failing `pnpm build` on every laptop.
  it("warns once, without throwing, when a production build off Vercel still advertises localhost", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const fresh = await freshBaseUrl()
    expect(fresh({ NODE_ENV: "production" })).toBe("http://localhost:3000")
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toMatch(
      /production build with the public origin "http:\/\/localhost:3000"[\s\S]*NEXT_PUBLIC_BASE_URL/
    )
    expect(
      fresh({
        NODE_ENV: "production",
        NEXT_PUBLIC_BASE_URL: "http://127.0.0.1:3000",
      })
    ).toBe("http://127.0.0.1:3000")
    expect(warn).toHaveBeenCalledTimes(1)
  })

  // `next dev` and the test runners set NODE_ENV to development or test, and
  // a localhost origin is the right one there.
  it("stays silent outside a production build, whatever the origin", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const fresh = await freshBaseUrl()
    for (const NODE_ENV of [undefined, "development", "test"]) {
      expect(fresh({ NODE_ENV })).toBe("http://localhost:3000")
      expect(
        fresh({ NODE_ENV, NEXT_PUBLIC_BASE_URL: "http://127.0.0.1:3000" })
      ).toBe("http://127.0.0.1:3000")
    }
    expect(warn).not.toHaveBeenCalled()
    fresh({ NODE_ENV: "production" })
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it("stays silent for a production build with a public origin", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const fresh = await freshBaseUrl()
    fresh({
      NODE_ENV: "production",
      NEXT_PUBLIC_BASE_URL: "https://uifiles.dev",
    })
    expect(warn).not.toHaveBeenCalled()
    fresh({ NODE_ENV: "production" })
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it("stays silent for a Vercel preview build that advertises localhost", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const fresh = await freshBaseUrl()
    fresh({
      NODE_ENV: "production",
      VERCEL: "1",
      VERCEL_ENV: "preview",
      NEXT_PUBLIC_BASE_URL: "http://localhost:3000",
    })
    expect(warn).not.toHaveBeenCalled()
    fresh({
      NODE_ENV: "production",
      NEXT_PUBLIC_BASE_URL: "http://localhost:3000",
    })
    expect(warn).toHaveBeenCalledTimes(1)
  })
})

describe("/robots.txt", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("allows everything and sets Host to the public host name, not the origin", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://uifiles.dev")
    expect(robots()).toEqual({
      rules: { userAgent: "*", allow: "/" },
      host: "uifiles.dev",
    })
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "http://localhost:3000")
    expect(robots().host).toBe("localhost:3000")
  })
})

describe("/llms.txt", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("has no localhost URL and no double slash when NEXT_PUBLIC_BASE_URL is set", async () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://uifiles.dev/")
    const body = await llmsTxt().text()
    expect(body).not.toContain("localhost")
    expect(body).toContain("https://uifiles.dev/r/base.json")
    expect(body).not.toContain("uifiles.dev//r/")
  })

  it("lists every registry item exactly once in the catalog with its item URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://uifiles.dev")
    const body = await llmsTxt().text()
    // Everything after the "## Install" section is the catalog, one section per type.
    const catalog = body
      .split(/^## (?!Install\b)/m)
      .slice(1)
      .join("\n")
    for (const item of registry.items) {
      const url = `https://uifiles.dev/r/${item.name}.json`
      const lines = catalog
        .split("\n")
        .filter(
          (line) => line.startsWith("- [") && line.includes(`](${url}): `)
        )
      expect(lines, url).toHaveLength(1)
    }
  })
})

describe("home page catalog", () => {
  it("labels only file-less registry:ui entries as aliases to shadcn/ui", () => {
    expect(isUpstreamAlias(byName("base"))).toBe(false)
    expect(isUpstreamAlias(byName("button"))).toBe(true)
    expect(isUpstreamAlias(byName("response"))).toBe(false)
    expect(isUpstreamAlias(byName("chat"))).toBe(false)
    const fork: RegistryItem = {
      name: "button",
      type: "registry:ui",
      files: [{ path: "button.tsx", type: "registry:ui" }],
    }
    expect(isUpstreamAlias(fork)).toBe(false)
  })

  it("links every previewable item to its preview and every alias to its shadcn/ui docs, in a section per catalog group", () => {
    const html = renderToStaticMarkup(createElement(HomePage))
    for (const item of registry.items.filter(hasPreviewPage)) {
      expect(html, item.name).toContain(`href="/preview/${item.name}"`)
    }
    expect(html).toContain(">@uifiles/button</span>")
    expect(html).toContain(
      'href="https://ui.shadcn.com/docs/components/base/button"'
    )
    expect(html).not.toContain('href="/preview/button"')
    expect(html).toContain(">@uifiles/base</span>")
    expect(html).not.toContain('href="/preview/base"')
    const order = [
      "chat",
      "agent",
      "code",
      "media",
      "blocks",
      "primitives",
      "base",
    ]
    const positions = order.map((id) => html.indexOf(`id="${id}"`))
    expect(positions.every((index) => index !== -1)).toBe(true)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
    // Every section is reachable from the catalog nav, primitives included.
    for (const id of order.slice(0, -1)) {
      expect(html, id).toContain(`href="#${id}"`)
    }
  })

  // A sideways-scrolling <pre> at phone width is a scroll region without a
  // tab stop (axe scrollable-region-focusable, serious); wrapping avoids the
  // region altogether and a soft-wrapped command still copies as one line.
  it("wraps the install commands instead of scrolling them sideways", () => {
    const html = renderToStaticMarkup(createElement(HomePage))
    const pre = /<pre\b[^>]*>/.exec(html)?.[0] ?? ""
    expect(pre).toMatch(/\bwhitespace-pre-wrap\b/)
    expect(pre).toMatch(/\bbreak-words\b/)
    expect(pre).not.toMatch(/\boverflow-x-(auto|scroll)\b/)
  })

  it("links the previews, the registry index and llms.txt from the header and footer, with one h1 and one main", () => {
    const html = renderToStaticMarkup(createElement(HomePage))
    expect(html).toMatch(/<a [^>]*href="\/preview"/)
    expect(html).toMatch(/<a [^>]*href="\/r\/registry\.json"/)
    expect(html).toMatch(/<a [^>]*href="\/llms\.txt"/)
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1)
    expect(html.match(/<main[\s>]/g)).toHaveLength(1)
  })
})

describe("preview routes", () => {
  it("every app/preview/<name> directory has a page.tsx (the index lists directories)", () => {
    for (const name of dirs("app/preview")) {
      expect(exists(`app/preview/${name}/page.tsx`), name).toBe(true)
    }
  })

  // The root layout's title template applies only when a route sets a
  // title; a "use client" page cannot export metadata, a layout beside it can.
  it("every preview route sets a title, the registry item's: the page exports metadata, or a layout beside a client page does", () => {
    const titleIn = (rel: string) =>
      exists(rel)
        ? /^export const metadata\b[^=]*=\s*\{\s*title:\s*"([^"]+)"/m.exec(
            read(rel)
          )?.[1]
        : undefined
    const titles = Object.fromEntries(
      dirs("app/preview").map((name) => [
        name,
        titleIn(`app/preview/${name}/page.tsx`) ??
          titleIn(`app/preview/${name}/layout.tsx`),
      ])
    )
    expect(titles).toEqual(
      Object.fromEntries(
        dirs("app/preview").map((name) => [name, byName(name).title])
      )
    )
    for (const name of dirs("app/preview")) {
      const page = read(`app/preview/${name}/page.tsx`)
      if (/^"use client"/.test(page)) {
        expect(
          page,
          `${name}: client pages cannot export metadata`
        ).not.toMatch(/^export const metadata\b/m)
      }
    }
  })

  // The shell renders the item's title as the page's only <h1>, from the
  // registry, so the pages hold nothing but their demos.
  it("no preview page renders an <h1> of its own", () => {
    const withH1 = dirs("app/preview").filter((name) =>
      /<h1\b/.test(read(`app/preview/${name}/page.tsx`))
    )
    expect(withH1).toEqual([])
  })

  it("the preview shell renders each item's registry title as the one <h1>, its install command, its links and previous/next in catalog order", () => {
    const groups: PreviewGroup[] = previewGroups(registry.items).map(
      (group) => ({
        id: group.id,
        label: group.label,
        description: group.description,
        items: group.items.map(previewEntry),
      })
    )
    const flat = groups.flatMap((group) => group.items)
    expect(flat.map((entry) => entry.name).sort()).toEqual(dirs("app/preview"))
    for (const [index, entry] of flat.entries()) {
      route.segment = entry.name
      const html = renderToStaticMarkup(
        createElement(
          PreviewShell,
          { groups } as React.ComponentProps<typeof PreviewShell>,
          createElement("p", null, "demos")
        )
      )
      const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g) ?? []
      expect(h1, entry.name).toHaveLength(1)
      expect(h1[0]).toContain(`>${byName(entry.name).title}<`)
      expect(html).toContain("<p>demos</p>")
      expect(html).toContain(
        `pnpm dlx shadcn@latest add @uifiles/${entry.name}`
      )
      expect(html).toContain(`href="/r/${entry.name}.json"`)
      expect(html.match(/<main\b/g)).toHaveLength(1)
      // The sidebar and the phone menu both mark the current item.
      expect(html.match(/aria-current="page"/g)).toHaveLength(2)
      const previous = flat[index - 1]
      const next = flat[index + 1]
      expect(html.includes(">Previous<"), entry.name).toBe(Boolean(previous))
      expect(html.includes(">Next<"), entry.name).toBe(Boolean(next))
      if (previous) expect(html).toContain(`href="${previous.href}"`)
      if (next) expect(html).toContain(`href="${next.href}"`)
    }
    route.segment = null
  })

  it("the shell renders the index page without an item header, and the index links every preview", () => {
    route.segment = null
    const html = renderToStaticMarkup(
      createElement(PreviewLayout, null, createElement(PreviewIndex))
    )
    expect(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)).toEqual([
      expect.stringContaining(">Components<"),
    ])
    expect(html).not.toContain(">Previous<")
    expect(html).not.toContain(">Next<")
    // Only the header's "Components" link is current: no item is.
    expect(html.match(/aria-current="page"/g)).toHaveLength(1)
    for (const name of dirs("app/preview")) {
      expect(html, name).toContain(`href="/preview/${name}"`)
    }
    expect(html.match(/<main\b/g)).toHaveLength(1)
  })

  it("names a preview in its layout after the registry item, and the layout only passes the page through", async () => {
    const withLayout = dirs("app/preview").filter((name) =>
      exists(`app/preview/${name}/layout.tsx`)
    )
    expect(withLayout.length).toBeGreaterThan(0)
    for (const name of withLayout) {
      const layout = (await import(`@/app/preview/${name}/layout.tsx`)) as {
        metadata: { title?: unknown }
        default: (props: { children?: React.ReactNode }) => React.ReactNode
      }
      expect(layout.metadata.title, name).toBe(byName(name).title)
      expect(
        renderToStaticMarkup(
          createElement(layout.default, null, createElement("p", null, "page"))
        ),
        name
      ).toBe("<p>page</p>")
    }
  })

  it("titles the 404 page after its heading", async () => {
    const { metadata, default: NotFound } = await import("@/app/not-found")
    expect(metadata.title).toBe("Page not found")
    expect(renderToStaticMarkup(createElement(NotFound))).toMatch(
      /<h1[^>]*>Page not found<\/h1>/
    )
  })

  it("every registry/ai item has a preview page and a browser test that runs axe", () => {
    expect(aiItems.length).toBeGreaterThanOrEqual(18)
    for (const item of aiItems) {
      const test = `tests/browser/ai/${item.name}.test.tsx`
      expect(exists(`app/preview/${item.name}/page.tsx`), item.name).toBe(true)
      expect(exists(test), test).toBe(true)
      expect(read(test), `${test} runs axe`).toMatch(
        /expectNoViolations\(|runAxe\(|axe\.run\(/
      )
    }
  })
})

describe("licensing and attribution", () => {
  const MIT = `MIT License

Copyright (c) 2026 Jamie Thompson

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`

  it("LICENSE is the unmodified MIT text so GitHub detects it as MIT", () => {
    expect(read("LICENSE").trim()).toBe(MIT)
  })

  it("licenses/APACHE-2.0-ai-elements.txt carries the upstream copyright and the full Apache-2.0 text", () => {
    const text = read("licenses/APACHE-2.0-ai-elements.txt")
    expect(text.startsWith("Copyright 2023 Vercel, Inc.")).toBe(true)
    expect(text).toContain(
      "TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION"
    )
    expect(text).toContain("END OF TERMS AND CONDITIONS")
    expect(text).toContain("registry/ai/")
  })

  it("keeps LICENSE as the only license-like file at the root, so GitHub detects MIT rather than Other", () => {
    // licensee scores every root file named LICENSE*, LICENCE*, COPYING* as a (spelling-ok)
    // license and reports "Other" when two of them match different licenses.
    const licenseLike = readdirSync(root).filter(
      (name) =>
        /^(licen[sc]e|copying)/i.test(name) &&
        statSync(join(root, name)).isFile()
    )
    expect(licenseLike).toEqual(["LICENSE"])
  })

  it("NOTICE names every directory that holds third-party files and each vendored skill's source", () => {
    const notice = read("NOTICE")
    expect(notice).toContain("registry/ai/")
    expect(notice).toContain("components/ui/")
    expect(notice).toContain(".claude/skills/")
    for (const skill of dirs(".claude/skills")) {
      expect(notice, `NOTICE lists skill ${skill}`).toContain(skill)
    }
    expect(notice).toContain("https://github.com/shadcn-ui/ui")
    expect(notice).toContain("https://github.com/vercel/ai")
    expect(notice).toContain("https://github.com/vercel/ai-elements")
  })

  it("README's license section matches NOTICE and both point at the Apache-2.0 copy", () => {
    const readme = read("README.md")
    expect(readme).toContain("components/ui/")
    expect(readme).toContain("registry/ai/")
    expect(readme).toContain("licenses/APACHE-2.0-ai-elements.txt")
    expect(readme).toContain("NOTICE")
    expect(read("NOTICE")).toContain("licenses/APACHE-2.0-ai-elements.txt")
    expect(readme).not.toContain("LICENSE-ai-elements")
    expect(read("NOTICE")).not.toContain("LICENSE-ai-elements")
  })

  it("every registry/ai item opens its docs with the AI Elements derivation, so the CLI shows it on install", () => {
    const opening =
      "Derived from Vercel AI Elements (Apache-2.0, Copyright 2023 Vercel, Inc.); ported to Base UI and maintained by uifiles. "
    const { items } = JSON.parse(read("registry/ai/registry.json")) as {
      items: { name: string; docs?: string }[]
    }
    expect(items.length).toBe(aiItems.length)
    for (const item of items) {
      expect(item.docs?.startsWith(opening), item.name).toBe(true)
    }
  })

  it("every registry/ai source carries the two-line Apache header verbatim", () => {
    const header =
      /^\/\/ Derived from Vercel AI Elements [\w-]+\.tsx \(Apache-2\.0, Copyright 2023 Vercel, Inc\.\)\.\n\/\/ Modified for uifiles: ported from Radix UI to Base UI; dependencies point at @uifiles\.\n/
    for (const file of readdirSync(join(root, "registry/ai")).filter((f) =>
      f.endsWith(".tsx")
    )) {
      expect(read(`registry/ai/${file}`), file).toMatch(header)
    }
  })
})

describe("docs accuracy", () => {
  const docs = [
    "AGENTS.md",
    "README.md",
    "CONTRIBUTING.md",
    "docs/architecture.md",
    "docs/porting-ai-elements.md",
    "skills/uifiles/SKILL.md",
    ".claude/rules/registry.md",
  ]

  it("nothing refers to the retired docs/plan.md: not the docs, not a test, script or app source", () => {
    expect(exists("docs/plan.md")).toBe(false)
    expect(exists("docs/architecture.md")).toBe(true)
    for (const doc of docs) {
      expect(read(doc), doc).not.toContain("plan.md")
    }
    const self = fileURLToPath(import.meta.url)
    const hits: string[] = []
    for (const dir of ["app", "components", "e2e", "lib", "scripts", "tests"]) {
      for (const file of walk(join(root, dir))) {
        if (file === self) continue
        if (readFileSync(file, "utf8").includes("plan.md")) {
          hits.push(file.slice(root.length + 1))
        }
      }
    }
    expect(hits).toEqual([])
  })

  it("README's Getting started lists the three commands in order: shadcn init with the base, uifiles init, shadcn add", () => {
    const readme = read("README.md")
    const section =
      /^## Getting started\n([\s\S]*?)^## /m.exec(readme)?.[1] ?? ""
    expect(section).not.toBe("")
    const commands = [...section.matchAll(/^pnpm dlx [^\n#]+/gm)].map((m) =>
      m[0].trim()
    )
    expect(commands.slice(0, 3)).toEqual([
      "pnpm dlx shadcn@latest init https://uifiles.dev/r/base.json",
      "pnpm dlx uifiles@latest init",
      expect.stringMatching(/^pnpm dlx shadcn@latest add @uifiles\/[\w-]+/),
    ])
    for (const name of commands[2]?.match(/@uifiles\/([\w-]+)/g) ?? []) {
      expect(() => byName(name.slice("@uifiles/".length)), name).not.toThrow()
    }
    expect(section).toContain('Unknown registry "@uifiles"')
    for (const flag of ["--cwd", "--url", "--force"]) {
      expect(section, flag).toContain(flag)
    }
  })

  it("README no longer carries the interim GitHub-path instructions, and the CLI package's README gives the same three commands", () => {
    const readme = read("README.md")
    expect(readme).not.toMatch(/GitHub path/i)
    expect(readme).not.toMatch(/jamiethompsondesign\/uifiles\/[\w-]+#v/)
    expect(readme).not.toContain("directory lists `@uifiles`")
    const commands = (text: string) =>
      [...text.matchAll(/^pnpm dlx (?:shadcn|uifiles)@latest [^\n#]+/gm)]
        .map((m) => m[0].trim())
        .slice(0, 3)
    expect(commands(read("packages/uifiles/README.md"))).toEqual(
      commands(readme)
    )
  })

  it("README does not claim `pnpm gate` is everything CI runs, and names each CI-only script", () => {
    const readme = read("README.md")
    expect(readme).not.toMatch(/pnpm gate\s+#\s*everything CI runs\s*$/m)
    const { scripts } = JSON.parse(read("package.json")) as {
      scripts: Record<string, string>
    }
    const ciScripts = [
      ...read(".github/workflows/ci.yml").matchAll(
        /- run: pnpm ([\w:-]+)\s*$/gm
      ),
    ]
      .map((m) => m[1] ?? "")
      .filter((s) => s !== "install")
    const ciOnly = ciScripts.filter((script) => !scripts.gate?.includes(script))
    expect(ciOnly).toContain("test:e2e")
    for (const script of ciOnly) {
      expect(readme, `README mentions CI-only script ${script}`).toContain(
        `pnpm ${script}`
      )
      expect(read("AGENTS.md"), `AGENTS.md mentions ${script}`).toContain(
        `pnpm ${script}`
      )
    }
  })

  it("the skill points only at things that exist and allows the same CLI runners as the shadcn skill", () => {
    const skill = read("skills/uifiles/SKILL.md")
    expect(skill).not.toContain("references/")
    const allowed = (text: string) =>
      new Set(
        (text.match(/^allowed-tools: (.+)$/m)?.[1] ?? "").split(/,\s*/).sort()
      )
    expect(allowed(skill)).toEqual(
      allowed(read(".claude/skills/shadcn/SKILL.md"))
    )
    expect(skill).toMatch(/^user-invocable: false$/m)
  })

  it("docs/porting-ai-elements.md has balanced fences and '## 5. Verify' is a heading", () => {
    const lines = read("docs/porting-ai-elements.md").split("\n")
    let open: { char: string; len: number } | null = null
    let headingInsideFence = false
    for (const line of lines) {
      const fence = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/)
      if (!open) {
        if (fence) {
          const marker = fence[1] ?? ""
          open = { char: marker[0] ?? "`", len: marker.length }
        }
        continue
      }
      const marker = fence?.[1] ?? ""
      if (
        fence &&
        marker[0] === open.char &&
        marker.length >= open.len &&
        (fence[2] ?? "").trim() === ""
      ) {
        open = null
        continue
      }
      if (line.startsWith("## 5. Verify")) headingInsideFence = true
    }
    expect(open, "document ends inside an open fence").toBeNull()
    expect(headingInsideFence).toBe(false)
  })

  it("docs/porting-ai-elements.md teaches the shared a11y helpers and the ref-held callback pattern", () => {
    const doc = read("docs/porting-ai-elements.md")
    expect(doc).toContain("tests/a11y.ts")
    expect(doc).toContain("expectNoViolations")
    expect(doc).toContain("withDark")
    expect(doc).toContain("onOpenChangeRef")
    expect(doc).not.toContain("[isControlled, onOpenChange]")
    expect(doc).not.toContain("tests/browser/button.test.tsx")
  })

  it(".env.example describes the origin's real use and .mcp.json pins the shadcn major", () => {
    expect(read(".env.example")).not.toMatch(/v0/i)
    expect(read(".env.example")).toContain("NEXT_PUBLIC_BASE_URL=")
    const mcp = JSON.parse(read(".mcp.json")) as {
      mcpServers: Record<string, { args: string[] }>
    }
    expect(mcp.mcpServers.shadcn?.args).toContain("shadcn@4")
  })
})

describe("open-source hygiene", () => {
  it("ships the community files GitHub and contributors look for", () => {
    for (const file of [
      "CHANGELOG.md",
      "CONTRIBUTING.md",
      "SECURITY.md",
      "CODE_OF_CONDUCT.md",
      ".github/CODEOWNERS",
      ".github/PULL_REQUEST_TEMPLATE.md",
      ".github/ISSUE_TEMPLATE/bug_report.yml",
      ".github/ISSUE_TEMPLATE/feature_request.yml",
      ".github/ISSUE_TEMPLATE/config.yml",
    ]) {
      expect(exists(file), file).toBe(true)
    }
    expect(read("CHANGELOG.md")).toMatch(/^## \[0\.1\.0\]/m)
    expect(read("SECURITY.md")).toContain("security/advisories/new")
    expect(read("CODE_OF_CONDUCT.md")).not.toContain("[INSERT CONTACT METHOD]")
    expect(read(".github/CODEOWNERS").trim()).toBe("* @jamiethompsondesign")
  })

  it("keeps a .gitkeep only where the directory would otherwise be empty", () => {
    expect(exists("components/.gitkeep")).toBe(false)
    expect(exists("lib/.gitkeep")).toBe(false)
    expect(exists("public/.gitkeep")).toBe(false)
    expect(exists("hooks/.gitkeep")).toBe(true)
  })
})
