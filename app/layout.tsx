import { cn } from "cn"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { baseUrl } from "@/lib/registry"

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

const description =
  "A shadcn/ui registry on Base UI: every shadcn primitive under one namespace, AI components ported from Vercel AI Elements, and the tokens that tie them together."

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl()),
  title: { default: "uifiles", template: "%s · uifiles" },
  description,
  openGraph: {
    title: "uifiles",
    description,
    url: "/",
    siteName: "uifiles",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: "uifiles",
    description,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        geist.variable
      )}
    >
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
