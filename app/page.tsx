import Link from "next/link"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  baseUrl,
  groupByType,
  isUpstreamAlias,
  loadRegistry,
  TYPE_LABELS,
} from "@/lib/registry"

const GITHUB_URL = "https://github.com/jamiethompsondesign/uifiles"

export default function Page() {
  const registry = loadRegistry()
  const groups = groupByType(registry.items)
  const origin = baseUrl()

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-10 px-4 py-12 text-sm">
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            uifiles
          </h1>
          <ThemeToggle />
        </div>
        <p className="leading-relaxed text-muted-foreground">
          A shadcn registry on Base UI. Every shadcn/ui primitive under one
          namespace, AI components ported from Vercel AI Elements, and the
          tokens that tie them together. Components are files copied into your
          project, not a dependency.
        </p>
        {/* Wraps at phone width instead of scrolling sideways: a scroll region
            would need a tab stop to be keyboard reachable (WCAG 2.1.1), and a
            soft-wrapped command still copies as one line. */}
        <pre className="rounded-lg bg-muted p-4 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap">
          {`pnpm dlx shadcn@latest init ${origin}/r/base.json\npnpm dlx shadcn@latest add @uifiles/button`}
        </pre>
        <nav
          aria-label="Site"
          className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground"
        >
          <Link className="inline-block py-1 underline" href="/preview">
            Previews
          </Link>
          <a className="inline-block py-1 underline" href="/r/registry.json">
            Registry index
          </a>
          <a className="inline-block py-1 underline" href="/llms.txt">
            llms.txt for agents
          </a>
          <a className="inline-block py-1 underline" href={GITHUB_URL}>
            GitHub
          </a>
        </nav>
      </header>

      {groups.map(([type, items]) => (
        <section key={type} className="flex flex-col gap-3">
          <h2 className="font-medium">
            {TYPE_LABELS[type] ?? type}{" "}
            <span className="font-normal text-muted-foreground">
              ({items.length})
            </span>
          </h2>
          <ul className="divide-y divide-border rounded-lg border">
            {items.map((item) => (
              <li key={item.name} className="flex flex-col gap-1 p-3">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-mono text-xs">
                    @uifiles/{item.name}
                  </span>
                  {isUpstreamAlias(item) ? (
                    <span className="text-xs text-muted-foreground">
                      alias → shadcn/ui
                    </span>
                  ) : null}
                </div>
                <p className="text-muted-foreground">{item.description}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  )
}
