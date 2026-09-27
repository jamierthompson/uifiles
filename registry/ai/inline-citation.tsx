// Derived from Vercel AI Elements inline-citation.tsx (Apache-2.0, Copyright 2023 Vercel, Inc.).
// Modified for uifiles: ported from Radix UI to Base UI; dependencies point at @uifiles.
"use client"

import { cn } from "cn"
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react"
import type {
  ComponentProps,
  KeyboardEvent,
  MouseEvent as ReactMouseEvent,
  ReactNode,
  RefObject,
} from "react"
import {
  Children,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react"
import { Badge } from "@/components/ui/badge"
import type { CarouselApi } from "@/components/ui/carousel"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"

export type InlineCitationProps = ComponentProps<"span">

export const InlineCitation = ({
  className,
  ...props
}: InlineCitationProps) => (
  <span
    className={cn("group inline items-center gap-1", className)}
    {...props}
  />
)

export type InlineCitationTextProps = ComponentProps<"span">

export const InlineCitationText = ({
  className,
  ...props
}: InlineCitationTextProps) => (
  <span
    className={cn("transition-colors group-hover:bg-accent", className)}
    {...props}
  />
)

export type InlineCitationCardProps = ComponentProps<typeof HoverCard>

type InlineCitationCardChangeEventDetails = Parameters<
  NonNullable<InlineCitationCardProps["onOpenChange"]>
>[1]

type InlineCitationCardContextValue = {
  open: boolean
  /** Opened, or kept open, by a press: focus belongs inside the card. */
  pinned: boolean
  press: (event: ReactMouseEvent<HTMLElement>) => void
  popupRef: RefObject<HTMLDivElement | null>
  /** The body's id, for the badge's aria-controls. */
  popupId: string
  /** Lets the body report an id the consumer gave it. */
  setPopupIdOverride: (id: string | undefined) => void
  /** The pressed badge's id, which names the pinned card. */
  triggerId: string | undefined
}

const InlineCitationCardContext =
  createContext<InlineCitationCardContextValue | null>(null)

// Base UI Preview Card opens on hover and on keyboard focus only, so a press
// gets change details built here in the shape Base UI gives every reason.
const pressEventDetails = (
  event: MouseEvent,
  trigger: Element
): InlineCitationCardChangeEventDetails => {
  let isCanceled = false
  let isPropagationAllowed = false
  return {
    reason: "trigger-press",
    event,
    trigger,
    get isCanceled() {
      return isCanceled
    },
    get isPropagationAllowed() {
      return isPropagationAllowed
    },
    cancel: () => {
      isCanceled = true
    },
    allowPropagation: () => {
      isPropagationAllowed = true
    },
    preventUnmountOnClose: () => {},
  }
}

// Base UI puts hover delays on the trigger, not the root: see
// InlineCitationCardTrigger. The open state lives here so a press (click,
// tap, Enter, Space) can open the card: Base UI Preview Card has hover and
// keyboard-focus interactions only, which leaves touch users nothing.
export const InlineCitationCard = ({
  open: openProp,
  defaultOpen,
  onOpenChange,
  ...props
}: InlineCitationCardProps) => {
  const onOpenChangeRef = useRef(onOpenChange)
  useEffect(() => {
    onOpenChangeRef.current = onOpenChange
  })
  const [uncontrolled, setUncontrolled] = useState(defaultOpen ?? false)
  const isControlled = openProp !== undefined
  const open = isControlled ? openProp : uncontrolled
  const [pinned, setPinned] = useState(false)
  // A closed card is never pinned. A press a controlled parent refused (its
  // `open` stayed false) or a pinned card the parent closed through `open`
  // would otherwise make the card's next opening modal.
  if (pinned && !open) setPinned(false)
  const [triggerId, setTriggerId] = useState<string>()
  const generatedPopupId = useId()
  const [popupIdOverride, setPopupIdOverride] = useState<string>()
  const popupId = popupIdOverride ?? generatedPopupId
  const triggerRef = useRef<HTMLElement | null>(null)
  const popupRef = useRef<HTMLDivElement | null>(null)
  const restoreFocusRef = useRef(false)
  // Focus returned to the badge by the card must not count as the badge
  // receiving focus, until the badge is blurred or pressed again.
  const ignoreFocusOpenRef = useRef(false)

  const setOpen = useCallback(
    (next: boolean, details: InlineCitationCardChangeEventDetails) => {
      if (!isControlled) setUncontrolled(next)
      onOpenChangeRef.current?.(next, details)
    },
    [isControlled]
  )

  const handleOpenChange = useCallback(
    (next: boolean, details: InlineCitationCardChangeEventDetails) => {
      if (next) {
        if (details.reason === "trigger-focus" && ignoreFocusOpenRef.current) {
          details.cancel()
          return
        }
        if (details.trigger instanceof HTMLElement) {
          triggerRef.current = details.trigger
        }
        setOpen(true, details)
        return
      }
      if (details.reason === "trigger-focus") {
        ignoreFocusOpenRef.current = false
      }
      // A pinned card outlives the pointer leaving the badge; it closes on
      // Escape, an outside press or a second press.
      if (pinned && details.reason === "trigger-hover") {
        details.cancel()
        return
      }
      // Focus goes back to the badge when it was in the card, or when a
      // pinned card lost it to <body> (content that removed or disabled its
      // own focused control); focus the user put elsewhere stays there.
      const active = document.activeElement
      restoreFocusRef.current =
        details.reason === "escape-key" &&
        (popupRef.current?.contains(active) === true ||
          (pinned && (active === null || active === document.body)))
      setPinned(false)
      setOpen(false, details)
    },
    [pinned, setOpen]
  )

  const press = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      const details = pressEventDetails(event.nativeEvent, event.currentTarget)
      triggerRef.current = event.currentTarget
      setTriggerId(event.currentTarget.id || undefined)
      ignoreFocusOpenRef.current = false
      if (open && pinned) {
        restoreFocusRef.current = true
        setPinned(false)
        setOpen(false, details)
        return
      }
      setPinned(true)
      if (!open) setOpen(true, details)
    },
    [open, pinned, setOpen]
  )

  // Runs after Base UI has handled the dismissal, so its own Escape block is
  // in place; the ignore flag covers a press-close and a delayed focus open.
  useEffect(() => {
    if (open || !restoreFocusRef.current) return
    restoreFocusRef.current = false
    ignoreFocusOpenRef.current = true
    triggerRef.current?.focus()
  }, [open])

  const contextValue = useMemo<InlineCitationCardContextValue>(
    () => ({
      open,
      pinned: open && pinned,
      popupId,
      popupRef,
      press,
      setPopupIdOverride,
      triggerId,
    }),
    [open, pinned, popupId, press, triggerId]
  )

  return (
    <InlineCitationCardContext.Provider value={contextValue}>
      <HoverCard onOpenChange={handleOpenChange} open={open} {...props} />
    </InlineCitationCardContext.Provider>
  )
}

