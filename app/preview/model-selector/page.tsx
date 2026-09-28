import type { Metadata } from "next"
import { Demo } from "@/app/_components/demo"
import { ModelSelectorDemo } from "./model-selector-demo"

export const metadata: Metadata = { title: "Model Selector" }

export default function ModelSelectorPreview() {
  return (
    <Demo
      description={
        <>
          A command palette in a dialog. Pick a model and the trigger updates;
          the search matches whole terms in the id, name and provider. The logos
          are inline placeholders passed through <code>src</code>, so the page
          makes no request to models.dev.
        </>
      }
      title="Pick a model"
    >
      <ModelSelectorDemo />
    </Demo>
  )
}
