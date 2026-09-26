import axe from "axe-core"
import { expect, it, vi } from "vitest"
import { userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import {
  Confirmation,
  ConfirmationAccepted,
  ConfirmationAction,
  ConfirmationActions,
  ConfirmationRejected,
  ConfirmationRequest,
  ConfirmationTitle,
} from "@/registry/ai/confirmation"
import "@/app/globals.css"

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

it("renders the pending request with working actions", async () => {
  const onApprove = vi.fn()
  const onReject = vi.fn()

  const screen = await render(
    <Confirmation approval={{ id: "call_1" }} state="approval-requested">
      <Body />
      <ConfirmationActions>
        <ConfirmationAction onClick={onReject} variant="outline">
          Reject
        </ConfirmationAction>
        <ConfirmationAction onClick={onApprove}>Approve</ConfirmationAction>
      </ConfirmationActions>
    </Confirmation>
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

  const results = await axe.run(document.body)
  expect(results.violations).toEqual([])
})

it("shows the accepted and rejected outcomes and hides the actions", async () => {
  const screen = await render(
    <>
      <Confirmation
        approval={{ id: "call_2", approved: true }}
        state="output-available"
      >
        <Body />
        <ConfirmationActions>
          <ConfirmationAction>Approve</ConfirmationAction>
        </ConfirmationActions>
      </Confirmation>
      <Confirmation
        approval={{ id: "call_3", approved: false }}
        state="output-denied"
      >
        <Body />
      </Confirmation>
    </>
  )

  await expect
    .element(screen.getByText("You approved deleting the branch."))
    .toBeVisible()
  await expect
    .element(screen.getByText("You rejected deleting the branch."))
    .toBeVisible()
  expect(
    screen.getByText("Allow the agent to delete the branch?").query()
  ).toBeNull()
  expect(screen.getByRole("button", { name: "Approve" }).query()).toBeNull()

  const results = await axe.run(document.body)
  expect(results.violations).toEqual([])
})

it("renders nothing before an approval exists", async () => {
  const screen = await render(
    <Confirmation state="input-available">
      <Body />
    </Confirmation>
  )
  expect(screen.getByRole("alert").query()).toBeNull()
})
