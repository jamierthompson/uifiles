/**
 * Server rendering. Every registry/ai file is a client component, and Next
 * renders client components on the server too, so a module-level or
 * render-time `window`/`document` access breaks `/preview/<name>` and every
 * consumer page. Rendering to a string in this node project catches that;
 * the browser project never can.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { createElement as h, type ReactNode } from "react"
import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"

type Case = [name: string, render: () => ReactNode]

/**
 * Resolves to a getter that returns the module, or rethrows the error it
 * failed to load with, so a module that cannot load on the server (a
 * module-level `window` access) still fails only its own case.
 */
function loaded<T>(module: Promise<T>): Promise<() => T> {
  return module.then(
    (m) => () => m,
    (error: unknown) => () => {
      throw error
    }
  )
}

// Imported once while the file loads, before any test starts: a cold
// transform takes seconds under full-suite load and would otherwise count
// against the first case's 5 s timeout.
const [
  branch,
  chainOfThought,
  checkpoint,
  codeBlock,
  confirmation,
  context,
  image,
  inlineCitation,
  modelSelector,
  plan,
  promptInput,
  queue,
  reasoning,
  response,
  sources,
  suggestion,
  task,
  tool,
  chat,
] = await Promise.all([
  loaded(import("@/registry/ai/branch")),
  loaded(import("@/registry/ai/chain-of-thought")),
  loaded(import("@/registry/ai/checkpoint")),
  loaded(import("@/registry/ai/code-block")),
  loaded(import("@/registry/ai/confirmation")),
  loaded(import("@/registry/ai/context")),
  loaded(import("@/registry/ai/image")),
  loaded(import("@/registry/ai/inline-citation")),
  loaded(import("@/registry/ai/model-selector")),
  loaded(import("@/registry/ai/plan")),
  loaded(import("@/registry/ai/prompt-input")),
  loaded(import("@/registry/ai/queue")),
  loaded(import("@/registry/ai/reasoning")),
  loaded(import("@/registry/ai/response")),
  loaded(import("@/registry/ai/sources")),
  loaded(import("@/registry/ai/suggestion")),
  loaded(import("@/registry/ai/task")),
  loaded(import("@/registry/ai/tool")),
  loaded(import("@/registry/blocks/chat/components/blocks/chat")),
])

