import type { ToolUIPart } from "ai"
import { CheckIcon, XIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Component } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import {
  Confirmation,
  ConfirmationAccepted,
  ConfirmationAction,
  ConfirmationActions,
  type ConfirmationProps,
  ConfirmationRejected,
  ConfirmationRequest,
  ConfirmationTitle,
} from "@/registry/ai/confirmation"
import { expectNoViolations, withDark } from "@/tests/a11y"
import { allowConsole } from "@/tests/setup"
import "@/app/globals.css"

class Boundary extends Component<
  { children: ReactNode; onError: (error: Error) => void },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: Error) {
    this.props.onError(error)
  }
  render() {
    return this.state.failed ? <p>render crashed</p> : this.props.children
  }
}

const Body = () => (
  <ConfirmationTitle>
    <ConfirmationRequest>
      Allow the agent to delete the branch?
    </ConfirmationRequest>
    <ConfirmationAccepted>
      You approved deleting the branch.
    </ConfirmationAccepted>
    <ConfirmationRejected>
      You rejected deleting the branch.
    </ConfirmationRejected>
  </ConfirmationTitle>
)

const Actions = () => (
  <ConfirmationActions>
    <ConfirmationAction variant="outline">Reject</ConfirmationAction>
    <ConfirmationAction>Approve</ConfirmationAction>
  </ConfirmationActions>
)

afterEach(() => {
  vi.restoreAllMocks()
})

describe("Confirmation", () => {
  it("renders children when approval is present", async () => {
    const screen = await render(
      <Confirmation approval={{ id: "test-id" }} state="approval-requested">
        <div>Approval Content</div>
      </Confirmation>
    )
    await expect.element(screen.getByText("Approval Content")).toBeVisible()
    await expect.element(screen.getByRole("alert")).toBeVisible()
  })

  it("does not render when approval is not present", async () => {
    const screen = await render(
      <Confirmation state="input-streaming">
        <div>Approval Content</div>
      </Confirmation>
    )
    expect(screen.container.firstChild).toBeNull()
  })

  it("does not render in input-streaming state", async () => {
    const screen = await render(
      <Confirmation approval={{ id: "test-id" }} state="input-streaming">
        <div>Approval Content</div>
      </Confirmation>
    )
    expect(screen.container.firstChild).toBeNull()
  })

  it("does not render in input-available state", async () => {
    const screen = await render(
      <Confirmation approval={{ id: "test-id" }} state="input-available">
        <div>Approval Content</div>
      </Confirmation>
    )
    expect(screen.container.firstChild).toBeNull()
  })

  it("applies custom className", async () => {
    const screen = await render(
      <Confirmation
        approval={{ id: "test-id" }}
        className="custom-class"
        state="approval-requested"
      >
        <div>Content</div>
      </Confirmation>
    )
    const alert = screen.getByRole("alert")
    await expect.element(alert).toHaveClass("custom-class")
    await expect.element(alert).toHaveClass("flex-col")
  })

  it("renders nothing for a responded state whose approval carries no decision", async () => {
    const screen = await render(
      <>
        <Confirmation approval={{ id: "a" }} state="approval-responded">
          <Body />
        </Confirmation>
        <Confirmation approval={{ id: "b" }} state="output-available">
          <Body />
        </Confirmation>
        <Confirmation approval={{ id: "c" }} state="output-error">
          <Body />
        </Confirmation>
      </>
    )
    expect(screen.container.firstChild).toBeNull()
    expect(screen.getByRole("alert").query()).toBeNull()
  })

  it("throws when a part is used outside Confirmation", async () => {
    allowConsole("error")
    const onError = vi.fn()
    const screen = await render(
      <Boundary onError={onError}>
        <ConfirmationRequest>Orphan</ConfirmationRequest>
      </Boundary>
    )
    await expect.element(screen.getByText("render crashed")).toBeVisible()
    expect(onError.mock.calls[0]?.[0]?.message).toBe(
      "Confirmation components must be used within Confirmation"
    )
  })
})

