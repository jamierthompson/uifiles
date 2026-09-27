// Derived from Vercel AI Elements sources.tsx (Apache-2.0, Copyright 2023 Vercel, Inc.).
// Modified for uifiles: ported from Radix UI to Base UI; dependencies point at @uifiles.
"use client"

import { cn } from "cn"
import { BookIcon, ChevronDownIcon } from "lucide-react"
import type { ComponentProps } from "react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

export type SourcesProps = ComponentProps<"div"> &
  Pick<
    ComponentProps<typeof Collapsible>,
    "open" | "defaultOpen" | "onOpenChange" | "disabled"
  >

export const Sources = ({ className, ...props }: SourcesProps) => (
  <Collapsible
    className={cn("not-prose mb-4 text-xs text-primary", className)}
    {...props}
  />
)

export type SourcesTriggerProps = ComponentProps<typeof CollapsibleTrigger> & {
  count: number
}

export const SourcesTrigger = ({
  className,
  count,
  children,
  ...props
}: SourcesTriggerProps) => (
  <CollapsibleTrigger
    className={cn("flex min-h-6 items-center gap-2", className)}
    {...props}
  >
    {children ?? (
      <>
        <span className="font-medium">
          {`Used ${count} ${count === 1 ? "source" : "sources"}`}
        </span>
        <ChevronDownIcon className="h-4 w-4" />
      </>
    )}
  </CollapsibleTrigger>
)

export type SourcesContentProps = ComponentProps<typeof CollapsibleContent>

export const SourcesContent = ({
  className,
  ...props
}: SourcesContentProps) => (
  <CollapsibleContent
    className={cn(
      "mt-3 flex w-fit flex-col gap-2",
      "outline-none data-open:animate-in data-open:slide-in-from-top-2 data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-top-2",
      className
    )}
    {...props}
  />
)

export type SourceProps = ComponentProps<"a">

/** Absolute (`https://…`, `mailto:`) or protocol-relative URLs leave the app. */
const isExternal = (href: string) => /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href)

const hostnameOf = (href: string) => {
  try {
    return new URL(href).hostname
  } catch {
    return ""
  }
}

export const Source = ({
  href,
  title,
  children,
  className,
  rel,
  target,
  ...props
}: SourceProps) => {
  // Providers do return empty titles; an empty string is as unusable as a
  // missing one, so both fall through to the hostname.
  const content = children || (
    <>
      <BookIcon className="h-4 w-4" />
      <span className="block font-medium">
        {title || (href ? hostnameOf(href) || href : undefined)}
      </span>
    </>
  )
  const classes = cn("flex min-h-6 items-center gap-2", className)

  if (!href) {
    // An <a> without href is neither a link nor focusable; render plain text.
    return (
      <span className={classes} {...(props as ComponentProps<"span">)}>
        {content}
      </span>
    )
  }

  const external = isExternal(href)

  return (
    <a
      className={classes}
      href={href}
      rel={rel ?? (external ? "noreferrer noopener" : undefined)}
      target={target ?? (external ? "_blank" : undefined)}
      {...props}
    >
      {content}
    </a>
  )
}