export type InlineCitationCardTriggerProps = ComponentProps<typeof Badge> &
  Pick<ComponentProps<typeof HoverCardTrigger>, "delay" | "closeDelay"> & {
    sources: string[]
  }

// Sources come from model output, so relative paths ("/docs/streaming") and
// bare hosts ("example.com") are common; `new URL` throws on both. A
// try/catch rather than URL.canParse, which Safari before 17 lacks.
const safeHostname = (source: string) => {
  try {
    return new URL(source).hostname || source
  } catch {
    return source
  }
}

export const InlineCitationCardTrigger = ({
  sources,
  className,
  delay = 0,
  closeDelay = 0,
  onClick,
  ...props
}: InlineCitationCardTriggerProps) => {
  const card = useContext(InlineCitationCardContext)
  const [first] = sources
  const label = first
    ? `${safeHostname(first)}${sources.length > 1 ? ` +${sources.length - 1}` : ""}`
    : "unknown"

  return (
    <HoverCardTrigger
      closeDelay={closeDelay}
      delay={delay}
      // A <span> is skipped by Tab. A button is focusable, so Base UI's
      // focus path opens the card for keyboard and assistive-tech users.
      render={
        <Badge
          // Base UI's Preview Card trigger carries no ARIA; a press opens
          // the card, so the badge is a disclosure button for it.
          {...(card && {
            "aria-controls": card.open ? card.popupId : undefined,
            "aria-expanded": card.open,
          })}
          className={cn("ml-1 rounded-full", className)}
          render={<button type="button" />}
          variant="secondary"
          {...props}
          onClick={(event) => {
            onClick?.(event)
            if (!event.defaultPrevented) card?.press(event)
          }}
        />
      }
    >
      {label}
    </HoverCardTrigger>
  )
}

export type InlineCitationCardBodyProps = ComponentProps<
  typeof HoverCardContent
>

const TABBABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Tab and Shift+Tab stay inside the card while focus is in it: the popup is
// portaled to <body>, so the browser's own order would leave the page.
// Escape closes the card and returns focus to the badge.
const cycleTab = (event: KeyboardEvent<HTMLDivElement>) => {
  if (event.key !== "Tab") return
  const popup = event.currentTarget
  const items = Array.from(popup.querySelectorAll<HTMLElement>(TABBABLE))
  const first = items[0]
  const last = items[items.length - 1]
  if (!first || !last) {
    event.preventDefault()
    popup.focus()
    return
  }
  const active = document.activeElement
  if (event.shiftKey ? active === popup || active === first : active === last) {
    event.preventDefault()
    ;(event.shiftKey ? last : first).focus()
  }
}

// Mounts with the popup, so the effect runs once the card is in the DOM and
// again when a press pins a card that hover or focus already opened.
const PinnedFocus = ({
  pinned,
  popupRef,
}: Pick<InlineCitationCardContextValue, "pinned" | "popupRef">) => {
  useEffect(() => {
    const popup = popupRef.current
    if (pinned && popup && !popup.contains(document.activeElement)) {
      popup.focus()
    }
  }, [pinned, popupRef])
  return null
}

export const InlineCitationCardBody = ({
  className,
  children,
  onKeyDown,
  ref,
  ...props
}: InlineCitationCardBodyProps) => {
  const card = useContext(InlineCitationCardContext)
  const popupRef = card?.popupRef
  const setPopupIdOverride = card?.setPopupIdOverride
  const { id: idProp } = props

  useEffect(() => {
    setPopupIdOverride?.(idProp)
    return () => setPopupIdOverride?.(undefined)
  }, [setPopupIdOverride, idProp])

  // A peek on hover or focus is non-modal and keeps focus on the badge; a
  // pinned card takes focus, so it is a dialog named after its badge.
  const pinned = card?.pinned === true
  const named =
    props["aria-label"] !== undefined || props["aria-labelledby"] !== undefined

  const setPopup = useCallback(
    (node: HTMLDivElement | null) => {
      if (popupRef) popupRef.current = node
      if (typeof ref === "function") ref(node)
      else if (ref) ref.current = node
    },
    [popupRef, ref]
  )

  return (
    <HoverCardContent
      className={cn(
        "relative w-80 p-0 focus-visible:ring-3 focus-visible:ring-ring/50",
        className
      )}
      id={card?.popupId}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!event.defaultPrevented) cycleTab(event)
      }}
      ref={setPopup}
      {...(pinned && {
        role: "dialog",
        ...(!named &&
          (card?.triggerId
            ? { "aria-labelledby": card.triggerId }
            : { "aria-label": "Sources" })),
      })}
      {...props}
    >
      {children}
      {card ? (
        <PinnedFocus pinned={card.pinned} popupRef={card.popupRef} />
      ) : null}
    </HoverCardContent>
  )
}

const CarouselApiContext = createContext<CarouselApi | undefined>(undefined)

const useCarouselApi = () => {
  const context = useContext(CarouselApiContext)
  return context
}

type CarouselSnap = {
  current: number
  count: number
  canScrollPrev: boolean
  canScrollNext: boolean
}

const emptySnap: CarouselSnap = {
  current: 0,
  count: 0,
  canScrollPrev: false,
  canScrollNext: false,
}

// Adding or removing slides makes embla re-initialise (`reInit`,
// `slidesChanged`) without emitting `select`, so all three events resync.
const snapEvents = ["select", "reInit", "slidesChanged"] as const

const useCarouselSnap = (): CarouselSnap => {
  const api = useCarouselApi()
  const [snap, setSnap] = useState(emptySnap)

  useEffect(() => {
    if (!api) {
      return
    }

    const sync = () => {
      const count = api.scrollSnapList().length
      setSnap({
        current: count === 0 ? 0 : api.selectedScrollSnap() + 1,
        count,
        canScrollPrev: api.canScrollPrev(),
        canScrollNext: api.canScrollNext(),
      })
    }

    sync()

    for (const event of snapEvents) {
      api.on(event, sync)
    }

    return () => {
      for (const event of snapEvents) {
        api.off(event, sync)
      }
    }
  }, [api])

  return snap
}

export type InlineCitationCarouselProps = ComponentProps<typeof Carousel>

export const InlineCitationCarousel = ({
  className,
  children,
  setApi: consumerSetApi,
  ...props
}: InlineCitationCarouselProps) => {
  const [api, setApi] = useState<CarouselApi>()

  const handleSetApi = useCallback(
    (nextApi: CarouselApi) => {
      setApi(nextApi)
      consumerSetApi?.(nextApi)
    },
    [consumerSetApi]
  )

  return (
    <CarouselApiContext.Provider value={api}>
      <Carousel
        className={cn("w-full", className)}
        setApi={handleSetApi}
        {...props}
      >
        {children}
      </Carousel>
    </CarouselApiContext.Provider>
  )
}

