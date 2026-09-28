// Fails on British spellings in the tracked text of the repo, so that docs,
// comments, registry descriptions and test names stay in American English.
// Agents drift to "colour", "behaviour", "initialise", "licence" and
// "cancelled" whatever the prompt says; this keeps the drift out of main.
// Run by `pnpm check:spelling` (in `pnpm gate` and CI).
//
//   node scripts/check-spelling.ts [--fix] [file ...]
//
// Without files it checks every tracked or untracked-but-not-ignored file
// with a text extension (git ls-files), except the paths in SKIPPED: vendored
// and generated trees, license texts and the QA transcripts. Exits 1 and
// lists `path:line: word → replacement` when it finds anything; `--fix`
// rewrites the files in place (the case of the word is kept) and exits 0.
// A line containing `spelling-ok` is not checked.
//
// Words are recognized from a word list plus three families that are too
// large to list: `-ise`/`-isation` (with the words that are `-ise` in
// American English too, and only for stems of six letters or more so
// "miser", "crises" and names such as "Elise" pass), the `-our` nouns and
// what is built on them ("colourful", "behavioural", "favourite"), and the
// `-lled`/`-lling` verbs whose American form has one l. Identifiers are split
// on camelCase, so `normaliseValue` and `greyScale` are caught too.
import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

export type Finding = {
  path: string
  line: number
  word: string
  replacement: string
}

/** Files the guard never reads, by path prefix or exact path. */
export const SKIPPED = [
  "LICENSE",
  "licenses/",
  ".claude/skills/", // vendored, installed verbatim from skills-lock.json
  "skills-lock.json",
  "pnpm-lock.yaml",
  "components/ui/", // vendored shadcn/ui; do not edit by hand
  "docs/qa/", // archived QA transcripts, kept as written
  "scripts/check-spelling.ts", // the word list
  "tests/unit/check-spelling.test.ts",
]

const EXTENSIONS =
  /\.(?:[cm]?[jt]sx?|json|md|mdx|ya?ml|css|txt|html|svg|sh|env\.example)$/

export const MARKER = "spelling-ok"

/**
 * Stems of the `-our` nouns; a token that begins with one is rewritten with
 * `-or`, whatever follows ("colourful", "behavioural", "favourite",
 * "neighbourhood"). "glamour" and "hour" are not here on purpose.
 */
const OUR_STEMS = [
  "ardour",
  "armour",
  "behaviour",
  "candour",
  "clamour",
  "colour",
  "demeanour",
  "endeavour",
  "favour",
  "fervour",
  "flavour",
  "harbour",
  "honour",
  "humour",
  "labour",
  "neighbour",
  "odour",
  "parlour",
  "rigour",
  "rumour",
  "saviour",
  "savour",
  "splendour",
  "succour",
  "tumour",
  "valour",
  "vapour",
  "vigour",
]

/**
 * Words that end in `-ise` in American English as well, as the stem the
 * `-ise` rule reduces a token to ("exercising" → "exercise"). Anything
 * ending in `-wise` is accepted without being listed.
 */
const ISE_EXCEPTIONS = new Set([
  "advertise",
  "advise",
  "appraise",
  "apprise",
  "arise",
  "bourgeoise",
  "braise",
  "bruise",
  "cerise",
  "chastise",
  "chemise",
  "circumcise",
  "comprise",
  "compromise",
  "concise",
  "counterpoise",
  "cruise",
  "demise",
  "denise",
  "denoise",
  "despise",
  "devise",
  "disenfranchise",
  "disguise",
  "eloise",
  "enfranchise",
  "enterprise",
  "equipoise",
  "excise",
  "exercise",
  "exorcise",
  "expertise",
  "franchise",
  "fundraise",
  "heloise",
  "highrise",
  "improvise",
  "incise",
  "liaise",
  "louise",
  "malaise",
  "marquise",
  "merchandise",
  "moonrise",
  "mortise",
  "paradise",
  "porpoise",
  "praise",
  "precise",
  "premise",
  "promise",
  "reprise",
  "revise",
  "sunrise",
  "supervise",
  "surmise",
  "surprise",
  "televise",
  "tortoise",
  "treatise",
  "turquoise",
  "uprise",
  "valise",
])

