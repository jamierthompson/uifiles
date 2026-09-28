"use client"

import { cn } from "cn"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  ChevronDownIcon,
} from "lucide-react"
import Link from "next/link"
import { useSelectedLayoutSegment } from "next/navigation"
import { Badge, badgeVariants } from "@/components/ui/badge"
import type { PreviewEntry, PreviewGroup } from "@/lib/site"
import { InstallCommand } from "./install-command"

/** A dependency chip: the outline badge as a link, tall enough to be a target. */
const CHIP = cn(
  badgeVariants({ variant: "outline" }),
  "h-6 px-2 font-mono font-normal focus-visible:outline-none"
)

const LINK =
  "inline-flex items-center gap-1 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"

function GroupList({
  groups,
  active,
  idPrefix,
}: {
  groups: PreviewGroup[]
  active: string | null
  /** Keeps the label ids unique: the list renders twice (sidebar, phone menu). */
  idPrefix: string
}) {
  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => {
        const labelId = `${idPrefix}-${group.id}`
        return (
          <div className="flex flex-col gap-1" key={group.id}>
            <div
              className="px-2 text-xs font-medium tracking-wider text-muted-foreground uppercase"
              id={labelId}
            >
              {group.label}
            </div>
            <ul aria-labelledby={labelId} className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const current = item.name === active
                return (
                  <li key={item.name}>
                    <Link
                      aria-current={current ? "page" : undefined}
                      className={cn(
                        "flex h-8 items-center rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                        current && "bg-muted font-medium text-foreground"
                      )}
                      href={item.href}
                    >
                      {item.title}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

function PreviewHeader({
  entry,
  group,
}: {
  entry: PreviewEntry
  group: PreviewGroup
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          className="inline-flex items-center py-1 text-xs font-medium tracking-wider text-muted-foreground uppercase transition-colors hover:text-foreground focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          href={`/preview#${group.id}`}
        >
          {group.label}
        </Link>
        <Badge variant="outline">
          {entry.kind === "block" ? "Block" : "Component"}
        </Badge>
      </div>
      <div className="flex flex-col gap-3">
        <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
          {entry.title}
        </h1>
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground sm:text-base">
          {entry.description}
        </p>
      </div>
      <InstallCommand
        command={entry.install}
        label={`Copy the install command for ${entry.title}`}
      />
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <a className={LINK} href={entry.jsonHref}>
          Registry JSON
          <ArrowUpRightIcon aria-hidden="true" className="size-3.5" />
        </a>
        {entry.sourceHref ? (
          <a className={LINK} href={entry.sourceHref}>
            Source
            <ArrowUpRightIcon aria-hidden="true" className="size-3.5" />
          </a>
        ) : null}
      </div>
      {entry.dependsOn.length > 0 ? (
        <div className="flex flex-col gap-2">
          <div className="text-xs font-medium text-muted-foreground">
            Installs with
          </div>
          <ul className="flex flex-wrap gap-1.5">
            {entry.dependsOn.map((dependency) =>
              dependency.external ? (
                <li key={dependency.label}>
                  <a className={CHIP} href={dependency.href}>
                    {dependency.label}
                  </a>
                </li>
              ) : (
                <li key={dependency.label}>
                  <Link className={CHIP} href={dependency.href}>
                    {dependency.label}
                  </Link>
                </li>
              )
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function PagerLink({
  entry,
  direction,
}: {
  entry: PreviewEntry
  direction: "previous" | "next"
}) {
  const next = direction === "next"
  return (
    <Link
      className={cn(
        "flex min-w-0 flex-1 flex-col gap-1 rounded-lg border bg-card p-3 transition-colors hover:border-foreground/20 hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        next ? "items-end text-right" : "items-start"
      )}
      href={entry.href}
    >
      <span className="text-xs text-muted-foreground">
        {next ? "Next" : "Previous"}
      </span>
      <span className="flex items-center gap-1.5 text-sm font-medium">
        {next ? null : <ArrowLeftIcon aria-hidden="true" className="size-4" />}
        <span className="truncate">{entry.title}</span>
        {next ? <ArrowRightIcon aria-hidden="true" className="size-4" /> : null}
      </span>
    </Link>
  )
}

/**
 * The frame around every `/preview` page: a grouped component list (a sticky
 * sidebar from `lg`, a disclosure above the content below it), and for an
 * item page the header that names it, its install command, its links and
 * what it installs with, plus previous/next within the catalog order. The
 * item is read from the route segment, so the pages render only their demos.
 */
function PreviewShell({
  groups,
  children,
}: {
  groups: PreviewGroup[]
  children: React.ReactNode
}) {
  const segment = useSelectedLayoutSegment()
  const flat = groups.flatMap((group) =>
    group.items.map((entry) => ({ entry, group }))
  )
  const index = flat.findIndex(({ entry }) => entry.name === segment)
  const current = index === -1 ? undefined : flat[index]
  const previous = index > 0 ? flat[index - 1] : undefined
  const next = index === -1 ? undefined : flat[index + 1]

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 items-start gap-10 px-4 sm:px-6">
      <nav
        aria-label="Components"
        className="sticky top-14 hidden max-h-[calc(100svh-3.5rem)] w-56 shrink-0 overflow-y-auto py-8 pr-2 lg:block"
      >
        <GroupList active={segment} groups={groups} idPrefix="sidebar" />
      </nav>
      <main
        className="flex min-w-0 flex-1 flex-col gap-8 py-8 outline-none sm:py-10"
        id="main"
        tabIndex={-1}
      >
        {/* Keyed on the segment so it closes again after a navigation. */}
        <details className="group lg:hidden" key={segment ?? "index"}>
          <summary className="flex h-10 cursor-pointer list-none items-center justify-between rounded-lg border bg-card px-3 text-sm font-medium transition-colors hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
            Browse components
            <ChevronDownIcon
              aria-hidden="true"
              className="size-4 text-muted-foreground transition-transform group-open:rotate-180"
            />
          </summary>
          <nav
            aria-label="Components menu"
            className="mt-2 rounded-lg border bg-card p-3"
          >
            <GroupList active={segment} groups={groups} idPrefix="menu" />
          </nav>
        </details>
        <div className="flex w-full max-w-3xl flex-col gap-10">
          {current ? (
            <PreviewHeader entry={current.entry} group={current.group} />
          ) : null}
          {children}
          {current ? (
            <nav
              aria-label="Previous and next component"
              className="flex items-stretch gap-4 border-t pt-6"
            >
              {previous ? (
                <PagerLink direction="previous" entry={previous.entry} />
              ) : (
                <span className="flex-1" />
              )}
              {next ? (
                <PagerLink direction="next" entry={next.entry} />
              ) : (
                <span className="flex-1" />
              )}
            </nav>
          ) : null}
        </div>
      </main>
    </div>
  )
}

export { PreviewShell }
