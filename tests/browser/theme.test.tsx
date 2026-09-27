import { beforeAll, beforeEach, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { ThemeProvider } from "@/components/theme-provider"
import { ThemeToggle } from "@/components/theme-toggle"
import { expectNoViolations } from "@/tests/a11y"
import "@/app/globals.css"

const isDark = () => document.documentElement.classList.contains("dark")

let storageKey = 0
const storedTheme = () => localStorage.getItem(`theme-test-${storageKey}`)

// next-themes renders its anti-flash <script> inline, and React logs one error
// per page for a client-rendered script tag. Trigger that single message here,
// before the console guard's per-test window opens, and check it is the only
// thing logged.
beforeAll(async () => {
  const logged: string[] = []
  const original = console.error
  console.error = (...args: unknown[]) => {
    logged.push(String(args[0]))
  }
  try {
    const warmup = await render(
      <ThemeProvider storageKey="theme-test-warmup">
        <span />
      </ThemeProvider>
    )
    await warmup.unmount()
  } finally {
    console.error = original
  }
  expect(logged).toEqual([expect.stringMatching(/script tag/)])
})

beforeEach(() => {
  localStorage.clear()
  document.documentElement.classList.remove("dark", "light")
  storageKey += 1
})

function Fixture({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      defaultTheme="light"
      enableSystem={false}
      storageKey={`theme-test-${storageKey}`}
    >
      <main>{children}</main>
    </ThemeProvider>
  )
}

it("the toggle flips the theme class and its label, and passes axe in both themes", async () => {
  const screen = await render(
    <Fixture>
      <ThemeToggle />
    </Fixture>
  )
  const toDark = screen.getByRole("button", { name: "Switch to dark theme" })
  await expect.element(toDark).toBeVisible()
  expect(isDark()).toBe(false)
  await expectNoViolations()

  await userEvent.click(toDark)
  await expect.poll(isDark).toBe(true)
  const toLight = screen.getByRole("button", { name: "Switch to light theme" })
  await expect.element(toLight).toBeVisible()
  await expectNoViolations()

  await userEvent.click(toLight)
  await expect.poll(isDark).toBe(false)
  await expect.element(toDark).toBeVisible()
})

it("the toggle works from the keyboard with Enter and Space", async () => {
  const screen = await render(
    <Fixture>
      <ThemeToggle />
    </Fixture>
  )
  const toDark = screen.getByRole("button", { name: "Switch to dark theme" })
  await expect.element(toDark).toBeVisible()
  ;(await toDark.element()).focus()
  await userEvent.keyboard("{Enter}")
  await expect.poll(isDark).toBe(true)
  await expect
    .element(screen.getByRole("button", { name: "Switch to light theme" }))
    .toHaveFocus()
  await userEvent.keyboard(" ")
  await expect.poll(isDark).toBe(false)
})

// WCAG 2.1.4 (Level A): a single-character shortcut must be remappable,
// switchable off or scoped to a focused component. The site has none; the
// visible toggle is the only control. next-themes writes the choice to
// localStorage synchronously inside setTheme, so an empty store right after
// the key press shows the theme was never set.
it("has no single-key shortcut: d and D leave the theme alone wherever focus is, and nothing advertises one", async () => {
  const screen = await render(
    <Fixture>
      <ThemeToggle />
      <button type="button">Plain button</button>
      <a href="#catalog">Back to the catalog</a>
    </Fixture>
  )
  const toggle = screen.getByRole("button", { name: "Switch to dark theme" })
  await expect.element(toggle).toBeVisible()

  const targets: Array<[string, () => Promise<void>]> = [
    [
      "body",
      async () => {
        ;(document.activeElement as HTMLElement | null)?.blur()
      },
    ],
    [
      "a plain button",
      async () =>
        (
          await screen.getByRole("button", { name: "Plain button" }).element()
        ).focus(),
    ],
    [
      "a link",
      async () =>
        (
          await screen
            .getByRole("link", { name: "Back to the catalog" })
            .element()
        ).focus(),
    ],
    ["the toggle", async () => (await toggle.element()).focus()],
  ]
  for (const [where, focus] of targets) {
    await focus()
    await userEvent.keyboard("d")
    await userEvent.keyboard("D")
    expect(storedTheme(), where).toBeNull()
    expect(isDark(), where).toBe(false)
  }
  expect((await toggle.element()).hasAttribute("aria-keyshortcuts")).toBe(false)
  expect(document.querySelector("kbd")).toBeNull()

  // The provider is live: the toggle still sets and stores the theme.
  await userEvent.click(toggle)
  await expect.poll(isDark).toBe(true)
  expect(storedTheme()).toBe("dark")
})