const ISE = /^([a-z]+)is(e|es|ed|er|ers|ing|ation|ations|able)$/

/**
 * Prefixes a word may carry in front of a listed word or stem, so that
 * "unsupervised" passes like "supervised" and "unlabelled" is rewritten like
 * "labelled". Longer prefixes come first so "under" is not read as "un".
 */
const PREFIX = /^(counter|under|over|semi|non|mis|dis|pre|sub|re|un|in|im)/

/** Whether an `-ise` stem is American too, on its own or behind a prefix. */
function isIseException(stem: string): boolean {
  if (ISE_EXCEPTIONS.has(stem)) return true
  const prefix = PREFIX.exec(stem)?.[0]
  return prefix !== undefined && ISE_EXCEPTIONS.has(stem.slice(prefix.length))
}

/** Verbs whose British past and participle double the final l. */
const SINGLE_L_STEMS = [
  "bevel",
  "cancel",
  "carol",
  "channel",
  "chisel",
  "counsel",
  "dial",
  "enamel",
  "equal",
  "fuel",
  "funnel",
  "gambol",
  "grovel",
  "initial",
  "jewel",
  "kennel",
  "label",
  "level",
  "libel",
  "marshal",
  "model",
  "panel",
  "pedal",
  "pencil",
  "pummel",
  "quarrel",
  "ravel",
  "remodel",
  "revel",
  "rival",
  "shovel",
  "shrivel",
  "signal",
  "snivel",
  "spiral",
  "stencil",
  "swivel",
  "tassel",
  "total",
  "towel",
  "travel",
  "trowel",
  "tunnel",
  "unravel",
  "yodel",
]

