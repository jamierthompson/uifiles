// Derived from Vercel AI Elements checkpoint.tsx (Apache-2.0, Copyright 2023 Vercel, Inc.).
// Modified for uifiles: ported from Radix UI to Base UI; dependencies point at @uifiles.
"use client"

import { cn } from "cn"
import type { LucideProps } from "lucide-react"
import { BookmarkIcon } from "lucide-react"
import type { ComponentProps, HTMLAttributes } from "react"
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

export type CheckpointTriggerProps = ComponentProps<typeof Button> & {
  tooltip?: string
}

export const CheckpointTrigger = ({
  children,
  variant = "ghost",
  size = "sm",
  tooltip,
  ...props
}: CheckpointTriggerProps) =>
  tooltip ? (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button size={size} type="button" variant={variant} {...props} />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent align="start" side="bottom">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  ) : (
    <Button size={size} type="button" variant={variant} {...props}>
      {children}
    </Button>
  )
