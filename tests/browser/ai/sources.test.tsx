import axe from "axe-core"
import { expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/registry/ai/sources"
import "@/app/globals.css"

it("expands to reveal the source links", async () => {
  const screen = await render(
    <main>
      <Sources>
        <SourcesTrigger count={2} />
        <SourcesContent>
          <Source href="https://ai-sdk.dev/docs" title="AI SDK docs" />
          <Source href="https://base-ui.com" title="Base UI" />
        </SourcesContent>
      </Sources>
    </main>
  )

  const trigger = screen.getByRole("button", { name: "Used 2 sources" })
  await expect.element(trigger).toBeVisible()
  await expect.element(trigger).toHaveAttribute("aria-expanded", "false")
  await expect
    .element(screen.getByRole("link", { name: "AI SDK docs" }))
    .not.toBeInTheDocument()

  await userEvent.click(trigger)

  await expect.element(trigger).toHaveAttribute("aria-expanded", "true")
  const link = screen.getByRole("link", { name: "AI SDK docs" })
  await expect.element(link).toBeVisible()
  await expect.element(link).toHaveAttribute("href", "https://ai-sdk.dev/docs")
  await expect
    .element(screen.getByRole("link", { name: "Base UI" }))
    .toBeVisible()

  const results = await axe.run(document.body)
  expect(results.violations).toEqual([])
})
