import axe from "axe-core"
import { expect, it } from "vitest"
import { render } from "vitest-browser-react"
import { Button } from "@/components/ui/button"
import "@/app/globals.css"

it("renders an accessible button", async () => {
  const screen = await render(<Button>Save</Button>)
  await expect
    .element(screen.getByRole("button", { name: "Save" }))
    .toBeVisible()
  const results = await axe.run(document.body)
  expect(results.violations).toEqual([])
})
