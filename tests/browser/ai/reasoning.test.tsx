import axe from "axe-core"
import { expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/registry/ai/reasoning"
import "@/app/globals.css"

/** Wait for finite enter animations so axe measures colors at rest. */
async function settle() {
  await Promise.all(
    document
      .getAnimations()
      .filter((a) => a.effect?.getTiming().iterations !== Infinity)
      .map((a) => a.finished.catch(() => undefined))
  )
}

const thought = "First I check the **cache headers**, then the origin."

it("renders the finished state with a duration and toggles open", async () => {
  const screen = await render(
    <main>
      <Reasoning duration={4}>
        <ReasoningTrigger />
        <ReasoningContent>{thought}</ReasoningContent>
      </Reasoning>
    </main>
  )
  const trigger = screen.getByRole("button", { name: /Thought for 4 seconds/ })

  await expect.element(trigger).toBeVisible()
  await expect.element(trigger).toHaveAttribute("aria-expanded", "false")
  expect(screen.getByText("cache headers").query()).toBeNull()

  await userEvent.click(trigger)
  await expect.element(trigger).toHaveAttribute("aria-expanded", "true")
  await expect.element(screen.getByText("cache headers")).toBeVisible()

  await settle()
  const results = await axe.run(document.body)
  expect(results.violations).toEqual([])

  await userEvent.click(trigger)
  await expect.element(trigger).toHaveAttribute("aria-expanded", "false")
})

it("auto-opens while streaming and auto-closes after the stream ends", async () => {
  const screen = await render(
    <main>
      <Reasoning isStreaming>
        <ReasoningTrigger />
        <ReasoningContent>{thought}</ReasoningContent>
      </Reasoning>
    </main>
  )
  const trigger = screen.getByRole("button", { name: /Thinking/ })

  await expect.element(trigger).toBeVisible()
  await expect.element(trigger).toHaveAttribute("aria-expanded", "true")
  await expect.element(screen.getByText("cache headers")).toBeVisible()

  await settle()
  const results = await axe.run(document.body)
  expect(results.violations).toEqual([])

  await screen.rerender(
    <main>
      <Reasoning isStreaming={false}>
        <ReasoningTrigger />
        <ReasoningContent>{thought}</ReasoningContent>
      </Reasoning>
    </main>
  )
  await expect
    .element(screen.getByRole("button", { name: /Thought for/ }))
    .toBeVisible()
  // Auto-close fires AUTO_CLOSE_DELAY (1s) after streaming stops.
  await expect
    .poll(
      () =>
        screen
          .getByRole("button", { name: /Thought for/ })
          .element()
          .getAttribute("aria-expanded"),
      { timeout: 3000 }
    )
    .toBe("false")
})

it("respects defaultOpen={false} while streaming", async () => {
  const screen = await render(
    <Reasoning defaultOpen={false} isStreaming>
      <ReasoningTrigger />
      <ReasoningContent>{thought}</ReasoningContent>
    </Reasoning>
  )
  await expect
    .element(screen.getByRole("button", { name: /Thinking/ }))
    .toHaveAttribute("aria-expanded", "false")
})
