// Derived from Vercel AI Elements message.tsx (Apache-2.0, Copyright 2023 Vercel, Inc.).
// Modified for uifiles: ported from Radix UI to Base UI; dependencies point at @uifiles.
"use client"

import { cjk } from "@streamdown/cjk"
import { code } from "@streamdown/code"
import { math } from "@streamdown/math"
import { mermaid } from "@streamdown/mermaid"
import { cn } from "cn"
import type { ComponentProps } from "react"
import { memo, useEffect, useRef } from "react"
import { Streamdown } from "streamdown"

export type MessageResponseProps = ComponentProps<typeof Streamdown>

const streamdownPlugins = { cjk, code, math, mermaid }
// uifiles: GitHub's default light theme fails AA (orange tokens at 3.48:1); the
// high-contrast pair keeps every token readable in both schemes.
const shikiThemes: NonNullable<
  ComponentProps<typeof Streamdown>["shikiTheme"]
> = ["github-light-high-contrast", "github-dark-high-contrast"]

// uifiles: Streamdown's code blocks scroll (horizontally, and vertically past
// codeBlockMaxHeight) without being focusable, so keyboard users cannot reach
// the overflow (axe scrollable-region-focusable). Mark the ones that actually
// overflow as tab stops; re-check as streamed content arrives.
const CODE_BLOCK_BODY = '[data-streamdown="code-block-body"]'

function markScrollableCodeBlocks(root: HTMLElement) {
  for (const el of root.querySelectorAll<HTMLElement>(CODE_BLOCK_BODY)) {
    const scrollable =
      el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight
    if (scrollable) el.tabIndex = 0
    else el.removeAttribute("tabindex")
  }
}

export const MessageResponse = memo(
  ({ className, ...props }: MessageResponseProps) => {
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
      const root = ref.current
      if (!root) return
      markScrollableCodeBlocks(root)
      const observer = new MutationObserver(() =>
        markScrollableCodeBlocks(root)
      )
      observer.observe(root, { childList: true, subtree: true })
      return () => observer.disconnect()
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
        />
      </div>
    )
  },
  (prevProps, nextProps) =>
    prevProps.children === nextProps.children &&
    nextProps.isAnimating === prevProps.isAnimating
)

MessageResponse.displayName = "MessageResponse"
