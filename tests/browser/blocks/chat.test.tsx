import { useChat } from "@ai-sdk/react"
import { createChat } from "@shadcn/helpers/ai-sdk"
import type {
  ChatStatus,
  ChatTransport,
  ToolUIPart,
  UIMessage,
  UIMessageChunk,
} from "ai"
import { Component, type ReactNode, useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import {
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import {
  Chat,
  ChatAttachments,
  ChatComposer,
  ChatEmpty,
  ChatErrorMarker,
  ChatMessage,
  ChatMessagePart,
  type ChatMessagePartType,
  type ChatSubmitMessage,
  ChatThinkingMarker,
  ChatToolPart,
  getMessageText,
} from "@/registry/blocks/chat/components/blocks/chat"
import {
  demoConversation,
  demoSuggestions,
  transport,
} from "@/registry/blocks/chat/lib/demo-conversation"
import { expectNoViolations, withDark } from "@/tests/a11y"
import { allowConsole } from "@/tests/setup"
import "@/app/globals.css"

/** Records a render error instead of unmounting the whole test tree. */
class Boundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    return this.state.error ? (
      <div data-testid="crash">{this.state.error.message}</div>
    ) : (
      this.props.children
    )
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Polls until `read()` returns `expected`, then keeps sampling for a short
 * bounded window and fails if it changes. The positive half is a poll; the
 * hold is for "and nothing else happens" assertions, which have no event to
 * wait for.
 */
async function settled<T>(read: () => T, expected: T, holdMs = 100) {
  await expect.poll(read).toBe(expected)
  const until = performance.now() + holdMs
  while (performance.now() < until) {
    await sleep(10)
    expect(read()).toBe(expected)
  }
}

async function nextFrames(count: number) {
  for (let i = 0; i < count; i += 1) {
    await new Promise((resolve) => requestAnimationFrame(resolve))
  }
}

/** ChatMessagePart's `role` is the message role, not an ARIA role. */
const assistantRole = { role: "assistant" as const }
const userRole = { role: "user" as const }

const PLACEHOLDER = "What would you like to know?"
const openingQuestion = demoSuggestions[0] ?? ""
const allStatuses: ChatStatus[] = ["ready", "submitted", "streaming", "error"]

const transcript: UIMessage[] = [
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

const longTranscript: UIMessage[] = Array.from({ length: 30 }, (_, i) => ({
  id: `m${i}`,
  role: i % 2 ? "assistant" : "user",
  parts: [{ type: "text", text: `Message number ${i} with some text` }],
}))

function chunkStream(chunks: UIMessageChunk[]) {
  return new ReadableStream<UIMessageChunk>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk)
      controller.close()
    },
  })
}

/** Fails the first request with an `error` chunk and answers the next one. */
function failingOnceTransport() {
  const triggers: string[] = []
  const chatTransport: ChatTransport<UIMessage> = {
    async sendMessages({ trigger }) {
      triggers.push(trigger)
      if (triggers.length === 1) {
        return chunkStream([{ type: "error", errorText: "Upstream exploded" }])
      }
      return chunkStream([
        { type: "start" },
        { type: "text-start", id: "t1" },
        { type: "text-delta", id: "t1", delta: "Recovered." },
        { type: "text-end", id: "t1" },
        { type: "finish" },
      ])
    },
    async reconnectToStream() {
      return null
    },
  }
  return { transport: chatTransport, triggers }
}

function Demo({
  chatTransport = transport,
  height = 700,
  onStatus,
  onMessages,
  probe,
}: {
  chatTransport?: ChatTransport<UIMessage>
  height?: number
  onStatus?: (status: ChatStatus) => void
  onMessages?: (messages: UIMessage[]) => void
  probe?: (helpers: { error: Error | undefined }) => ReactNode
}) {
  const { error, messages, regenerate, sendMessage, status, stop } = useChat({
    transport: chatTransport,
  })
  onStatus?.(status)
  onMessages?.(messages)
  return (
    <main className="flex flex-col" style={{ height }}>
      {probe?.({ error })}
      <Chat
        error={error}
        messages={messages}
        onRetry={regenerate}
        onStop={stop}
        // Returns the transport promise on purpose: it settles only once the
        // answer has streamed, and the block must not wait for it.
        onSubmit={({ text, files }) => sendMessage({ text, files })}
        status={status}
        suggestions={demoSuggestions}
      />
    </main>
  )
}

const messagesViewport = () =>
  document.querySelector(
    "[data-slot='message-scroller-viewport']"
  ) as HTMLElement

const distanceFromBottom = (viewport: HTMLElement) =>
  viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight

const makeFile = (name: string, type = "text/plain") =>
  new File(["hello"], name, { type })

/** Puts files on the hidden <input type="file"> and fires the native change event. */
const chooseFiles = (files: File[]) => {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')
  if (!input) {
    throw new Error("hidden file input not rendered")
  }
  const dt = new DataTransfer()
  for (const file of files) {
    dt.items.add(file)
  }
  input.files = dt.files
  input.dispatchEvent(new Event("change", { bubbles: true }))
}

const formEl = () => {
  const form = document.querySelector("form")
  if (!form) {
    throw new Error("form not rendered")
  }
  return form
}

const textareaValue = () =>
  document.querySelector<HTMLTextAreaElement>('textarea[name="message"]')
    ?.value ?? ""
const submitButton = () => page.getByRole("button", { name: "Submit" })
const stopButton = () => page.getByRole("button", { name: "Stop" })
const composerAttachments = () =>
  document.querySelectorAll('form [data-slot="attachment"]').length
const transcriptAttachments = () =>
  document.querySelectorAll('[data-message-id] [data-slot="attachment"]').length

/**
 * A transport that streams `chunks` with `gapMs` between them and stops
 * feeding once the request is aborted, so Stop is honoured.
 */
function timedTransport(
  chunks: UIMessageChunk[],
  gapMs: number
): ChatTransport<UIMessage> {
  return {
    async sendMessages({ abortSignal }) {
      return new ReadableStream<UIMessageChunk>({
        start(controller) {
          void (async () => {
            try {
              for (const chunk of chunks) {
                if (abortSignal?.aborted) {
                  break
                }
                controller.enqueue(chunk)
                await sleep(gapMs)
              }
              controller.close()
            } catch {
              // The reader was cancelled.
            }
          })()
        },
      })
    },
    async reconnectToStream() {
      return null
    },
  }
}

/** A plain text answer of `lines` paragraphs. */
const textAnswer = (lines: number): UIMessageChunk[] => [
  { type: "start" },
  { type: "text-start", id: "t" },
  ...Array.from({ length: lines }, (_, i) => ({
    type: "text-delta" as const,
    id: "t",
    delta: `Line ${i + 1} of the answer.\n\n`,
  })),
  { type: "text-end", id: "t" },
  { type: "finish" },
]

afterEach(async () => {
  await page.viewport(414, 896)
  vi.restoreAllMocks()
})

/**
 * Collects unhandled promise rejections while `run` executes, so a test can
 * assert there were none (the runtime reports them outside the test).
 */
async function collectUnhandledRejections(
  run: (reasons: unknown[]) => Promise<void>
) {
  const reasons: unknown[] = []
  const capture = (event: PromiseRejectionEvent) => {
    reasons.push(event.reason)
    event.preventDefault()
  }
  window.addEventListener("unhandledrejection", capture)
  try {
    await run(reasons)
  } finally {
    window.removeEventListener("unhandledrejection", capture)
  }
}

