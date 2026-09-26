import type { LanguageModelUsage } from "ai"
import axe from "axe-core"
import { expect, it } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import {
  Context,
  ContextCacheUsage,
  ContextContent,
  ContextContentBody,
  ContextContentFooter,
  ContextContentHeader,
  ContextInputUsage,
  ContextOutputUsage,
  ContextReasoningUsage,
  ContextTrigger,
} from "@/registry/ai/context"
import "@/app/globals.css"

// Wait for enter animations so axe measures final colors, not mid-fade frames.
const settle = () =>
  Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {})))

const usage: LanguageModelUsage = {
  inputTokens: 62_000,
  inputTokenDetails: {
    noCacheTokens: 42_000,
    cacheReadTokens: 20_000,
    cacheWriteTokens: 0,
  },
  outputTokens: 18_000,
  outputTokenDetails: { textTokens: 12_000, reasoningTokens: 6_000 },
  totalTokens: 80_000,
}

function Demo({ usedTokens }: { usedTokens: number }) {
  return (
    <Context
      maxTokens={200_000}
      modelId="openai:gpt-4o"
      usage={usage}
      usedTokens={usedTokens}
    >
      <ContextTrigger />
      <ContextContent>
        <ContextContentHeader />
        <ContextContentBody>
          <ContextInputUsage />
          <ContextOutputUsage />
          <ContextReasoningUsage />
          <ContextCacheUsage />
        </ContextContentBody>
        <ContextContentFooter />
      </ContextContent>
    </Context>
  )
}

it("shows usage details on hover", async () => {
  const screen = await render(
    <main>
      <Demo usedTokens={80_000} />
    </main>
  )

  const trigger = screen.getByRole("button", { name: /40%/ })
  await expect.element(trigger).toBeVisible()
  await expect.element(page.getByText("Total cost")).not.toBeInTheDocument()

  const closed = await axe.run(document.body)
  expect(closed.violations).toEqual([])

  await userEvent.hover(trigger)

  await expect.element(page.getByText("80K / 200K")).toBeVisible()
  await expect.element(page.getByRole("progressbar")).toBeVisible()
  await expect.element(page.getByText("Input")).toBeVisible()
  await expect.element(page.getByText("Output")).toBeVisible()
  await expect.element(page.getByText("Reasoning")).toBeVisible()
  await expect.element(page.getByText("Cache")).toBeVisible()
  await expect.element(page.getByText("Total cost")).toBeVisible()

  // The popup is portaled outside every landmark, so scope the open-state
  // check to it; axe's page-level `region` rule does not apply to a subtree.
  await settle()
  const popup = document.querySelector('[data-slot="hover-card-content"]')
  expect(popup).not.toBeNull()
  const open = await axe.run(popup as Element)
  expect(open.violations).toEqual([])
})

it("renders the near-full state", async () => {
  const screen = await render(
    <main>
      <Demo usedTokens={190_000} />
    </main>
  )
  await expect
    .element(screen.getByRole("button", { name: /95%/ }))
    .toBeVisible()
  // Scoped to this render: the previous test's hover card can still be
  // animating out in <body>, outside any landmark.
  const results = await axe.run(screen.container)
  expect(results.violations).toEqual([])
})
