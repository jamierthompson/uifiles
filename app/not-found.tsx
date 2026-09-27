import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = { title: "Page not found" }

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-4 px-4 py-12 text-sm">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        Page not found
      </h1>
      <p className="leading-relaxed text-muted-foreground">
        Nothing lives at this address. Registry items are served under{" "}
        <code className="font-mono">/r/</code> and rendered previews under{" "}
        <code className="font-mono">/preview/</code>.
      </p>
      <p>
        <Link className="inline-block py-1 underline" href="/">
          Back to the catalog
        </Link>
      </p>
    </main>
  )
}
