import { GITHUB_URL } from "@/lib/site"

const LINK =
  "inline-flex items-center py-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"

/** Machine-readable entry points and the licence note, on every page. */
function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-muted-foreground">
          MIT. AI components derived from Vercel AI Elements (Apache-2.0), built
          on shadcn/ui and Base UI.
        </p>
        <nav aria-label="Resources" className="flex flex-wrap gap-x-5 gap-y-1">
          <a className={LINK} href="/r/registry.json">
            Registry index
          </a>
          <a className={LINK} href="/llms.txt">
            llms.txt
          </a>
          <a className={LINK} href={GITHUB_URL}>
            GitHub
          </a>
        </nav>
      </div>
    </footer>
  )
}

export { SiteFooter }
