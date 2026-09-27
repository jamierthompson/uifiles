import type { Metadata } from "next"
import { ModelSelectorDemo } from "./model-selector-demo"

export const metadata: Metadata = { title: "Model Selector" }

export default function ModelSelectorPreview() {
  return (
    <>
      <h1 className="font-heading text-xl font-semibold">Model Selector</h1>
      <p className="text-sm text-muted-foreground">
        A command palette in a dialog. Pick a model; the trigger updates. The
        search matches whole terms in the id, name and provider. The logos are
        inline placeholders passed through <code>src</code>, so the page makes
        no request to models.dev.
      </p>
      <ModelSelectorDemo />
    </>
  )
}
