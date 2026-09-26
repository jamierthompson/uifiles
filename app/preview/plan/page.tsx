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

const steps = [
  "Add a `theme` column to the users table with a Drizzle migration",
  "Expose a `PATCH /api/settings` route that validates the payload",
  "Wire the settings form to the route and show a toast on success",
  "Cover the route with a Vitest test and the form with a Playwright flow",
]

export default function PlanPreview() {
  return (
    <>
      <h1 className="font-heading text-xl font-semibold">Plan</h1>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm text-muted-foreground">Streaming</h2>
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
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm text-muted-foreground">Complete</h2>
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
      </section>
    </>
  )
}