describe("Chat", () => {
  it("renders a transcript with user, reasoning, tool and markdown parts and passes axe", async () => {
    const screen = await render(
      <main className="flex h-[900px] flex-col">
        <Chat messages={transcript} onSubmit={() => {}} status="ready" />
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
    await expect.element(screen.getByPlaceholder(PLACEHOLDER)).toBeVisible()
    expect(document.querySelector("[data-slot='chat']")).not.toBeNull()

    await expectNoViolations()
  })

  it("passes axe under dark mode with the full transcript", async () => {
    const screen = await render(
      <main className="flex h-[900px] flex-col">
        <Chat messages={transcript} onSubmit={() => {}} status="ready" />
      </main>
    )
    await expect
      .element(screen.getByRole("heading", { name: "Registry build" }))
      .toBeVisible()
    await withDark(() => expectNoViolations())
  })

  it("forwards className and rest props to the root and placeholder, emptyTitle and emptyDescription to their slots", async () => {
    const screen = await render(
      <main className="flex h-[500px] flex-col">
        <Chat
          className="custom-chat"
          data-testid="root"
          emptyDescription="Custom description"
          emptyTitle="Custom title"
          messages={[]}
          onSubmit={() => {}}
          placeholder="Type here"
          status="ready"
        />
      </main>
    )
    const root = screen.getByTestId("root").element()
    expect(root.getAttribute("data-slot")).toBe("chat")
    expect(root.className).toContain("custom-chat")
    expect(root.className).toContain("flex-col")
    await expect.element(screen.getByText("Custom title")).toBeVisible()
    await expect.element(screen.getByText("Custom description")).toBeVisible()
    await expect.element(screen.getByPlaceholder("Type here")).toBeVisible()
  })

  it("shows suggestions only while the transcript is empty and submits a clicked one as-is", async () => {
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
    await expectNoViolations()

    await screen.rerender(
      <main className="flex h-[600px] flex-col">
        <Chat
          messages={transcript.slice(0, 1)}
          onSubmit={onSubmit}
          status="ready"
          suggestions={["Summarize this repository"]}
        />
      </main>
    )
    await expect
      .element(screen.getByText("What does the registry build do?"))
      .toBeVisible()
    expect(screen.getByText("Start a conversation").query()).toBeNull()
    expect(
      screen.getByRole("button", { name: "Summarize this repository" }).query()
    ).toBeNull()
  })

  it("ignores a suggestion click while a response is in flight", async () => {
    const onSubmit = vi.fn<(message: ChatSubmitMessage) => void>()
    const screen = await render(
      <main className="flex h-[600px] flex-col">
        <Chat
          messages={[]}
          onStop={() => {}}
          onSubmit={onSubmit}
          status="submitted"
          suggestions={["Summarize this repository"]}
        />
      </main>
    )
    await screen
      .getByRole("button", { name: "Summarize this repository" })
      .click()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("reports a rejected onSubmit from a suggestion click through console.error instead of an unhandled rejection", async () => {
    allowConsole("error")
    const consoleError = vi.spyOn(console, "error")
    await collectUnhandledRejections(async (reasons) => {
      const failure = new Error("send failed")
      const screen = await render(
        <main className="flex h-[600px] flex-col">
          <Chat
            messages={[]}
            onSubmit={() => Promise.reject(failure)}
            status="ready"
            suggestions={["Summarize this repository"]}
          />
        </main>
      )
      await screen
        .getByRole("button", { name: "Summarize this repository" })
        .click()
      await expect.poll(() => consoleError).toHaveBeenCalledWith(failure)
      await settled(() => reasons.length, 0)
    })
  })

  it("submits typed text through onSubmit and clears the textarea", async () => {
    const onSubmit = vi.fn<(message: ChatSubmitMessage) => void>()
    const screen = await render(
      <main className="flex h-[600px] flex-col">
        <Chat messages={transcript} onSubmit={onSubmit} status="ready" />
      </main>
    )

    const textarea = screen.getByPlaceholder(PLACEHOLDER)
    await textarea.fill("Where is the build output?")
    await screen.getByRole("button", { name: "Submit" }).click()

    await expect.poll(() => onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
      files: [],
      text: "Where is the build output?",
    })
    await expect.element(textarea).toHaveValue("")
  })

  it("swallows empty and whitespace-only submits from Enter and the button", async () => {
    const onSubmit = vi.fn<(message: ChatSubmitMessage) => void>()
    const screen = await render(
      <main className="flex h-[600px] flex-col">
        <Chat messages={transcript} onSubmit={onSubmit} status="ready" />
      </main>
    )
    const textarea = screen.getByPlaceholder(PLACEHOLDER)
    await screen.getByRole("button", { name: "Submit" }).click()
    await textarea.fill("   \n  ")
    await screen.getByRole("button", { name: "Submit" }).click()
    await textarea.fill("  ")
    await userEvent.keyboard("{Enter}")
    await settled(() => onSubmit.mock.calls.length, 0)
  })

  it("renders a files-only user turn as attachments without an empty bubble", async () => {
    // sendMessage({ text: "", files }) always appends an empty text part.
    const message: UIMessage = {
      id: "u1",
      role: "user",
      parts: [
        {
          type: "file",
          mediaType: "application/pdf",
          url: "https://x/y.pdf",
          filename: "brief.pdf",
        },
        { type: "text", text: "" },
      ],
    }
    const screen = await render(
      <main className="flex h-[600px] flex-col">
        <Chat messages={[message]} onSubmit={() => {}} status="ready" />
      </main>
    )
    await expect.element(screen.getByText("brief.pdf")).toBeVisible()
    expect(document.querySelector("[data-slot='bubble']")).toBeNull()
    expect(document.querySelector("[data-message-id='u1']")).not.toBeNull()
  })

  it("renders system messages as a separator marker and nothing when their text is empty", async () => {
    const messages: UIMessage[] = [
      { id: "s", role: "system", parts: [{ type: "text", text: "Model: x" }] },
      { id: "s-empty", role: "system", parts: [{ type: "step-start" }] },
      {
        id: "a",
        role: "assistant",
        parts: [
          {
            type: "file",
            mediaType: "image/png",
            url: "data:image/png;base64,iVBORw0KGgo=",
          },
          { type: "text", text: "Here is the chart." },
        ],
      },
    ]
    const screen = await render(
      <main className="flex h-[600px] flex-col">
        <Chat messages={messages} onSubmit={() => {}} status="ready" />
      </main>
    )
    await expect.element(screen.getByText("Model: x")).toBeVisible()
    expect(
      document.querySelector("[data-slot='marker'][data-variant='separator']")
    ).not.toBeNull()
    expect(document.querySelector("[data-message-id='s-empty']")).toBeNull()
    // Unnamed image file parts fall back to "Image" for the alt text.
    await expect
      .element(screen.getByRole("img", { name: "Image" }))
      .toBeVisible()
  })

  it("renders no row for a message with nothing to draw yet", async () => {
    const messages: UIMessage[] = [
      { id: "u", role: "user", parts: [{ type: "text", text: "hi" }] },
      {
        id: "a",
        role: "assistant",
        parts: [{ type: "step-start" }, { type: "text", text: " \n" }],
      },
    ]
    const screen = await render(
      <main className="flex h-[600px] flex-col">
        <Chat
          messages={messages}
          onStop={() => {}}
          onSubmit={() => {}}
          status="submitted"
        />
      </main>
    )
    await expect.element(screen.getByText("Thinking…")).toBeVisible()
    expect(document.querySelector("[data-message-id='a']")).toBeNull()
    expect(document.querySelectorAll("[data-message-id]")).toHaveLength(1)
  })

  it("marks the log aria-busy while submitted or streaming only", async () => {
    const screen = await render(
      <main className="flex h-[600px] flex-col">
        <Chat messages={transcript} onSubmit={() => {}} status="ready" />
      </main>
    )
    const log = () => document.querySelector("[role='log']") as HTMLElement
    expect(log().getAttribute("aria-busy")).toBe("false")
    for (const status of allStatuses) {
      await screen.rerender(
        <main className="flex h-[600px] flex-col">
          <Chat
            messages={transcript}
            onStop={() => {}}
            onSubmit={() => {}}
            status={status}
          />
        </main>
      )
      expect(log().getAttribute("aria-busy")).toBe(
        status === "submitted" || status === "streaming" ? "true" : "false"
      )
    }
  })

  it("anchors user rows only and scrolls a new user turn to the top of the viewport", async () => {
    function Transcript() {
      const [messages, setMessages] = useState(longTranscript)
      return (
        <main className="flex h-[500px] flex-col">
          <button
            onClick={() =>
              setMessages((current) => [
                ...current,
                {
                  id: "new-user",
                  role: "user",
                  parts: [{ type: "text", text: "A brand new question" }],
                },
              ])
            }
            type="button"
          >
            append
          </button>
          <Chat messages={messages} onSubmit={() => {}} status="ready" />
        </main>
      )
    }
    const screen = await render(<Transcript />)
    const viewport = messagesViewport()
    await expect.poll(() => distanceFromBottom(viewport)).toBeLessThan(4)
    await expect
      .poll(() => viewport.hasAttribute("data-pending-scroll"))
      .toBe(false)
    await nextFrames(2)
    expect(
      document
        .querySelector("[data-message-id='m0']")
        ?.getAttribute("data-scroll-anchor")
    ).toBe("true")
    expect(
      document
        .querySelector("[data-message-id='m1']")
        ?.getAttribute("data-scroll-anchor")
    ).toBe("false")

    await screen.getByRole("button", { name: "append" }).click()
    const row = () =>
      document.querySelector("[data-message-id='new-user']") as HTMLElement
    await expect.poll(() => row()).not.toBeNull()
    // The scroller keeps a 64px peek of the previous row above the anchor.
    const offset = () =>
      row().getBoundingClientRect().top - viewport.getBoundingClientRect().top
    await expect.poll(offset, { timeout: 3_000 }).toBeLessThanOrEqual(70)
    expect(offset()).toBeGreaterThanOrEqual(0)
    // Anchoring pads the end with a spacer instead of following to the bottom.
    const spacer = document.querySelector(
      "[data-message-scroller-spacer]"
    ) as HTMLElement
    expect(spacer.hidden).toBe(false)
    expect(Number.parseFloat(spacer.style.height)).toBeGreaterThan(0)
  })

  it("shows a thinking marker and a stop button while submitted", async () => {
    const onStop = vi.fn()
    const screen = await render(
      <main className="flex h-[600px] flex-col">
        <Chat
          messages={transcript.slice(0, 1)}
          onStop={onStop}
          onSubmit={() => {}}
          status="submitted"
        />
      </main>
    )

    await expect.element(screen.getByText("Thinking…")).toBeVisible()
    await screen.getByRole("button", { name: "Stop" }).click()
    expect(onStop).toHaveBeenCalledTimes(1)
    await expectNoViolations()
  })

  it("shows the error row with Retry after a failed request and a plain Submit button", async () => {
    const onRetry = vi.fn()
    const screen = await render(
      <main className="flex h-[600px] flex-col">
        <Chat
          error={new Error("Upstream exploded")}
          messages={transcript.slice(0, 1)}
          onRetry={onRetry}
          onSubmit={() => {}}
          status="error"
        />
      </main>
    )
    const alert = screen.getByRole("alert")
    await expect.element(alert).toBeVisible()
    expect(alert.element().textContent).toContain("Upstream exploded")
    await screen.getByRole("button", { name: "Retry" }).click()
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(screen.getByText("Thinking…").query()).toBeNull()

    const submit = screen.getByRole("button", { name: "Submit" })
    await expect.element(submit).toBeVisible()
    expect(
      submit.element().querySelector("svg[class*='corner-down-left']")
    ).not.toBeNull()
    expect(submit.element().querySelector("svg[class*='lucide-x']")).toBeNull()
    await expectNoViolations()
    await withDark(() => expectNoViolations())

    await screen.rerender(
      <main className="flex h-[600px] flex-col">
        <Chat
          error={new Error("Upstream exploded")}
          messages={transcript.slice(0, 1)}
          onSubmit={() => {}}
          status="error"
        />
      </main>
    )
    await expect.element(screen.getByRole("alert")).toBeVisible()
    expect(screen.getByRole("button", { name: "Retry" }).query()).toBeNull()
  })

  it("passes axe at 375px with the long demo suggestion and does not overflow horizontally", async () => {
    await page.viewport(375, 700)
    const screen = await render(
      <main className="flex h-svh flex-col p-4">
        <Chat
          messages={[]}
          onSubmit={() => {}}
          status="ready"
          suggestions={[
            ...demoSuggestions,
            "A second, also rather long suggestion",
          ]}
        />
      </main>
    )
    await expect
      .element(screen.getByRole("button", { name: openingQuestion }))
      .toBeInTheDocument()
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(375)
    // The suggestion strip overflows here; Base UI's viewport becomes a tab stop.
    const viewport = document.querySelector(
      "[data-slot='scroll-area-viewport']"
    ) as HTMLElement
    expect(viewport.scrollWidth).toBeGreaterThan(viewport.clientWidth)
    expect(viewport.getAttribute("tabindex")).toBe("0")
    await expectNoViolations()
  })

  it("passes axe at 375px with a wide code block and a tool call in the transcript", async () => {
    await page.viewport(375, 700)
    const messages: UIMessage[] = [
      { id: "u", role: "user", parts: [{ type: "text", text: "Show me" }] },
      {
        id: "a",
        role: "assistant",
        parts: [
          {
            type: "tool-readFile",
            toolCallId: "c",
            state: "output-available",
            input: {
              path: "a/very/long/path/that/keeps/going/and/going/forever.tsx",
            },
            output: { ok: true },
          },
          {
            type: "text",
            text: "```ts\nconst reallyLongIdentifierName = anotherReallyLongFunctionName(withArguments, andMore, andEvenMore)\n```",
          },
        ],
      },
    ]
    const screen = await render(
      <main className="flex h-svh flex-col p-4">
        <Chat messages={messages} onSubmit={() => {}} status="ready" />
      </main>
    )
    await expect.element(screen.getByText("Show me")).toBeVisible()
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(375)
    await expect
      .poll(() =>
        document
          .querySelector("[data-streamdown='code-block-body']")
          ?.getAttribute("tabindex")
      )
      .toBe("0")
    await expectNoViolations()
  })

  it("keeps the Messages viewport as the only vertical scroll container in a constrained parent", async () => {
    const screen = await render(
      <main className="flex h-[500px] flex-col">
        <Chat messages={longTranscript} onSubmit={() => {}} status="ready" />
      </main>
    )
    const viewport = screen
      .getByRole("region", { name: "Messages" })
      .element() as HTMLElement
    await expect
      .poll(() => viewport.scrollHeight > viewport.clientHeight)
      .toBe(true)
    expect(document.documentElement.scrollHeight).toBeLessThanOrEqual(
      window.innerHeight
    )
    const nested = [...viewport.querySelectorAll<HTMLElement>("*")].filter(
      (el) => {
        const style = getComputedStyle(el)
        return (
          (style.overflowY === "auto" || style.overflowY === "scroll") &&
          el.scrollHeight > el.clientHeight
        )
      }
    )
    expect(nested).toEqual([])
  })
})

describe("ChatMessagePart", () => {
  it("renders every UI part type in the ai union without crashing or leaking raw objects", async () => {
    const parts: ChatMessagePartType[] = [
      { type: "step-start" },
      {
        type: "source-url",
        sourceId: "s1",
        url: "https://example.com",
        title: "Example",
      },
      {
        type: "source-document",
        sourceId: "s2",
        mediaType: "text/markdown",
        title: "Doc",
      },
      { type: "file", mediaType: "application/pdf", url: "https://x/y.pdf" },
      {
        type: "file",
        mediaType: "image/png",
        url: "data:image/png;base64,iVBORw0KGgo=",
        filename: "shot.png",
      },
      { type: "reasoning-file", mediaType: "text/plain", url: "data:," },
      { type: "reasoning", text: "", state: "streaming" },
      { type: "text", text: "partial **bo", state: "streaming" },
      { type: "text", text: "All done.", state: "done" },
      { type: "custom", kind: "openai.thing" },
      { type: "data-weather", data: { temp: 18 } },
      {
        type: "dynamic-tool",
        toolName: "lookup",
        toolCallId: "c2",
        state: "approval-requested",
        input: { q: 1 },
        approval: { id: "a1" },
      },
      {
        type: "dynamic-tool",
        toolName: "lookup",
        toolCallId: "c3",
        state: "output-denied",
        input: { q: 1 },
        approval: { id: "a2", approved: false },
      },
      {
        type: "tool-lookup",
        toolCallId: "c4",
        state: "output-available",
        input: { q: 1 },
        output: "plain string output",
      },
      {
        type: "tool-search",
        toolCallId: "c5",
        state: "input-streaming",
        input: undefined,
      },
      {
        type: "tool-search",
        toolCallId: "c6",
        state: "output-error",
        input: undefined,
        rawInput: '{"q": "unterminated',
        errorText: "Invalid tool input",
      },
    ]
    const screen = await render(
      <main>
        <Boundary>
          <div data-testid="parts">
            {parts.map((part, i) => (
              <ChatMessagePart
                // biome-ignore lint/suspicious/noArrayIndexKey: static fixture
                key={i}
                part={part}
                status="streaming"
                {...assistantRole}
              />
            ))}
          </div>
        </Boundary>
      </main>
    )
    expect(screen.getByTestId("crash").query()).toBeNull()
    const text = screen.getByTestId("parts").element().textContent ?? ""
    expect(text).not.toContain("[object Object]")
    expect(text).not.toContain("undefined")
    await expect.element(screen.getByText("Awaiting Approval")).toBeVisible()
    await expect.element(screen.getByText("Denied")).toBeVisible()
    await expect.element(screen.getByText("Completed")).toBeVisible()
    await expect.element(screen.getByText("Pending")).toBeVisible()
    await expect.element(screen.getByText("Invalid tool input")).toBeVisible()
    await expect.element(screen.getByText("All done.")).toBeVisible()
    // Streaming reasoning with empty text still shows the shimmer trigger.
    await expect
      .element(screen.getByRole("button", { name: /Thinking/ }))
      .toBeVisible()
    expect(document.querySelector("[data-slot='bubble']")).toBeNull()
    await expectNoViolations()
  })

  it("renders streaming text through incomplete-markdown parsing", async () => {
    const screen = await render(
      <main>
        <ChatMessagePart
          part={{ type: "text", text: "partial **bo", state: "streaming" }}
          {...assistantRole}
        />
      </main>
    )
    const strong = screen.getByText("bo")
    await expect.element(strong).toBeVisible()
    expect(strong.element().getAttribute("data-streamdown")).toBe("strong")
    expect(document.body.textContent).not.toContain("**")
  })

  it("renders user text in a bubble and nothing for whitespace-only text", async () => {
    const screen = await render(
      <main>
        <ChatMessagePart
          part={{ type: "text", text: "hello\nthere" }}
          {...userRole}
        />
        <ChatMessagePart part={{ type: "text", text: " \n\t" }} {...userRole} />
        <ChatMessagePart
          part={{ type: "text", text: " \n\t" }}
          {...assistantRole}
        />
      </main>
    )
    await expect.element(screen.getByText("hello there")).toBeVisible()
    expect(document.querySelectorAll("[data-slot='bubble']")).toHaveLength(1)
    expect(
      document.querySelectorAll("[data-slot='message-response']")
    ).toHaveLength(0)
  })

  it("streams a reasoning part while the chat streams and settles it once the chat is no longer generating", async () => {
    const part: ChatMessagePartType = {
      type: "reasoning",
      text: "Considering the options.",
      state: "streaming",
    }
    const screen = await render(
      <main>
        <ChatMessagePart part={part} status="streaming" {...assistantRole} />
      </main>
    )
    await expect
      .element(screen.getByRole("button", { name: /Thinking/ }))
      .toBeVisible()

    // Stop leaves the part marked streaming; the block settles it by status.
    await screen.rerender(
      <main>
        <ChatMessagePart part={part} status="ready" {...assistantRole} />
      </main>
    )
    await expect
      .element(screen.getByRole("button", { name: /Thought for/ }))
      .toBeVisible()
    expect(screen.getByRole("button", { name: /Thinking/ }).query()).toBeNull()

    // Without a status the part's own state decides.
    await screen.rerender(
      <main>
        <ChatMessagePart part={part} {...assistantRole} />
      </main>
    )
    await expect
      .element(screen.getByRole("button", { name: /Thinking/ }))
      .toBeVisible()
  })

  it("settles stale streaming parts of earlier messages while a new response streams", async () => {
    // Stop leaves the first answer's parts marked streaming and running.
    const messages: UIMessage[] = [
      { id: "u1", role: "user", parts: [{ type: "text", text: "one" }] },
      {
        id: "a1",
        role: "assistant",
        parts: [
          { type: "reasoning", text: "old thought", state: "streaming" },
          {
            type: "tool-readFile",
            toolCallId: "c1",
            state: "input-available",
            input: { path: "x" },
          },
        ],
      },
      { id: "u2", role: "user", parts: [{ type: "text", text: "two" }] },
      {
        id: "a2",
        role: "assistant",
        parts: [
          { type: "reasoning", text: "new thought", state: "streaming" },
          {
            type: "tool-readFile",
            toolCallId: "c2",
            state: "input-available",
            input: { path: "y" },
          },
        ],
      },
    ]
    const screen = await render(
      <main className="flex h-[700px] flex-col">
        <Chat
          messages={messages}
          onStop={() => {}}
          onSubmit={() => {}}
          status="streaming"
        />
      </main>
    )
    await expect
      .element(screen.getByRole("button", { name: /Thinking/ }))
      .toBeVisible()
    await expect
      .element(screen.getByRole("button", { name: /Thought for/ }))
      .toBeVisible()
    const headers = screen.getByRole("button", { name: /readFile/ })
    await expect.poll(() => headers.elements().length).toBe(2)
    expect(headers.elements().map((el) => el.textContent)).toEqual([
      "readFilePending",
      "readFileRunning",
    ])
  })

  it("shows a done reasoning part as Thought for", async () => {
    const screen = await render(
      <main>
        <ChatMessagePart
          part={{ type: "reasoning", text: "Done thinking.", state: "done" }}
          status="ready"
          {...assistantRole}
        />
      </main>
    )
    await expect
      .element(screen.getByRole("button", { name: /Thought for/ }))
      .toBeVisible()
  })

  it("shows an inline error row for a part that throws and retries it when its state changes", async () => {
    allowConsole("error")
    // A persisted message with a malformed part must not take the chat down.
    const broken = {
      type: "text",
      text: 42,
      state: "streaming",
    } as unknown as ChatMessagePartType
    const messages: UIMessage[] = [
      { id: "u", role: "user", parts: [{ type: "text", text: "hi" }] },
      {
        id: "a",
        role: "assistant",
        parts: [{ type: "text", text: "Still here.", state: "done" }, broken],
      },
    ]
    const screen = await render(
      <main className="flex h-[600px] flex-col">
        <Boundary>
          <Chat messages={messages} onSubmit={() => {}} status="ready" />
        </Boundary>
      </main>
    )
    expect(screen.getByTestId("crash").query()).toBeNull()
    await expect.element(screen.getByText("hi")).toBeVisible()
    await expect.element(screen.getByText("Still here.")).toBeVisible()
    const alert = screen.getByRole("alert")
    await expect.element(alert).toBeVisible()
    expect(alert.element().textContent).toContain(
      "Could not render the text part"
    )
    await expect.element(screen.getByPlaceholder(PLACEHOLDER)).toBeVisible()
    await expectNoViolations()

    const fixed: UIMessage[] = [
      messages[0] as UIMessage,
      {
        id: "a",
        role: "assistant",
        parts: [
          { type: "text", text: "Still here.", state: "done" },
          { type: "text", text: "Recovered text.", state: "done" },
        ],
      },
    ]
    await screen.rerender(
      <main className="flex h-[600px] flex-col">
        <Boundary>
          <Chat messages={fixed} onSubmit={() => {}} status="ready" />
        </Boundary>
      </main>
    )
    await expect.element(screen.getByText("Recovered text.")).toBeVisible()
    expect(screen.getByRole("alert").query()).toBeNull()
  })
})

describe("ChatToolPart", () => {
  const toolStates = [
    ["approval-requested", "Awaiting Approval"],
    ["approval-responded", "Responded"],
    ["input-available", "Running"],
    ["input-streaming", "Pending"],
    ["output-available", "Completed"],
    ["output-denied", "Denied"],
    ["output-error", "Error"],
  ] as const

  function partFor(
    state: (typeof toolStates)[number][0],
    dynamic: boolean
  ): ChatMessagePartType {
    const base = dynamic
      ? { type: "dynamic-tool" as const, toolName: "lookup", toolCallId: "c" }
      : { type: "tool-lookup" as const, toolCallId: "c" }
    switch (state) {
      case "approval-requested":
        return { ...base, state, input: { q: 1 }, approval: { id: "a" } }
      case "approval-responded":
        return {
          ...base,
          state,
          input: { q: 1 },
          approval: { id: "a", approved: true },
        }
      case "input-available":
        return { ...base, state, input: { q: 1 } }
      case "input-streaming":
        return { ...base, state, input: { q: 1 } }
      case "output-available":
        return { ...base, state, input: { q: 1 }, output: { ok: true } }
      case "output-denied":
        return {
          ...base,
          state,
          input: { q: 1 },
          approval: { id: "a", approved: false },
        }
      case "output-error":
        return { ...base, state, input: { q: 1 }, errorText: "boom" }
    }
  }

  it("renders every state with its label for static and dynamic tools while streaming", async () => {
    for (const dynamic of [false, true]) {
      for (const [state, label] of toolStates) {
        const part = partFor(state, dynamic)
        if (!("toolCallId" in part)) throw new Error("tool part expected")
        const screen = await render(
          <main>
            <ChatToolPart part={part} status="streaming" />
          </main>
        )
        const header = screen.getByRole("button", { name: /lookup/ })
        await expect.element(header).toBeVisible()
        expect(header.element().textContent).toContain(label)
        await expect
          .element(header)
          .toHaveAttribute(
            "aria-expanded",
            state === "output-error" ? "true" : "false"
          )
        await screen.unmount()
      }
    }
  })

  it("shows the tool item's No input yet placeholder while input-streaming with no input yet", async () => {
    // The SDK creates exactly this part on `tool-input-start`, before any delta.
    const screen = await render(
      <main>
        <Boundary>
          <ChatToolPart
            part={{
              type: "tool-search",
              toolCallId: "call-1",
              state: "input-streaming",
              input: undefined,
            }}
            status="streaming"
          />
        </Boundary>
      </main>
    )
    await screen.getByRole("button", { name: /search/ }).click()
    expect(screen.getByTestId("crash").query()).toBeNull()
    await expect.element(screen.getByText("Parameters")).toBeVisible()
    await expect.element(screen.getByText("No input yet")).toBeVisible()
    await expectNoViolations()
  })

  it("shows a partial input while it streams", async () => {
    const screen = await render(
      <main>
        <ChatToolPart
          part={{
            type: "tool-search",
            toolCallId: "call-1",
            state: "input-streaming",
            input: { q: "unfin" },
          }}
          status="streaming"
        />
      </main>
    )
    await screen.getByRole("button", { name: /search/ }).click()
    await expect.element(screen.getByText("Parameters")).toBeVisible()
    await expect
      .element(screen.getByText("unfin", { exact: false }))
      .toBeVisible()
    expect(screen.getByText("No input yet").query()).toBeNull()
  })

  it("shows the raw input as text when a call errored before its input parsed", async () => {
    // `tool-input-error` writes state "output-error" with input undefined and
    // rawInput for static tools; the card opens by default.
    const screen = await render(
      <main>
        <Boundary>
          <ChatToolPart
            part={{
              type: "tool-search",
              toolCallId: "call-1",
              state: "output-error",
              input: undefined,
              rawInput: '{"q": "unterminated',
              errorText: "Invalid tool input",
            }}
            status="ready"
          />
        </Boundary>
      </main>
    )
    expect(screen.getByTestId("crash").query()).toBeNull()
    await expect.element(screen.getByText("Raw input")).toBeVisible()
    await expect.element(screen.getByText('{"q": "unterminated')).toBeVisible()
    await expect.element(screen.getByText("Invalid tool input")).toBeVisible()
    await expect
      .element(screen.getByRole("button", { name: /search/ }))
      .toHaveAttribute("aria-expanded", "true")
    await expectNoViolations()
  })

  it("lets title override the derived name for static and dynamic tools", async () => {
    const screen = await render(
      <main>
        <ChatToolPart
          part={{
            type: "tool-readFile",
            toolCallId: "c1",
            state: "output-available",
            input: {},
            output: "x",
            title: "Read a file",
          }}
        />
        <ChatToolPart
          part={{
            type: "dynamic-tool",
            toolName: "lookup",
            toolCallId: "c2",
            state: "input-available",
            input: {},
          }}
        />
      </main>
    )
    await expect
      .element(screen.getByRole("button", { name: /Read a file/ }))
      .toBeVisible()
    expect(screen.getByText("readFile").query()).toBeNull()
    await expect
      .poll(
        () =>
          screen.getByRole("button", { name: /lookup/ }).element().textContent
      )
      .toContain("Running")
  })

  it("shows a call still marked running as Pending once the chat is no longer generating", async () => {
    const part: ChatMessagePartType = {
      type: "tool-readFile",
      toolCallId: "c1",
      state: "input-available",
      input: { path: "x" },
    }
    if (!("toolCallId" in part)) throw new Error("tool part expected")
    const screen = await render(
      <main>
        <ChatToolPart part={part} status="streaming" />
      </main>
    )
    const header = screen.getByRole("button", { name: /readFile/ })
    await expect.poll(() => header.element().textContent).toContain("Running")
    for (const status of ["ready", "error"] as const) {
      await screen.rerender(
        <main>
          <ChatToolPart part={part} status={status} />
        </main>
      )
      await expect.poll(() => header.element().textContent).toContain("Pending")
      expect(header.element().textContent).not.toContain("Running")
    }
    await screen.rerender(
      <main>
        <ChatToolPart part={part} />
      </main>
    )
    await expect.poll(() => header.element().textContent).toContain("Running")
  })

  it("shows exactly one 'No input yet' placeholder while the input is still undefined", async () => {
    const part = {
      type: "tool-read_file",
      toolCallId: "call_1",
      state: "input-streaming",
      input: undefined,
    } as ToolUIPart
    const screen = await render(
      <main>
        <ChatToolPart part={part} status="streaming" />
      </main>
    )
    const trigger = screen.getByRole("button", { name: /read_file/ })
    await userEvent.click(trigger)
    await expect.element(screen.getByText("Parameters")).toBeVisible()
    expect(screen.getByText("No input yet").elements()).toHaveLength(1)
    expect(screen.getByText(/Streaming input/).query()).toBeNull()
    await expectNoViolations()
  })

  it("shows a stopped call as Pending with the same single placeholder", async () => {
    const part = {
      type: "tool-read_file",
      toolCallId: "call_1",
      state: "input-available",
      input: undefined,
    } as ToolUIPart
    const screen = await render(
      <main>
        <ChatToolPart part={part} status="ready" />
      </main>
    )
    await expect.element(screen.getByText("Pending")).toBeVisible()
    await userEvent.click(screen.getByRole("button", { name: /read_file/ }))
    await expect.element(screen.getByText("Parameters")).toBeVisible()
    expect(screen.getByText("No input yet").elements()).toHaveLength(1)
    await expectNoViolations()
  })
})

describe("ChatAttachments", () => {
  it("renders files by kind, removes by index, and needs no remove handler", async () => {
    const onRemove = vi.fn()
    const files = [
      { type: "file" as const, mediaType: "text/plain", url: "data:,x" },
      {
        type: "file" as const,
        mediaType: "image/png",
        url: "data:image/png;base64,iVBORw0KGgo=",
        filename: "pic.png",
      },
      { type: "file" as const, mediaType: "text/plain", url: "data:,x" },
    ]
    const screen = await render(
      <main>
        <ChatAttachments files={files} onRemove={onRemove} />
      </main>
    )
    await expect.element(screen.getByText("File").first()).toBeVisible()
    await expect.element(screen.getByText("text/plain").first()).toBeVisible()
    await expect
      .element(screen.getByRole("img", { name: "pic.png" }))
      .toBeVisible()
    expect(document.querySelectorAll("[data-slot='attachment']")).toHaveLength(
      3
    )
    await screen.getByRole("button", { name: "Remove pic.png" }).click()
    expect(onRemove).toHaveBeenCalledWith(1)
    await expectNoViolations()

    await screen.rerender(
      <main>
        <ChatAttachments files={files} />
      </main>
    )
    expect(screen.getByRole("button").query()).toBeNull()
  })
})

describe("ChatThinkingMarker and ChatErrorMarker", () => {
  it("falls back to Something went wrong. when the error message is empty", async () => {
    const screen = await render(
      <main className="flex h-[400px] flex-col">
        <Chat
          error={new Error("")}
          messages={transcript.slice(0, 1)}
          onSubmit={() => {}}
          status="error"
        />
      </main>
    )
    await expect
      .poll(() => screen.getByRole("alert").element().textContent)
      .toContain("Something went wrong.")
  })

  it("shows a generic error row with Retry when status is error and no error object is given", async () => {
    const onRetry = vi.fn()
    const screen = await render(
      <main className="flex h-[500px] flex-col">
        <Chat
          messages={transcript.slice(0, 1)}
          onRetry={onRetry}
          onStop={() => {}}
          onSubmit={() => {}}
          status="error"
        />
      </main>
    )
    const alert = screen.getByRole("alert")
    await expect.element(alert).toBeVisible()
    expect(alert.element().textContent).toContain("Something went wrong.")
    await screen.getByRole("button", { name: "Retry" }).click()
    expect(onRetry).toHaveBeenCalledTimes(1)
    await expectNoViolations()

    // An explicit error message wins over the generic line.
    await screen.rerender(
      <main className="flex h-[500px] flex-col">
        <Chat
          error={new Error("Upstream exploded")}
          messages={transcript.slice(0, 1)}
          onSubmit={() => {}}
          status="error"
        />
      </main>
    )
    await expect
      .poll(() => screen.getByRole("alert").element().textContent)
      .toContain("Upstream exploded")
    expect(screen.getByRole("alert").element().textContent).not.toContain(
      "Something went wrong."
    )
  })

  it("reports a rejected onRetry through console.error instead of an unhandled rejection", async () => {
    allowConsole("error")
    const consoleError = vi.spyOn(console, "error")
    await collectUnhandledRejections(async (reasons) => {
      // regenerate() rejects like this when the transcript is empty.
      const failure = new Error("message undefined not found")
      const screen = await render(
        <main className="flex h-[500px] flex-col">
          <Chat
            error={new Error("Could not resume the stream")}
            messages={[]}
            onRetry={() => Promise.reject(failure)}
            onSubmit={() => {}}
            status="error"
          />
        </main>
      )
      await screen.getByRole("button", { name: "Retry" }).click()
      await expect.poll(() => consoleError).toHaveBeenCalledWith(failure)
      await settled(() => reasons.length, 0)
    })
  })

  it("renders ChatErrorMarker standalone inside a MessageScroller with className forwarded and a working Retry", async () => {
    const onRetry = vi.fn()
    const screen = await render(
      <main className="flex h-[300px] flex-col">
        <MessageScrollerProvider>
          <MessageScroller>
            <MessageScrollerViewport>
              <MessageScrollerContent>
                <ChatErrorMarker
                  className="custom-row"
                  error={new Error("boom")}
                  onRetry={onRetry}
                />
              </MessageScrollerContent>
            </MessageScrollerViewport>
          </MessageScroller>
        </MessageScrollerProvider>
      </main>
    )
    const alert = screen.getByRole("alert")
    await expect.element(alert).toBeVisible()
    expect(alert.element().textContent).toContain("boom")
    expect(alert.element().closest(".custom-row")).not.toBeNull()
    await screen.getByRole("button", { name: "Retry" }).click()
    expect(onRetry).toHaveBeenCalledTimes(1)
    await expectNoViolations()
  })

  it("throws a clear error outside a MessageScrollerProvider", async () => {
    allowConsole("error")
    const screen = await render(
      <Boundary>
        <ChatThinkingMarker />
      </Boundary>
    )
    await expect
      .element(screen.getByTestId("crash"))
      .toHaveTextContent(
        "MessageScrollerItem must be used within a MessageScroller."
      )
    await screen.unmount()
    const second = await render(
      <Boundary>
        <ChatErrorMarker error={new Error("x")} />
      </Boundary>
    )
    await expect
      .element(second.getByTestId("crash"))
      .toHaveTextContent(
        "MessageScrollerItem must be used within a MessageScroller."
      )
  })

  it("shows the default Thinking… marker with an aria-hidden spinner and shimmer text", async () => {
    const screen = await render(
      <main className="flex h-[400px] flex-col">
        <Chat
          messages={transcript.slice(0, 1)}
          onStop={() => {}}
          onSubmit={() => {}}
          status="submitted"
        />
      </main>
    )
    const marker = screen.getByText("Thinking…")
    await expect.element(marker).toBeVisible()
    expect(marker.element().className).toContain("shimmer")
    const icon = document.querySelector("[data-slot='marker-icon']")
    expect(icon?.getAttribute("aria-hidden")).toBe("true")
    expect(icon?.querySelector("svg")?.getAttribute("class")).toContain(
      "animate-spin"
    )
  })

  it("renders custom ChatThinkingMarker children in the shimmer slot with the spinner", async () => {
    const screen = await render(
      <main className="flex h-[300px] flex-col">
        <MessageScrollerProvider>
          <MessageScroller>
            <MessageScrollerViewport>
              <MessageScrollerContent>
                <ChatThinkingMarker className="custom-row">
                  Searching the docs…
                </ChatThinkingMarker>
              </MessageScrollerContent>
            </MessageScrollerViewport>
          </MessageScroller>
        </MessageScrollerProvider>
      </main>
    )
    const marker = screen.getByText("Searching the docs…")
    await expect.element(marker).toBeVisible()
    expect(marker.element().className).toContain("shimmer")
    expect(marker.element().closest(".custom-row")).not.toBeNull()
    expect(screen.getByText("Thinking…").query()).toBeNull()
    const icon = document.querySelector("[data-slot='marker-icon']")
    expect(icon?.getAttribute("aria-hidden")).toBe("true")
    expect(icon?.querySelector("svg.animate-spin")).not.toBeNull()
    await expectNoViolations()
  })
})

describe("ChatEmpty", () => {
  it("works standalone with custom copy and renders no buttons without suggestions", async () => {
    const onClick = vi.fn()
    const screen = await render(
      <main>
        <ChatEmpty
          description="Custom description"
          onSuggestionClick={onClick}
          suggestions={["One"]}
          title="Custom title"
        />
      </main>
    )
    await expect.element(screen.getByText("Custom title")).toBeVisible()
    await expect.element(screen.getByText("Custom description")).toBeVisible()
    await screen.getByRole("button", { name: "One" }).click()
    expect(onClick).toHaveBeenCalledWith("One")
    await expectNoViolations()

    await screen.rerender(
      <main>
        <ChatEmpty suggestions={[]} />
      </main>
    )
    await expect.element(screen.getByText("Start a conversation")).toBeVisible()
    expect(screen.getByRole("button").query()).toBeNull()
  })
})

describe("ChatComposer", () => {
  it("keeps the draft and submits nothing on Enter while a response is in flight", async () => {
    for (const status of ["submitted", "streaming"] as const) {
      const onSubmit = vi.fn<(message: ChatSubmitMessage) => void>()
      const screen = await render(
        <main>
          <ChatComposer onStop={() => {}} onSubmit={onSubmit} status={status} />
        </main>
      )
      const textarea = screen.getByPlaceholder(PLACEHOLDER)
      await textarea.fill("interrupting")
      await userEvent.keyboard("{Enter}")
      await settled(() => onSubmit.mock.calls.length, 0)
      await expect.element(textarea).toHaveValue("interrupting")
      await expect
        .element(screen.getByRole("button", { name: "Stop" }))
        .toBeVisible()
      await screen.unmount()
    }
  })

  it("keeps the draft on Enter while generating when no onStop is wired, so the block's own guard carries it", async () => {
    // Without onStop the prompt-input button stays a submit button, so Enter
    // reaches the block's keydown guard rather than being blocked upstream.
    const onSubmit = vi.fn<(message: ChatSubmitMessage) => void>()
    const screen = await render(
      <main>
        <ChatComposer onSubmit={onSubmit} status="streaming" />
      </main>
    )
    // The keydown guard stops Enter before the form is submitted at all, so
    // the form never resets (PromptInput's `false` handling would otherwise
    // restore the draft after a reset).
    const formEvents: string[] = []
    const record = (event: Event) => formEvents.push(event.type)
    formEl().addEventListener("submit", record)
    formEl().addEventListener("reset", record)
    const textarea = screen.getByPlaceholder(PLACEHOLDER)
    await textarea.fill("interrupting")
    await userEvent.keyboard("{Enter}")
    await settled(() => onSubmit.mock.calls.length, 0)
    await expect.element(textarea).toHaveValue("interrupting")
    expect(formEvents).toEqual([])
  })

  it("still inserts a newline on Shift+Enter while a response streams", async () => {
    const screen = await render(
      <main>
        <ChatComposer
          onStop={() => {}}
          onSubmit={() => {}}
          status="streaming"
        />
      </main>
    )
    const textarea = screen.getByPlaceholder(PLACEHOLDER)
    await textarea.fill("line one")
    await userEvent.keyboard("{Shift>}{Enter}{/Shift}line two")
    await expect.element(textarea).toHaveValue("line one\nline two")
  })

  it("keeps the draft when the button is clicked while generating without an onStop", async () => {
    const onSubmit = vi.fn<(message: ChatSubmitMessage) => void>()
    const screen = await render(
      <main>
        <ChatComposer onSubmit={onSubmit} status="streaming" />
      </main>
    )
    const textarea = screen.getByPlaceholder(PLACEHOLDER)
    await textarea.fill("still typing")
    // Without onStop the button cannot stop anything, so it keeps its Submit
    // name while generating; the composer swallows the submit.
    await screen.getByRole("button", { name: "Submit" }).click()
    await settled(() => onSubmit.mock.calls.length, 0)
    await expect.element(textarea).toHaveValue("still typing")
  })

  it("keeps the draft and the attachments when a programmatic form submit is rejected while generating", async () => {
    const onSubmit = vi.fn<(message: ChatSubmitMessage) => void>()
    const screen = await render(
      <main>
        <ChatComposer
          onStop={() => {}}
          onSubmit={onSubmit}
          status="streaming"
        />
      </main>
    )
    await screen.getByPlaceholder(PLACEHOLDER).fill("queued")
    chooseFiles([makeFile("notes.txt")])
    await expect
      .element(screen.getByRole("button", { name: "Remove notes.txt" }))
      .toBeVisible()
    formEl().requestSubmit()
    await settled(() => onSubmit.mock.calls.length, 0)
    expect(textareaValue()).toBe("queued")
    expect(composerAttachments()).toBe(1)
    await expect
      .element(screen.getByRole("button", { name: "Remove notes.txt" }))
      .toBeVisible()

    // Once ready, the same submit goes through with the kept draft and file.
    await screen.rerender(
      <main>
        <ChatComposer onStop={() => {}} onSubmit={onSubmit} status="ready" />
      </main>
    )
    formEl().requestSubmit()
    await expect.poll(() => onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0]?.[0].text).toBe("queued")
    expect(onSubmit.mock.calls[0]?.[0].files.map((f) => f.filename)).toEqual([
      "notes.txt",
    ])
    await expect.poll(composerAttachments).toBe(0)
  })

  it("disables nothing inside the input group in any status", async () => {
    for (const status of allStatuses) {
      const screen = await render(
        <main>
          <ChatComposer onStop={() => {}} onSubmit={() => {}} status={status} />
        </main>
      )
      expect(
        document.querySelector("[data-slot='input-group'] :disabled")
      ).toBeNull()
      await screen.unmount()
    }
  })

  it("inserts a newline on Shift+Enter and removes the last attachment on Backspace in an empty textarea", async () => {
    const onSubmit = vi.fn<(message: ChatSubmitMessage) => void>()
    const screen = await render(
      <main>
        <ChatComposer onSubmit={onSubmit} status="ready" />
      </main>
    )
    const textarea = screen.getByPlaceholder(PLACEHOLDER)
    await textarea.fill("line one")
    await userEvent.keyboard("{Shift>}{Enter}{/Shift}")
    await userEvent.keyboard("line two")
    await expect.element(textarea).toHaveValue("line one\nline two")
    expect(onSubmit).not.toHaveBeenCalled()

    const input = document.querySelector(
      "input[type='file']"
    ) as HTMLInputElement
    const dt = new DataTransfer()
    dt.items.add(new File(["hello"], "notes.txt", { type: "text/plain" }))
    input.files = dt.files
    input.dispatchEvent(new Event("change", { bubbles: true }))
    await expect.element(screen.getByText("notes.txt")).toBeVisible()

    await textarea.fill("")
    await userEvent.keyboard("{Backspace}")
    await expect.element(screen.getByText("notes.txt")).not.toBeInTheDocument()
  })

  it("shows a plain Submit button after an error instead of an X", async () => {
    const onSubmit = vi.fn<(message: ChatSubmitMessage) => void>()
    const screen = await render(
      <main>
        <ChatComposer onStop={() => {}} onSubmit={onSubmit} status="error" />
      </main>
    )
    const submit = screen.getByRole("button", { name: "Submit" })
    await expect.element(submit).toBeVisible()
    expect(submit.element().getAttribute("type")).toBe("submit")
    expect(
      submit.element().querySelector("svg[class*='corner-down-left']")
    ).not.toBeNull()
    await screen.getByPlaceholder(PLACEHOLDER).fill("try again")
    await submit.click()
    await expect.poll(() => onSubmit).toHaveBeenCalledTimes(1)
  })

  it("hands the composer's files through onSubmit as FileUIParts (no id) and shows a removable preview first", async () => {
    const onSubmit = vi.fn<(message: ChatSubmitMessage) => void>()
    const screen = await render(
      <main>
        <ChatComposer onSubmit={onSubmit} status="ready" />
      </main>
    )
    const input = document.querySelector(
      "input[type='file']"
    ) as HTMLInputElement
    const file = new File(["hello"], "notes.txt", { type: "text/plain" })
    const dt = new DataTransfer()
    dt.items.add(file)
    input.files = dt.files
    input.dispatchEvent(new Event("change", { bubbles: true }))

    await expect.element(screen.getByText("notes.txt")).toBeVisible()
    await expect
      .element(screen.getByRole("button", { name: "Remove notes.txt" }))
      .toBeVisible()
    await expectNoViolations()

    await screen.getByRole("button", { name: "Submit" }).click()
    await expect.poll(() => onSubmit).toHaveBeenCalledTimes(1)
    const sent = onSubmit.mock.calls[0]?.[0]
    expect(sent?.text).toBe("")
    expect(sent?.files).toHaveLength(1)
    expect(sent?.files[0]).toMatchObject({
      type: "file",
      filename: "notes.txt",
      mediaType: "text/plain",
    })
    expect(sent?.files[0]?.url.startsWith("data:")).toBe(true)
    expect("id" in (sent?.files[0] ?? {})).toBe(false)
    await expect.element(screen.getByText("notes.txt")).not.toBeInTheDocument()
  })
})

describe("ChatComposer onSubmit", () => {
  it("reports a rejected onSubmit through console.error instead of an unhandled rejection", async () => {
    allowConsole("error")
    const consoleError = vi.spyOn(console, "error")
    await collectUnhandledRejections(async (reasons) => {
      const failure = new Error("send failed")
      await render(
        <main>
          <ChatComposer
            onSubmit={() => Promise.reject(failure)}
            status="ready"
          />
        </main>
      )
      await page.getByRole("textbox", { name: "Message" }).fill("hello")
      await userEvent.keyboard("{Enter}")
      await expect.poll(() => consoleError).toHaveBeenCalledWith(failure)
      await settled(() => reasons.length, 0)
      // Not awaited, so the composer cleared as soon as the message was sent.
      expect(textareaValue()).toBe("")
    })
  })

  it("keeps the draft and the attachments and reports it through console.error when onSubmit throws synchronously", async () => {
    allowConsole("error")
    const consoleError = vi.spyOn(console, "error")
    const failure = new Error("not wired")
    await render(
      <main>
        <ChatComposer
          onSubmit={() => {
            throw failure
          }}
          status="ready"
        />
      </main>
    )
    chooseFiles([makeFile("notes.txt")])
    await expect.poll(composerAttachments).toBe(1)
    await page.getByRole("textbox", { name: "Message" }).fill("hello")
    await userEvent.keyboard("{Enter}")
    await expect.poll(() => consoleError).toHaveBeenCalledWith(failure)
    await expect.poll(textareaValue).toBe("hello")
    expect(composerAttachments()).toBe(1)
  })

  it("carries an attachment through exactly one submit when a second submit lands during the blob conversion", async () => {
    let open = () => {}
    const gate = new Promise<void>((resolve) => {
      open = resolve
    })
    vi.spyOn(window, "fetch").mockImplementation(async () => {
      await gate
      return new Response(new Blob(["x"], { type: "text/plain" }))
    })
    const onSubmit = vi.fn<(message: ChatSubmitMessage) => void>()
    await render(
      <main>
        <ChatComposer onSubmit={onSubmit} status="ready" />
      </main>
    )
    chooseFiles([makeFile("once.txt")])
    await expect.poll(composerAttachments).toBe(1)
    await page.getByRole("textbox", { name: "Message" }).fill("hi")

    // A double press: the second submit arrives while the first is reading
    // the file as a data URL, and carries nothing, so the block drops it.
    formEl().requestSubmit()
    formEl().requestSubmit()
    open()

    await expect.poll(() => onSubmit).toHaveBeenCalledTimes(1)
    await settled(() => onSubmit.mock.calls.length, 1)
    expect(onSubmit.mock.calls[0]?.[0].text).toBe("hi")
    expect(
      onSubmit.mock.calls[0]?.[0].files.map((file) => file.filename)
    ).toEqual(["once.txt"])
    await expect.poll(composerAttachments).toBe(0)
  })
})

describe("through useChat", () => {
  it("drives the scripted demo end to end, then falls back", async () => {
    // The console guard in tests/setup.ts fails the test on any error or warning.
    const statuses: ChatStatus[] = []
    const screen = await render(
      <Demo
        onStatus={(status) => {
          if (statuses.at(-1) !== status) statuses.push(status)
        }}
      />
    )
    const log = () => document.querySelector("[role='log']") as HTMLElement

    // Empty state, then the suggestion is submitted as-is.
    await expect.element(screen.getByText("Start a conversation")).toBeVisible()
    expect(log().getAttribute("aria-busy")).toBe("false")
    await screen.getByRole("button", { name: openingQuestion }).click()
    await expect.element(screen.getByText(openingQuestion)).toBeVisible()
    expect(screen.getByText("Start a conversation").query()).toBeNull()

    // While submitted (the script sleeps 600ms before `start`): marker + stop.
    await expect.element(screen.getByText("Thinking…")).toBeVisible()
    expect(log().getAttribute("aria-busy")).toBe("true")
    await expect
      .element(screen.getByRole("button", { name: "Stop" }))
      .toBeVisible()
    expect(screen.getByRole("button", { name: "Submit" }).query()).toBeNull()

    // Reasoning streams open with the shimmer, the tool completes, markdown lands.
    const reasoning = screen.getByRole("button", { name: /Thinking/ })
    await expect.element(reasoning, { timeout: 5_000 }).toBeVisible()
    await expect.element(reasoning).toHaveAttribute("aria-expanded", "true")
    expect(
      document.querySelector("[data-slot='marker-content'].shimmer")
    ).toBeNull()
    const tool = screen.getByRole("button", { name: /readFile/ })
    await expect.element(tool, { timeout: 10_000 }).toBeVisible()
    await expect
      .poll(() => tool.element().textContent, { timeout: 5_000 })
      .toContain("Completed")
    await expect
      .element(screen.getByText("Then:"), { timeout: 20_000 })
      .toBeVisible()
    expect(screen.getByText("Thinking…").query()).toBeNull()

    // Composer re-enables; the reasoning settled with a duration.
    const submit = screen.getByRole("button", { name: "Submit" })
    await expect.element(submit, { timeout: 10_000 }).toBeVisible()
    await expect
      .element(screen.getByRole("button", { name: /Thought for/ }))
      .toBeVisible()
    expect(statuses).toEqual(["ready", "submitted", "streaming", "ready"])
    expect(log().getAttribute("aria-busy")).toBe("false")

    // The viewport followed the stream to the bottom.
    const viewport = messagesViewport()
    await expect
      .poll(() => viewport.scrollHeight > viewport.clientHeight)
      .toBe(true)
    await expect
      .poll(() => distanceFromBottom(viewport), { timeout: 3_000 })
      .toBeLessThan(4)

    // Second turn: any text gets the second scripted answer.
    const textarea = screen.getByPlaceholder(PLACEHOLDER)
    await textarea.fill("Shorter please")
    await userEvent.keyboard("{Enter}")
    await expect.element(textarea).toHaveValue("")
    await expect
      .element(screen.getByText(/Define it under/), { timeout: 20_000 })
      .toBeVisible()
    await expect
      .element(screen.getByRole("button", { name: "Submit" }), {
        timeout: 10_000,
      })
      .toBeVisible()

    // Third turn: script exhausted, fallback text streams instead of throwing.
    await textarea.fill("And again?")
    await userEvent.keyboard("{Enter}")
    await expect
      .element(screen.getByText(/end of the scripted demo/), {
        timeout: 20_000,
      })
      .toBeVisible()
    await expect
      .element(screen.getByRole("button", { name: "Submit" }), {
        timeout: 10_000,
      })
      .toBeVisible()
    await expect
      .poll(() => distanceFromBottom(viewport), { timeout: 3_000 })
      .toBeLessThan(4)
    await expectNoViolations()
  }, 90_000)

  it("stop mid-reasoning settles the trigger and returns the composer to ready", async () => {
    const screen = await render(<Demo />)
    await screen.getByPlaceholder(PLACEHOLDER).fill("go")
    await userEvent.keyboard("{Enter}")
    await expect
      .element(screen.getByRole("button", { name: /Thinking/ }), {
        timeout: 10_000,
      })
      .toBeVisible()
    await screen.getByRole("button", { name: "Stop" }).click()
    await expect
      .element(screen.getByRole("button", { name: "Submit" }), {
        timeout: 5_000,
      })
      .toBeVisible()
    await expect
      .element(screen.getByRole("button", { name: /Thought for/ }), {
        timeout: 5_000,
      })
      .toBeVisible()
    expect(screen.getByRole("button", { name: /Thinking/ }).query()).toBeNull()
    // Nothing from later in the script arrives after stop (the tool output
    // would have followed within 900 ms).
    await settled(
      () =>
        screen.getByText("Then:").query() === null &&
        screen.getByRole("button", { name: /readFile/ }).query() === null,
      true,
      1_500
    )
  }, 30_000)

  it("stop mid-tool leaves the tool header settled rather than Running", async () => {
    const screen = await render(<Demo />)
    await screen.getByPlaceholder(PLACEHOLDER).fill("go")
    await userEvent.keyboard("{Enter}")
    const tool = screen.getByRole("button", { name: /readFile/ })
    await expect.element(tool, { timeout: 15_000 }).toBeVisible()
    // The script sleeps 900 ms between the call and its output.
    await expect.poll(() => tool.element().textContent).toContain("Running")
    await screen.getByRole("button", { name: "Stop" }).click()
    await expect
      .element(screen.getByRole("button", { name: "Submit" }), {
        timeout: 5_000,
      })
      .toBeVisible()
    await expect.poll(() => tool.element().textContent).toContain("Pending")
    expect(tool.element().textContent).not.toContain("Running")
    await settled(
      () =>
        !tool.element().textContent?.includes("Completed") &&
        screen.getByText("Then:").query() === null,
      true,
      1_500
    )
  }, 30_000)

  it("ignores Enter mid-stream: one response, unique ids, no duplicate-key errors, draft kept", async () => {
    // A duplicate key would reach the console guard as a React error.
    let latest: UIMessage[] = []
    const screen = await render(
      <Demo
        onMessages={(messages) => {
          latest = messages
        }}
      />
    )
    const textarea = screen.getByPlaceholder(PLACEHOLDER)
    await textarea.fill("first")
    await userEvent.keyboard("{Enter}")
    await expect
      .element(screen.getByRole("button", { name: /Thinking/ }), {
        timeout: 10_000,
      })
      .toBeVisible()
    await textarea.fill("second")
    await userEvent.keyboard("{Enter}")
    await expect.element(textarea).toHaveValue("second")
    await expect
      .element(screen.getByRole("button", { name: "Submit" }), {
        timeout: 20_000,
      })
      .toBeVisible()
    await settled(() => latest.length, 2)
    const ids = latest.map((message) => message.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(latest.map((message) => message.role)).toEqual(["user", "assistant"])
    await expect.element(textarea).toHaveValue("second")
  }, 40_000)

  it("surfaces a transport error as a row whose Retry regenerates the response", async () => {
    const { transport: flaky, triggers } = failingOnceTransport()
    const statuses: ChatStatus[] = []
    const screen = await render(
      <Demo
        chatTransport={flaky}
        height={600}
        onStatus={(status) => {
          if (statuses.at(-1) !== status) statuses.push(status)
        }}
        probe={({ error }) => (
          <span data-testid="hook-error">{error?.message}</span>
        )}
      />
    )
    await screen.getByPlaceholder(PLACEHOLDER).fill("hi")
    await userEvent.keyboard("{Enter}")
    await expect
      .element(screen.getByTestId("hook-error"), { timeout: 10_000 })
      .toHaveTextContent("Upstream exploded")
    expect(statuses.at(-1)).toBe("error")
    const alert = screen.getByRole("alert")
    await expect.element(alert).toBeVisible()
    expect(alert.element().textContent).toContain("Upstream exploded")
    expect(screen.getByText("Thinking…").query()).toBeNull()
    expect(document.querySelectorAll("[data-message-id]")).toHaveLength(1)
    const submit = screen.getByRole("button", { name: "Submit" })
    await expect.element(submit).toBeVisible()
    expect(submit.element().querySelector("svg[class*='lucide-x']")).toBeNull()
    await expectNoViolations()

    await screen.getByRole("button", { name: "Retry" }).click()
    await expect
      .element(screen.getByText("Recovered."), { timeout: 10_000 })
      .toBeVisible()
    expect(screen.getByRole("alert").query()).toBeNull()
    await expect.element(screen.getByTestId("hook-error")).toHaveTextContent("")
    expect(triggers).toEqual(["submit-message", "regenerate-message"])
    expect(statuses).toEqual([
      "ready",
      "submitted",
      "error",
      "submitted",
      "streaming",
      "ready",
    ])
  }, 30_000)

  it("keeps the thinking marker up through start/start-step with no empty assistant row", async () => {
    // Real backends emit `start` and `start-step` before the model's first
    // token; the SDK leaves status "submitted" until a text/reasoning delta.
    const slow = createChat({ messageIdPrefix: "gap" })
      .user("hi")
      .assistant(({ writer }) => {
        writer.stepStart()
        writer.sleep(1_200)
        writer.text("finally", { mode: "instant" })
      })
      .transport({ delayMs: 0 })
    let latest: UIMessage[] = []
    const screen = await render(
      <Demo
        chatTransport={slow}
        height={600}
        onMessages={(messages) => {
          latest = messages
        }}
      />
    )
    await screen.getByPlaceholder(PLACEHOLDER).fill("hi")
    await userEvent.keyboard("{Enter}")
    // Inside the gap: the assistant message exists (step-start only) but draws nothing.
    await expect.poll(() => latest.length).toBe(2)
    await expect.element(screen.getByText("Thinking…")).toBeVisible()
    expect(document.querySelectorAll("[data-message-id]")).toHaveLength(1)
    await expect
      .element(screen.getByText("finally"), { timeout: 5_000 })
      .toBeVisible()
    expect(screen.getByText("Thinking…").query()).toBeNull()
    expect(document.querySelectorAll("[data-message-id]")).toHaveLength(2)
  }, 20_000)

  it("clears sent files from the composer once the message is sent, not when the answer ends", async () => {
    const screen = await render(
      <Demo chatTransport={timedTransport(textAnswer(20), 100)} height={600} />
    )
    chooseFiles([makeFile("notes.txt")])
    await expect
      .element(screen.getByRole("button", { name: "Remove notes.txt" }))
      .toBeVisible()
    await screen.getByPlaceholder(PLACEHOLDER).fill("hi")
    await userEvent.keyboard("{Enter}")
    await expect.element(stopButton()).toBeVisible()
    await expect.poll(transcriptAttachments).toBe(1)
    expect(composerAttachments()).toBe(0)
    expect(
      screen.getByRole("button", { name: "Remove notes.txt" }).query()
    ).toBeNull()
  })

  it("keeps a file attached while the previous answer streams", async () => {
    const screen = await render(
      <Demo chatTransport={timedTransport(textAnswer(15), 100)} height={600} />
    )
    await screen.getByPlaceholder(PLACEHOLDER).fill("hi")
    await userEvent.keyboard("{Enter}")
    await expect.element(stopButton()).toBeVisible()
    chooseFiles([makeFile("later.txt")])
    await expect
      .element(screen.getByRole("button", { name: "Remove later.txt" }))
      .toBeVisible()
    await expect.element(submitButton(), { timeout: 10_000 }).toBeVisible()
    await settled(composerAttachments, 1)
    await expect
      .element(screen.getByRole("button", { name: "Remove later.txt" }))
      .toBeVisible()
  }, 20_000)

  it("settles the partial answer after a mid-stream error and shows the error row with Retry and a plain Submit", async () => {
    const chunks: UIMessageChunk[] = [
      { type: "start" },
      { type: "reasoning-start", id: "r" },
      { type: "reasoning-delta", id: "r", delta: "thinking hard" },
      { type: "tool-input-start", toolCallId: "c1", toolName: "readFile" },
      {
        type: "tool-input-available",
        toolCallId: "c1",
        toolName: "readFile",
        input: { path: "x" },
      },
      { type: "error", errorText: "Upstream exploded" },
    ]
    const screen = await render(
      <Demo chatTransport={timedTransport(chunks, 30)} height={600} />
    )
    await screen.getByPlaceholder(PLACEHOLDER).fill("go")
    await userEvent.keyboard("{Enter}")
    const alert = screen.getByRole("alert")
    await expect.element(alert, { timeout: 5_000 }).toBeVisible()
    expect(alert.element().textContent).toContain("Upstream exploded")
    await expect
      .element(screen.getByRole("button", { name: /Thought for/ }))
      .toBeVisible()
    const tool = screen.getByRole("button", { name: /readFile/ })
    await expect.poll(() => tool.element().textContent).toContain("Pending")
    await expect.element(submitButton()).toBeVisible()
    await expect
      .element(screen.getByRole("button", { name: "Retry" }))
      .toBeVisible()
    await expectNoViolations()
  })

  it.each([
    [1280, 800],
    [375, 812],
  ])(
    "follows the stream to the bottom at %ix%i and anchors the next user turn near the top",
    async (width, height) => {
      await page.viewport(width, height)
      const screen = await render(
        <Demo
          chatTransport={timedTransport(textAnswer(60), 10)}
          height={height - 120}
        />
      )
      await screen.getByPlaceholder(PLACEHOLDER).fill("first")
      await userEvent.keyboard("{Enter}")
      await expect.element(submitButton(), { timeout: 15_000 }).toBeVisible()
      const viewport = messagesViewport()
      await expect
        .poll(() => viewport.scrollHeight > viewport.clientHeight)
        .toBe(true)
      await expect
        .poll(() => distanceFromBottom(viewport), { timeout: 3_000 })
        .toBeLessThan(4)

      await screen.getByPlaceholder(PLACEHOLDER).fill("second")
      await userEvent.keyboard("{Enter}")
      const anchors = () =>
        document.querySelectorAll<HTMLElement>(
          "[data-message-id][data-scroll-anchor='true']"
        )
      await expect.poll(() => anchors().length).toBe(2)
      const second = anchors()[1] as HTMLElement
      const offset = () =>
        second.getBoundingClientRect().top -
        viewport.getBoundingClientRect().top
      await expect.poll(offset, { timeout: 3_000 }).toBeLessThanOrEqual(70)
      expect(offset()).toBeGreaterThanOrEqual(0)
      await expect.element(submitButton(), { timeout: 15_000 }).toBeVisible()
      await expect
        .poll(() => distanceFromBottom(viewport), { timeout: 3_000 })
        .toBeLessThan(4)
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width)
    },
    40_000
  )
})

describe("exports and helpers", () => {
  it("ChatMessage needs a MessageScrollerProvider and says so", async () => {
    allowConsole("error")
    const screen = await render(
      <Boundary>
        <ChatMessage
          message={{
            id: "x",
            role: "user",
            parts: [{ type: "text", text: "hi" }],
          }}
        />
      </Boundary>
    )
    await expect
      .element(screen.getByTestId("crash"))
      .toHaveTextContent(
        "MessageScrollerItem must be used within a MessageScroller."
      )
  })

  it("demo helpers: get(1) is the opening question and getMessageText joins text parts only", () => {
    expect(demoSuggestions).toEqual([
      "How do I add a new color token to this design system?",
    ])
    expect(demoConversation.get(1)[0]?.role).toBe("user")
    expect(demoConversation.get()).toHaveLength(4)
    expect(demoConversation.get().map((message) => message.id)).toEqual([
      "demo-message-1",
      "demo-message-2",
      "demo-message-3",
      "demo-message-4",
    ])
    expect(
      getMessageText({
        id: "n",
        role: "assistant",
        parts: [{ type: "step-start" }],
      })
    ).toBe("")
    expect(
      getMessageText({
        id: "n",
        role: "assistant",
        parts: [
          { type: "reasoning", text: "no", state: "done" },
          { type: "text", text: "a" },
          { type: "step-start" },
          { type: "text", text: "b" },
        ],
      })
    ).toBe("ab")
    expect(getMessageText(demoConversation.next([]) as UIMessage)).toBe(
      openingQuestion
    )
  })
})
