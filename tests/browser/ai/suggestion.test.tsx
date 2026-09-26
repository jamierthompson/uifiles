import axe from "axe-core"
import { describe, expect, it, vi } from "vitest"
import { render } from "vitest-browser-react"
import { Suggestion, Suggestions } from "@/registry/ai/suggestion"
import "@/app/globals.css"

const items = [
  "Summarize this repository",
  "Write a unit test for the parser",
  "Explain the auth flow",
]

describe("suggestion", () => {
  it("renders an accessible row of suggestions", async () => {
    const screen = await render(
      <Suggestions>
        {items.map((item) => (
          <Suggestion key={item} suggestion={item} />
        ))}
      </Suggestions>
    )
    for (const item of items) {
      await expect
        .element(screen.getByRole("button", { name: item }))
        .toBeVisible()
    }
    const results = await axe.run(document.body)
    expect(results.violations).toEqual([])
  })

  it("calls onClick with the suggestion text", async () => {
    const onClick = vi.fn<(suggestion: string) => void>()
    const screen = await render(
      <Suggestions>
        {items.map((item) => (
          <Suggestion key={item} onClick={onClick} suggestion={item} />
        ))}
      </Suggestions>
    )
    await screen.getByRole("button", { name: items[1] }).click()
    expect(onClick).toHaveBeenCalledExactlyOnceWith(items[1])
  })

  it("renders custom children in place of the suggestion text", async () => {
    const screen = await render(
      <Suggestions>
        <Suggestion suggestion="Explain the auth flow">Auth flow</Suggestion>
      </Suggestions>
    )
    await expect
      .element(screen.getByRole("button", { name: "Auth flow" }))
      .toBeVisible()
  })
})
