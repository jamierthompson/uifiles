import axe from "axe-core"
import { expect, it, vi } from "vitest"
import { userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import {
  MessageBranch,
  MessageBranchContent,
  MessageBranchNext,
  MessageBranchPage,
  MessageBranchPrevious,
  MessageBranchSelector,
} from "@/registry/ai/branch"
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

function Demo({ onBranchChange }: { onBranchChange?: (i: number) => void }) {
  return (
    <main>
      <MessageBranch onBranchChange={onBranchChange}>
        <MessageBranchContent>
          <p key="a">First answer</p>
          <p key="b">Second answer</p>
          <p key="c">Third answer</p>
        </MessageBranchContent>
        <MessageBranchSelector>
          <MessageBranchPrevious />
          <MessageBranchPage />
          <MessageBranchNext />
        </MessageBranchSelector>
      </MessageBranch>
    </main>
  )
}

it("shows the first of three branches with a selector", async () => {
  const screen = await render(<Demo />)

  await expect.element(screen.getByText("First answer")).toBeVisible()
  await expect.element(screen.getByText("Second answer")).not.toBeVisible()
  await expect.element(screen.getByText("1 of 3")).toBeVisible()
  await expect
    .element(screen.getByRole("button", { name: "Previous branch" }))
    .toBeEnabled()
  await expect
    .element(screen.getByRole("button", { name: "Next branch" }))
    .toBeEnabled()

  await settle()
  const results = await axe.run(document.body)
  expect(results.violations).toEqual([])
})

it("navigates with next/previous and wraps around", async () => {
  const onBranchChange = vi.fn()
  const screen = await render(<Demo onBranchChange={onBranchChange} />)
  const next = screen.getByRole("button", { name: "Next branch" })
  const previous = screen.getByRole("button", { name: "Previous branch" })

  await userEvent.click(next)
  await expect.element(screen.getByText("2 of 3")).toBeVisible()
  await expect.element(screen.getByText("Second answer")).toBeVisible()
  expect(onBranchChange).toHaveBeenLastCalledWith(1)

  await userEvent.click(previous)
  await expect.element(screen.getByText("1 of 3")).toBeVisible()

  await userEvent.click(previous)
  await expect.element(screen.getByText("3 of 3")).toBeVisible()
  await expect.element(screen.getByText("Third answer")).toBeVisible()
  expect(onBranchChange).toHaveBeenLastCalledWith(2)

  await userEvent.click(next)
  await expect.element(screen.getByText("1 of 3")).toBeVisible()
})

it("hides the selector when there is a single branch", async () => {
  const screen = await render(
    <MessageBranch>
      <MessageBranchContent>
        <p key="only">Only answer</p>
      </MessageBranchContent>
      <MessageBranchSelector>
        <MessageBranchPrevious />
        <MessageBranchPage />
        <MessageBranchNext />
      </MessageBranchSelector>
    </MessageBranch>
  )
  await expect.element(screen.getByText("Only answer")).toBeVisible()
  expect(screen.getByRole("button").query()).toBeNull()
})
