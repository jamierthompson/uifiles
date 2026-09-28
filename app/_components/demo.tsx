import { cn } from "cn"
import type * as React from "react"

type DemoProps = {
  /** Names the state or variant shown; rendered as the section's heading. */
  title: string
  description?: React.ReactNode
  /** Controls rendered beside the title (a restart button, a toggle). */
  actions?: React.ReactNode
  /** Extra classes for the framed surface: `p-0` to let a block fill it. */
  className?: string | undefined
  children: React.ReactNode
}

/**
 * One demo on a preview page: a titled section with the component on a
 * framed surface, so every state reads the same way across the site. The
 * frame keeps the page's colors (no pattern behind the component), so what
 * axe measures here is what the component ships with.
 */
function Demo({ title, description, actions, className, children }: DemoProps) {
  return (
    <section className="flex flex-col gap-3" data-slot="demo">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-sm leading-6 font-medium">{title}</h2>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
      </div>
      <div
        className={cn(
          "rounded-xl border bg-card p-4 text-card-foreground shadow-xs sm:p-6",
          className
        )}
        data-slot="demo-surface"
      >
        {children}
      </div>
    </section>
  )
}

export { Demo }
