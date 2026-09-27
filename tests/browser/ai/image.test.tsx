import { DefaultGeneratedFile, type GeneratedFile } from "ai"
import { afterEach, describe, expect, it, vi } from "vitest"
import { render } from "vitest-browser-react"
import { Image } from "@/registry/ai/image"
import { expectNoViolations, withDark } from "@/tests/a11y"
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

afterEach(() => {
  vi.restoreAllMocks()
})

describe("image", () => {
  it("renders image with base64 data", async () => {
    const screen = await render(
      <main>
        <Image
          alt="Test image"
          base64="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
          mediaType="image/png"
          uint8Array={generated.uint8Array}
        />
      </main>
    )
    const img = screen.getByRole("img", { name: "Test image" })
    await expect.element(img).toBeVisible()
    expect(img.element().getAttribute("src")).toMatch(
      /^data:image\/png;base64,/
    )
  })

  it("applies custom className", async () => {
    const screen = await render(
      <main>
        <Image
          alt="Test"
          base64="test"
          className="custom-class"
          mediaType="image/jpeg"
          uint8Array={generated.uint8Array}
        />
      </main>
    )
    const img = screen.getByRole("img", { name: "Test" })
    await expect.element(img).toHaveClass("custom-class")
    await expect.element(img).toHaveClass("rounded-md")
  })

  it("uses correct media type in data URL", async () => {
    const screen = await render(
      <main>
        <Image
          alt="JPEG test"
          base64="test"
          mediaType="image/jpeg"
          uint8Array={generated.uint8Array}
        />
      </main>
    )
    const img = screen.getByRole("img", { name: "JPEG test" })
    await expect
      .element(img)
      .toHaveAttribute("src", "data:image/jpeg;base64,test")
  })

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

    await expectNoViolations()
    await withDark(() => expectNoViolations())
  })

  it("puts nothing but alt, class and src on the element and logs no unknown-prop warnings", async () => {
    // The console guard in tests/setup.ts fails the test on any warning.
    await render(
      <main>
        <Image {...generated} alt="pixel" />
      </main>
    )
    const img = document.querySelector("img")
    expect(img).not.toBeNull()
    expect([...(img?.attributes ?? [])].map((a) => a.name).sort()).toEqual([
      "alt",
      "class",
      "src",
    ])
  })

  it("keeps media type parameters in the data URL", async () => {
    const svg = btoa("<svg xmlns='http://www.w3.org/2000/svg'/>")
    const screen = await render(
      <main>
        <Image
          alt="Vector"
          base64={svg}
          mediaType="image/svg+xml;charset=utf-8"
          uint8Array={generated.uint8Array}
        />
      </main>
    )
    await expect
      .element(screen.getByRole("img", { name: "Vector" }))
      .toHaveAttribute("src", `data:image/svg+xml;charset=utf-8;base64,${svg}`)
  })

  it("renders nothing and leaks nothing when a DefaultGeneratedFile instance is spread", async () => {
    const file = new DefaultGeneratedFile({
      data: base64,
      mediaType: "image/png",
    })
    expect(file.base64).toBe(base64)
    // Object spread copies own enumerable properties only; base64 and
    // uint8Array are prototype getters, so they never reach the props.
    const spread = { ...file }
    expect(spread).not.toHaveProperty("base64")
    await render(
      <main>
        <p>Generated:</p>
        <Image {...(spread as unknown as GeneratedFile)} alt="pixel" />
      </main>
    )
    expect(document.querySelector("img")).toBeNull()
    expect(document.querySelector("[base64data], [uint8arraydata]")).toBeNull()
  })

  it("requires alt and treats an empty alt as decorative", async () => {
    // Vitest does not type-check, so the directive below is enforced by
    // `pnpm typecheck` in the gate: it errors if alt becomes optional.
    // @ts-expect-error alt is required: an image without a text alternative fails WCAG 1.1.1
    const missingAlt = () => <Image {...generated} />
    expect(typeof missingAlt).toBe("function")

    await render(
      <main>
        <p>A decorative divider follows.</p>
        <Image {...generated} alt="" />
      </main>
    )
    const img = document.querySelector("img")
    expect(img?.getAttribute("alt")).toBe("")
    await expectNoViolations()
  })

  it("falls back to image/png when mediaType is missing", async () => {
    const screen = await render(
      <main>
        <Image
          {...generated}
          alt="Untyped"
          mediaType={undefined as unknown as string}
        />
      </main>
    )
    await expect
      .element(screen.getByRole("img", { name: "Untyped" }))
      .toHaveAttribute("src", `data:image/png;base64,${base64}`)
  })

  it("renders nothing when there is no image data", async () => {
    await render(
      <main>
        <p>Nothing to show.</p>
        <Image {...generated} alt="Missing" base64="" />
      </main>
    )
    expect(document.querySelector("img")).toBeNull()
  })
})
