"use client"

import { useChat } from "@ai-sdk/react"
import { Chat } from "@/registry/blocks/chat/components/blocks/chat"
import {
  demoSuggestions,
  transport,
} from "@/registry/blocks/chat/lib/demo-conversation"

export default function ChatPage() {
  const { messages, sendMessage, status, stop } = useChat({ transport })

  return (
    <main className="mx-auto flex h-svh w-full max-w-3xl flex-col p-4">
      <Chat
        messages={messages}
        onStop={stop}
        onSubmit={({ text, files }) => sendMessage({ text, files })}
        status={status}
        suggestions={demoSuggestions}
      />
    </main>
  )
}
