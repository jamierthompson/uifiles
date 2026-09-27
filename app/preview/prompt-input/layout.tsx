import type { Metadata } from "next"

// The page is a client component, which cannot export metadata; this layout
// only names the route.
export const metadata: Metadata = { title: "Prompt Input" }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
