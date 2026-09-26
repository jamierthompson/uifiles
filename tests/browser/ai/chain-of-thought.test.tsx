import axe from "axe-core"
import { SearchIcon } from "lucide-react"
import { expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtImage,
  ChainOfThoughtSearchResult,
  ChainOfThoughtSearchResults,
  ChainOfThoughtStep,
} from "@/registry/ai/chain-of-thought"
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

function Demo({ defaultOpen }: { defaultOpen?: boolean }) {
  return (
    <main>
      <ChainOfThought defaultOpen={defaultOpen}>
        <ChainOfThoughtHeader>Investigating slow checkout</ChainOfThoughtHeader>
        <ChainOfThoughtContent>
          <ChainOfThoughtStep
            description="Looking for recent reports."
            icon={SearchIcon}
            label="Searching incident history"
            status="complete"
          >
            <ChainOfThoughtSearchResults>
              <ChainOfThoughtSearchResult>INC-2291</ChainOfThoughtSearchResult>
              <ChainOfThoughtSearchResult>PR #4410</ChainOfThoughtSearchResult>
            </ChainOfThoughtSearchResults>
          </ChainOfThoughtStep>
          <ChainOfThoughtStep label="Comparing regions" status="active">
            <ChainOfThoughtImage caption="p95 latency by region">
              <svg aria-label="latency chart" role="img" viewBox="0 0 10 10">
                <title>latency chart</title>
                <rect height="10" width="10" />
              </svg>
            </ChainOfThoughtImage>
          </ChainOfThoughtStep>
          <ChainOfThoughtStep label="Proposing a fix" status="pending" />
        </ChainOfThoughtContent>
      </ChainOfThought>
    </main>
  )
}

it("renders open with steps, search results and an image", async () => {
  const screen = await render(<Demo defaultOpen />)
  const header = screen.getByRole("button", {
    name: "Investigating slow checkout",
  })

  await expect.element(header).toBeVisible()
  await expect.element(header).toHaveAttribute("aria-expanded", "true")
  await expect
    .element(screen.getByText("Searching incident history"))
    .toBeVisible()
  await expect.element(screen.getByText("INC-2291")).toBeVisible()
  await expect.element(screen.getByText("PR #4410")).toBeVisible()
  await expect
    .element(screen.getByRole("img", { name: "latency chart" }))
    .toBeVisible()
  await expect.element(screen.getByText("p95 latency by region")).toBeVisible()
  await expect.element(screen.getByText("Proposing a fix")).toBeVisible()

  await settle()
  const results = await axe.run(document.body)
  expect(results.violations).toEqual([])
})

it("starts collapsed and opens from the header", async () => {
  const screen = await render(<Demo />)
  const header = screen.getByRole("button", {
    name: "Investigating slow checkout",
  })

  await expect.element(header).toHaveAttribute("aria-expanded", "false")
  expect(screen.getByText("Searching incident history").query()).toBeNull()

  await userEvent.click(header)
  await expect.element(header).toHaveAttribute("aria-expanded", "true")
  await expect
    .element(screen.getByText("Searching incident history"))
    .toBeVisible()

  await settle()
  const results = await axe.run(document.body)
  expect(results.violations).toEqual([])

  await userEvent.click(header)
  await expect.element(header).toHaveAttribute("aria-expanded", "false")
})
