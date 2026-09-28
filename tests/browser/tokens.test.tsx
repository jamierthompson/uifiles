// Renders every wrapper variant that reads a colour token under the light and
// the dark theme (`.dark` on <html>, as next-themes sets it) and runs axe, so a
// token change that breaks contrast in a consumer's install fails here first.
import { FileIcon } from "lucide-react"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Attachment,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment"
import { Badge } from "@/components/ui/badge"
import { Bubble, BubbleContent, BubbleGroup } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { MessageResponse } from "@/registry/ai/response"
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/registry/ai/tool"
import { expectNoViolations, runAxe, withDark } from "@/tests/a11y"
import "@/app/globals.css"

const buttonVariants = [
  "default",
  "secondary",
  "destructive",
  "outline",
  "ghost",
  "link",
] as const
const badgeVariants = [
  "default",
  "secondary",
  "destructive",
  "outline",
  "ghost",
  "link",
] as const
const bubbleVariants = [
  "default",
  "secondary",
  "muted",
  "tinted",
  "outline",
  "ghost",
  "destructive",
] as const

function Buttons() {
  return (
    <main className="flex flex-wrap gap-2 p-6">
      {buttonVariants.map((variant) => (
        <Button key={variant} variant={variant}>
          {variant}
        </Button>
      ))}
    </main>
  )
}

function Badges() {
  return (
    <main className="flex flex-wrap gap-2 p-6">
      {badgeVariants.map((variant) => (
        <Badge key={variant} variant={variant}>
          {variant}
        </Badge>
      ))}
    </main>
  )
}

function Alerts() {
  return (
    <main className="space-y-4 p-6">
      <Alert>
        <AlertTitle>Saved</AlertTitle>
        <AlertDescription>Your changes are live.</AlertDescription>
      </Alert>
      <Alert variant="destructive">
        <AlertTitle>Request failed</AlertTitle>
        <AlertDescription>The server returned 502.</AlertDescription>
      </Alert>
    </main>
  )
}

function ErrorAttachment() {
  return (
    <main className="p-6">
      <Attachment state="error">
        <AttachmentMedia>
          <FileIcon />
        </AttachmentMedia>
        <AttachmentContent>
          <AttachmentTitle>report.pdf</AttachmentTitle>
          <AttachmentDescription>Upload failed</AttachmentDescription>
        </AttachmentContent>
      </Attachment>
    </main>
  )
}

function Bubbles() {
  return (
    <main className="p-6">
      <BubbleGroup>
        {bubbleVariants.map((variant) => (
          <Bubble key={variant} variant={variant}>
            <BubbleContent>A {variant} bubble</BubbleContent>
          </Bubble>
        ))}
      </BubbleGroup>
    </main>
  )
}

function Fields() {
  return (
    <main className="space-y-4 p-6">
      <Input placeholder="Search" aria-label="Search" />
      <Textarea placeholder="Describe the change" aria-label="Description" />
    </main>
  )
}

const fixtures = [
  ["button variants", Buttons],
  ["badge variants", Badges],
  ["alert default and destructive", Alerts],
  ["attachment error state", ErrorAttachment],
  ["bubble variants", Bubbles],
  ["input and textarea placeholders", Fields],
] as const

describe.each(fixtures)("%s", (_name, Fixture) => {
  it("passes axe in the light theme", async () => {
    await render(<Fixture />)
    await expectNoViolations()
  })

  it("passes axe in the dark theme", async () => {
    await withDark(async () => {
      await render(<Fixture />)
      await expectNoViolations()
    })
  })
})

// The light hover tint (`bg-destructive/20` behind `text-destructive`) is the
// tightest destructive pair; axe only sees it while the pointer is over the
// control, so each one is hovered explicitly.
function DestructiveHoverTargets() {
  return (
    <main className="flex flex-wrap items-start gap-2 p-6">
      <Button variant="destructive">Delete</Button>
      <Badge variant="destructive" render={<a href="#failed" />}>
        Failed
      </Badge>
      <Bubble variant="destructive">
        <BubbleContent render={<button type="button" />}>
          Message failed to send
        </BubbleContent>
      </Bubble>
    </main>
  )
}

const hoverTargets = [
  ["destructive button", "button", "Delete"],
  ["destructive badge link", "link", "Failed"],
  ["interactive destructive bubble", "button", "Message failed to send"],
] as const

describe.each(hoverTargets)("hovered %s", (_name, role, name) => {
  async function hover() {
    const screen = await render(<DestructiveHoverTargets />)
    const target = screen.getByRole(role, { name })
    await userEvent.hover(target)
    // Guards against a vacuous pass: axe must sample the hovered state.
    await expect.poll(() => target.element().matches(":hover")).toBe(true)
  }

  it("passes axe in the light theme", async () => {
    await hover()
    await expectNoViolations()
  })

  it("passes axe in the dark theme", async () => {
    await withDark(async () => {
      await hover()
      await expectNoViolations()
    })
  })
})

