import { fileURLToPath } from "node:url"
import { playwright } from "@vitest/browser-playwright"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  // Pre-bundle every bare specifier (subpaths included) the browser tests
  // reach through registry/**, components/** and the tests themselves. Vite
  // bundles this list once per cache; a specifier outside it is bundled only
  // when Vite meets it, and one first met mid-run triggers a re-optimize that
  // invalidates the test files still importing ("Failed to fetch dynamically
  // imported module") and can serve a second React copy ("Invalid hook
  // call"). Only vitest and vitest/browser are the runner's own.
  // tests/unit/test-setup.test.ts checks the list against the imports.
  optimizeDeps: {
    include: [
      "@ai-sdk/react",
      "@base-ui/react/button",
      "@base-ui/react/collapsible",
      "@base-ui/react/dialog",
      "@base-ui/react/input",
      "@base-ui/react/menu",
      "@base-ui/react/merge-props",
      "@base-ui/react/preview-card",
      "@base-ui/react/progress",
      "@base-ui/react/scroll-area",
      "@base-ui/react/select",
      "@base-ui/react/separator",
      "@base-ui/react/tooltip",
      "@base-ui/react/use-render",
      "@shadcn/helpers/ai-sdk",
      "@shadcn/react/message-scroller",
      "@streamdown/cjk",
      "@streamdown/code",
      "@streamdown/math",
      "@streamdown/mermaid",
      "ai",
      "axe-core",
      "class-variance-authority",
      "cmdk",
      "cn",
      "embla-carousel-react",
      "lucide-react",
      "nanoid",
      "next-themes",
      "react",
      "react-dom",
      "react-dom/client",
      "react-dom/server",
      "shiki",
      "streamdown",
      "tokenlens",
      "vitest-browser-react",
    ],
  },
  test: {
    coverage: {
      provider: "v8",
      include: ["registry/**/*.{ts,tsx}", "lib/**/*.ts"],
      // Pages are exercised by the Playwright suite, not by component tests.
      exclude: ["registry/**/page.tsx"],
      reporter: ["text", "json-summary"],
      reportOnFailure: true,
      thresholds: { perFile: true, lines: 80, functions: 80, branches: 70 },
    },
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
          setupFiles: ["tests/setup.ts"],
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
