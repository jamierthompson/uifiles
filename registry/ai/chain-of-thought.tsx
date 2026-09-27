// Derived from Vercel AI Elements chain-of-thought.tsx (Apache-2.0, Copyright 2023 Vercel, Inc.).
// Modified for uifiles: ported from Radix UI to Base UI; dependencies point at @uifiles.
"use client"

import { cn } from "cn"
import type { LucideIcon } from "lucide-react"
import { BrainIcon, ChevronDownIcon, DotIcon } from "lucide-react"
import type { ComponentProps, ReactNode } from "react"
import {
  Children,
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

interface ChainOfThoughtContextValue {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
}

const ChainOfThoughtContext = createContext<ChainOfThoughtContextValue | null>(
  null
)

const useChainOfThought = () => {
  const context = useContext(ChainOfThoughtContext)
  if (!context) {
    throw new Error(
      "ChainOfThought components must be used within ChainOfThought"
    )
  }
  return context
}

export type ChainOfThoughtProps = ComponentProps<"div"> & {
  open?: boolean | undefined
  defaultOpen?: boolean | undefined
  onOpenChange?: ((open: boolean) => void) | undefined
}

export const ChainOfThought = memo(
  ({
    className,
    open,
    defaultOpen = false,
    onOpenChange,
    children,
    ...props
  }: ChainOfThoughtProps) => {
    // The latest callback lives in a ref so the setter (and the context value
    // built from it) keeps one identity across parent renders, as Radix's
    // useControllableState did upstream.
    const onOpenChangeRef = useRef(onOpenChange)
    useEffect(() => {
      onOpenChangeRef.current = onOpenChange
    })
    const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)
    const isControlled = open !== undefined
    const isOpen = isControlled ? open : uncontrolledOpen
    const setIsOpen = useCallback(
      (next: boolean) => {
        if (!isControlled) setUncontrolledOpen(next)
        onOpenChangeRef.current?.(next)
      },
      [isControlled]
    )

    const chainOfThoughtContext = useMemo(
      () => ({ isOpen, setIsOpen }),
      [isOpen, setIsOpen]
    )

    return (
      <ChainOfThoughtContext.Provider value={chainOfThoughtContext}>
        <Collapsible
          className={cn("not-prose w-full space-y-4", className)}
          onOpenChange={setIsOpen}
          open={isOpen}
          {...props}
        >
          {children}
        </Collapsible>
      </ChainOfThoughtContext.Provider>
    )
  }
)

export type ChainOfThoughtHeaderProps = ComponentProps<
  typeof CollapsibleTrigger
>

export const ChainOfThoughtHeader = memo(
  ({ className, children, ...props }: ChainOfThoughtHeaderProps) => {
    const { isOpen } = useChainOfThought()

    return (
      <CollapsibleTrigger
        className={cn(
          // min-h-6 lifts the 20 px text row to the WCAG 2.2 24 px target size
          // without changing the type size or weight.
          "flex min-h-6 w-full items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground",
          className
        )}
        {...props}
      >
        <BrainIcon className="size-4" />
        <span className="flex-1 text-left">
          {children ?? "Chain of Thought"}
        </span>
        <ChevronDownIcon
          className={cn(
            "size-4 transition-transform",
            isOpen ? "rotate-180" : "rotate-0"
          )}
        />
      </CollapsibleTrigger>
    )
  }
)

type ChainOfThoughtStepStatus = "complete" | "active" | "pending"

export type ChainOfThoughtStepProps = ComponentProps<"div"> & {
  icon?: LucideIcon | undefined
  label: ReactNode
  description?: ReactNode | undefined
  status?: ChainOfThoughtStepStatus | undefined
}

// uifiles: upstream dims pending steps with `text-muted-foreground/50`, which
// fails WCAG AA contrast (1.96:1 on the light theme). Keep the text readable
// and dim only the step icon instead.
const stepStatusStyles: Record<ChainOfThoughtStepStatus, string> = {
  active: "text-foreground",
  complete: "text-muted-foreground",
  pending: "text-muted-foreground [&>div:first-child>svg]:opacity-50",
}

export const ChainOfThoughtStep = memo(
  ({
    className,
    icon: Icon = DotIcon,
    label,
    description,
    status = "complete",
    children,
    ...props
  }: ChainOfThoughtStepProps) => (
    <div
      className={cn(
        "flex gap-2 text-sm",
        // A status value this version does not know gets the neutral
        // treatment rather than an unstyled row.
        stepStatusStyles[status] ?? stepStatusStyles.complete,
        "animate-in fade-in-0 slide-in-from-top-2",
        className
      )}
      {...props}
    >
      <div className="relative mt-0.5">
        <Icon className="size-4" />
        <div className="absolute top-7 bottom-0 left-1/2 -mx-px w-px bg-border" />
      </div>
      <div className="flex-1 space-y-2 overflow-hidden">
        <div>{label}</div>
        {description && (
          <div className="text-xs text-muted-foreground">{description}</div>
        )}
        {children}
      </div>
    </div>
  )
)

export type ChainOfThoughtSearchResultsProps = ComponentProps<"div">

export const ChainOfThoughtSearchResults = memo(
  ({ className, children, ...props }: ChainOfThoughtSearchResultsProps) => {
    if (Children.toArray(children).length === 0) return null

    return (
      <div
        className={cn("flex flex-wrap items-center gap-2", className)}
        {...props}
      >
        {children}
      </div>
    )
  }
)

export type ChainOfThoughtSearchResultProps = ComponentProps<typeof Badge>

export const ChainOfThoughtSearchResult = memo(
  ({ className, children, ...props }: ChainOfThoughtSearchResultProps) => (
    <Badge
      className={cn("gap-1 px-2 py-0.5 text-xs font-normal", className)}
      variant="secondary"
      {...props}
    >
      {children}
    </Badge>
  )
)

export type ChainOfThoughtContentProps = ComponentProps<
  typeof CollapsibleContent
>

export const ChainOfThoughtContent = memo(
  ({ className, children, ...props }: ChainOfThoughtContentProps) => (
    <CollapsibleContent
      className={cn(
        "mt-2 space-y-3",
        "text-popover-foreground outline-none data-open:animate-in data-open:slide-in-from-top-2 data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-top-2",
        className
      )}
      {...props}
    >
      {children}
    </CollapsibleContent>
  )
)

export type ChainOfThoughtImageProps = ComponentProps<"div"> & {
  caption?: string | undefined
}

export const ChainOfThoughtImage = memo(
  ({ className, children, caption, ...props }: ChainOfThoughtImageProps) => (
    <div className={cn("mt-2 space-y-2", className)} {...props}>
      <div className="relative flex max-h-[22rem] items-center justify-center overflow-hidden rounded-lg bg-muted p-3">
        {children}
      </div>
      {caption && <p className="text-xs text-muted-foreground">{caption}</p>}
    </div>
  )
)

ChainOfThought.displayName = "ChainOfThought"
ChainOfThoughtHeader.displayName = "ChainOfThoughtHeader"
ChainOfThoughtStep.displayName = "ChainOfThoughtStep"
ChainOfThoughtSearchResults.displayName = "ChainOfThoughtSearchResults"
ChainOfThoughtSearchResult.displayName = "ChainOfThoughtSearchResult"
ChainOfThoughtContent.displayName = "ChainOfThoughtContent"
ChainOfThoughtImage.displayName = "ChainOfThoughtImage"