describe("ConfirmationRequest, ConfirmationAccepted, ConfirmationRejected", () => {
  it("renders ConfirmationRequest when state is approval-requested", async () => {
    const screen = await render(
      <Confirmation approval={{ id: "test-id" }} state="approval-requested">
        <ConfirmationRequest>Custom approval message</ConfirmationRequest>
        <ConfirmationAccepted>Accepted</ConfirmationAccepted>
        <ConfirmationRejected>Rejected</ConfirmationRejected>
      </Confirmation>
    )
    await expect
      .element(screen.getByText("Custom approval message"))
      .toBeVisible()
    expect(screen.getByText("Accepted").query()).toBeNull()
    expect(screen.getByText("Rejected").query()).toBeNull()
  })

  it("renders ConfirmationAccepted when approved and state is approval-responded", async () => {
    const screen = await render(
      <Confirmation
        approval={{ approved: true, id: "test-id" }}
        state="approval-responded"
      >
        <ConfirmationRequest>Custom approval message</ConfirmationRequest>
        <ConfirmationAccepted>
          <CheckIcon />
          <span>Accepted</span>
        </ConfirmationAccepted>
        <ConfirmationRejected>
          <XIcon />
          <span>Rejected</span>
        </ConfirmationRejected>
      </Confirmation>
    )
    await expect.element(screen.getByText("Accepted")).toBeVisible()
    expect(screen.getByText("Custom approval message").query()).toBeNull()
    expect(screen.getByText("Rejected").query()).toBeNull()
  })

  it("renders ConfirmationRejected when not approved and state is output-denied", async () => {
    const screen = await render(
      <Confirmation
        approval={{ approved: false, id: "test-id" }}
        state="output-denied"
      >
        <ConfirmationRequest>Custom approval message</ConfirmationRequest>
        <ConfirmationAccepted>
          <CheckIcon />
          <span>Accepted</span>
        </ConfirmationAccepted>
        <ConfirmationRejected>
          <XIcon />
          <span>Rejected</span>
        </ConfirmationRejected>
      </Confirmation>
    )
    await expect.element(screen.getByText("Rejected")).toBeVisible()
    expect(screen.getByText("Custom approval message").query()).toBeNull()
    expect(screen.getByText("Accepted").query()).toBeNull()
  })

  it("shows the request and its actions, not an outcome, while a decided part is still approval-requested", async () => {
    const screen = await render(
      <main>
        <Confirmation
          approval={{ id: "call_1", approved: true }}
          state="approval-requested"
        >
          <Body />
          <Actions />
        </Confirmation>
      </main>
    )
    await expect
      .element(screen.getByText("Allow the agent to delete the branch?"))
      .toBeVisible()
    await expect
      .element(screen.getByRole("button", { name: "Approve" }))
      .toBeVisible()
    expect(
      screen.getByText("You approved deleting the branch.").query()
    ).toBeNull()
    expect(
      screen.getByText("You rejected deleting the branch.").query()
    ).toBeNull()
    await expectNoViolations()
  })

  it("colors only the rejected outcome with the destructive token", async () => {
    const outcome = (approved: boolean) => (
      <main>
        <Confirmation
          approval={{ id: "call_1", approved }}
          state="approval-responded"
        >
          <Body />
        </Confirmation>
      </main>
    )
    const screen = await render(outcome(false))
    const token = () =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--destructive")
        .trim()
    const colorOf = (text: string) =>
      getComputedStyle(screen.getByText(text).element()).color

    const rejected = screen.getByText("You rejected deleting the branch.")
    await expect.element(rejected).toBeVisible()
    await expect.element(rejected).toHaveClass("text-destructive")
    expect(colorOf("You rejected deleting the branch.")).toBe(token())
    await expectNoViolations()
    await withDark(async () => {
      expect(colorOf("You rejected deleting the branch.")).toBe(token())
      await expectNoViolations()
    })

    await screen.rerender(outcome(true))
    const accepted = screen.getByText("You approved deleting the branch.")
    await expect.element(accepted).toBeVisible()
    expect(colorOf("You approved deleting the branch.")).not.toBe(token())
    expect(document.querySelector(".text-destructive")).toBeNull()
  })

  it("merges className into the rejected outcome and lets it override the color", async () => {
    const outcome = (className: string) => (
      <main>
        <Confirmation
          approval={{ id: "call_1", approved: false }}
          state="approval-responded"
        >
          <ConfirmationTitle>
            <ConfirmationRejected className={className}>
              Rejected
            </ConfirmationRejected>
          </ConfirmationTitle>
        </Confirmation>
      </main>
    )
    const screen = await render(outcome("custom-rejected"))
    const rejected = screen.getByText("Rejected")
    await expect.element(rejected).toHaveClass("custom-rejected")
    await expect.element(rejected).toHaveClass("text-destructive")

    // cn is tailwind-merge: the consumer's color comes last and replaces
    // the destructive one instead of fighting it in the cascade.
    await screen.rerender(outcome("text-muted-foreground"))
    await expect.element(rejected).toHaveClass("text-muted-foreground")
    await expect.element(rejected).not.toHaveClass("text-destructive")
    expect(getComputedStyle(rejected.element()).color).toBe(
      getComputedStyle(document.documentElement)
        .getPropertyValue("--muted-foreground")
        .trim()
    )
  })

  it("shows the accepted outcome for an approved tool that then errored", async () => {
    const screen = await render(
      <Confirmation approval={{ id: "c", approved: true }} state="output-error">
        <Body />
      </Confirmation>
    )
    await expect.element(screen.getByRole("alert")).toBeVisible()
    await expect
      .element(screen.getByText("You approved deleting the branch."))
      .toBeVisible()
    expect(
      screen.getByText("You rejected deleting the branch.").query()
    ).toBeNull()
    expect(
      screen.getByText("Allow the agent to delete the branch?").query()
    ).toBeNull()
  })

  it("shows exactly one part in every ai state", async () => {
    type Case = [ToolUIPart["state"], ConfirmationProps["approval"], string]
    const cases: Case[] = [
      ["input-streaming", { id: "1" }, "none"],
      ["input-available", { id: "2" }, "none"],
      ["approval-requested", { id: "3" }, "request"],
      ["approval-responded", { id: "4", approved: true }, "accepted"],
      ["approval-responded", { id: "5", approved: false }, "rejected"],
      ["output-available", { id: "6", approved: true }, "accepted"],
      ["output-denied", { id: "7", approved: false }, "rejected"],
      ["output-error", { id: "8", approved: true }, "accepted"],
      ["output-error", undefined, "none"],
    ]
    for (const [state, approval, expected] of cases) {
      const screen = await render(
        <Confirmation approval={approval} state={state}>
          <ConfirmationTitle>
            <ConfirmationRequest>request</ConfirmationRequest>
            <ConfirmationAccepted>accepted</ConfirmationAccepted>
            <ConfirmationRejected>rejected</ConfirmationRejected>
          </ConfirmationTitle>
          <ConfirmationActions>
            <ConfirmationAction>Approve</ConfirmationAction>
          </ConfirmationActions>
        </Confirmation>
      )
      const shown = ["request", "accepted", "rejected"].filter(
        (part) => screen.getByText(part).query() !== null
      )
      expect(shown, `${state} ${JSON.stringify(approval)}`).toEqual(
        expected === "none" ? [] : [expected]
      )
      expect(screen.getByRole("alert").query() !== null, `${state} alert`).toBe(
        expected !== "none"
      )
      expect(
        screen.getByRole("button", { name: "Approve" }).query() !== null,
        `${state} actions`
      ).toBe(expected === "request")
      await screen.unmount()
    }
  })
})

