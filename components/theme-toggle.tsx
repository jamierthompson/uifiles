"use client"

import { MoonIcon, SunIcon, SunMoonIcon } from "lucide-react"
import { useTheme } from "next-themes"
import * as React from "react"
import { Button } from "@/components/ui/button"

function useMounted() {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => {
    setMounted(true)
  }, [])
  return mounted
}

/**
 * Flips between the light and dark theme; the site's only theme control (no
 * character-key shortcut, WCAG 2.1.4). next-themes cannot know the theme on
 * the server, so until the component mounts it renders a neutral icon and
 * label that match the server HTML, then re-renders with the real state.
 */
function ThemeToggle() {
  const mounted = useMounted()
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = mounted && resolvedTheme === "dark"
  const label = mounted
    ? isDark
      ? "Switch to light theme"
      : "Switch to dark theme"
    : "Toggle theme"

  return (
    <Button
      aria-label={label}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      size="icon-sm"
      variant="ghost"
    >
      {mounted ? isDark ? <SunIcon /> : <MoonIcon /> : <SunMoonIcon />}
    </Button>
  )
}

export { ThemeToggle }
