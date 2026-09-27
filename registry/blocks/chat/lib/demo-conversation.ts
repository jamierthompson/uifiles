import { createChat } from "@shadcn/helpers/ai-sdk"
import { getMessageText } from "@/registry/blocks/chat/components/blocks/chat"

/**
 * A scripted conversation for the chat block. `@shadcn/helpers` turns it into
 * an AI SDK transport that streams the assistant turns word by word, so the
 * block works with no API route and no API key.
 */
export const demoConversation = createChat({
  messageIdPrefix: "demo-message",
  toolCallIdPrefix: "demo-call",
})
  .user("How do I add a new color token to this design system?")
  .sleep(600)
  .assistant(({ writer }) => {
    writer.reasoning(
      "The tokens live in app/globals.css as oklch() values, with a light block under :root and a dark block under .dark. I should confirm what is there before answering, then explain the @theme inline mapping that turns a token into a Tailwind utility."
    )
    writer
      .tool("readFile", { input: { path: "app/globals.css" } })
      .sleep(900)
      .output({
        path: "app/globals.css",
        lines: 212,
        tokens: ["--background", "--foreground", "--primary", "--muted"],
        themeInline: true,
      })
    writer.text(`Add the token in three places in \`app/globals.css\`: the light block, the dark block, and the Tailwind mapping.

\`\`\`css
:root {
  --success: oklch(0.72 0.19 150);
}

.dark {
  --success: oklch(0.8 0.17 150);
}

@theme inline {
  --color-success: var(--success);
}
\`\`\`

Then:

- Use it through semantic utilities such as \`bg-success\` or \`text-success\`, never a palette class.
- Run \`pnpm registry:sync\` so the \`base\` registry item picks up the new variable.
- Add it to both blocks even if the values match, so dark mode never falls back to the light value.`)
  })
  .user("Can you give me the short version?")
  .sleep(400)
  .assistant(
    "Define it under `:root` and `.dark`, map it in `@theme inline` as `--color-<name>`, then run `pnpm registry:sync`."
  )

/**
 * Transport for `useChat`. Streams the scripted assistant turns; once the
 * script is used up it answers with the fallback instead of throwing.
 */
export const transport = demoConversation.transport({
  delayMs: 20,
  fallback:
    "That is the end of the scripted demo. Swap `transport` for your own API route (`DefaultChatTransport`) to keep chatting.",
})

/** The scripted opening question, offered as a one-click suggestion. */
export const demoSuggestions = demoConversation.get(1).map(getMessageText)
