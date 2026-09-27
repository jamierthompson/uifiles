// Derived from Vercel AI Elements context.tsx (Apache-2.0, Copyright 2023 Vercel, Inc.).
// Modified for uifiles: ported from Radix UI to Base UI; dependencies point at @uifiles.
"use client"

import type { LanguageModelUsage } from "ai"
import { cn } from "cn"
import type { ComponentProps } from "react"
import { createContext, isValidElement, useContext, useMemo } from "react"
import { getUsage, type TokenBreakdown } from "tokenlens"
import { Button } from "@/components/ui/button"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { Progress } from "@/components/ui/progress"

const PERCENT_MAX = 100
const ICON_RADIUS = 10
const ICON_VIEWBOX = 24
const ICON_CENTER = 12
const ICON_STROKE_WIDTH = 2

// Number formatting is fixed to en-US (tokenlens prices in USD); see docs.
const LOCALE = "en-US"
const percentFormat = new Intl.NumberFormat(LOCALE, {
  maximumFractionDigits: 1,
  style: "percent",
})
const compactFormat = new Intl.NumberFormat(LOCALE, { notation: "compact" })
const currencyFormat = new Intl.NumberFormat(LOCALE, {
  currency: "USD",
  style: "currency",
})

type ModelId = string

interface ContextSchema {
  usedTokens: number
  maxTokens: number
  usage?: LanguageModelUsage | undefined
  modelId?: ModelId | undefined
}

/**
 * The usage split into non-overlapping rows: cached input reads and reasoning
 * output are subsets of `inputTokens` / `outputTokens` in ai@7, so they are
 * taken out of Input / Output and shown (and priced) on their own rows.
 */
interface UsageRows {
  input: number
  cache: number
  output: number
  reasoning: number
}

/** Each row's cost in USD, rounded to cents so the rows add up to `total`. */
interface UsageCosts extends UsageRows {
  total: number
}

interface ContextValue extends ContextSchema {
  rows: UsageRows
  costs: UsageCosts | undefined
}

const ContextContext = createContext<ContextValue | null>(null)

const useContextValue = () => {
  const context = useContext(ContextContext)

  if (!context) {
    throw new Error("Context components must be used within Context")
  }

  return context
}

// Fraction of the window in use; 0 when the window is unknown (maxTokens
// 0/undefined while model metadata loads) so no NaN% or ∞% is rendered.
const usedPercent = (used: number, max: number): number =>
  Number.isFinite(used) && Number.isFinite(max) && max > 0
    ? Math.max(0, used / max)
    : 0

// A missing, NaN or negative count (a JS consumer, usage still streaming)
// reads as 0 everywhere, never as "NaN".
const count = (value: number | undefined): number =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0

const formatTokens = (value: number | undefined): string =>
  compactFormat.format(count(value))

const splitUsage = (usage: LanguageModelUsage | undefined): UsageRows => {
  const cache = count(usage?.inputTokenDetails?.cacheReadTokens)
  const reasoning = count(usage?.outputTokenDetails?.reasoningTokens)
  return {
    cache,
    input: Math.max(0, count(usage?.inputTokens) - cache),
    output: Math.max(0, count(usage?.outputTokens) - reasoning),
    reasoning,
  }
}

const roundCents = (usd: number): number =>
  Number.isFinite(usd) ? Math.round(usd * 100) / 100 : 0

const priceTokens = (modelId: ModelId, usage: TokenBreakdown): number =>
  roundCents(getUsage({ modelId, usage }).costUSD?.totalUSD ?? 0)

// Reasoning is billed at the output rate (tokenlens only prices
// `reasoningTokens` for models with a separate reasoning rate, and the
// bundled catalog has none); cache reads at the cache-read rate; the rest of
// the input at the input rate. The total is the sum of the four rows.
const priceRows = (
  modelId: ModelId | undefined,
  rows: UsageRows
): UsageCosts | undefined => {
  if (!modelId) return undefined
  const costs = {
    cache: priceTokens(modelId, {
      cacheReads: rows.cache,
      input: 0,
      output: 0,
    }),
    input: priceTokens(modelId, { input: rows.input, output: 0 }),
    output: priceTokens(modelId, { input: 0, output: rows.output }),
    reasoning: priceTokens(modelId, { input: 0, output: rows.reasoning }),
  }
  return {
    ...costs,
    total: roundCents(
      costs.input + costs.cache + costs.output + costs.reasoning
    ),
  }
}

export type ContextProps = ComponentProps<typeof HoverCard> & ContextSchema

// Base UI puts hover delays on the trigger, not the root: see ContextTrigger.
export const Context = ({
  usedTokens,
  maxTokens,
  usage,
  modelId,
  ...props
}: ContextProps) => {
  const contextValue = useMemo<ContextValue>(() => {
    const rows = splitUsage(usage)
    return {
      costs: priceRows(modelId, rows),
      maxTokens,
      modelId,
      rows,
      usage,
      usedTokens,
    }
  }, [maxTokens, modelId, usage, usedTokens])

  return (
    <ContextContext.Provider value={contextValue}>
      <HoverCard {...props} />
    </ContextContext.Provider>
  )
}

