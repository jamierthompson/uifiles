// Inline placeholder marks, so the preview makes no request to models.dev
// (ModelSelectorLogo's default source) and stays hermetic offline, under an
// img-src 'self' CSP and in the e2e console check. A consumer points `src`
// at its own assets the same way.
const mark = (letter: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="none" stroke="#000" stroke-width="2"/><text x="12" y="16.5" text-anchor="middle" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="#000">${letter}</text></svg>`
  )}`

export const logos = {
  openai: mark("O"),
  anthropic: mark("A"),
  google: mark("G"),
} as const

export type LogoProvider = keyof typeof logos