describe("ConfirmationActions", () => {
  it("renders custom children buttons", async () => {
    const screen = await render(
      <Confirmation approval={{ id: "test-id" }} state="approval-requested">
        <Actions />
      </Confirmation>
    )
    await expect
      .element(screen.getByRole("button", { name: "Approve" }))
      .toBeVisible()
    await expect
      .element(screen.getByRole("button", { name: "Reject" }))
      .toBeVisible()
  })

  it("hides when state is not approval-requested", async () => {
    const screen = await render(
      <Confirmation
        approval={{ id: "test-id", approved: true }}
        state="approval-responded"
      >
        <Body />
        <Actions />
      </Confirmation>
    )
    await expect.element(screen.getByRole("alert")).toBeVisible()
    expect(screen.getByRole("button", { name: "Approve" }).query()).toBeNull()
    expect(screen.getByRole("button", { name: "Reject" }).query()).toBeNull()
  })

  it("shows when state is approval-requested", async () => {
    const screen = await render(
      <Confirmation approval={{ id: "test-id" }} state="approval-requested">
        <Actions />
      </Confirmation>
    )
    await expect.element(screen.getByText("Approve")).toBeVisible()
    await expect.element(screen.getByText("Reject")).toBeVisible()
  })

  it("calls onClick when accept button is clicked", async () => {
    const handleAccept = vi.fn()
    const screen = await render(
      <Confirmation approval={{ id: "test-id" }} state="approval-requested">
        <ConfirmationActions>
          <ConfirmationAction variant="outline">Reject</ConfirmationAction>
          <ConfirmationAction onClick={handleAccept}>Accept</ConfirmationAction>
        </ConfirmationActions>
      </Confirmation>
    )
    await userEvent.click(screen.getByText("Accept"))
    expect(handleAccept).toHaveBeenCalledOnce()
  })

  it("calls onClick when reject button is clicked", async () => {
    const handleReject = vi.fn()
    const screen = await render(
      <Confirmation approval={{ id: "test-id" }} state="approval-requested">
        <ConfirmationActions>
          <ConfirmationAction onClick={handleReject} variant="outline">
            Reject
          </ConfirmationAction>
          <ConfirmationAction>Accept</ConfirmationAction>
        </ConfirmationActions>
      </Confirmation>
    )
    await userEvent.click(screen.getByText("Reject"))
    expect(handleReject).toHaveBeenCalledOnce()
  })

  it("disables buttons when disabled prop is true", async () => {
    const screen = await render(
      <Confirmation approval={{ id: "test-id" }} state="approval-requested">
        <ConfirmationActions>
          <ConfirmationAction disabled variant="outline">
            Reject
          </ConfirmationAction>
          <ConfirmationAction disabled>Accept</ConfirmationAction>
        </ConfirmationActions>
      </Confirmation>
    )
    await expect.element(screen.getByText("Accept")).toBeDisabled()
    await expect.element(screen.getByText("Reject")).toBeDisabled()
  })

  it("applies custom className", async () => {
    const screen = await render(
      <Confirmation approval={{ id: "test-id" }} state="approval-requested">
        <ConfirmationActions className="custom-class">
          <ConfirmationAction variant="outline">Reject</ConfirmationAction>
          <ConfirmationAction>Accept</ConfirmationAction>
        </ConfirmationActions>
      </Confirmation>
    )
    const container = screen.getByText("Accept").element().parentElement
    expect(container).toHaveClass("custom-class")
    expect(container).toHaveClass("justify-end")
  })
})

