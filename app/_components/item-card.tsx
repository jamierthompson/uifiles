import { cn } from "cn"
import { ArrowRightIcon, ArrowUpRightIcon } from "lucide-react"
import Link from "next/link"

const CARD =
  "group flex h-full flex-col gap-2 rounded-xl border bg-card p-4 text-card-foreground transition-colors hover:border-foreground/20 hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"

/**
 * One catalog entry as a link: the title, the name to install, and the
 * description clamped so a grid of them stays even. Internal links go to the
 * item's preview; an external one (a shadcn/ui alias) to its upstream docs.
 */
function ItemCard({
  href,
  title,
  name,
  description,
  external = false,
  lines = 3,
  className,
}: {
  href: string
  title: string
  name: string
  description?: string | undefined
  external?: boolean | undefined
  /** How many lines of the description to keep. */
  lines?: 2 | 3 | undefined
  className?: string | undefined
}) {
  const Arrow = external ? ArrowUpRightIcon : ArrowRightIcon
  const body = (
    <>
      <span className="flex items-start justify-between gap-3">
        <span className="leading-6 font-medium">{title}</span>
        <Arrow
          aria-hidden="true"
          className="mt-1 size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        />
      </span>
      <span className="font-mono text-xs text-muted-foreground">
        @uifiles/{name}
      </span>
      {description ? (
        <span
          className={cn(
            "text-sm text-muted-foreground",
            lines === 2 ? "line-clamp-2" : "line-clamp-3"
          )}
        >
          {description}
        </span>
      ) : null}
    </>
  )
  return external ? (
    <a className={cn(CARD, className)} href={href}>
      {body}
    </a>
  ) : (
    <Link className={cn(CARD, className)} href={href}>
      {body}
    </Link>
  )
}

export { ItemCard }
