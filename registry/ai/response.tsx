// Derived from Vercel AI Elements message.tsx (Apache-2.0, Copyright 2023 Vercel, Inc.).
// Modified for uifiles: ported from Radix UI to Base UI; dependencies point at @uifiles.
"use client"

import { cjk } from "@streamdown/cjk"
import { code } from "@streamdown/code"
import { math } from "@streamdown/math"
import { mermaid } from "@streamdown/mermaid"
import { cn } from "cn"
import type { ComponentProps } from "react"
import { memo, useEffect, useId, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type {
  LinkSafetyConfig,
  LinkSafetyModalProps,
  StreamdownTranslations,
} from "streamdown"
import { defaultTranslations, Streamdown } from "streamdown"

export type MessageResponseProps = ComponentProps<typeof Streamdown>

const streamdownPlugins = { cjk, code, math, mermaid }
// uifiles: GitHub's default light theme fails AA (orange tokens at 3.48:1); the
// high-contrast pair keeps every token readable in both schemes.
const shikiThemes: NonNullable<
  ComponentProps<typeof Streamdown>["shikiTheme"]
> = ["github-light-high-contrast", "github-dark-high-contrast"]

// uifiles: Streamdown's code-block bodies and table wrappers scroll
// (horizontally, and vertically past codeBlockMaxHeight / tableMaxHeight)
// without being focusable, so keyboard users cannot reach the overflow (axe
// scrollable-region-focusable). Mark the ones that actually overflow as named
// tab stops; re-check as streamed content arrives and on resize.
const CODE_BLOCK_BODY = '[data-streamdown="code-block-body"]'
// The wrapper holds the table's controls; the div between it and the table
// is the one that scrolls.
const TABLE = '[data-streamdown="table-wrapper"] [data-streamdown="table"]'
// Streamdown portals the fullscreen table view to document.body.
const FULLSCREEN = '[data-streamdown="table-fullscreen"]'
const FULLSCREEN_TABLE = `${FULLSCREEN} [data-streamdown="table"]`
// KaTeX's display formula; it scrolls once the stylesheet gives it
// `overflow: auto hidden` (see the item's docs).
const MATH_DISPLAY = ".katex-display"

interface Scroller {
  /** The accessible name it carries while it overflows. */
  label: string
  overflows: (element: HTMLElement) => boolean
}

const overflowsEitherAxis = (element: HTMLElement) =>
  element.scrollWidth > element.clientWidth ||
  element.scrollHeight > element.clientHeight

const CODE: Scroller = { label: "Code", overflows: overflowsEitherAxis }
const TABLE_SCROLLER: Scroller = {
  label: "Table",
  overflows: overflowsEitherAxis,
}
// A formula is one line clipped vertically, so only a sideways overflow can
// be scrolled; without the stylesheet rule the page scrolls instead and
// there is nothing to focus.
const MATH: Scroller = {
  label: "Math",
  overflows: (element) => {
    const { overflowX } = getComputedStyle(element)
    return (
      (overflowX === "auto" || overflowX === "scroll") &&
      element.scrollWidth > element.clientWidth
    )
  },
}

/** Every element Streamdown lets scroll, with what it is. */
function findScrollers(root: HTMLElement): Map<HTMLElement, Scroller> {
  const scrollers = new Map<HTMLElement, Scroller>()
  for (const body of root.querySelectorAll<HTMLElement>(CODE_BLOCK_BODY)) {
    scrollers.set(body, CODE)
  }
  const tables = [
    ...root.querySelectorAll(TABLE),
    ...document.querySelectorAll(FULLSCREEN_TABLE),
  ]
  for (const table of tables) {
    const scroller = table.parentElement
    if (scroller instanceof HTMLElement) scrollers.set(scroller, TABLE_SCROLLER)
  }
  for (const display of root.querySelectorAll<HTMLElement>(MATH_DISPLAY)) {
    scrollers.set(display, MATH)
  }
  return scrollers
}

// React tags every host node it has hydrated or created with a
// `__reactFiber$…` property. Streamdown lazy-loads its highlighted code body
// inside a Suspense boundary, and until that boundary hydrates its server
// DOM carries no tag; an attribute added there is reported as a hydration
// mismatch once React reaches it.
const isClaimedByReact = (element: Element) =>
  Object.keys(element).some((key) => key.startsWith("__reactFiber$"))

function markScrollable(element: HTMLElement, scroller: Scroller) {
  if (scroller.overflows(element)) {
    element.tabIndex = 0
    // A named group rather than a region: a transcript with several
    // overflowing blocks would otherwise list identical landmarks.
    element.setAttribute("role", "group")
    element.setAttribute("aria-label", scroller.label)
  } else {
    element.removeAttribute("tabindex")
    element.removeAttribute("role")
    element.removeAttribute("aria-label")
  }
}

const isFullscreenView = (node: Node) =>
  node instanceof Element && node.matches(FULLSCREEN)

type LinkSafetyDialogProps = LinkSafetyModalProps & {
  translations: StreamdownTranslations
}

// uifiles: Streamdown's own link-safety modal is a role="button" backdrop
// wrapped around the dialog's buttons (axe nested-interactive) that never
// moves focus into itself, and a long URL scrolls in a box the keyboard
// cannot reach. A native modal <dialog> makes the page inert, takes focus,
// closes on Escape and gives focus back to the link.
function LinkSafetyDialog({ isOpen, ...props }: LinkSafetyDialogProps) {
  if (!isOpen || typeof document === "undefined") return null
  return createPortal(<OpenLinkDialog {...props} />, document.body)
}

const dialogButton =
  "inline-flex flex-1 items-center justify-center rounded-md px-4 py-2 font-medium text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50"

function OpenLinkDialog({
  onClose,
  onConfirm,
  translations,
  url,
}: Omit<LinkSafetyDialogProps, "isOpen">) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const dialog = ref.current
    // Closing hands focus back to what had it before (the link). StrictMode
    // replays this effect on the dialog it already opened, which older
    // engines refuse with an InvalidStateError.
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  const close = () => ref.current?.close()

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      // Clipboard access denied: the URL stays visible to copy by hand.
    }
  }

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the backdrop click is the pointer's way out; Escape (the dialog's native cancel) is the keyboard's
    <dialog
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-xl border bg-background p-0 text-foreground shadow-lg backdrop:bg-background/50 backdrop:backdrop-blur-sm"
      data-slot="link-safety-dialog"
      // A click on the backdrop lands on the dialog itself; the panel
      // inside catches every click on the content.
      onClick={(event) => {
        if (event.target === event.currentTarget) close()
      }}
      // Escape, a button or the backdrop closed it.
      onClose={onClose}
      ref={ref}
    >
      <div className="relative flex flex-col gap-4 p-6">
        <button
          aria-label={translations.close}
          className="absolute top-4 right-4 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          onClick={close}
          title={translations.close}
          type="button"
        >
          <svg
            aria-hidden="true"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
        <div className="flex flex-col gap-2 pr-8">
          <h2 className="text-lg font-semibold" id={titleId}>
            {translations.openExternalLink}
          </h2>
          <p className="text-sm text-muted-foreground" id={descriptionId}>
            {translations.externalLinkWarning}
          </p>
        </div>
        <p className="rounded-md bg-muted p-3 font-mono text-sm break-all">
          {url}
        </p>
        <div className="flex gap-2">
          <button
            className={cn(dialogButton, "border bg-background hover:bg-muted")}
            onClick={copy}
            type="button"
          >
            {copied ? translations.copied : translations.copyLink}
          </button>
          <button
            className={cn(
              dialogButton,
              "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
            onClick={() => {
              onConfirm()
              close()
            }}
            type="button"
          >
            {translations.openLink}
          </button>
        </div>
      </div>
    </dialog>
  )
}

