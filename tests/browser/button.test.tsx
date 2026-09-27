import { PlusIcon } from "lucide-react"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { Button } from "@/components/ui/button"
import { expectNoViolations, runAxe, settle, withDark } from "@/tests/a11y"
import "@/app/globals.css"

type Rgb = [number, number, number]

/** Paints a CSS colour through a canvas so the browser converts it to sRGB. */
function srgb(color: string): Rgb {
  const canvas = document.createElement("canvas")
  canvas.width = 1
  canvas.height = 1
  const context = canvas.getContext("2d", { willReadFrequently: true })
  if (!context) throw new Error("no 2d canvas context")
  context.fillStyle = color
  context.fillRect(0, 0, 1, 1)
  const [r = 0, g = 0, b = 0] = context.getImageData(0, 0, 1, 1).data
  return [r, g, b]
}

/** WCAG 2.x contrast ratio of two opaque sRGB colours. */
function contrast(a: Rgb, b: Rgb) {
  const luminance = (rgb: Rgb) => {
    const [r, g, b] = rgb.map((channel) => {
      const c = channel / 255
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    }) as Rgb
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ]
  return (hi + 0.05) / (lo + 0.05)
}

const token = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()

const variants = [
  "default",
  "secondary",
  "destructive",
  "outline",
  "ghost",
  "link",
] as const
const sizes = [
  "default",
  "xs",
  "sm",
  "lg",
  "icon",
  "icon-xs",
  "icon-sm",
  "icon-lg",
] as const

function Matrix() {
  return (
    <main className="space-y-3 p-6">
      {variants.map((variant) => (
        <div key={variant} className="flex flex-wrap items-center gap-2">
          {sizes.map((size) =>
            size.startsWith("icon") ? (
              <Button
                key={size}
                variant={variant}
                size={size}
                aria-label={`${variant} ${size}`}
              >
                <PlusIcon />
              </Button>
            ) : (
              <Button key={size} variant={variant} size={size}>
                {variant} {size}
              </Button>
            )
          )}
        </div>
      ))}
    </main>
  )
}

it("renders an accessible button", async () => {
  const screen = await render(
    <main>
      <Button>Save</Button>
    </main>
  )
  await expect
    .element(screen.getByRole("button", { name: "Save" }))
    .toBeVisible()
  await expectNoViolations()
})

describe("every variant and size", () => {
  it("renders as a button with an accessible name and passes axe in both themes", async () => {
    const screen = await render(<Matrix />)
    for (const variant of variants) {
      for (const size of sizes) {
        await expect
          .element(screen.getByRole("button", { name: `${variant} ${size}` }))
          .toBeVisible()
      }
    }
    await expectNoViolations()
    await withDark(async () => {
      await expectNoViolations()
    })
  })

  it("meets the 24px target size on every size, including xs", async () => {
    await render(<Matrix />)
    const results = await runAxe()
    const targetSize = results.passes.find((r) => r.id === "target-size")
    expect(targetSize?.nodes.length).toBe(variants.length * sizes.length)
    expect(results.violations.map((v) => v.id)).not.toContain("target-size")
    for (const button of document.querySelectorAll("button")) {
      const { width, height } = button.getBoundingClientRect()
      expect(width, button.textContent).toBeGreaterThanOrEqual(24)
      expect(height, button.textContent).toBeGreaterThanOrEqual(24)
    }
  })
})

describe("keyboard focus", () => {
  // The destructive variant borders itself with its own translucent token
  // (focus-visible:border-destructive/40) instead of the ring.
  const ringBordered = variants.filter((variant) => variant !== "destructive")

  it.each(ringBordered)(
    "shows a ring and a border in the ring token that clears 3:1 on the %s variant",
    async (variant) => {
      const screen = await render(
        <main>
          <Button variant={variant}>Focus me</Button>
        </main>
      )
      const button = screen
        .getByRole("button", { name: "Focus me" })
        .element() as HTMLButtonElement
      const atRest = getComputedStyle(button)
      expect(atRest.boxShadow).toBe("none")
      const ring = srgb(token("--ring"))
      expect(srgb(atRest.borderColor)).not.toEqual(ring)

      await userEvent.tab()
      expect(document.activeElement).toBe(button)
      // The ring and border-color animate in (transition-all), so wait for
      // the transitions to land before reading the settled colours.
      await expect
        .poll(() => getComputedStyle(button).boxShadow)
        .toMatch(/0px 0px 0px 3px/)
      await settle()
      const border = srgb(getComputedStyle(button).borderColor)
      expect(border).toEqual(ring)
      // The 1px border is the focus indicator (WCAG 1.4.11 asks 3:1).
      const surface = srgb(getComputedStyle(document.body).backgroundColor)
      expect(contrast(border, surface)).toBeGreaterThanOrEqual(3)
    }
  )

  it("borders the destructive variant with its own token on focus", async () => {
    const screen = await render(
      <main>
        <Button variant="destructive">Focus me</Button>
      </main>
    )
    const button = screen
      .getByRole("button", { name: "Focus me" })
      .element() as HTMLButtonElement
    await userEvent.tab()
    expect(document.activeElement).toBe(button)
    await expect
      .poll(() => getComputedStyle(button).boxShadow)
      .toMatch(/0px 0px 0px 3px/)
    await settle()
    const border = getComputedStyle(button).borderColor
    expect(srgb(border)).not.toEqual(srgb(token("--ring")))
    expect(srgb(border)).not.toEqual(srgb("transparent"))
    // The destructive hue at 40% over white: red stays the dominant channel.
    const [r, g, b] = srgb(border)
    expect(r).toBeGreaterThan(g)
    expect(r).toBeGreaterThan(b)
  })

  it("does not show the focus ring after a pointer click", async () => {
    const screen = await render(
      <main>
        <Button>Click me</Button>
      </main>
    )
    const button = screen.getByRole("button", { name: "Click me" })
    await userEvent.click(button)
    expect(document.activeElement).toBe(button.element())
    // A ring that were going to appear would be transitioning in by now;
    // once every transition has finished the shadow is at its final value.
    await settle()
    expect(getComputedStyle(button.element()).boxShadow).toBe("none")
  })
})

describe("composition", () => {
  it("renders an anchor through the Base UI render prop, keeping button semantics", async () => {
    const screen = await render(
      <main>
        <Button nativeButton={false} render={<a href="#docs" />}>
          Read the docs
        </Button>
      </main>
    )
    const anchor = screen.getByRole("button", { name: "Read the docs" })
    expect(anchor.element().tagName).toBe("A")
    await expect.element(anchor).toHaveAttribute("href", "#docs")
    await expect.element(anchor).toHaveAttribute("data-slot", "button")
    await expectNoViolations()
  })

  it("keeps a disabled button out of the tab order and visibly muted", async () => {
    const screen = await render(
      <main>
        <Button disabled>Saving</Button>
        <Button>Next</Button>
      </main>
    )
    await userEvent.tab()
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Next" }).element()
    )
    const disabled = screen.getByRole("button", { name: "Saving" }).element()
    expect(getComputedStyle(disabled).opacity).toBe("0.5")
    expect(getComputedStyle(disabled).pointerEvents).toBe("none")
  })
})
