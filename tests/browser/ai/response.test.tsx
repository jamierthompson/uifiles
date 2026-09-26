import axe from "axe-core"
import { expect, it } from "vitest"
import { render } from "vitest-browser-react"
import { MessageResponse } from "@/registry/ai/response"
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

const markdown = `## Cache strategy

Some **bold** prose.

\`\`\`ts
const answer = 42
\`\`\`

| Strategy | Cost |
| --- | --- |
| no-store | Highest |
| force-cache | Lowest |

A display equation:

$$
c = h \\cdot c_{hit} + (1 - h) \\cdot c_{miss}
$$
`

it("renders markdown with a code fence, table and math", async () => {
  const screen = await render(
    <main>
      <MessageResponse>{markdown}</MessageResponse>
    </main>
  )

  await expect
    .element(screen.getByRole("heading", { name: "Cache strategy" }))
    .toBeVisible()
  await expect.element(screen.getByText("bold")).toBeVisible()
  await expect.element(screen.getByText("no-store")).toBeVisible()
  await expect
    .element(screen.getByRole("cell", { name: "Lowest" }))
    .toBeVisible()
  // Shiki highlights asynchronously; the raw text is present either way.
  await expect
    .element(screen.getByText("answer", { exact: false }).first())
    .toBeVisible()
  // KaTeX renders MathML alongside the visual output.
  await expect
    .poll(() => document.querySelectorAll("math").length)
    .toBeGreaterThanOrEqual(1)

  await settle()
  const results = await axe.run(document.body)
  expect(results.violations).toEqual([])
})

it("does not re-render when children and isAnimating are unchanged", async () => {
  const screen = await render(
    <MessageResponse>Hello **world**</MessageResponse>
  )
  await expect.element(screen.getByText("world")).toBeVisible()
  await screen.rerender(<MessageResponse>Hello **world**</MessageResponse>)
  await expect.element(screen.getByText("world")).toBeVisible()
})
