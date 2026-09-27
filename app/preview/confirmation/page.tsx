"use client"

import type { ToolUIPart } from "ai"
import { useState } from "react"
import {
  Confirmation,
  ConfirmationAccepted,
  ConfirmationAction,
  ConfirmationActions,
  ConfirmationRejected,
  ConfirmationRequest,
  ConfirmationTitle,
} from "@/registry/ai/confirmation"

type Approval =
  | { id: string; approved?: never; reason?: never }
  | { id: string; approved: boolean; reason?: string }

function InteractiveConfirmation() {
  const [state, setState] = useState<ToolUIPart["state"]>("approval-requested")
  const [approval, setApproval] = useState<Approval>({ id: "call_01" })

  const respond = (approved: boolean) => {
    setApproval({ id: "call_01", approved })
    setState("approval-responded")
  }

  return (
    <div className="flex flex-col gap-2">
      <Confirmation approval={approval} state={state}>
        <ConfirmationTitle>
          <ConfirmationRequest>
            The agent wants to run <code>rm -rf ./dist</code> in your project.
            Allow it?
          </ConfirmationRequest>
          <ConfirmationAccepted>
            You approved <code>rm -rf ./dist</code>.
          </ConfirmationAccepted>
          <ConfirmationRejected>
            You rejected <code>rm -rf ./dist</code>.
          </ConfirmationRejected>
        </ConfirmationTitle>
        <ConfirmationActions>
          <ConfirmationAction onClick={() => respond(false)} variant="outline">
            Reject
          </ConfirmationAction>
          <ConfirmationAction onClick={() => respond(true)}>
            Approve
          </ConfirmationAction>
        </ConfirmationActions>
      </Confirmation>
      {state !== "approval-requested" && (
        <button
          className="self-start text-xs text-muted-foreground underline"
          onClick={() => {
            setApproval({ id: "call_01" })
            setState("approval-requested")
          }}
          type="button"
        >
          Reset
        </button>
      )}
    </div>
  )
}

export default function ConfirmationPreview() {
  return (
    <>
      <h1 className="font-heading text-xl font-semibold">Confirmation</h1>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm text-muted-foreground">
          approval-requested (interactive)
        </h2>
        <InteractiveConfirmation />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm text-muted-foreground">
          approval-responded, accepted
        </h2>
        <Confirmation
          approval={{ id: "call_02", approved: true }}
          state="output-available"
        >
          <ConfirmationTitle>
            <ConfirmationAccepted>
              You approved sending the email to the team.
            </ConfirmationAccepted>
          </ConfirmationTitle>
        </Confirmation>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm text-muted-foreground">
          output-error, approved (the tool ran and failed)
        </h2>
        <Confirmation
          approval={{ id: "call_04", approved: true }}
          state="output-error"
        >
          <ConfirmationTitle>
            <ConfirmationAccepted>
              You approved running the database migration.
            </ConfirmationAccepted>
          </ConfirmationTitle>
        </Confirmation>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm text-muted-foreground">
          approval-responded, rejected
        </h2>
        <Confirmation
          approval={{
            id: "call_03",
            approved: false,
            reason: "Not before the release freeze.",
          }}
          state="output-denied"
        >
          <ConfirmationTitle>
            <ConfirmationRejected>
              You rejected deploying to production.
            </ConfirmationRejected>
          </ConfirmationTitle>
        </Confirmation>
      </section>
    </>
  )
}