const cases: Case[] = [
  [
    "branch",
    () => {
      const m = branch()
      return h(
        m.MessageBranch,
        null,
        h(
          m.MessageBranchContent,
          null,
          h("p", { key: "a" }, "First"),
          h("p", { key: "b" }, "Second")
        ),
        h(
          m.MessageBranchSelector,
          null,
          h(m.MessageBranchPrevious),
          h(m.MessageBranchPage),
          h(m.MessageBranchNext)
        )
      )
    },
  ],
  [
    "chain-of-thought",
    () => {
      const m = chainOfThought()
      return h(
        m.ChainOfThought,
        { defaultOpen: true },
        h(m.ChainOfThoughtHeader, null, "Investigating"),
        h(
          m.ChainOfThoughtContent,
          null,
          h(m.ChainOfThoughtStep, { label: "Step one", status: "complete" })
        )
      )
    },
  ],
  [
    "checkpoint",
    () => {
      const m = checkpoint()
      return h(
        m.Checkpoint,
        null,
        h(m.CheckpointIcon),
        h(m.CheckpointTrigger, { tooltip: "Restore" }, "Checkpoint 1")
      )
    },
  ],
  [
    "code-block",
    () => {
      const m = codeBlock()
      return h(
        m.CodeBlock,
        {
          code: "const a = 1",
          language: "typescript",
          showLineNumbers: true,
        },
        h(
          m.CodeBlockHeader,
          null,
          h(m.CodeBlockTitle, null, h(m.CodeBlockFilename, null, "a.ts")),
          h(m.CodeBlockActions, null, h(m.CodeBlockCopyButton))
        )
      )
    },
  ],
  [
    "confirmation",
    () => {
      const m = confirmation()
      return h(
        m.Confirmation,
        { approval: { id: "c", approved: true }, state: "output-available" },
        h(
          m.ConfirmationTitle,
          null,
          h(m.ConfirmationAccepted, null, "Approved")
        )
      )
    },
  ],
  [
    "context",
    () => {
      const m = context()
      return h(
        m.Context,
        { maxTokens: 1000, usedTokens: 400, modelId: "openai:gpt-4o" },
        h(m.ContextTrigger),
        h(
          m.ContextContent,
          null,
          h(m.ContextContentHeader),
          h(m.ContextContentBody, null, h(m.ContextInputUsage)),
          h(m.ContextContentFooter)
        )
      )
    },
  ],
  [
    "image",
    () => {
      const m = image()
      return h(m.Image, {
        alt: "pixel",
        base64: "iVBORw0KGgo=",
        mediaType: "image/png",
        uint8Array: new Uint8Array(),
      })
    },
  ],
  [
    "inline-citation",
    () => {
      const m = inlineCitation()
      return h(
        m.InlineCitation,
        null,
        h(m.InlineCitationText, null, "Cited"),
        h(
          m.InlineCitationCard,
          null,
          h(m.InlineCitationCardTrigger, { sources: ["https://a.dev/x"] }),
          h(
            m.InlineCitationCardBody,
            null,
            h(
              m.InlineCitationCarousel,
              null,
              h(
                m.InlineCitationCarouselContent,
                null,
                h(
                  m.InlineCitationCarouselItem,
                  null,
                  h(m.InlineCitationSource, {
                    title: "A",
                    url: "https://a.dev/x",
                  })
                )
              )
            )
          )
        )
      )
    },
  ],
  [
    "model-selector",
    () => {
      const m = modelSelector()
      return h(
        m.ModelSelector,
        null,
        h(m.ModelSelectorTrigger, null, "GPT-4o"),
        h(
          m.ModelSelectorContent,
          null,
          h(m.ModelSelectorInput, { placeholder: "Search" }),
          h(
            m.ModelSelectorList,
            null,
            h(
              m.ModelSelectorGroup,
              { heading: "OpenAI" },
              h(
                m.ModelSelectorItem,
                { value: "gpt-4o" },
                h(m.ModelSelectorLogo, { provider: "openai" }),
                h(m.ModelSelectorName, null, "GPT-4o")
              )
            )
          )
        )
      )
    },
  ],
  [
    "plan",
    () => {
      const m = plan()
      return h(
        m.Plan,
        { defaultOpen: true },
        h(
          m.PlanHeader,
          null,
          h(m.PlanTitle, null, "Plan"),
          h(m.PlanAction, null, h(m.PlanTrigger))
        ),
        h(m.PlanContent, null, "Steps")
      )
    },
  ],
  [
    "prompt-input",
    () => {
      const m = promptInput()
      return h(
        m.PromptInput,
        { onSubmit: () => {} },
        h(m.PromptInputBody, null, h(m.PromptInputTextarea)),
        h(
          m.PromptInputFooter,
          null,
          h(m.PromptInputTools),
          h(m.PromptInputSubmit, { status: "ready" })
        )
      )
    },
  ],
  [
    "queue",
    () => {
      const m = queue()
      return h(
        m.Queue,
        null,
        h(
          m.QueueSection,
          null,
          h(
            m.QueueSectionTrigger,
            null,
            h(m.QueueSectionLabel, { count: 1, label: "tasks" })
          ),
          h(
            m.QueueSectionContent,
            null,
            h(
              m.QueueList,
              null,
              h(m.QueueItem, null, h(m.QueueItemContent, null, "Do it"))
            )
          )
        )
      )
    },
  ],
  [
    "reasoning",
    () => {
      const m = reasoning()
      return h(
        m.Reasoning,
        { duration: 2, defaultOpen: true },
        h(m.ReasoningTrigger),
        h(m.ReasoningContent, null, "Thinking **hard**.")
      )
    },
  ],
  [
    "response",
    () => {
      const m = response()
      return h(
        m.MessageResponse,
        null,
        "Hello **world**\n\n```ts\nconst a = 1\n```"
      )
    },
  ],
  [
    "sources",
    () => {
      const m = sources()
      return h(
        m.Sources,
        null,
        h(m.SourcesTrigger, { count: 1 }),
        h(
          m.SourcesContent,
          null,
          h(m.Source, { href: "https://a.dev", title: "A" })
        )
      )
    },
  ],
  [
    "suggestion",
    () => {
      const m = suggestion()
      return h(
        m.Suggestions,
        null,
        h(m.Suggestion, { suggestion: "Summarize" })
      )
    },
  ],
  [
    "task",
    () => {
      const m = task()
      return h(
        m.Task,
        { defaultOpen: true },
        h(m.TaskTrigger, { title: "Scanning" }),
        h(
          m.TaskContent,
          null,
          h(m.TaskItem, null, "Reading ", h(m.TaskItemFile, null, "a.ts"))
        )
      )
    },
  ],
  [
    "tool",
    () => {
      const m = tool()
      return h(
        m.Tool,
        { defaultOpen: true },
        h(m.ToolHeader, {
          state: "output-available",
          type: "tool-get_weather",
        }),
        h(
          m.ToolContent,
          null,
          h(m.ToolInput, { input: { city: "Melbourne" } }),
          h(m.ToolOutput, { errorText: undefined, output: { temp: 18 } })
        )
      )
    },
  ],
  [
    "chat (block)",
    () => {
      const m = chat()
      return h(m.Chat, {
        messages: [
          {
            id: "u1",
            role: "user",
            parts: [{ type: "text", text: "Hi" }],
          },
          {
            id: "a1",
            role: "assistant",
            parts: [
              { type: "reasoning", text: "Think", state: "done" },
              {
                type: "tool-readFile",
                toolCallId: "c1",
                state: "output-available",
                input: { path: "x" },
                output: { ok: true },
              },
              {
                type: "text",
                text: "## Hello\n\n```ts\nconst a = 1\n```",
                state: "done",
              },
            ],
          },
        ],
        onSubmit: () => {},
        status: "ready",
        suggestions: ["One"],
      })
    },
  ],
]

