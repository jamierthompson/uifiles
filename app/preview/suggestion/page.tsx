import type { Metadata } from "next"
import { SuggestionDemo } from "./suggestion-demo"

export const metadata: Metadata = { title: "Suggestion" }

export default function SuggestionPreview() {
  return (
    <section className="flex flex-col gap-3">
      <h1 className="font-heading text-xl font-semibold">Suggestion</h1>
      <SuggestionDemo />
    </section>
  )
}