function buildWords(): Map<string, string> {
  const map = new Map<string, string>()
  const add = (british: string, american: string) => map.set(british, american)
  /** A noun: singular and plural. */
  const noun = (british: string, american: string) => {
    add(british, american)
    add(`${british}s`, `${american}s`)
  }
  /** A verb ending in e: base, -s, -d, -ing. */
  const eVerb = (british: string, american: string) => {
    add(british, american)
    add(`${british}s`, `${american}s`)
    add(
      `${british}d`,
      american.endsWith("e") ? `${american}d` : `${american}ed`
    )
    add(`${british.slice(0, -1)}ing`, `${american.replace(/e$/, "")}ing`)
  }
  /** A verb ending in a consonant: base, -s, -ed, -ing. */
  const verb = (british: string, american: string) => {
    add(british, american)
    add(`${british}s`, `${american}s`)
    add(`${british}ed`, `${american}ed`)
    add(`${british}ing`, `${american}ing`)
  }

  // -yse: no -s form, since "analyses" is also the plural of "analysis"
  for (const b of ["analyse", "catalyse", "paralyse", "hydrolyse", "dialyse"]) {
    const a = b.replace(/yse$/, "yze")
    add(b, a)
    add(`${b}d`, `${a}d`)
    add(`${b.slice(0, -1)}ing`, `${a.slice(0, -1)}ing`)
    add(`${b}r`, `${a}r`)
    add(`${b}rs`, `${a}rs`)
  }
  // -ll- → -l-
  for (const stem of SINGLE_L_STEMS) {
    add(`${stem}led`, `${stem}ed`)
    add(`${stem}ling`, `${stem}ing`)
    add(`${stem}ler`, `${stem}er`)
    add(`${stem}lers`, `${stem}ers`)
  }
  noun("counsellor", "counselor")
  add("jewellery", "jewelry")
  add("woollen", "woolen")
  add("marvellous", "marvelous")
  add("focussed", "focused")
  add("focusses", "focuses")
  add("focussing", "focusing")
  // -l → -ll
  add("fulfil", "fulfill")
  add("fulfils", "fulfills")
  noun("fulfilment", "fulfillment")
  add("enrol", "enroll")
  add("enrols", "enrolls")
  noun("enrolment", "enrollment")
  noun("instalment", "installment")
  add("instil", "instill")
  add("instils", "instills")
  add("distil", "distill")
  add("distils", "distills")
  add("skilful", "skillful")
  add("wilful", "willful")
  add("enthral", "enthrall")
  add("appal", "appall")
  // -re → -er
  eVerb("centre", "center")
  noun("centrepiece", "centerpiece")
  noun("epicentre", "epicenter")
  for (const prefix of ["", "kilo", "milli", "centi", "nano", "micro"]) {
    noun(`${prefix}metre`, `${prefix}meter`)
    noun(`${prefix}litre`, `${prefix}liter`)
  }
  noun("theatre", "theater")
  noun("fibre", "fiber")
  noun("calibre", "caliber")
  noun("sabre", "saber")
  noun("spectre", "specter")
  noun("sceptre", "scepter")
  noun("mitre", "miter")
  add("sombre", "somber")
  add("lustre", "luster")
  add("meagre", "meager")
  add("ochre", "ocher")
  eVerb("manoeuvre", "maneuver")
  add("manoeuvrable", "maneuverable")
  // -ence → -ense
  noun("licence", "license")
  noun("defence", "defense")
  noun("offence", "offense")
  noun("pretence", "pretense")
  eVerb("practise", "practice")
  // -ogue → -og; "dialogue" and "analogue" stay, they are the American
  // headwords too ("dialog" and "analog" are the computing senses)
  eVerb("catalogue", "catalog")
  // the rest
  verb("grey", "gray")
  add("greyer", "grayer")
  add("greyest", "grayest")
  add("greyish", "grayish")
  add("greyscale", "grayscale")
  add("ageing", "aging")
  noun("artefact", "artifact")
  noun("programme", "program")
  noun("cheque", "check")
  noun("kerb", "curb")
  noun("tyre", "tire")
  verb("mould", "mold")
  verb("plough", "plow")
  noun("sceptic", "skeptic")
  add("sceptical", "skeptical")
  add("scepticism", "skepticism")
  add("storey", "story")
  add("storeys", "stories")
  add("paediatric", "pediatric")
  add("encyclopaedia", "encyclopedia")
  add("mediaeval", "medieval")
  noun("aeroplane", "airplane")
  add("aluminium", "aluminum")
  add("maths", "math")
  add("sulphur", "sulfur")
  add("cosy", "cozy")
  noun("draught", "draft")
  add("speciality", "specialty")
  add("specialities", "specialties")
  eVerb("enquire", "inquire")
  add("enquiry", "inquiry")
  add("enquiries", "inquiries")
  eVerb("orientate", "orient")
  add("learnt", "learned")
  add("dreamt", "dreamed")
  add("whilst", "while")
  add("amongst", "among")
  noun("judgement", "judgment")
  noun("acknowledgement", "acknowledgment")
  add("pyjamas", "pajamas")
  noun("moustache", "mustache")
  add("gaol", "jail")
  return map
}

/** British → American, both lower case. Built above from small tables. */
export const WORDS: ReadonlyMap<string, string> = buildWords()

/** The American spelling of one lower-case word, or undefined when it passes. */
export function american(word: string): string | undefined {
  const listed = WORDS.get(word)
  if (listed !== undefined) return listed
  // A listed word behind a prefix ("unlabelled", "refuelled"); the -ise rule
  // below handles its own prefixes, since "improvise" must not become
  // "im" + "provise".
  const prefix = PREFIX.exec(word)?.[0]
  if (prefix !== undefined) {
    const rest = WORDS.get(word.slice(prefix.length))
    if (rest !== undefined) return `${prefix}${rest}`
  }
  // An -our stem anywhere in the word: "discoloured", "misbehaviour".
  for (const stem of OUR_STEMS) {
    const at = word.indexOf(stem)
    if (at >= 0) {
      return `${word.slice(0, at)}${stem.slice(0, -3)}or${word.slice(at + stem.length)}`
    }
  }
  const ise = ISE.exec(word)
  if (ise?.[1] !== undefined && ise[2] !== undefined) {
    const stem = `${ise[1]}ise`
    if (stem.length >= 6 && !stem.endsWith("wise") && !isIseException(stem)) {
      return `${ise[1]}iz${ise[2]}`
    }
  }
  return undefined
}

