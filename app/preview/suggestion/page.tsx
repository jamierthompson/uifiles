"use client"

import { useState } from "react"
import { Suggestion, Suggestions } from "@/registry/ai/suggestion"

const suggestions = [
  "What are the latest trends in AI?",
  "How does machine learning work?",
  "Explain quantum computing",
  "Best practices for React development",
  "Tell me about TypeScript benefits",
  "How to optimize database queries?",
  "What is the difference between SQL and NoSQL?",
]

export default function SuggestionPreview() {
  const [selected, setSelected] = useState<string | null>(null)

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium">Suggestions</h2>
      <Suggestions>
        {suggestions.map((suggestion) => (
          <Suggestion
            key={suggestion}
            onClick={setSelected}
            suggestion={suggestion}
          />
        ))}
      </Suggestions>
      <p className="text-xs text-muted-foreground">
        {selected ? `Selected: ${selected}` : "Pick a suggestion."}
      </p>
    </section>
  )
}
