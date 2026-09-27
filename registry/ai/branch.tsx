// Derived from Vercel AI Elements message.tsx (Apache-2.0, Copyright 2023 Vercel, Inc.).
// Modified for uifiles: ported from Radix UI to Base UI; dependencies point at @uifiles.
"use client"

import { cn } from "cn"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import type { ComponentProps, HTMLAttributes, ReactNode } from "react"
import {
  Children,
  createContext,
  Fragment,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { Button } from "@/components/ui/button"
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group"

interface MessageBranchContextType {
  /** The requested index before clamping; content clamps it against its own child count. */
  branchIndex: number
  currentBranch: number
  totalBranches: number
  /** The count MessageBranch read off its own children; undefined when it could not see the content. */
  derivedTotal: number | undefined
  goToPrevious: () => void
  goToNext: () => void
  registerTotal: (total: number) => void
}

const MessageBranchContext = createContext<MessageBranchContextType | null>(
  null
)

const useMessageBranch = () => {
  const context = useContext(MessageBranchContext)

  if (!context) {
    throw new Error(
      "MessageBranch components must be used within MessageBranch"
    )
  }

  return context
}

const clampBranch = (index: number, total: number) =>
  total === 0 ? 0 : Math.min(Math.max(index, 0), total - 1)

// Children.toArray drops null/boolean children (conditional branches),
// resolves Server Component children (keyless lazy nodes) and keys every
// element, so a branch keeps its identity across navigation.
const branchesOf = (children: ReactNode) => Children.toArray(children)

const LAZY = Symbol.for("react.lazy")
const MEMO = Symbol.for("react.memo")
const FORWARD_REF = Symbol.for("react.forward_ref")

/**
 * The component behind an element type. A Server Component hands its client
 * children over as lazy types (the Flight client's reference to the module
 * export), which React resolves only when it renders them; memo and
 * forwardRef wrap a component in an object.
 */
function componentOf(type: unknown): unknown {
  if (typeof type !== "object" || type === null || !("$$typeof" in type)) {
    return type
  }
  if (type.$$typeof === MEMO && "type" in type) return componentOf(type.type)
  if (type.$$typeof === FORWARD_REF && "render" in type) {
    return componentOf(type.render)
  }
  if (
    type.$$typeof === LAZY &&
    "_init" in type &&
    "_payload" in type &&
    typeof type._init === "function"
  ) {
    // A module still loading throws its promise: MessageBranch suspends on
    // it, as React would on the element itself a moment later, and counts
    // once it is in.
    return componentOf(type._init(type._payload))
  }
  return type
}

/**
 * The branch count of the first MessageBranchContent among `children`, looked
 * for through fragments and host elements. Reading it while rendering keeps
 * the selector and page count in server HTML; a content rendered by a custom
 * component cannot be seen here and registers its count after mount instead.
 */
function countBranches(children: ReactNode): number | undefined {
  for (const child of Children.toArray(children)) {
    if (!isValidElement<{ children?: ReactNode }>(child)) continue
    if (componentOf(child.type) === MessageBranchContent) {
      return branchesOf(child.props.children).length
    }
    if (child.type === Fragment || typeof child.type === "string") {
      const nested = countBranches(child.props.children)
      if (nested !== undefined) return nested
    }
  }
  return undefined
}

export type MessageBranchProps = HTMLAttributes<HTMLDivElement> & {
  branch?: number | undefined
  defaultBranch?: number | undefined
  onBranchChange?: ((branchIndex: number) => void) | undefined
}

export const MessageBranch = ({
  branch,
  defaultBranch = 0,
  onBranchChange,
  className,
  children,
  ...props
}: MessageBranchProps) => {
  const onBranchChangeRef = useRef(onBranchChange)
  useEffect(() => {
    onBranchChangeRef.current = onBranchChange
  })
  const [uncontrolledBranch, setUncontrolledBranch] = useState(defaultBranch)
  const [registeredTotal, setRegisteredTotal] = useState(0)
  const derivedTotal = countBranches(children)
  const totalBranches = derivedTotal ?? registeredTotal
  const isControlled = branch !== undefined
  const branchIndex = isControlled ? branch : uncontrolledBranch
  const currentBranch = clampBranch(branchIndex, totalBranches)

  // A controlled branch that clamping moved (out of range, or the list
  // shrank below it) is reported once, so the parent's state follows what
  // is shown; the ref keeps StrictMode's replayed effect from reporting the
  // same clamp twice.
  const reportedClampRef = useRef<string | null>(null)
  useEffect(() => {
    if (!isControlled || totalBranches === 0 || branch === currentBranch) {
      reportedClampRef.current = null
      return
    }
    const clamp = `${branch}>${currentBranch}`
    if (reportedClampRef.current === clamp) return
    reportedClampRef.current = clamp
    onBranchChangeRef.current?.(currentBranch)
  }, [isControlled, branch, currentBranch, totalBranches])

  const setBranch = useCallback(
    (next: number) => {
      if (!isControlled) setUncontrolledBranch(next)
      onBranchChangeRef.current?.(next)
    },
    [isControlled]
  )

  const goToPrevious = useCallback(() => {
    if (totalBranches === 0) return
    setBranch(currentBranch > 0 ? currentBranch - 1 : totalBranches - 1)
  }, [currentBranch, totalBranches, setBranch])

  const goToNext = useCallback(() => {
    if (totalBranches === 0) return
    setBranch(currentBranch < totalBranches - 1 ? currentBranch + 1 : 0)
  }, [currentBranch, totalBranches, setBranch])

  const contextValue = useMemo<MessageBranchContextType>(
    () => ({
      branchIndex,
      currentBranch,
      derivedTotal,
      goToNext,
      goToPrevious,
      registerTotal: setRegisteredTotal,
      totalBranches,
    }),
    [
      branchIndex,
      currentBranch,
      derivedTotal,
      goToNext,
      goToPrevious,
      totalBranches,
    ]
  )

  return (
    <MessageBranchContext.Provider value={contextValue}>
      <div
        className={cn("grid w-full gap-2 [&>div]:pb-0", className)}
        {...props}
      >
        {children}
      </div>
    </MessageBranchContext.Provider>
  )
}

export type MessageBranchContentProps = HTMLAttributes<HTMLDivElement>

export const MessageBranchContent = ({
  children,
  className,
  ...props
}: MessageBranchContentProps) => {
  const { branchIndex, derivedTotal, registerTotal } = useMessageBranch()
  const branches = branchesOf(children)
  const currentBranch = clampBranch(branchIndex, branches.length)

  // Only content MessageBranch could not count itself registers, before
  // paint so the selector does not flash in.
  useLayoutEffect(() => {
    if (derivedTotal !== undefined) return
    registerTotal(branches.length)
    return () => registerTotal(0)
  }, [derivedTotal, branches.length, registerTotal])

  return branches.map((branch, index) => (
    <div
      className={cn(
        "grid gap-2 overflow-hidden [&>div]:pb-0",
        index === currentBranch ? "block" : "hidden",
        className
      )}
      key={isValidElement(branch) ? branch.key : index}
      {...props}
    >
      {branch}
    </div>
  ))
}

export type MessageBranchSelectorProps = ComponentProps<typeof ButtonGroup>

export const MessageBranchSelector = ({
  className,
  ...props
}: MessageBranchSelectorProps) => {
  const { totalBranches } = useMessageBranch()

  // Don't render if there's only one branch
  if (totalBranches <= 1) {
    return null
  }

  return (
    <ButtonGroup
      className={cn(
        "[&>*:not(:first-child)]:rounded-l-md [&>*:not(:last-child)]:rounded-r-md",
        className
      )}
      orientation="horizontal"
      {...props}
    />
  )
}

export type MessageBranchPreviousProps = ComponentProps<typeof Button>

export const MessageBranchPrevious = ({
  children,
  ...props
}: MessageBranchPreviousProps) => {
  const { goToPrevious, totalBranches } = useMessageBranch()

  return (
    <Button
      aria-label="Previous branch"
      disabled={totalBranches <= 1}
      onClick={goToPrevious}
      size="icon-sm"
      type="button"
      variant="ghost"
      {...props}
    >
      {children ?? <ChevronLeftIcon size={14} />}
    </Button>
  )
}

export type MessageBranchNextProps = ComponentProps<typeof Button>

export const MessageBranchNext = ({
  children,
  ...props
}: MessageBranchNextProps) => {
  const { goToNext, totalBranches } = useMessageBranch()

  return (
    <Button
      aria-label="Next branch"
      disabled={totalBranches <= 1}
      onClick={goToNext}
      size="icon-sm"
      type="button"
      variant="ghost"
      {...props}
    >
      {children ?? <ChevronRightIcon size={14} />}
    </Button>
  )
}

export type MessageBranchPageProps = ComponentProps<typeof ButtonGroupText>

export const MessageBranchPage = ({
  className,
  ...props
}: MessageBranchPageProps) => {
  const { currentBranch, totalBranches } = useMessageBranch()

  return (
    <ButtonGroupText
      className={cn(
        "border-none bg-transparent text-muted-foreground shadow-none",
        className
      )}
      {...props}
    >
      {totalBranches === 0 ? 0 : currentBranch + 1} of {totalBranches}
    </ButtonGroupText>
  )
}
