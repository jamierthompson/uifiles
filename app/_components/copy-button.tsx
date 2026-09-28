"use client"

import { CheckIcon, CopyIcon } from "lucide-react"
import * as React from "react"
import { Button } from "@/components/ui/button"

const COPIED_FOR_MS = 2000

/**
 * Copies `text` to the clipboard and shows a check for two seconds. The
 * label stays put (a changing label is not announced); a polite status
 * region beside the button says "Copied" instead. When the clipboard is
 * unavailable or refuses, nothing changes: there is nothing to announce.
 */
function CopyButton({
  text,
  label,
  className,
}: {
  text: string
  /** The accessible name; says what is copied. */
  label: string
  className?: string | undefined
}) {
  const [copied, setCopied] = React.useState(false)
  const timer = React.useRef<number | undefined>(undefined)

  React.useEffect(() => () => window.clearTimeout(timer.current), [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      return
    }
    setCopied(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied(false), COPIED_FOR_MS)
  }

  return (
    <>
      <Button
        aria-label={label}
        className={className}
        data-copied={copied ? "" : undefined}
        onClick={copy}
        size="icon-sm"
        variant="ghost"
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </Button>
      <span className="sr-only" role="status">
        {copied ? "Copied" : null}
      </span>
    </>
  )
}

export { CopyButton }
