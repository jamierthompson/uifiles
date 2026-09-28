import { spawnSync } from "node:child_process"
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  american,
  checkText,
  fixText,
  fixToken,
  isChecked,
  listFiles,
  MARKER,
  main,
  SKIPPED,
} from "@/scripts/check-spelling"

const root = process.cwd()
const script = join(root, "scripts/check-spelling.ts")

describe("scripts/check-spelling.ts word rules", () => {
  it.each([
    // the -our family and what is built on it
    ["colour", "color"],
    ["colours", "colors"],
    ["colourful", "colorful"],
    ["behaviour", "behavior"],
    ["behavioural", "behavioral"],
    ["favourite", "favorite"],
    ["neighbourhood", "neighborhood"],
    ["honours", "honors"],
    // -ise and -isation, by rule
    ["initialise", "initialize"],
    ["initialised", "initialized"],
    ["initialising", "initializing"],
    ["organisation", "organization"],
    ["organisations", "organizations"],
    ["serialisable", "serializable"],
    ["tokeniser", "tokenizer"],
    ["memoised", "memoized"],
    ["customisable", "customizable"],
    // -yse
    ["analyse", "analyze"],
    ["analysing", "analyzing"],
    ["analyser", "analyzer"],
    // the doubled l
    ["cancelled", "canceled"],
    ["cancelling", "canceling"],
    ["labelled", "labeled"],
    ["modelling", "modeling"],
    ["signalled", "signaled"],
    ["traveller", "traveler"],
    ["marshalling", "marshaling"],
    ["focussed", "focused"],
    ["counsellor", "counselor"],
    // the single l
    ["fulfil", "fulfill"],
    ["fulfilment", "fulfillment"],
    ["enrolment", "enrollment"],
    ["skilful", "skillful"],
    // -re, -ence, -ogue
    ["centre", "center"],
    ["centred", "centered"],
    ["centring", "centering"],
    ["metre", "meter"],
    ["fibre", "fiber"],
    ["manoeuvring", "maneuvering"],
    ["licence", "license"],
    ["licences", "licenses"],
    ["defence", "defense"],
    ["practise", "practice"],
    ["practising", "practicing"],
    ["catalogue", "catalog"],
    ["cataloguing", "cataloging"],
    ["dialogue", "dialog"],
    // the rest
    ["grey", "gray"],
    ["greyed", "grayed"],
    ["greyscale", "grayscale"],
    ["artefact", "artifact"],
    ["artefacts", "artifacts"],
    ["programme", "program"],
    ["whilst", "while"],
    ["amongst", "among"],
    ["judgement", "judgment"],
    ["acknowledgement", "acknowledgment"],
    ["enquiry", "inquiry"],
    ["learnt", "learned"],
    ["ageing", "aging"],
    ["sceptical", "skeptical"],
    ["aluminium", "aluminum"],
    ["maths", "math"],
  ])("%s → %s", (british, expected) => {
    expect(american(british)).toBe(expected)
  })

  it.each([
    // -ise words that are American too, with their inflections
    "otherwise",
    "likewise",
    "clockwise",
    "promise",
    "promises",
    "promising",
    "compromised",
    "exercise",
    "exercising",
    "precise",
    "concise",
    "surprise",
    "surprised",
    "advertise",
    "advertising",
    "supervise",
    "revise",
    "revised",
    "enterprise",
    "franchise",
    "expertise",
    "merchandise",
    "raise",
    "raised",
    "praise",
    "arise",
    "arising",
    "rise",
    "rising",
    "sunrise",
    "noise",
    "denoise",
    "premise",
    "premises",
    "disguise",
    "cruise",
    "improvisation",
    // short stems the rule does not reach
    "miser",
    "crises",
    "elise",
    // names
    "denise",
    "louise",
    // -our words that are American too
    "hour",
    "hours",
    "our",
    "your",
    "four",
    "flour",
    "tour",
    "tourism",
    "contour",
    "glamour",
    "detour",
    "source",
    "resource",
    "journal",
    "courage",
    "flourish",
    // -re, -ll and the rest that are American too
    "genre",
    "timbre",
    "acre",
    "mediocre",
    "controlled",
    "compelled",
    "propelled",
    "patrolled",
    "enrolled",
    "fulfilled",
    "programmed",
    "programming",
    "analysis",
    "analyses",
    "emphasis",
    "license",
    "practice",
    "gray",
    "color",
    "center",
    "canceled",
    "toward",
    "afterward",
  ])("%s passes", (word) => {
    expect(american(word)).toBeUndefined()
  })

  it("keeps the case of the word it rewrites", () => {
    expect(fixToken("Colour")).toBe("Color")
    expect(fixToken("COLOUR")).toBe("COLOR")
    expect(fixToken("colour")).toBe("color")
    expect(fixToken("Initialise")).toBe("Initialize")
  })

  it("applies a second rule when the first leaves another British spelling", () => {
    expect(fixToken("colourise")).toBe("colorize")
    expect(fixToken("colourised")).toBe("colorized")
  })
})

