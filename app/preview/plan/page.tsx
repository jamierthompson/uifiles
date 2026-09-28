import type { Metadata } from "next"
import { Demo } from "@/app/_components/demo"
import { Button } from "@/components/ui/button"
import {
  Plan,
  PlanAction,
  PlanContent,
  PlanDescription,
  PlanFooter,
  PlanHeader,
  PlanTitle,
  PlanTrigger,
} from "@/registry/ai/plan"

export const metadata: Metadata = { title: "Plan" }

const steps = [
  "Add a `theme` column to the users table with a Drizzle migration",
  "Expose a `PATCH /api/settings` route that validates the payload",
  "Wire the settings form to the route and show a toast on success",
  "Cover the route with a Vitest test and the form with a Playwright flow",
]

export default function PlanPreview() {
  return (
    <>
      <Demo
        description="Still being drafted: the header shimmers and the steps arrive as they are written."
        title="Streaming"
      >
        <Plan defaultOpen isStreaming>
          <PlanHeader>
            <div>
              <PlanTitle>Drafting a plan for user theme settings</PlanTitle>
              <PlanDescription>
                Working out which files change and in what order
              </PlanDescription>
            </div>
            <PlanAction>
              <PlanTrigger />
            </PlanAction>
          </PlanHeader>
          <PlanContent>
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              {steps.slice(0, 2).map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </PlanContent>
        </Plan>
      </Demo>

      <Demo
        description="Four steps and a footer to edit or approve. The trigger collapses the content."
        title="Complete"
      >
        <Plan defaultOpen>
          <PlanHeader>
            <div>
              <PlanTitle>Add user theme settings</PlanTitle>
              <PlanDescription>
                Four steps across the database, API and settings UI. Review and
                approve to start.
              </PlanDescription>
            </div>
            <PlanAction>
              <PlanTrigger />
            </PlanAction>
          </PlanHeader>
          <PlanContent>
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              {steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </PlanContent>
          <PlanFooter className="justify-end gap-2">
            <Button size="sm" variant="outline">
              Edit plan
            </Button>
            <Button size="sm">Approve and run</Button>
          </PlanFooter>
        </Plan>
      </Demo>
    </>
  )
}
