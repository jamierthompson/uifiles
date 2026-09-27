// Derived from Vercel AI Elements tool.tsx (Apache-2.0, Copyright 2023 Vercel, Inc.).
// Modified for uifiles: ported from Radix UI to Base UI; dependencies point at @uifiles.
"use client"

import type { DynamicToolUIPart, ToolUIPart } from "ai"
import { cn } from "cn"
import {
  CheckCircleIcon,
  ChevronDownIcon,
  CircleIcon,
  ClockIcon,
  WrenchIcon,
  XCircleIcon,
} from "lucide-react"
import type { ComponentProps, ReactNode } from "react"
import { isValidElement } from "react"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

import { CodeBlock } from "./code-block"

export type ToolProps = ComponentProps<typeof Collapsible>

export const Tool = ({ className, ...props }: ToolProps) => (
  <Collapsible
    className={cn("group not-prose mb-4 w-full rounded-md border", className)}
    {...props}
  />
)

export type ToolPart = ToolUIPart | DynamicToolUIPart

export type ToolHeaderProps = {
  title?: string | undefined
  className?: string | undefined
} & (
  | { type: ToolUIPart["type"]; state: ToolUIPart["state"]; toolName?: never }
  | {
      type: DynamicToolUIPart["type"]
      state: DynamicToolUIPart["state"]
      toolName: string
    }
)

const statusLabels: Record<ToolPart["state"], string> = {
  "approval-requested": "Awaiting Approval",
  "approval-responded": "Responded",
  "input-available": "Running",
  "input-streaming": "Pending",
  "output-available": "Completed",
  "output-denied": "Denied",
  "output-error": "Error",
}

const statusIcons: Record<ToolPart["state"], ReactNode> = {
  "approval-requested": <ClockIcon className="size-4 text-muted-foreground" />,
  "approval-responded": <CheckCircleIcon className="size-4 text-primary" />,
  "input-available": <ClockIcon className="size-4 animate-pulse" />,
  "input-streaming": <CircleIcon className="size-4" />,
  "output-available": <CheckCircleIcon className="size-4 text-primary" />,
  "output-denied": <XCircleIcon className="size-4 text-destructive" />,
  "output-error": <XCircleIcon className="size-4 text-destructive" />,
}

// A newer `ai` can emit a state this map has not learned yet; show the raw
// state with a neutral icon rather than an empty badge.
export const getStatusBadge = (status: ToolPart["state"]) => (
  <Badge className="gap-1.5 rounded-full text-xs" variant="secondary">
    {statusIcons[status] ?? <CircleIcon className="size-4" />}
    {statusLabels[status] ?? status}
  </Badge>
)

export const ToolHeader = ({
  className,
  title,
  type,
  state,
  toolName,
  ...props
}: ToolHeaderProps) => {
  const derivedName =
    type === "dynamic-tool" ? toolName : type.split("-").slice(1).join("-")

  return (
    <CollapsibleTrigger
      className={cn(
        "flex w-full items-center justify-between gap-4 p-3",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2">
        <WrenchIcon className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">{title ?? derivedName}</span>
        {getStatusBadge(state)}
      </div>
      <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-data-open:rotate-180" />
    </CollapsibleTrigger>
  )
}

export type ToolContentProps = ComponentProps<typeof CollapsibleContent>

export const ToolContent = ({ className, ...props }: ToolContentProps) => (
  <CollapsibleContent
    className={cn(
      "space-y-4 p-4 text-popover-foreground outline-none data-open:animate-in data-open:slide-in-from-top-2 data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-top-2",
      className
    )}
    {...props}
  />
)

// Tool inputs and outputs are JSON on the wire, but a consumer can hand us
// anything; BigInt is stringified and whatever else JSON rejects (circular
// references) falls back to String() so the card never throws mid-stream.
const toJson = (value: unknown): string => {
  try {
    return (
      JSON.stringify(
        value,
        (_key, item: unknown) =>
          typeof item === "bigint" ? item.toString() : item,
        2
      ) ?? String(value)
    )
  } catch {
    return String(value)
  }
}

export type ToolInputProps = ComponentProps<"div"> & {
  input: ToolPart["input"]
}

export const ToolInput = ({ className, input, ...props }: ToolInputProps) => (
  <div className={cn("space-y-2 overflow-hidden", className)} {...props}>
    <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
      Parameters
    </div>
    <div className="rounded-md bg-muted/50">
      {input === undefined ? (
        <p className="px-4 py-3 text-xs text-muted-foreground">No input yet</p>
      ) : (
        <CodeBlock code={toJson(input)} language="json" />
      )}
    </div>
  </div>
)

export type ToolOutputProps = ComponentProps<"div"> & {
  output: ToolPart["output"]
  errorText: ToolPart["errorText"]
}

const renderOutput = (output: ToolPart["output"]): ReactNode => {
  if (output === undefined) {
    return null
  }
  if (typeof output === "string") {
    return <CodeBlock code={output} language="json" />
  }
  if (typeof output === "object") {
    return isValidElement(output) ? (
      <div>{output}</div>
    ) : (
      <CodeBlock code={toJson(output)} language="json" />
    )
  }
  return <div>{String(output)}</div>
}

export const ToolOutput = ({
  className,
  output,
  errorText,
  ...props
}: ToolOutputProps) => {
  if (output === undefined && !errorText) {
    return null
  }

  return (
    <div className={cn("space-y-2", className)} {...props}>
      <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {errorText ? "Error" : "Result"}
      </div>
      <div
        className={cn(
          "overflow-x-auto rounded-md text-xs [&_table]:w-full",
          errorText ? "bg-card text-destructive" : "bg-muted/50 text-foreground"
        )}
      >
        {errorText && <div>{errorText}</div>}
        {renderOutput(output)}
      </div>
    </div>
  )
}