describe("scripts/check-spelling.ts on text", () => {
  it("reports each word with its 1-based line, splitting identifiers on camelCase", () => {
    const text = [
      "const colour = 1",
      "clean line",
      "normaliseValue(greyScale) // the behaviour",
      "URLColour",
    ].join("\n")
    expect(checkText(text, "a.ts")).toEqual([
      { path: "a.ts", line: 1, word: "colour", replacement: "color" },
      { path: "a.ts", line: 3, word: "normalise", replacement: "normalize" },
      { path: "a.ts", line: 3, word: "grey", replacement: "gray" },
      { path: "a.ts", line: 3, word: "behaviour", replacement: "behavior" },
      { path: "a.ts", line: 4, word: "Colour", replacement: "Color" },
    ])
  })

  it("rewrites the same words, leaves everything else byte for byte, and keeps a marked line", () => {
    const text = `const colour = "grey"\n// LICENCE* is the glob licensee reads (${MARKER})\n\tbehaviourRef.current\n`
    expect(fixText(text)).toBe(
      `const color = "gray"\n// LICENCE* is the glob licensee reads (${MARKER})\n\tbehaviorRef.current\n`
    )
    expect(checkText(text)).toHaveLength(3)
    expect(fixText(fixText(text))).toBe(fixText(text))
  })

  it("does not read a token out of a longer word", () => {
    // "colouring" is caught as a whole; "discolour" is not a word we rewrite
    // from the middle, and letters inside other words never match.
    expect(checkText("recolour")).toEqual([])
    expect(checkText("colouring")).toEqual([
      { path: "", line: 1, word: "colouring", replacement: "coloring" },
    ])
    expect(checkText("Chromium 1194, tokens, semantic tokens")).toEqual([])
  })
})