describe("ConfirmationAction", () => {
  it("forwards variant and disabled and ignores clicks while disabled", async () => {
    const onClick = vi.fn()
    const screen = await render(
      <Confirmation approval={{ id: "d" }} state="approval-requested">
        <ConfirmationActions>
          <ConfirmationAction disabled onClick={onClick} variant="destructive">
            Reject
          </ConfirmationAction>
        </ConfirmationActions>
      </Confirmation>
    )
    const reject = screen.getByRole("button", { name: "Reject" })
    await expect.element(reject).toBeDisabled()
    await expect.element(reject).toHaveClass("text-destructive")
    await expect.element(reject).toHaveAttribute("type", "button")
    await userEvent.click(reject, { force: true })
    expect(onClick).not.toHaveBeenCalled()
  })

  it("merges className with its size defaults", async () => {
    const screen = await render(
      <Confirmation approval={{ id: "e" }} state="approval-requested">
        <ConfirmationActions>
          <ConfirmationAction className="w-full">Wide</ConfirmationAction>
          <ConfirmationAction className="h-10">Tall</ConfirmationAction>
        </ConfirmationActions>
      </Confirmation>
    )
    const wide = screen.getByRole("button", { name: "Wide" })
    await expect.element(wide).toHaveClass("w-full")
    await expect.element(wide).toHaveClass("h-8")
    await expect.element(wide).toHaveClass("px-3")
    const tall = screen.getByRole("button", { name: "Tall" })
    await expect.element(tall).toHaveClass("h-10")
    await expect.element(tall).not.toHaveClass("h-8")
    await expect.element(tall).toHaveClass("px-3")
  })

  it("composes another element through render", async () => {
    const screen = await render(
      <Confirmation approval={{ id: "f" }} state="approval-requested">
        <ConfirmationActions>
          <ConfirmationAction
            nativeButton={false}
            render={<a href="#policy" />}
            variant="link"
          >
            Read the policy
          </ConfirmationAction>
        </ConfirmationActions>
      </Confirmation>
    )
    const link = screen.getByRole("button", { name: "Read the policy" })
    await expect.element(link).toBeVisible()
    expect(link.element().tagName).toBe("A")
    await expect.element(link).toHaveAttribute("href", "#policy")
    await expect.element(link).toHaveClass("h-8")
    await expect.element(link).toHaveClass("text-primary")
    await expect.element(link).toHaveAttribute("role", "button")
  })
})