describe("registry components render on the server (renderToString, node env)", () => {
  it.each(cases)(
    "%s renders to a non-empty string without throwing",
    (_name, make) => {
      expect(typeof window).toBe("undefined")
      const html = renderToString(make())
      expect(html.length).toBeGreaterThan(0)
    }
  )
})

describe("prompt-input on the server", () => {
  it("starts with the port header and the use client directive", () => {
    const source = readFileSync(
      join(process.cwd(), "registry/ai/prompt-input.tsx"),
      "utf8"
    )
    const lines = source.split("\n")
    expect(lines[0]).toMatch(
      /^\/\/ Derived from Vercel AI Elements prompt-input\.tsx/
    )
    expect(lines[2]).toBe('"use client"')
  })

  it("renders the composer with menu, select and stop button to a string without touching browser globals", () => {
    const m = promptInput()
    const models = [{ label: "Claude Sonnet 4", value: "claude-sonnet-4" }]
    const model = models[0]
    if (!model) throw new Error("fixture")
    expect(typeof window).toBe("undefined")
    const html = renderToString(
      h(
        m.PromptInput,
        { onSubmit: () => {} },
        h(m.PromptInputBody, null, h(m.PromptInputTextarea)),
        h(
          m.PromptInputFooter,
          null,
          h(
            m.PromptInputTools,
            null,
            h(
              m.PromptInputActionMenu,
              null,
              h(m.PromptInputActionMenuTrigger, {
                "aria-label": "Add attachment",
              }),
              h(
                m.PromptInputActionMenuContent,
                null,
                h(m.PromptInputActionAddAttachments)
              )
            ),
            h(
              m.PromptInputSelect,
              { defaultValue: model.value, items: models },
              h(
                m.PromptInputSelectTrigger,
                { "aria-label": "Model" },
                h(m.PromptInputSelectValue)
              ),
              h(
                m.PromptInputSelectContent,
                null,
                h(m.PromptInputSelectItem, { value: model.value }, model.label)
              )
            )
          ),
          h(m.PromptInputSubmit, { status: "streaming", onStop: () => {} })
        )
      )
    )
    expect(html).toContain('name="message"')
    expect(html).toContain('type="file"')
    expect(html).toContain("Claude Sonnet 4")
    expect(html).toContain('aria-label="Stop"')
    expect(html).toContain('type="button"')
  })
})
