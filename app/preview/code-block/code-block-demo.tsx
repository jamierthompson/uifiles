"use client"

import { useState } from "react"
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockCopyButton,
  CodeBlockFilename,
  CodeBlockHeader,
  CodeBlockLanguageSelector,
  CodeBlockLanguageSelectorContent,
  CodeBlockLanguageSelectorItem,
  CodeBlockLanguageSelectorTrigger,
  CodeBlockLanguageSelectorValue,
  CodeBlockTitle,
} from "@/registry/ai/code-block"

const samples = {
  typescript: {
    filename: "use-debounce.ts",
    code: `import { useEffect, useState } from "react"

export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(id)
  }, [value, delay])

  return debounced
}`,
  },
  javascript: {
    filename: "use-debounce.js",
    code: `import { useEffect, useState } from "react"

export function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(id)
  }, [value, delay])

  return debounced
}`,
  },
  python: {
    filename: "debounce.py",
    code: `import threading


def debounce(wait: float):
    def decorator(fn):
        timer: threading.Timer | None = None

        def wrapper(*args, **kwargs):
            nonlocal timer
            if timer is not None:
                timer.cancel()
            timer = threading.Timer(wait, fn, args, kwargs)
            timer.start()

        return wrapper

    return decorator`,
  },
} as const

type Language = keyof typeof samples

const languageLabels: Record<Language, string> = {
  typescript: "TypeScript",
  javascript: "JavaScript",
  python: "Python",
}

export function CodeBlockDemo() {
  const [language, setLanguage] = useState<Language>("typescript")
  const sample = samples[language]

  return (
    <>
      <CodeBlock code={sample.code} language={language} showLineNumbers>
        <CodeBlockHeader>
          <CodeBlockTitle>
            <CodeBlockFilename>{sample.filename}</CodeBlockFilename>
          </CodeBlockTitle>
          <CodeBlockActions>
            <CodeBlockLanguageSelector
              items={languageLabels}
              onValueChange={(value) => {
                if (value) setLanguage(value)
              }}
              value={language}
            >
              <CodeBlockLanguageSelectorTrigger aria-label="Language">
                <CodeBlockLanguageSelectorValue />
              </CodeBlockLanguageSelectorTrigger>
              <CodeBlockLanguageSelectorContent>
                {(Object.keys(languageLabels) as Language[]).map((key) => (
                  <CodeBlockLanguageSelectorItem key={key} value={key}>
                    {languageLabels[key]}
                  </CodeBlockLanguageSelectorItem>
                ))}
              </CodeBlockLanguageSelectorContent>
            </CodeBlockLanguageSelector>
            <CodeBlockCopyButton aria-label="Copy code" />
          </CodeBlockActions>
        </CodeBlockHeader>
      </CodeBlock>
      <h2 className="font-heading text-lg font-semibold">Without header</h2>
      <CodeBlock
        code={`{ "city": "Melbourne", "unit": "celsius" }`}
        language="json"
      />
      <h2 className="font-heading text-lg font-semibold">Long lines</h2>
      <p className="text-sm text-muted-foreground">
        A block that overflows becomes a focusable, labelled scroll region so
        keyboard users can reach the rest of the line.
      </p>
      <CodeBlock
        aria-label="Fetch example"
        code={`const response = await fetch("https://api.example.com/v1/models?provider=openai&capability=tool-calling&context=200000&sort=price&order=asc&limit=50", { headers: { Authorization: \`Bearer \${token}\` } })`}
        language="typescript"
      />
    </>
  )
}
