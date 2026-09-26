import axe from "axe-core"
import { expect, it, vi } from "vitest"
import { userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockCopyButton,
  CodeBlockFilename,
  CodeBlockHeader,
  CodeBlockLanguageSelector,
  CodeBlockLanguageSelectorContent,
  CodeBlockLanguageSelectorItem,
  CodeBlockLanguageSelectorTrigger,
  CodeBlockLanguageSelectorValue,
  CodeBlockTitle,
} from "@/registry/ai/code-block"
import "@/app/globals.css"

const code = `const greeting: string = "hello"
console.log(greeting)`

const languages = { typescript: "TypeScript", javascript: "JavaScript" }

it("highlights TypeScript with shiki once it loads", async () => {
  const screen = await render(
    <main>
      <CodeBlock code={code} language="typescript" showLineNumbers />
    </main>
  )
  // Before shiki resolves each line is a single raw span; after highlighting
  // `const` becomes its own token.
  await expect
    .element(screen.getByText("const", { exact: true }))
    .toBeInTheDocument()
  await expect
    .element(screen.getByText("greeting", { exact: true }).first())
    .toBeInTheDocument()
  expect(document.querySelector("[data-language='typescript']")).not.toBeNull()

  const results = await axe.run(document.body)
  expect(results.violations).toEqual([])
})

it("copies the code to the clipboard", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  })
  const onCopy = vi.fn()

  const screen = await render(
    <CodeBlock code={code} language="typescript">
      <CodeBlockHeader>
        <CodeBlockTitle>
          <CodeBlockFilename>greeting.ts</CodeBlockFilename>
        </CodeBlockTitle>
        <CodeBlockActions>
          <CodeBlockCopyButton aria-label="Copy code" onCopy={onCopy} />
        </CodeBlockActions>
      </CodeBlockHeader>
    </CodeBlock>
  )

  await userEvent.click(screen.getByRole("button", { name: "Copy code" }))
  await vi.waitFor(() => expect(onCopy).toHaveBeenCalledTimes(1))
  expect(writeText).toHaveBeenCalledWith(code)
})

it("switches language through the selector", async () => {
  const onValueChange = vi.fn()

  const screen = await render(
    <main>
      <CodeBlock code={code} language="typescript">
        <CodeBlockHeader>
          <CodeBlockTitle>
            <CodeBlockFilename>greeting.ts</CodeBlockFilename>
          </CodeBlockTitle>
          <CodeBlockActions>
            <CodeBlockLanguageSelector
              defaultValue="typescript"
              items={languages}
              onValueChange={onValueChange}
            >
              <CodeBlockLanguageSelectorTrigger aria-label="Language">
                <CodeBlockLanguageSelectorValue />
              </CodeBlockLanguageSelectorTrigger>
              <CodeBlockLanguageSelectorContent>
                <CodeBlockLanguageSelectorItem value="typescript">
                  TypeScript
                </CodeBlockLanguageSelectorItem>
                <CodeBlockLanguageSelectorItem value="javascript">
                  JavaScript
                </CodeBlockLanguageSelectorItem>
              </CodeBlockLanguageSelectorContent>
            </CodeBlockLanguageSelector>
          </CodeBlockActions>
        </CodeBlockHeader>
      </CodeBlock>
    </main>
  )

  const trigger = screen.getByRole("combobox", { name: "Language" })
  await expect.element(trigger).toBeVisible()
  expect(trigger.element().textContent).toContain("TypeScript")

  const before = await axe.run(document.body)
  expect(before.violations).toEqual([])

  await userEvent.click(trigger)
  const option = screen.getByRole("option", { name: "JavaScript" })
  await expect.element(option).toBeVisible()

  // Base UI portals the popup to document.body, outside the <main> landmark
  // this test renders into, so the best-practice "region" rule is skipped for
  // the open state only; every WCAG rule still runs.
  const open = await axe.run(document.body, {
    rules: { region: { enabled: false } },
  })
  expect(open.violations).toEqual([])

  await userEvent.click(option)
  await vi.waitFor(() =>
    expect(onValueChange).toHaveBeenCalledWith("javascript", expect.anything())
  )
  await expect.poll(() => trigger.element().textContent).toContain("JavaScript")
})
