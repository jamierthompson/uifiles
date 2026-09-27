import Link from "next/link"
import { ThemeToggle } from "@/components/theme-toggle"

export default function PreviewLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-8 px-4 py-10">
      <nav
        aria-label="Previews"
        className="flex items-center justify-between gap-4 text-sm"
      >
        <div className="flex items-center gap-4">
          <Link className="inline-block py-1 underline" href="/">
            uifiles
          </Link>
          <Link className="inline-block py-1 underline" href="/preview">
            All previews
          </Link>
        </div>
        <ThemeToggle />
      </nav>
      {children}
    </main>
  )
}
