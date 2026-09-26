import { useChat } from "@ai-sdk/react"
import type { UIMessage } from "ai"
import axe from "axe-core"
import { describe, expect, it, vi } from "vitest"
import { render } from "vitest-browser-react"
import {
  Chat,
  type ChatSubmitMessage,
} from "@/registry/blocks/chat/components/blocks/chat"
import {
  demoSuggestions,
  transport,
} from "@/registry/blocks/chat/lib/demo-conversation"
import "@/app/globals.css"

/**
 * Wait for finite, time-based enter animations so axe measures colors at rest.
 * Scroll-driven animations (the scroller's `scroll-fade-*` edges) never
 * finish, so they are skipped.
 */
async function settle() {
  await Promise.all(
    document
      .getAnimations()
      .filter(
        (a) =>
          a.timeline === document.timeline &&
          a.effect?.getTiming().iterations !== Infinity
      )
      .map((a) => a.finished.catch(() => undefined))
  )
}

const messages: UIMessage[] = [
  {
    id: "u1",
    role: "user",
    parts: [{ type: "text", text: "What does the registry build do?" }],
  },
  {
    id: "a1",
    role: "assistant",
    parts: [
      {
        type: "reasoning",
        text: "I should read the build script before answering.",
        state: "done",
      },
      {
        type: "tool-readFile",
        toolCallId: "call-1",
        state: "output-available",
        input: { path: "package.json" },
        output: { script: "node scripts/sync-tokens.ts && shadcn build" },
      },
      {
        type: "text",
        text: "## Registry build\n\nIt runs **three** steps:\n\n- sync tokens\n- validate\n- build\n\n```bash\npnpm registry:build\n```",
        state: "done",
      },
    ],
  },
]

describe("chat block", () => {
  it("renders a transcript with user, reasoning, tool and markdown parts", async () => {
    const screen = await render(
      <main className="flex h-[900px] flex-col">
        <Chat messages={messages} onSubmit={() => {}} status="ready" />
      </main>
    )

    await expect
      .element(screen.getByRole("region", { name: "Messages" }))
      .toBeVisible()
    await expect
      .element(screen.getByText("What does the registry build do?"))
      .toBeVisible()
    await expect
      .element(screen.getByRole("button", { name: /Thought for/ }))
      .toBeVisible()
    const tool = screen.getByRole("button", { name: /readFile/ })
    await expect.element(tool).toBeVisible()
    expect(tool.element().textContent).toContain("Completed")
    await expect
      .element(screen.getByRole("heading", { name: "Registry build" }))
      .toBeVisible()
    await expect.element(screen.getByText("three")).toBeVisible()
    await expect
      .element(screen.getByRole("listitem").first())
      .toHaveTextContent("sync tokens")
    await expect
      .element(screen.getByText("pnpm registry:build", { exact: false }))
      .toBeVisible()
    await expect
      .element(screen.getByPlaceholder("What would you like to know?"))
      .toBeVisible()

    await settle()
    const results = await axe.run(document.body)
    expect(results.violations).toEqual([])
  })

  it("submits typed text through onSubmit", async () => {
    const onSubmit = vi.fn<(message: ChatSubmitMessage) => void>()
    const screen = await render(
      <main className="flex h-[600px] flex-col">
        <Chat messages={messages} onSubmit={onSubmit} status="ready" />
      </main>
    )

    const textarea = screen.getByPlaceholder("What would you like to know?")
    await textarea.fill("Where is the build output?")
    await screen.getByRole("button", { name: "Submit" }).click()

    await expect.poll(() => onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
      files: [],
      text: "Where is the build output?",
    })
    await expect.element(textarea).toHaveValue("")
  })

  it("shows the empty state and submits a clicked suggestion", async () => {
    const onSubmit = vi.fn<(message: ChatSubmitMessage) => void>()
    const screen = await render(
      <main className="flex h-[600px] flex-col">
        <Chat
          messages={[]}
          onSubmit={onSubmit}
          status="ready"
          suggestions={["Summarize this repository"]}
        />
      </main>
    )

    await expect.element(screen.getByText("Start a conversation")).toBeVisible()
    await screen
      .getByRole("button", { name: "Summarize this repository" })
      .click()
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({
      files: [],
      text: "Summarize this repository",
    })

    await settle()
    const results = await axe.run(document.body)
    expect(results.violations).toEqual([])
  })

  it("streams the scripted demo conversation through useChat", async () => {
    function Demo() {
      const { messages, sendMessage, status, stop } = useChat({ transport })
      return (
        <main className="flex h-[900px] flex-col">
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
    const screen = await render(<Demo />)

    await screen
      .getByRole("button", { name: demoSuggestions[0] as string })
      .click()
    await expect
      .element(screen.getByRole("button", { name: /readFile/ }))
      .toBeVisible()
    await expect
      .element(screen.getByText("Then:"), { timeout: 20_000 })
      .toBeVisible()
    await expect
      .element(screen.getByRole("button", { name: "Submit" }), {
        timeout: 10_000,
      })
      .toBeVisible()
  }, 40_000)

  it("shows a thinking marker and a stop button while submitted", async () => {
    const onStop = vi.fn()
    const screen = await render(
      <main className="flex h-[600px] flex-col">
        <Chat
          messages={messages.slice(0, 1)}
          onStop={onStop}
          onSubmit={() => {}}
          status="submitted"
        />
      </main>
    )

    await expect.element(screen.getByText("Thinking…")).toBeVisible()
    await screen.getByRole("button", { name: "Stop" }).click()
    expect(onStop).toHaveBeenCalledTimes(1)
  })
})
