// Derived from Vercel AI Elements task.tsx (Apache-2.0, Copyright 2023 Vercel, Inc.).
// Modified for uifiles: ported from Radix UI to Base UI; dependencies point at @uifiles.
"use client"

import { cn } from "cn"
import { ChevronDownIcon, SearchIcon } from "lucide-react"
import type { ComponentProps } from "react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

export type TaskItemFileProps = ComponentProps<"div">

export const TaskItemFile = ({
  children,
  className,
  ...props
}: TaskItemFileProps) => (
  <div
    className={cn(
      "inline-flex items-center gap-1 rounded-md border bg-secondary px-1.5 py-0.5 text-xs text-foreground",
      className
    )}
    {...props}
  >
    {children}
  </div>
)

export type TaskItemProps = ComponentProps<"div">

export const TaskItem = ({ children, className, ...props }: TaskItemProps) => (
  <div className={cn("text-sm text-muted-foreground", className)} {...props}>
    {children}
  </div>
)

export type TaskProps = ComponentProps<typeof Collapsible>

export const Task = ({
  defaultOpen = true,
  className,
  ...props
}: TaskProps) => (
  <Collapsible className={cn(className)} defaultOpen={defaultOpen} {...props} />
)

export type TaskTriggerProps = ComponentProps<typeof CollapsibleTrigger> & {
  title: string
}

export const TaskTrigger = ({
  children,
  className,
  title,
  ...props
}: TaskTriggerProps) => (
  <CollapsibleTrigger
    className={cn(
      "group flex min-h-6 w-full cursor-pointer items-center gap-2 text-left text-sm text-muted-foreground transition-colors hover:text-foreground",
      className
    )}
    {...props}
  >
    {children ?? (
      <>
        <SearchIcon className="size-4" />
        <span className="text-sm">{title}</span>
        <ChevronDownIcon className="size-4 transition-transform group-data-panel-open:rotate-180" />
      </>
    )}
  </CollapsibleTrigger>
)

export type TaskContentProps = ComponentProps<typeof CollapsibleContent>

export const TaskContent = ({
  children,
  className,
  ...props
}: TaskContentProps) => (
  <CollapsibleContent
    className={cn(
      "text-popover-foreground outline-none data-open:animate-in data-open:slide-in-from-top-2 data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-top-2",
      className
    )}
    {...props}
  >
    <div className="mt-4 space-y-2 border-l-2 border-muted pl-4">
      {children}
    </div>
  </CollapsibleContent>
)
