// Derived from Vercel AI Elements reasoning.tsx (Apache-2.0, Copyright 2023 Vercel, Inc.).
// Modified for uifiles: ported from Radix UI to Base UI; dependencies point at @uifiles.
"use client"

import { cn } from "cn"
import { BrainIcon, ChevronDownIcon } from "lucide-react"
import type { ComponentProps, ReactNode } from "react"
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { MessageResponse } from "@/registry/ai/response"

interface ReasoningContextValue {
  isStreaming: boolean
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  duration: number | undefined
}

const ReasoningContext = createContext<ReasoningContextValue | null>(null)

export const useReasoning = () => {
  const context = useContext(ReasoningContext)
  if (!context) {
    throw new Error("Reasoning components must be used within Reasoning")
  }
  return context
}

export type ReasoningProps = ComponentProps<typeof Collapsible> & {
  isStreaming?: boolean | undefined
  open?: boolean | undefined
  defaultOpen?: boolean | undefined
  onOpenChange?: ((open: boolean) => void) | undefined
  duration?: number | undefined
}

const AUTO_CLOSE_DELAY = 1000
const MS_IN_S = 1000

export const Reasoning = memo(
  ({
    className,
    isStreaming = false,
    open,
    defaultOpen,
    onOpenChange,
    duration: durationProp,
    children,
    ...props
  }: ReasoningProps) => {
    const resolvedDefaultOpen = defaultOpen ?? isStreaming
    // Track if defaultOpen was explicitly set to false (to prevent auto-open)
    const isExplicitlyClosed = defaultOpen === false

    // Controlled/uncontrolled open state (replaces Radix useControllableState).
    // The latest onOpenChange lives in a ref so the setter stays stable and
    // the effects below do not restart the auto-close timer whenever a parent
    // re-renders with a new inline handler.
    const onOpenChangeRef = useRef(onOpenChange)
    useEffect(() => {
      onOpenChangeRef.current = onOpenChange
    })
    const [uncontrolledOpen, setUncontrolledOpen] =
      useState(resolvedDefaultOpen)
    const isOpenControlled = open !== undefined
    const isOpen = isOpenControlled ? open : uncontrolledOpen
    const setIsOpen = useCallback(
      (next: boolean) => {
        if (!isOpenControlled) setUncontrolledOpen(next)
        onOpenChangeRef.current?.(next)
      },
      [isOpenControlled]
    )

    // Controlled/uncontrolled duration (replaces Radix useControllableState)
    const [uncontrolledDuration, setUncontrolledDuration] = useState<
      number | undefined
    >(undefined)
    const duration = durationProp ?? uncontrolledDuration

    const hasEverStreamedRef = useRef(isStreaming)
    const wasStreamingRef = useRef(false)
    // Set once the auto-close has fired or the reader has toggled the panel
    // themselves; reset when a new stream starts.
    const autoCloseSpentRef = useRef(false)
    const startTimeRef = useRef<number | null>(null)

    // Track when streaming starts and compute duration
    useEffect(() => {
      if (isStreaming) {
        hasEverStreamedRef.current = true
        if (startTimeRef.current === null) {
          startTimeRef.current = Date.now()
        }
      } else if (startTimeRef.current !== null) {
        // At least one second: a stream whose start and end commits land in
        // the same millisecond would otherwise measure 0, which the trigger
        // reads as "still thinking" and shimmers forever.
        setUncontrolledDuration(
          Math.max(1, Math.ceil((Date.now() - startTimeRef.current) / MS_IN_S))
        )
        startTimeRef.current = null
      }
    }, [isStreaming])

    // Auto-open only when a stream starts (unless explicitly closed), so a
    // reader who closes the panel mid-stream is not re-opened on the next render.
    useEffect(() => {
      const started = isStreaming && !wasStreamingRef.current
      wasStreamingRef.current = isStreaming
      if (!started) return
      autoCloseSpentRef.current = false
      if (!isOpen && !isExplicitlyClosed) {
        setIsOpen(true)
      }
    }, [isStreaming, isOpen, isExplicitlyClosed, setIsOpen])

    // Auto-close once, one second after streaming ends: only if it ever
    // streamed (#86) and the reader has not taken the panel over.
    useEffect(() => {
      if (
        !hasEverStreamedRef.current ||
        isStreaming ||
        !isOpen ||
        autoCloseSpentRef.current
      ) {
        return
      }
      const timer = setTimeout(() => {
        autoCloseSpentRef.current = true
        setIsOpen(false)
      }, AUTO_CLOSE_DELAY)

      return () => clearTimeout(timer)
    }, [isStreaming, isOpen, setIsOpen])

    // A manual toggle hands the panel to the reader until the next stream.
    const handleOpenChange = useCallback(
      (newOpen: boolean) => {
        autoCloseSpentRef.current = true
        setIsOpen(newOpen)
      },
      [setIsOpen]
    )

    const contextValue = useMemo(
      () => ({ duration, isOpen, isStreaming, setIsOpen: handleOpenChange }),
      [duration, isOpen, isStreaming, handleOpenChange]
    )

    return (
      <ReasoningContext.Provider value={contextValue}>
        <Collapsible
          className={cn("not-prose mb-4", className)}
          onOpenChange={handleOpenChange}
          open={isOpen}
          {...props}
        >
          {children}
        </Collapsible>
      </ReasoningContext.Provider>
    )
  }
)

export type ReasoningTriggerProps = ComponentProps<
  typeof CollapsibleTrigger
> & {
  getThinkingMessage?:
    ((isStreaming: boolean, duration?: number) => ReactNode) | undefined
}

const defaultGetThinkingMessage = (isStreaming: boolean, duration?: number) => {
  if (isStreaming || duration === 0) {
    return <span className="shimmer [--shimmer-duration:1s]">Thinking...</span>
  }
  if (duration === undefined) {
    return <span>Thought for a few seconds</span>
  }
  return <span>Thought for {duration} seconds</span>
}

export const ReasoningTrigger = memo(
  ({
    className,
    children,
    getThinkingMessage = defaultGetThinkingMessage,
    ...props
  }: ReasoningTriggerProps) => {
    const { isStreaming, isOpen, duration } = useReasoning()

    return (
      <CollapsibleTrigger
        className={cn(
          "flex min-h-6 w-full items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground",
          className
        )}
        {...props}
      >
        {children ?? (
          <>
            <BrainIcon className="size-4" />
            {getThinkingMessage(isStreaming, duration)}
            <ChevronDownIcon
              className={cn(
                "size-4 transition-transform",
                isOpen ? "rotate-180" : "rotate-0"
              )}
            />
          </>
        )}
      </CollapsibleTrigger>
    )
  }
)

export type ReasoningContentProps = ComponentProps<
  typeof CollapsibleContent
> & {
  children: string
}

export const ReasoningContent = memo(
  ({ className, children, ...props }: ReasoningContentProps) => (
    <CollapsibleContent
      className={cn(
        "mt-4 text-sm",
        "text-muted-foreground outline-none data-open:animate-in data-open:slide-in-from-top-2 data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-top-2",
        className
      )}
      {...props}
    >
      {/* uifiles: Message Response carries the plugins and the high-contrast
          shiki pair, and adds what bare Streamdown lacks: overflowing code,
          tables and formulas become named tab stops, and links confirm in an
          accessible dialog. */}
      <MessageResponse>{children}</MessageResponse>
    </CollapsibleContent>
  )
)

Reasoning.displayName = "Reasoning"
ReasoningTrigger.displayName = "ReasoningTrigger"
ReasoningContent.displayName = "ReasoningContent"
