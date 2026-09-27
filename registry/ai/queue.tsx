// Derived from Vercel AI Elements queue.tsx (Apache-2.0, Copyright 2023 Vercel, Inc.).
// Modified for uifiles: ported from Radix UI to Base UI; dependencies point at @uifiles.
"use client"

import { cn } from "cn"
import { ChevronDownIcon, PaperclipIcon } from "lucide-react"
import type { ComponentProps, ReactNode } from "react"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ScrollArea } from "@/components/ui/scroll-area"

export interface QueueMessagePart {
  type: string
  text?: string | undefined
  url?: string | undefined
  filename?: string | undefined
  mediaType?: string | undefined
}

export interface QueueMessage {
  id: string
  parts: QueueMessagePart[]
}

export interface QueueTodo {
  id: string
  title: string
  description?: string | undefined
  status?: "pending" | "completed" | undefined
}

export type QueueItemProps = ComponentProps<"li">

export const QueueItem = ({ className, ...props }: QueueItemProps) => (
  <li
    className={cn(
      "group flex flex-col gap-1 rounded-md px-3 py-1 text-sm transition-colors hover:bg-muted",
      className
    )}
    {...props}
  />
)

export type QueueItemIndicatorProps = ComponentProps<"span"> & {
  completed?: boolean | undefined
}

export const QueueItemIndicator = ({
  completed = false,
  className,
  ...props
}: QueueItemIndicatorProps) => (
  <span
    className={cn(
      // uifiles: a full-alpha border so the dot clears 3:1 (upstream's /50 and
      // /20 borders measure 2.04:1 and 1.30:1); done is filled, pending hollow.
      "mt-0.5 inline-block size-2.5 rounded-full border border-muted-foreground",
      completed && "bg-muted-foreground",
      className
    )}
    {...props}
  />
)

export type QueueItemContentProps = ComponentProps<"span"> & {
  completed?: boolean | undefined
}

export const QueueItemContent = ({
  children,
  completed = false,
  className,
  ...props
}: QueueItemContentProps) => (
  <span
    className={cn(
      // uifiles: two lines, not upstream's one, so a phone-width title is not
      // cut off after a few words (the title is the item's only content).
      "line-clamp-2 grow break-words",
      completed
        ? "text-muted-foreground line-through"
        : "text-muted-foreground",
      className
    )}
    // uifiles: the clamp can still hide a line (a long title, or WCAG 1.4.12
    // text spacing widening one that fit); the title shows it whole on hover.
    title={typeof children === "string" ? children : undefined}
    {...props}
  >
    {children}
  </span>
)

export type QueueItemDescriptionProps = ComponentProps<"div"> & {
  completed?: boolean | undefined
}

export const QueueItemDescription = ({
  completed = false,
  className,
  ...props
}: QueueItemDescriptionProps) => (
  <div
    className={cn(
      "ml-6 text-xs",
      completed
        ? "text-muted-foreground line-through"
        : "text-muted-foreground",
      className
    )}
    {...props}
  />
)

export type QueueItemActionsProps = ComponentProps<"div">

export const QueueItemActions = ({
  className,
  ...props
}: QueueItemActionsProps) => (
  <div className={cn("flex gap-1", className)} {...props} />
)

export type QueueItemActionProps = Omit<
  ComponentProps<typeof Button>,
  "variant" | "size"
>

export const QueueItemAction = ({
  className,
  ...props
}: QueueItemActionProps) => (
  <Button
    className={cn(
      // uifiles: hover-revealed upstream; also revealed on keyboard focus so a
      // Tab stop is never invisible (WCAG 2.4.7), and always on a coarse
      // pointer, where Tailwind's hover variant (gated on hover: hover) never
      // matches and there is no Tab key.
      "size-auto rounded p-1 text-muted-foreground opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-muted-foreground/10 hover:text-foreground focus-visible:opacity-100 pointer-coarse:opacity-100",
      className
    )}
    size="icon"
    type="button"
    variant="ghost"
    {...props}
  />
)

export type QueueItemAttachmentProps = ComponentProps<"div">

export const QueueItemAttachment = ({
  className,
  ...props
}: QueueItemAttachmentProps) => (
  <div className={cn("mt-1 flex flex-wrap gap-2", className)} {...props} />
)

export type QueueItemImageProps = ComponentProps<"img">

export const QueueItemImage = ({
  className,
  ...props
}: QueueItemImageProps) => (
  // biome-ignore lint/performance/noImgElement: registry source is framework-agnostic; upstream renders a plain img
  <img
    alt=""
    className={cn("h-8 w-8 rounded border object-cover", className)}
    height={32}
    width={32}
    {...props}
  />
)

export type QueueItemFileProps = ComponentProps<"span">

export const QueueItemFile = ({
  children,
  className,
  ...props
}: QueueItemFileProps) => (
  <span
    className={cn(
      "flex items-center gap-1 rounded border bg-muted px-2 py-1 text-xs",
      className
    )}
    // uifiles: the name truncates at 100px; the title shows it whole on hover.
    title={typeof children === "string" ? children : undefined}
    {...props}
  >
    <PaperclipIcon size={12} />
    <span className="max-w-[100px] truncate">{children}</span>
  </span>
)

export type QueueListProps = ComponentProps<typeof ScrollArea>

export const QueueList = ({
  children,
  className,
  ...props
}: QueueListProps) => (
  <ScrollArea className={cn("mt-2 -mb-1", className)} {...props}>
    <div className="max-h-40 pr-4">
      <ul>{children}</ul>
    </div>
  </ScrollArea>
)

// QueueSection - collapsible section container
export type QueueSectionProps = ComponentProps<typeof Collapsible>

export const QueueSection = ({
  className,
  defaultOpen = true,
  ...props
}: QueueSectionProps) => (
  <Collapsible className={cn(className)} defaultOpen={defaultOpen} {...props} />
)

// QueueSectionTrigger - section header/trigger
export type QueueSectionTriggerProps = ComponentProps<"button">

export const QueueSectionTrigger = ({
  children,
  className,
  ...props
}: QueueSectionTriggerProps) => (
  <CollapsibleTrigger
    className={cn(
      "group flex w-full items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-muted",
      className
    )}
    type="button"
    {...props}
  >
    {children}
  </CollapsibleTrigger>
)

// QueueSectionLabel - label content with icon and count
export type QueueSectionLabelProps = ComponentProps<"span"> & {
  count?: number | undefined
  label: string
  icon?: ReactNode | undefined
}

export const QueueSectionLabel = ({
  count,
  label,
  icon,
  className,
  ...props
}: QueueSectionLabelProps) => (
  <span className={cn("flex items-center gap-2", className)} {...props}>
    <ChevronDownIcon className="size-4 -rotate-90 transition-transform group-data-panel-open:rotate-0" />
    {icon}
    <span>
      {count} {label}
    </span>
  </span>
)

// QueueSectionContent - collapsible content area
export type QueueSectionContentProps = ComponentProps<typeof CollapsibleContent>

export const QueueSectionContent = ({
  className,
  ...props
}: QueueSectionContentProps) => (
  <CollapsibleContent className={cn(className)} {...props} />
)

export type QueueProps = ComponentProps<"div">

export const Queue = ({ className, ...props }: QueueProps) => (
  <div
    className={cn(
      "flex flex-col gap-2 rounded-xl border border-border bg-background px-3 pt-2 pb-2 shadow-xs",
      className
    )}
    {...props}
  />
)