const ContextIcon = () => {
  const { usedTokens, maxTokens } = useContextValue()
  const circumference = 2 * Math.PI * ICON_RADIUS
  const percent = Math.min(1, usedPercent(usedTokens, maxTokens))
  const dashOffset = circumference * (1 - percent)

  return (
    <svg
      aria-label="Model context usage"
      height="20"
      role="img"
      style={{ color: "currentcolor" }}
      viewBox={`0 0 ${ICON_VIEWBOX} ${ICON_VIEWBOX}`}
      width="20"
    >
      <circle
        cx={ICON_CENTER}
        cy={ICON_CENTER}
        fill="none"
        opacity="0.25"
        r={ICON_RADIUS}
        stroke="currentColor"
        strokeWidth={ICON_STROKE_WIDTH}
      />
      <circle
        cx={ICON_CENTER}
        cy={ICON_CENTER}
        fill="none"
        opacity="0.7"
        r={ICON_RADIUS}
        stroke="currentColor"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        strokeWidth={ICON_STROKE_WIDTH}
        style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
      />
    </svg>
  )
}

export type ContextTriggerProps = ComponentProps<typeof Button> &
  Pick<ComponentProps<typeof HoverCardTrigger>, "delay" | "closeDelay">

export const ContextTrigger = ({
  children,
  delay = 0,
  closeDelay = 0,
  ...props
}: ContextTriggerProps) => {
  const { usedTokens, maxTokens } = useContextValue()
  const renderedPercent = percentFormat.format(
    usedPercent(usedTokens, maxTokens)
  )

  // As upstream: a custom child element replaces the default button entirely.
  return (
    <HoverCardTrigger
      closeDelay={closeDelay}
      delay={delay}
      render={
        isValidElement(children) ? (
          children
        ) : (
          <Button type="button" variant="ghost" {...props}>
            {children ?? (
              <>
                <span className="font-medium text-muted-foreground">
                  {renderedPercent}
                </span>
                <ContextIcon />
              </>
            )}
          </Button>
        )
      }
    />
  )
}

export type ContextContentProps = ComponentProps<typeof HoverCardContent>

export const ContextContent = ({
  className,
  ...props
}: ContextContentProps) => (
  <HoverCardContent
    className={cn("min-w-60 divide-y overflow-hidden p-0", className)}
    {...props}
  />
)

export type ContextContentHeaderProps = ComponentProps<"div">

export const ContextContentHeader = ({
  children,
  className,
  ...props
}: ContextContentHeaderProps) => {
  const { usedTokens, maxTokens } = useContextValue()
  const percent = usedPercent(usedTokens, maxTokens)
  const displayPct = percentFormat.format(percent)
  const used = formatTokens(usedTokens)
  const total = formatTokens(maxTokens)

  return (
    <div className={cn("w-full space-y-2 p-3", className)} {...props}>
      {children ?? (
        <>
          <div className="flex items-center justify-between gap-3 text-xs">
            <p>{displayPct}</p>
            <p className="font-mono text-muted-foreground">
              {used} / {total}
            </p>
          </div>
          <div className="space-y-2">
            <Progress
              aria-label="Context window usage"
              value={percent * PERCENT_MAX}
            />
          </div>
        </>
      )}
    </div>
  )
}

export type ContextContentBodyProps = ComponentProps<"div">

export const ContextContentBody = ({
  children,
  className,
  ...props
}: ContextContentBodyProps) => (
  <div className={cn("w-full p-3", className)} {...props}>
    {children}
  </div>
)

export type ContextContentFooterProps = ComponentProps<"div">

export const ContextContentFooter = ({
  children,
  className,
  ...props
}: ContextContentFooterProps) => {
  const { costs } = useContextValue()
  const totalCost = currencyFormat.format(costs?.total ?? 0)

  return (
    <div
      className={cn(
        "flex w-full items-center justify-between gap-3 bg-secondary p-3 text-xs",
        className
      )}
      {...props}
    >
      {children ?? (
        <>
          <span className="text-secondary-foreground">Total cost</span>
          <span>{totalCost}</span>
        </>
      )}
    </div>
  )
}

const TokensWithCost = ({
  tokens,
  costText,
}: {
  tokens?: number
  costText?: string
}) => (
  <span>
    {tokens === undefined ? "—" : formatTokens(tokens)}
    {costText ? (
      <span className="ml-2 text-muted-foreground">• {costText}</span>
    ) : null}
  </span>
)

const UsageRow = ({
  label,
  row,
  className,
  ...props
}: ComponentProps<"div"> & { label: string; row: keyof UsageRows }) => {
  const { rows, costs } = useContextValue()
  const tokens = rows[row]

  if (!tokens) {
    return null
  }

  return (
    <div
      className={cn("flex items-center justify-between text-xs", className)}
      {...props}
    >
      <span className="text-muted-foreground">{label}</span>
      <TokensWithCost
        costText={currencyFormat.format(costs?.[row] ?? 0)}
        tokens={tokens}
      />
    </div>
  )
}

export type ContextInputUsageProps = ComponentProps<"div">

export const ContextInputUsage = ({
  children,
  ...props
}: ContextInputUsageProps) =>
  children ? children : <UsageRow label="Input" row="input" {...props} />

export type ContextOutputUsageProps = ComponentProps<"div">

export const ContextOutputUsage = ({
  children,
  ...props
}: ContextOutputUsageProps) =>
  children ? children : <UsageRow label="Output" row="output" {...props} />

export type ContextReasoningUsageProps = ComponentProps<"div">

export const ContextReasoningUsage = ({
  children,
  ...props
}: ContextReasoningUsageProps) =>
  children ? (
    children
  ) : (
    <UsageRow label="Reasoning" row="reasoning" {...props} />
  )

export type ContextCacheUsageProps = ComponentProps<"div">

export const ContextCacheUsage = ({
  children,
  ...props
}: ContextCacheUsageProps) =>
  children ? children : <UsageRow label="Cache" row="cache" {...props} />