export const MessageResponse = memo(
  ({ className, ...props }: MessageResponseProps) => {
    const ref = useRef<HTMLDivElement>(null)
    const { linkSafety, translations } = props

    // Streamdown's default (link safety on) with the accessible dialog; a
    // consumer's renderModal or enabled: false still wins.
    const safety = useMemo<LinkSafetyConfig>(() => {
      const strings = { ...defaultTranslations, ...translations }
      return {
        enabled: true,
        renderModal: (modal) => (
          <LinkSafetyDialog {...modal} translations={strings} />
        ),
        ...linkSafety,
      }
    }, [linkSafety, translations])

    useEffect(() => {
      const root = ref.current
      if (!root) return
      const observed = new Map<HTMLElement, Scroller>()
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (!(entry.target instanceof HTMLElement)) continue
          const scroller = observed.get(entry.target)
          if (scroller) markScrollable(entry.target, scroller)
        }
      })
      let frame = 0
      const sync = () => {
        cancelAnimationFrame(frame)
        const scrollers = findScrollers(root)
        for (const element of observed.keys()) {
          if (!scrollers.has(element)) {
            resizeObserver.unobserve(element)
            observed.delete(element)
          }
        }
        let dehydrated = false
        for (const [element, scroller] of scrollers) {
          if (!isClaimedByReact(element)) {
            dehydrated = true
            continue
          }
          markScrollable(element, scroller)
          if (!observed.has(element)) {
            resizeObserver.observe(element)
            observed.set(element, scroller)
          }
        }
        // Hydration does not mutate the DOM, so poll until React owns every scroller.
        if (dehydrated) frame = requestAnimationFrame(sync)
      }
      sync()
      const mutationObserver = new MutationObserver(sync)
      mutationObserver.observe(root, {
        characterData: true,
        childList: true,
        subtree: true,
      })
      // Only the fullscreen view's arrival and departure matter out there.
      const portalObserver = new MutationObserver((records) => {
        if (
          records.some(
            (record) =>
              [...record.addedNodes].some(isFullscreenView) ||
              [...record.removedNodes].some(isFullscreenView)
          )
        ) {
          sync()
        }
      })
      portalObserver.observe(document.body, { childList: true })
      return () => {
        cancelAnimationFrame(frame)
        mutationObserver.disconnect()
        portalObserver.disconnect()
        resizeObserver.disconnect()
      }
    }, [])

    return (
      <div className="contents" data-slot="message-response" ref={ref}>
        <Streamdown
          className={cn(
            "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
            className
          )}
          plugins={streamdownPlugins}
          shikiTheme={shikiThemes}
          {...props}
          linkSafety={safety}
        />
      </div>
    )
  },
  (prevProps, nextProps) =>
    prevProps.children === nextProps.children &&
    nextProps.isAnimating === prevProps.isAnimating
)

MessageResponse.displayName = "MessageResponse"
