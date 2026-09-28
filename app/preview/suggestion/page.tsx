import type { Metadata } from "next"
import { Demo } from "@/app/_components/demo"
import { SuggestionDemo } from "./suggestion-demo"

export const metadata: Metadata = { title: "Suggestion" }

export default function SuggestionPreview() {
  return (
    <Demo
      description="A row of prompts that scrolls sideways when it overflows. Pick one to see what the handler receives."
      title="Suggestions under an empty conversation"
    >
      <SuggestionDemo />
    </Demo>
  )
}