function matchCase(source: string, replacement: string): string {
  if (source.length > 1 && source === source.toUpperCase()) {
    return replacement.toUpperCase()
  }
  if (source[0] !== source[0]?.toLowerCase()) {
    return replacement[0]?.toUpperCase() + replacement.slice(1)
  }
  return replacement
}

/** One token of letters, as the tokenizer cuts it: fixed, or unchanged. */
export function fixToken(token: string): string {
  let current = token
  // A word can need two rules ("colourise" → "colorise" → "colorize").
  for (let round = 0; round < 3; round++) {
    const fixed = american(current.toLowerCase())
    if (fixed === undefined) break
    current = matchCase(current, fixed)
  }
  return current
}

const LETTERS = /[A-Za-z]+/g
const TOKENS = /[A-Z]?[a-z]+|[A-Z]+(?![a-z])/g

function mapTokens(line: string, fn: (token: string) => string): string {
  return line.replace(LETTERS, (run) => run.replace(TOKENS, fn))
}

/** Every British spelling in `text`, with the line it is on (1-based). */
export function checkText(text: string, path = ""): Finding[] {
  const findings: Finding[] = []
  text.split("\n").forEach((line, index) => {
    if (line.includes(MARKER)) return
    mapTokens(line, (token) => {
      const fixed = fixToken(token)
      if (fixed !== token) {
        findings.push({
          path,
          line: index + 1,
          word: token,
          replacement: fixed,
        })
      }
      return token
    })
  })
  return findings
}

/** `text` with every British spelling rewritten; marked lines untouched. */
export function fixText(text: string): string {
  return text
    .split("\n")
    .map((line) => (line.includes(MARKER) ? line : mapTokens(line, fixToken)))
    .join("\n")
}

/** Text files without an extension that are checked all the same. */
const EXTENSIONLESS = new Set(["NOTICE"])

export function isChecked(path: string): boolean {
  if (!EXTENSIONS.test(path) && !EXTENSIONLESS.has(path)) return false
  return !SKIPPED.some((skip) =>
    skip.endsWith("/") ? path.startsWith(skip) : path === skip
  )
}

/** Tracked and untracked-but-not-ignored files under `cwd` that get checked. */
export function listFiles(cwd: string): string[] {
  const out = execFileSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  )
  return [...new Set(out.split("\0").filter(Boolean))].filter(isChecked).sort()
}

export function main(argv: string[], cwd = process.cwd()): number {
  const fix = argv.includes("--fix")
  const given = argv.filter((arg) => arg !== "--fix")
  const files = given.length > 0 ? given.filter(isChecked) : listFiles(cwd)
  const findings: Finding[] = []
  let rewritten = 0
  for (const path of files) {
    const text = readFileSync(`${cwd}/${path}`, "utf8")
    const found = checkText(text, path)
    if (found.length === 0) continue
    if (fix) {
      writeFileSync(`${cwd}/${path}`, fixText(text))
      rewritten++
    }
    findings.push(...found)
  }
  for (const f of findings) {
    console.log(`${f.path}:${f.line}: ${f.word} → ${f.replacement}`)
  }
  if (fix) {
    console.log(
      `check-spelling: rewrote ${findings.length} word${findings.length === 1 ? "" : "s"} in ${rewritten} file${rewritten === 1 ? "" : "s"}`
    )
    return 0
  }
  if (findings.length > 0) {
    console.error(
      `check-spelling: ${findings.length} British spelling${findings.length === 1 ? "" : "s"} in ${new Set(findings.map((f) => f.path)).size} file(s); run \`node scripts/check-spelling.ts --fix\` or add \`${MARKER}\` to a line that must keep one`
    )
    return 1
  }
  console.log(`check-spelling: ${files.length} files clean`)
  return 0
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exit(main(process.argv.slice(2)))
}
