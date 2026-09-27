// Derived from Vercel AI Elements suggestion.tsx (Apache-2.0, Copyright 2023 Vercel, Inc.).
// Modified for uifiles: ported from Radix UI to Base UI; dependencies point at @uifiles.
"use client"

import { cn } from "cn"
import type { ComponentProps } from "react"
import { useCallback } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"

export type SuggestionsProps = ComponentProps<typeof ScrollArea>

export const Suggestions = ({
  className,
  children,
  ...props
}: SuggestionsProps) => (
  <ScrollArea className="w-full overflow-x-auto whitespace-nowrap" {...props}>
    <div className={cn("flex w-max flex-nowrap items-center gap-2", className)}>
      {children}
    </div>
    <ScrollBar className="hidden" orientation="horizontal" />
  </ScrollArea>
)

export type SuggestionProps = Omit<ComponentProps<typeof Button>, "onClick"> & {
  suggestion: string
  onClick?: (suggestion: string) => void
}

type SuggestionFocusEvent = Parameters<
  NonNullable<ComponentProps<typeof Button>["onFocus"]>
>[0]

export const Suggestion = ({
  suggestion,
  onClick,
  onFocus,
  className,
  variant = "outline",
  size = "sm",
  children,
  ...props
}: SuggestionProps) => {
  const handleClick = useCallback(() => {
    onClick?.(suggestion)
  }, [onClick, suggestion])

  // Sequential focus only scrolls a chip into view when it is fully hidden;
  // one straddling the row's edge would keep focus half out of sight.
  const handleFocus = useCallback(
    (event: SuggestionFocusEvent) => {
      onFocus?.(event)
      event.currentTarget.scrollIntoView({
        block: "nearest",
        inline: "nearest",
      })
    },
    [onFocus]
  )

  return (
    <Button
      className={cn("cursor-pointer rounded-full px-4", className)}
      onClick={handleClick}
      onFocus={handleFocus}
      size={size}
      type="button"
      variant={variant}
      {...props}
    >
      {children || suggestion}
    </Button>
  )
}
