import axe from "axe-core"
import { describe, expect, it, vi } from "vitest"
import { userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionAddScreenshot,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputBody,
  PromptInputFooter,
  type PromptInputMessage,
  type PromptInputProps,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/registry/ai/prompt-input"
import "@/app/globals.css"

const models = [
  { label: "Claude Sonnet 4", value: "claude-sonnet-4" },
  { label: "GPT-5", value: "gpt-5" },
]

/** Let enter/exit animations finish so axe samples final colors. */
const settleAnimations = () =>
  Promise.all(document.getAnimations().map((animation) => animation.finished))

// Rendered inside <main> so axe's page-level "region" rule sees a landmark,
// as it would on any real page.
function Composer({
  onSubmit,
  status = "ready",
  onStop,
}: {
  onSubmit: PromptInputProps["onSubmit"]
  status?: "ready" | "streaming"
  onStop?: () => void
}) {
  return (
    <main>
      <PromptInput onSubmit={onSubmit}>
        <PromptInputBody>
          <PromptInputTextarea />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputTools>
            <PromptInputActionMenu>
              <PromptInputActionMenuTrigger aria-label="Add attachment" />
              <PromptInputActionMenuContent>
                <PromptInputActionAddAttachments />
                <PromptInputActionAddScreenshot />
              </PromptInputActionMenuContent>
            </PromptInputActionMenu>
            <PromptInputSelect defaultValue={models[0].value} items={models}>
              <PromptInputSelectTrigger aria-label="Model">
                <PromptInputSelectValue />
              </PromptInputSelectTrigger>
              <PromptInputSelectContent>
                {models.map((model) => (
                  <PromptInputSelectItem key={model.value} value={model.value}>
                    {model.label}
                  </PromptInputSelectItem>
                ))}
              </PromptInputSelectContent>
            </PromptInputSelect>
          </PromptInputTools>
          <PromptInputSubmit onStop={onStop} status={status} />
        </PromptInputFooter>
      </PromptInput>
    </main>
  )
}

describe("prompt-input", () => {
  it("renders an accessible composer", async () => {
    const screen = await render(<Composer onSubmit={() => {}} />)
    await expect
      .element(screen.getByPlaceholder("What would you like to know?"))
      .toBeVisible()
    await expect
      .element(screen.getByRole("button", { name: "Submit" }))
      .toBeVisible()
    await expect
      .element(screen.getByRole("button", { name: "Add attachment" }))
      .toBeVisible()
    // `items` on the select root lets Base UI's Select.Value render the label.
    await expect
      .element(screen.getByRole("combobox", { name: "Model" }))
      .toBeVisible()
    await expect.element(screen.getByText("Claude Sonnet 4")).toBeVisible()
    await settleAnimations()
    const results = await axe.run(document.body)
    expect(results.violations).toEqual([])
  })

  it("submits the typed message and clears the textarea", async () => {
    const onSubmit = vi.fn<(message: PromptInputMessage) => void>()
    const screen = await render(<Composer onSubmit={onSubmit} />)
    const textarea = screen.getByPlaceholder("What would you like to know?")
    await textarea.fill("Hello there")
    await screen.getByRole("button", { name: "Submit" }).click()
    await expect.poll(() => onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
      files: [],
      text: "Hello there",
    })
    await expect.element(textarea).toHaveValue("")
  })

  it("submits on Enter and keeps Shift+Enter as a newline", async () => {
    const onSubmit = vi.fn<(message: PromptInputMessage) => void>()
    const screen = await render(<Composer onSubmit={onSubmit} />)
    const textarea = screen.getByPlaceholder("What would you like to know?")
    await textarea.click()
    await userEvent.keyboard("line one{Shift>}{Enter}{/Shift}line two")
    await expect.element(textarea).toHaveValue("line one\nline two")
    expect(onSubmit).not.toHaveBeenCalled()
    await userEvent.keyboard("{Enter}")
    await expect.poll(() => onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0]?.[0].text).toBe("line one\nline two")
  })

  it("opens the action menu with the attachment actions", async () => {
    const screen = await render(<Composer onSubmit={() => {}} />)
    await screen.getByRole("button", { name: "Add attachment" }).click()
    await expect
      .element(screen.getByRole("menuitem", { name: "Add photos or files" }))
      .toBeVisible()
    await expect
      .element(screen.getByRole("menuitem", { name: "Take screenshot" }))
      .toBeVisible()
    await settleAnimations()
    // The menu popup is portaled to <body>, outside every landmark by design,
    // so axe's page-structure "region" best-practice rule does not apply here.
    const results = await axe.run(document.body, {
      rules: { region: { enabled: false } },
    })
    expect(results.violations).toEqual([])
  })

  it("shows a stop button while streaming", async () => {
    const onStop = vi.fn()
    const screen = await render(
      <Composer onStop={onStop} onSubmit={() => {}} status="streaming" />
    )
    const stop = screen.getByRole("button", { name: "Stop" })
    await expect.element(stop).toBeVisible()
    await stop.click()
    expect(onStop).toHaveBeenCalledTimes(1)
    await settleAnimations()
    const results = await axe.run(document.body)
    expect(results.violations).toEqual([])
  })
})
