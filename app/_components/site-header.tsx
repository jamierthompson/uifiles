import { cn } from "cn"
import { ComponentIcon } from "lucide-react"
import Link from "next/link"
import { ThemeToggle } from "@/components/theme-toggle"
import { GITHUB_URL, SITE_NAME } from "@/lib/site"

type SiteSection = "components"

function NavLink({
  href,
  active,
  children,
}: {
  href: string
  active?: boolean | undefined
  children: React.ReactNode
}) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-8 items-center rounded-md px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        active && "text-foreground"
      )}
      href={href}
    >
      {children}
    </Link>
  )
}

/**
 * The site's banner: wordmark, primary navigation and the theme toggle (the
 * only theme control, see components/theme-toggle.tsx). A skip link comes
 * first for keyboard users; every page gives its `<main>` the `main` id and
 * `tabIndex={-1}`, so the link moves focus there in every browser.
 */
function SiteHeader({ active }: { active?: SiteSection | undefined }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-sm supports-backdrop-filter:bg-background/60">
      <a
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:ring-3 focus:ring-ring/50 focus:outline-none"
        href="#main"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
        <Link
          className="flex h-8 items-center gap-2 rounded-md pr-1 font-heading text-sm font-semibold tracking-tight focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          href="/"
        >
          <span
            aria-hidden="true"
            className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground"
          >
            <ComponentIcon className="size-3.5" />
          </span>
          {SITE_NAME}
        </Link>
        <nav aria-label="Site" className="flex items-center gap-0.5">
          <NavLink active={active === "components"} href="/preview">
            Components
          </NavLink>
          <NavLink href={GITHUB_URL}>GitHub</NavLink>
        </nav>
        <div className="ml-auto flex items-center">
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}

export { SiteHeader }
