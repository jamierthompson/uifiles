import { baseUrl, groupByType, loadRegistry, TYPE_LABELS } from "@/lib/registry"

export default function Page() {
  const registry = loadRegistry()
  const groups = groupByType(registry.items)
  const origin = baseUrl()

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-10 px-4 py-12 text-sm">
      <header className="flex flex-col gap-3">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          uifiles
        </h1>
        <p className="leading-relaxed text-muted-foreground">
          A shadcn registry on Base UI. Every shadcn/ui primitive under one
          namespace, AI components ported from Vercel AI Elements, and the
          tokens that tie them together. Components are files copied into your
          project, not a dependency.
        </p>
        <pre className="overflow-x-auto rounded-lg bg-muted p-4 font-mono text-xs leading-relaxed">
          {`pnpm dlx shadcn@latest init ${origin}/r/base.json\npnpm dlx shadcn@latest add @uifiles/button`}
        </pre>
        <p className="text-xs text-muted-foreground">
          Registry index:{" "}
          <a className="underline" href="/r/registry.json">
            /r/registry.json
          </a>{" "}
          · For agents:{" "}
          <a className="underline" href="/llms.txt">
            /llms.txt
          </a>
        </p>
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
                  {item.files?.length ? null : (
                    <span className="text-xs text-muted-foreground">
                      alias → shadcn/ui
                    </span>
                  )}
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
