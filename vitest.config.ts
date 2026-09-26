import { fileURLToPath } from "node:url"
import { playwright } from "@vitest/browser-playwright"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  // Pre-bundle deps the browser tests discover lazily; a mid-run re-optimize
  // serves a second React copy and fails with "Invalid hook call".
  optimizeDeps: {
    include: [
      "cmdk",
      "nanoid",
      "embla-carousel-react",
      "streamdown",
      "@streamdown/code",
      "@streamdown/math",
      "@streamdown/mermaid",
      "@streamdown/cjk",
      "shiki",
      "tokenlens",
      "@base-ui/react/progress",
      "@base-ui/react/collapsible",
      "@base-ui/react/preview-card",
      "@base-ui/react/select",
      "@base-ui/react/menu",
      "@base-ui/react/dialog",
      "@base-ui/react/tooltip",
      "@base-ui/react/scroll-area",
      "@shadcn/react/message-scroller",
      "@shadcn/helpers/ai-sdk",
      "@ai-sdk/react",
    ],
  },
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        test: {
          name: "browser",
          include: ["tests/browser/**/*.test.tsx"],
          browser: {
            enabled: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
            headless: true,
          },
        },
      },
    ],
  },
})