export type InlineCitationCarouselContentProps = ComponentProps<"div">

export const InlineCitationCarouselContent = (
  props: InlineCitationCarouselContentProps
) => <CarouselContent {...props} />

export type InlineCitationCarouselItemProps = ComponentProps<"div">

export const InlineCitationCarouselItem = ({
  className,
  ...props
}: InlineCitationCarouselItemProps) => (
  <CarouselItem
    className={cn("w-full space-y-2 p-4 pl-8", className)}
    {...props}
  />
)

export type InlineCitationCarouselHeaderProps = ComponentProps<"div">

export const InlineCitationCarouselHeader = ({
  className,
  ...props
}: InlineCitationCarouselHeaderProps) => (
  <div
    className={cn(
      "flex items-center justify-between gap-2 rounded-t-md bg-secondary p-2",
      className
    )}
    {...props}
  />
)

export type InlineCitationCarouselIndexProps = ComponentProps<"div">

export const InlineCitationCarouselIndex = ({
  children,
  className,
  ...props
}: InlineCitationCarouselIndexProps) => {
  const { current, count } = useCarouselSnap()

  return (
    <div
      className={cn(
        "flex flex-1 items-center justify-end px-3 py-1 text-xs text-secondary-foreground",
        className
      )}
      {...props}
    >
      {children ?? `${current}/${count}`}
    </div>
  )
}

// size-6 gives the 16px icon the 24px hit area WCAG 2.5.8 asks for. At an
// end an arrow is aria-disabled rather than disabled (embla ignores the
// click there): a disabled button cannot hold focus, so a keyboard user
// paging to the last slide would be dropped to <body>.
const carouselButtonClassName =
  "inline-flex size-6 shrink-0 items-center justify-center rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 aria-disabled:opacity-50"

export type InlineCitationCarouselPrevProps = ComponentProps<"button">

export const InlineCitationCarouselPrev = ({
  className,
  ...props
}: InlineCitationCarouselPrevProps) => {
  const api = useCarouselApi()
  const { canScrollPrev } = useCarouselSnap()

  const handleClick = useCallback(() => {
    if (api) {
      api.scrollPrev()
    }
  }, [api])

  return (
    <button
      aria-disabled={!canScrollPrev}
      aria-label="Previous"
      className={cn(carouselButtonClassName, className)}
      onClick={handleClick}
      type="button"
      {...props}
    >
      <ArrowLeftIcon className="size-4 text-muted-foreground" />
    </button>
  )
}

export type InlineCitationCarouselNextProps = ComponentProps<"button">

export const InlineCitationCarouselNext = ({
  className,
  ...props
}: InlineCitationCarouselNextProps) => {
  const api = useCarouselApi()
  const { canScrollNext } = useCarouselSnap()

  const handleClick = useCallback(() => {
    if (api) {
      api.scrollNext()
    }
  }, [api])

  return (
    <button
      aria-disabled={!canScrollNext}
      aria-label="Next"
      className={cn(carouselButtonClassName, className)}
      onClick={handleClick}
      type="button"
      {...props}
    >
      <ArrowRightIcon className="size-4 text-muted-foreground" />
    </button>
  )
}

// React renders nothing for null, booleans, empty strings, empty arrays and
// whitespace-only text, which would leave an empty element (and a quote's
// border) behind.
const hasContent = (children: ReactNode) =>
  Children.toArray(children).some(
    (child) => typeof child !== "string" || child.trim() !== ""
  )

export type InlineCitationSourceProps = ComponentProps<"div"> & {
  title?: string | undefined
  url?: string | undefined
  description?: string | undefined
}

export const InlineCitationSource = ({
  title,
  url,
  description,
  className,
  children,
  ...props
}: InlineCitationSourceProps) => {
  if (!title && !url && !description && !hasContent(children)) {
    return null
  }

  return (
    <div className={cn("space-y-1", className)} {...props}>
      {title && (
        <p className="truncate text-sm leading-tight font-medium">{title}</p>
      )}
      {url && (
        <p className="truncate text-xs break-all text-muted-foreground">
          {url}
        </p>
      )}
      {description && (
        <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {children}
    </div>
  )
}

export type InlineCitationQuoteProps = ComponentProps<"blockquote">

export const InlineCitationQuote = ({
  children,
  className,
  ...props
}: InlineCitationQuoteProps) => {
  if (!hasContent(children)) {
    return null
  }

  return (
    <blockquote
      className={cn(
        "border-l-2 border-muted pl-3 text-sm text-muted-foreground italic",
        className
      )}
      {...props}
    >
      {children}
    </blockquote>
  )
}