describe("ConfirmationTitle", () => {
  it("renders an inline alert description", async () => {
    const screen = await render(
      <Confirmation approval={{ id: "g" }} state="approval-requested">
        <ConfirmationTitle className="custom-title">
          Title text
        </ConfirmationTitle>
      </Confirmation>
    )
    const title = screen.getByText("Title text")
    await expect
      .element(title)
      .toHaveAttribute("data-slot", "alert-description")
    await expect.element(title).toHaveClass("inline")
    await expect.element(title).toHaveClass("custom-title")
  })
})

describe("accessibility", () => {
  it("renders the pending request with working actions and passes axe", async () => {
    const onApprove = vi.fn()
    const onReject = vi.fn()
    const screen = await render(
      <main>
        <Confirmation approval={{ id: "call_1" }} state="approval-requested">
          <Body />
          <ConfirmationActions>
            <ConfirmationAction onClick={onReject} variant="outline">
              Reject
            </ConfirmationAction>
            <ConfirmationAction onClick={onApprove}>Approve</ConfirmationAction>
          </ConfirmationActions>
        </Confirmation>
      </main>
    )
    await expect.element(screen.getByRole("alert")).toBeVisible()
    await expect
      .element(screen.getByText("Allow the agent to delete the branch?"))
      .toBeVisible()
    expect(
      screen.getByText("You approved deleting the branch.").query()
    ).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: "Approve" }))
    expect(onApprove).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole("button", { name: "Reject" }))
    expect(onReject).toHaveBeenCalledTimes(1)
    await expectNoViolations()
  })

  it("shows only the accepted outcome, hides the actions, and passes axe", async () => {
    const screen = await render(
      <main>
        <Confirmation
          approval={{ id: "call_2", approved: true }}
          state="output-available"
        >
          <Body />
          <Actions />
        </Confirmation>
      </main>
    )
    await expect
      .element(screen.getByText("You approved deleting the branch."))
      .toBeVisible()
    expect(
      screen.getByText("You rejected deleting the branch.").query()
    ).toBeNull()
    expect(
      screen.getByText("Allow the agent to delete the branch?").query()
    ).toBeNull()
    expect(screen.getByRole("button").query()).toBeNull()
    await expectNoViolations()
  })

  it("shows only the rejected outcome and passes axe in dark mode", async () => {
    await withDark(async () => {
      const screen = await render(
        <main>
          <Confirmation
            approval={{ id: "call_3", approved: false, reason: "Not now." }}
            state="output-denied"
          >
            <Body />
            <Actions />
          </Confirmation>
        </main>
      )
      await expect
        .element(screen.getByText("You rejected deleting the branch."))
        .toBeVisible()
      expect(
        screen.getByText("You approved deleting the branch.").query()
      ).toBeNull()
      expect(
        screen.getByText("Allow the agent to delete the branch?").query()
      ).toBeNull()
      expect(screen.getByRole("button").query()).toBeNull()
      await expectNoViolations()
    })
  })
})
