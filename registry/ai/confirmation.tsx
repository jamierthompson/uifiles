// Derived from Vercel AI Elements confirmation.tsx (Apache-2.0, Copyright 2023 Vercel, Inc.).
// Modified for uifiles: ported from Radix UI to Base UI; dependencies point at @uifiles.
"use client"

import type { ToolUIPart } from "ai"
import { cn } from "cn"
import type { ComponentProps, ReactNode } from "react"
import { createContext, useContext, useMemo } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

type ToolUIPartApproval =
  | {
      id: string
      approved?: never
      reason?: never
    }
  | {
      id: string
      approved: boolean
      reason?: string | undefined
    }
  | {
      id: string
      approved: true
      reason?: string | undefined
    }
  | {
      id: string
      approved: false
      reason?: string | undefined
    }
  | undefined

interface ConfirmationContextValue {
  approval: ToolUIPartApproval
  state: ToolUIPart["state"]
}

const ConfirmationContext = createContext<ConfirmationContextValue | null>(null)

const useConfirmation = () => {
  const context = useContext(ConfirmationContext)

  if (!context) {
    throw new Error("Confirmation components must be used within Confirmation")
  }

  return context
}

// States in which the user has already answered the request. `output-error`
// belongs here: ai@7 keeps `approval.approved === true` on a tool that was
// approved and then failed, and the failure itself is ToolOutput's to show.
const respondedStates: ReadonlySet<ToolUIPart["state"]> = new Set([
  "approval-responded",
  "output-available",
  "output-denied",
  "output-error",
])

export type ConfirmationProps = ComponentProps<typeof Alert> & {
  approval?: ToolUIPartApproval
  state: ToolUIPart["state"]
}

export const Confirmation = ({
  className,
  approval,
  state,
  ...props
}: ConfirmationProps) => {
  const contextValue = useMemo(() => ({ approval, state }), [approval, state])

  const showsRequest = state === "approval-requested"
  const showsOutcome =
    respondedStates.has(state) && typeof approval?.approved === "boolean"

  // Without a request or a decision none of the parts below has anything to
  // show, and an empty role="alert" would still be announced.
  if (!approval || !(showsRequest || showsOutcome)) {
    return null
  }

  return (
    <ConfirmationContext.Provider value={contextValue}>
      <Alert className={cn("flex flex-col gap-2", className)} {...props} />
    </ConfirmationContext.Provider>
  )
}

export type ConfirmationTitleProps = ComponentProps<typeof AlertDescription>

export const ConfirmationTitle = ({
  className,
  ...props
}: ConfirmationTitleProps) => (
  <AlertDescription className={cn("inline", className)} {...props} />
)

export interface ConfirmationRequestProps {
  children?: ReactNode
}

export const ConfirmationRequest = ({ children }: ConfirmationRequestProps) => {
  const { state } = useConfirmation()

  if (state !== "approval-requested") {
    return null
  }

  return children
}

export interface ConfirmationAcceptedProps {
  children?: ReactNode
}

export const ConfirmationAccepted = ({
  children,
}: ConfirmationAcceptedProps) => {
  const { approval, state } = useConfirmation()

  if (approval?.approved !== true || !respondedStates.has(state)) {
    return null
  }

  return children
}

export interface ConfirmationRejectedProps {
  children?: ReactNode
  className?: string | undefined
}

export const ConfirmationRejected = ({
  children,
  className,
}: ConfirmationRejectedProps) => {
  const { approval, state } = useConfirmation()

  if (approval?.approved !== false || !respondedStates.has(state)) {
    return null
  }

  // uifiles: upstream returns the children bare, so both outcomes read in
  // the same foreground color; the destructive token tells them apart at a
  // glance (the wording still says which, so color is not the only cue).
  return <span className={cn("text-destructive", className)}>{children}</span>
}

export type ConfirmationActionsProps = ComponentProps<"div">

export const ConfirmationActions = ({
  className,
  ...props
}: ConfirmationActionsProps) => {
  const { state } = useConfirmation()

  if (state !== "approval-requested") {
    return null
  }

  return (
    <div
      className={cn("flex items-center justify-end gap-2 self-end", className)}
      {...props}
    />
  )
}

export type ConfirmationActionProps = ComponentProps<typeof Button>

export const ConfirmationAction = ({
  className,
  ...props
}: ConfirmationActionProps) => (
  <Button
    className={cn("h-8 px-3 text-sm", className)}
    type="button"
    {...props}
  />
)
