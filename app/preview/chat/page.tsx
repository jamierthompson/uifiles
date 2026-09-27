"use client"

import { useChat } from "@ai-sdk/react"
import { useEffect, useRef } from "react"
import { Chat } from "@/registry/blocks/chat/components/blocks/chat"
import {
  demoConversation,
  demoSuggestions,
  transport,
} from "@/registry/blocks/chat/lib/demo-conversation"

export default function ChatPreview() {
  const { error, messages, regenerate, sendMessage, status, stop } = useChat({
    transport,
  })
  const started = useRef(false)

  // Send the scripted opening question once so the preview streams on load.
  // Deferred a tick with cleanup so React Strict Mode's mount/unmount/mount in
  // development cancels the first attempt instead of aborting an in-flight
  // request and then re-sending a duplicate.
  useEffect(() => {
    const id = setTimeout(() => {
      if (started.current) return
      started.current = true
      const first = demoConversation.next([])
      if (first) void sendMessage(first)
    }, 0)
    return () => clearTimeout(id)
  }, [sendMessage])

  return (
    <>
      <h1 className="font-heading text-xl font-semibold">Chat</h1>
      <Chat
        className="h-[75svh]"
        error={error}
        messages={messages}
        onRetry={regenerate}
        onStop={stop}
        onSubmit={({ text, files }) => {
          // Not returned: it settles only once the answer has streamed.
          void sendMessage({ text, files })
        }}
        status={status}
        suggestions={demoSuggestions}
      />
    </>
  )
}