describe("token wiring", () => {
  it("applies the dark tokens through the class variant", async () => {
    await withDark(async () => {
      await render(<Buttons />)
      const body = getComputedStyle(document.body)
      expect(body.backgroundColor).toBe("oklch(0.145 0 0)")
      expect(body.color).toBe("oklch(0.985 0 0)")
    })
  })

  it("renders destructive text with the tuned token in both themes", async () => {
    const screen = await render(<Buttons />)
    const button = screen.getByRole("button", { name: "destructive" })
    await expect.element(button).toHaveStyle({
      color: "oklch(0.45 0.245 27.325)",
    })
    await withDark(async () => {
      await expect.element(button).toHaveStyle({
        color: "oklch(0.74 0.191 22.216)",
      })
    })
  })

  it("loads the KaTeX stylesheet, so a formula renders once and its MathML fallback is hidden", async () => {
    await render(
      <main>
        <MessageResponse>{"Energy: $$E = mc^2$$"}</MessageResponse>
      </main>
    )
    await expect
      .poll(() => document.querySelectorAll(".katex-html").length)
      .toBeGreaterThanOrEqual(1)
    const fallback = document.querySelector(".katex-mathml")
    expect(fallback).not.toBeNull()
    // katex.min.css visually hides .katex-mathml (1px, absolute, clipped);
    // without the stylesheet it paints as a second copy of the formula.
    const style = getComputedStyle(fallback as Element)
    expect(style.position).toBe("absolute")
    expect(style.height).toBe("1px")
    expect(style.width).toBe("1px")
    expect(style.overflow).toBe("hidden")
    await expectNoViolations()
  })

  it("draws placeholders with muted-foreground, which meets AA on the field", async () => {
    const screen = await render(<Fields />)
    const input = screen.getByRole("textbox", { name: "Search" }).element()
    expect(getComputedStyle(input, "::placeholder").color).toBe(
      "oklch(0.53 0 0)"
    )
    await withDark(async () => {
      expect(getComputedStyle(input, "::placeholder").color).toBe(
        "oklch(0.708 0 0)"
      )
    })
  })
})

describe("destructive token as axe measures it", () => {
  function Swatches() {
    return (
      <main className="space-y-2 bg-background p-6">
        <p className="text-destructive" data-testid="on-background">
          On the page background
        </p>
        <p className="bg-card text-destructive/80" data-testid="alpha-80">
          Attachment error description
        </p>
        <p className="bg-card text-destructive/90" data-testid="alpha-90">
          Alert destructive description
        </p>
        <p className="bg-muted text-destructive" data-testid="on-muted">
          On a muted panel
        </p>
        <p className="bg-destructive/10 text-destructive" data-testid="tint-10">
          Light button, badge and bubble tint
        </p>
        <p className="bg-destructive/20 text-destructive" data-testid="tint-20">
          Light hover tint, dark rest tint
        </p>
        <p className="bg-destructive/30 text-destructive" data-testid="tint-30">
          Dark hover tint
        </p>
      </main>
    )
  }

  /** axe's own measured ratio per swatch (its color-contrast check data). */
  async function measured() {
    const results = await runAxe()
    const out: Record<string, number> = {}
    for (const result of [...results.passes, ...results.violations]) {
      if (result.id !== "color-contrast") continue
      for (const node of result.nodes) {
        const selector = node.target[0]
        const element =
          typeof selector === "string" ? document.querySelector(selector) : null
        const id = element?.getAttribute("data-testid")
        const ratio = (node.any[0]?.data as { contrastRatio?: number })
          ?.contrastRatio
        if (id && typeof ratio === "number") out[id] = ratio
      }
    }
    return out
  }

  it("lands the light token where docs/architecture.md §4 says", async () => {
    await render(<Swatches />)
    const ratio = await measured()
    expect(ratio["on-background"]).toBeCloseTo(6.91, 1)
    expect(ratio["tint-10"]).toBeCloseTo(5.74, 1)
    expect(ratio["tint-20"]).toBeCloseTo(4.69, 1)
    expect(ratio["alpha-80"]).toBeCloseTo(5.35, 1)
    expect(ratio["alpha-90"]).toBeCloseTo(6.21, 1)
    expect(ratio["on-muted"]).toBeCloseTo(6.34, 1)
    for (const id of [
      "on-background",
      "tint-10",
      "tint-20",
      "alpha-80",
      "alpha-90",
      "on-muted",
    ]) {
      expect(ratio[id], id).toBeGreaterThanOrEqual(4.5)
    }
  })

  it("lands the dark token where docs/architecture.md §4 says", async () => {
    await withDark(async () => {
      await render(<Swatches />)
      const ratio = await measured()
      expect(ratio["tint-20"]).toBeCloseTo(5.59, 1)
      expect(ratio["tint-30"]).toBeCloseTo(4.55, 1)
      expect(ratio["alpha-80"]).toBeCloseTo(4.66, 1)
      for (const id of ["on-background", "tint-20", "tint-30", "alpha-80"]) {
        expect(ratio[id], id).toBeGreaterThanOrEqual(4.5)
      }
    })
  })

  function ToolError() {
    return (
      <main className="max-w-md bg-background p-6 text-foreground">
        <Tool defaultOpen>
          <ToolHeader state="output-error" type="tool-readFile" />
          <ToolContent>
            <ToolInput input={{ path: "/etc/shadow" }} />
            <ToolOutput
              errorText="EACCES: permission denied, open '/etc/shadow'"
              output={undefined}
            />
          </ToolContent>
        </Tool>
        <div className="mt-4 flex items-center gap-2">
          <Button variant="destructive">Delete</Button>
          <Badge variant="destructive">Failed</Badge>
          <span className="text-destructive">Inline error text</span>
        </div>
      </main>
    )
  }

  it("renders a tool error state free of contrast violations in both themes", async () => {
    const screen = await render(<ToolError />)
    await expect.element(screen.getByText("Inline error text")).toBeVisible()
    await expectNoViolations()
    await withDark(() => expectNoViolations())
  })
})
