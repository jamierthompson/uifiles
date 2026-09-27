// Derived from Vercel AI Elements checkpoint.tsx (Apache-2.0, Copyright 2023 Vercel, Inc.).
// Modified for uifiles: ported from Radix UI to Base UI; dependencies point at @uifiles.
"use client"

import { cn } from "cn"
import type { LucideProps } from "lucide-react"
import { BookmarkIcon } from "lucide-react"
import type { ComponentProps, HTMLAttributes, ReactNode } from "react"
import { Fragment, isValidElement, useId } from "react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export type CheckpointProps = HTMLAttributes<HTMLDivElement>

export const Checkpoint = ({
  className,
  children,
  ...props
}: CheckpointProps) => (
  <div
    className={cn(
      "flex items-center gap-0.5 overflow-hidden text-muted-foreground",
      className
    )}
    {...props}
  >
    {children}
    <Separator />
  </div>
)

export type CheckpointIconProps = LucideProps

export const CheckpointIcon = ({
  className,
  children,
  ...props
}: CheckpointIconProps) =>
  children ?? (
    <BookmarkIcon className={cn("size-4 shrink-0", className)} {...props} />
  )

/**
 * The text `node` renders, read through arrays, fragments and plain
 * elements; undefined when a component renders part of it, since its
 * output cannot be known here.
 */
function textOf(node: ReactNode): string | undefined {
  if (node === null || node === undefined || typeof node === "boolean") {
    return ""
  }
  if (typeof node === "string" || typeof node === "number") return `${node}`
  if (Array.isArray(node)) {
    let text = ""
    for (const child of node) {
      const part = textOf(child)
      if (part === undefined) return undefined
      text += part
    }
    return text
  }
  if (
    isValidElement<{ children?: ReactNode }>(node) &&
    (node.type === Fragment || typeof node.type === "string")
  ) {
    return textOf(node.props.children)
  }
  return undefined
}

/** Whitespace collapsed and trimmed, as accessible names are. */
const normalize = (text: string) => text.replace(/\s+/g, " ").trim()

export type CheckpointTriggerProps = ComponentProps<typeof Button> & {
  tooltip?: string | undefined
}

export const CheckpointTrigger = ({
  children,
  variant = "ghost",
  size = "sm",
  tooltip,
  ...props
}: CheckpointTriggerProps) => {
  const descriptionId = useId()

  if (!tooltip) {
    return (
      <Button size={size} type="button" variant={variant} {...props}>
        {children}
      </Button>
    )
  }

  // Base UI tooltips are visual only (no role or aria-describedby), so the
  // text is mirrored in a visually hidden description unless it would just
  // repeat the button's own name: a non-empty aria-label, or else the text
  // its children render ("Checkpoint {index}" is two children). A name from
  // aria-labelledby cannot be read here.
  const name =
    props["aria-labelledby"] === undefined
      ? props["aria-label"]?.trim() || textOf(children)
      : undefined
  const describes = name === undefined || normalize(tooltip) !== normalize(name)

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-describedby={describes ? descriptionId : undefined}
              size={size}
              type="button"
              variant={variant}
              {...props}
            />
          }
        >
          {children}
        </TooltipTrigger>
        <TooltipContent align="start" side="bottom">
          {tooltip}
        </TooltipContent>
      </Tooltip>
      {describes && (
        <span className="sr-only" id={descriptionId}>
          {tooltip}
        </span>
      )}
    </>
  )
}