describe("scripts/check-spelling.ts file selection", () => {
  it("checks text files and skips vendored, generated and licence files", () => {
    for (const path of [
      "README.md",
      "AGENTS.md",
      "registry/ai/registry.json",
      "registry/ai/code-block.tsx",
      "tests/browser/ai/tool.test.tsx",
      ".github/workflows/ci.yml",
      ".github/ISSUE_TEMPLATE/bug_report.yml",
      "app/globals.css",
      "scripts/sync-tokens.ts",
      "package.json",
      ".env.example",
    ]) {
      expect(isChecked(path), path).toBe(true)
    }
    for (const path of [
      "LICENSE",
      "NOTICE",
      "licenses/APACHE-2.0-ai-elements.txt",
      ".claude/skills/shadcn/SKILL.md",
      "skills-lock.json",
      "pnpm-lock.yaml",
      "components/ui/button.tsx",
      "docs/qa/HANDOFF.md",
      "scripts/check-spelling.ts",
      "tests/unit/check-spelling.test.ts",
      "public/favicon.ico",
      "public/og.png",
      ".nvmrc",
    ]) {
      expect(isChecked(path), path).toBe(false)
    }
  })

  it("skips only paths that exist, so a stale entry is noticed", () => {
    const tracked = new Set(
      spawnSync(
        "git",
        ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
        { cwd: root, encoding: "utf8" }
      )
        .stdout.split("\0")
        .filter(Boolean)
    )
    for (const skip of SKIPPED) {
      const present = skip.endsWith("/")
        ? [...tracked].some((file) => file.startsWith(skip))
        : tracked.has(skip)
      expect(present, skip).toBe(true)
    }
  })

  it("lists the repository's own files from git, deduplicated and sorted", () => {
    const files = listFiles(root)
    expect(files).toContain("README.md")
    expect(files).toContain("registry/ai/registry.json")
    expect(files).not.toContain("pnpm-lock.yaml")
    expect(files).not.toContain("components/ui/button.tsx")
    expect(new Set(files).size).toBe(files.length)
    expect([...files].sort()).toEqual(files)
  })

  it("passes on the repository itself", () => {
    expect(checkText(readFileSync(join(root, "README.md"), "utf8"))).toEqual([])
    const logs: string[] = []
    const log = console.log
    console.log = (line: string) => logs.push(line)
    try {
      expect(main([], root)).toBe(0)
    } finally {
      console.log = log
    }
    expect(logs.at(-1)).toMatch(/^check-spelling: \d+ files clean$/)
  })
})

describe("scripts/check-spelling.ts as a command", () => {
  function repo() {
    const dir = mkdtempSync(join(tmpdir(), "uifiles-spelling-"))
    spawnSync("git", ["init", "-q"], { cwd: dir })
    mkdirSync(join(dir, "docs"))
    mkdirSync(join(dir, "licenses"))
    writeFileSync(
      join(dir, "docs/guide.md"),
      "The colour of the button.\nFine.\nIt was cancelled.\n"
    )
    writeFileSync(join(dir, "app.ts"), "const behaviour = 1\n")
    writeFileSync(join(dir, "licenses/x.txt"), "licence\n")
    writeFileSync(join(dir, "photo.png"), "colour\n")
    return dir
  }

  function run(dir: string, ...args: string[]) {
    const result = spawnSync(process.execPath, [script, ...args], {
      cwd: dir,
      encoding: "utf8",
    })
    return { status: result.status, out: result.stdout + result.stderr }
  }

  it("exits 1 listing path:line: word → replacement, including untracked files, and skips licence and binary files", () => {
    const dir = repo()
    try {
      const { status, out } = run(dir)
      expect(status).toBe(1)
      expect(out).toContain("docs/guide.md:1: colour → color")
      expect(out).toContain("docs/guide.md:3: cancelled → canceled")
      expect(out).toContain("app.ts:1: behaviour → behavior")
      expect(out).not.toContain("licenses/")
      expect(out).not.toContain("photo.png")
      expect(out).toContain("3 British spellings in 2 file(s)")
      expect(out).toContain("--fix")
      expect(out).toContain(MARKER)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("--fix rewrites the files in place, then a second run is clean and exits 0", () => {
    const dir = repo()
    try {
      const fix = run(dir, "--fix")
      expect(fix.status).toBe(0)
      expect(fix.out).toContain("rewrote 3 words in 2 files")
      expect(readFileSync(join(dir, "docs/guide.md"), "utf8")).toBe(
        "The color of the button.\nFine.\nIt was canceled.\n"
      )
      expect(readFileSync(join(dir, "app.ts"), "utf8")).toBe(
        "const behavior = 1\n"
      )
      expect(readFileSync(join(dir, "licenses/x.txt"), "utf8")).toBe(
        "licence\n"
      )
      const again = run(dir)
      expect(again.status).toBe(0)
      expect(again.out).toContain("2 files clean")
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("checks only the files named on the command line when there are any", () => {
    const dir = repo()
    try {
      const { status, out } = run(dir, "app.ts")
      expect(status).toBe(1)
      expect(out).toContain("app.ts:1: behaviour → behavior")
      expect(out).not.toContain("docs/guide.md")
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
