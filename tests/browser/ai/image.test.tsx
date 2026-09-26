import axe from "axe-core"
import { expect, it } from "vitest"
import { render } from "vitest-browser-react"
import { Image } from "@/registry/ai/image"
import "@/app/globals.css"

// 1x1 transparent PNG
const base64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="

const generated = {
  base64,
  uint8Array: Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)),
  mediaType: "image/png",
  providerMetadata: { openai: { revisedPrompt: "a pixel" } },
}

it("renders a generated image as a data URL", async () => {
  const screen = await render(
    <main>
      <Image {...generated} alt="A single pixel" className="size-8" />
    </main>
  )

  const img = screen.getByRole("img", { name: "A single pixel" })
  await expect.element(img).toBeVisible()
  await expect
    .element(img)
    .toHaveAttribute("src", `data:image/png;base64,${base64}`)
  await expect.element(img).toHaveClass("size-8")
  // Non-DOM fields from GeneratedFile never reach the element.
  expect(img.element().hasAttribute("providermetadata")).toBe(false)

  const results = await axe.run(document.body)
  expect(results.violations).toEqual([])
})
