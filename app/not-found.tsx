import type { Metadata } from "next"
import Link from "next/link"
import { SiteFooter } from "@/app/_components/site-footer"
import { SiteHeader } from "@/app/_components/site-header"
import { buttonVariants } from "@/components/ui/button"

export const metadata: Metadata = { title: "Page not found" }

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-16 text-sm outline-none sm:px-6"
        id="main"
        tabIndex={-1}
      >
        <p className="font-mono text-xs text-muted-foreground">404</p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
          Page not found
        </h1>
        <p className="max-w-prose leading-relaxed text-muted-foreground sm:text-base">
          Nothing lives at this address. Registry items are served under{" "}
          <code className="font-mono">/r/</code> and rendered previews under{" "}
          <code className="font-mono">/preview/</code>.
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          <Link className={buttonVariants({ variant: "outline" })} href="/">
            Back to the catalog
          </Link>
          <Link
            className={buttonVariants({ variant: "ghost" })}
            href="/preview"
          >
            Browse components
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
