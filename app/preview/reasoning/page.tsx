"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/registry/ai/reasoning"

const fullText = `The user wants a caching strategy for a profile page.

- Profile data changes rarely, so a short revalidation window is fine.
- \`no-store\` would hit the origin on every request.
- \`force-cache\` would serve stale names after a rename.

Recommend \`revalidate: 60\` and mention \`revalidateTag\` for instant invalidation on edit.`

const STREAM_DURATION_MS = 4000
const TICK_MS = 80

/** Simulates a reasoning stream; remount (via `key`) to restart it. */
function StreamingReasoning() {
  const [text, setText] = useState("")
  const [isStreaming, setIsStreaming] = useState(true)

  useEffect(() => {
    const start = Date.now()
    const id = setInterval(() => {
      const progress = Math.min(1, (Date.now() - start) / STREAM_DURATION_MS)
      setText(fullText.slice(0, Math.floor(fullText.length * progress)))
      if (progress >= 1) {
        clearInterval(id)
        setIsStreaming(false)
      }
    }, TICK_MS)
    return () => clearInterval(id)
  }, [])

  return (
    <Reasoning isStreaming={isStreaming}>
      <ReasoningTrigger />
      <ReasoningContent>{text}</ReasoningContent>
    </Reasoning>
  )
}

export default function ReasoningPreview() {
  const [run, setRun] = useState(0)

  return (
    <>
      <h1 className="font-heading text-xl font-semibold">reasoning</h1>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">
            Streaming (auto-opens, auto-closes 1s after the stream ends)
          </h2>
          <Button
            onClick={() => setRun((n) => n + 1)}
            size="sm"
            variant="outline"
          >
            Restart stream
          </Button>
        </div>
        <StreamingReasoning key={run} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Finished (duration supplied, opened by default)
        </h2>
        <Reasoning defaultOpen duration={7}>
          <ReasoningTrigger />
          <ReasoningContent>{fullText}</ReasoningContent>
        </Reasoning>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Finished, unknown duration, collapsed
        </h2>
        <Reasoning>
          <ReasoningTrigger />
          <ReasoningContent>{fullText}</ReasoningContent>
        </Reasoning>
      </section>
    </>
  )
}
