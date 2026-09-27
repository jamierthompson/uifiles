export const meta = {
  name: 'fix-round-3',
  description: 'Fix round-3 QA findings per owner group, refute-verify each fix, run a completeness critic',
  phases: [
    { title: 'Fix', detail: 'one Opus coder per owner group (disjoint files)', model: 'opus' },
    { title: 'Verify', detail: 'three independent refuters per group; repair once if refuted' },
    { title: 'Manifest', detail: 'apply reported docs strings to the registry manifests', model: 'opus' },
    { title: 'Critic', detail: 'what is still missing across the whole tree' },
  ],
}

// args: { groups: [{ key, files: [...], findings: "...", reports: [...] }], brief: "<path>" }
const BRIEF = args.brief
const GROUPS = args.groups

const FIX_SCHEMA = {
  type: 'object',
  properties: {
    fixed: { type: 'array', items: { type: 'string' } },
    notFixed: { type: 'array', items: { type: 'string' } },
    testsChanged: { type: 'array', items: { type: 'string' } },
    filesChanged: { type: 'array', items: { type: 'string' } },
    registryEntryChanges: { type: 'string' },
    commands: { type: 'string' },
    report: { type: 'string' },
  },
  required: ['fixed', 'notFixed', 'testsChanged', 'filesChanged', 'report'],
}

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    refuted: { type: 'boolean' },
    problems: { type: 'array', items: { type: 'string' } },
    evidence: { type: 'string' },
  },
  required: ['refuted', 'problems', 'evidence'],
}

const CRITIC_SCHEMA = {
  type: 'object',
  properties: {
    missing: { type: 'array', items: { type: 'string' } },
    blocking: { type: 'array', items: { type: 'string' } },
    verdict: { type: 'string' },
    report: { type: 'string' },
  },
  required: ['missing', 'blocking', 'verdict', 'report'],
}

function fixPrompt(g, attempt, priorProblems) {
  return `You are a fresh coder. Read ${BRIEF} first (it points to the round-1 and round-2 fix briefs; all their rules apply: file ownership, no commits, no build/dev/e2e/server commands, prove fixes with tests that failed first, mutation-check, three runs, report format).

Your lens name is \`${g.key}\` (attempt ${attempt}). You own ONLY these files (edit nothing else; report needs elsewhere under "Requests for other owners"):
${g.files.map((f) => `- ${f}`).join('\n')}

Read these round-3 QA reports in full: ${g.reports.join(', ')}.

Findings to fix (ids refer to those reports):
${g.findings}
${priorProblems ? `\nA verifier refuted your previous attempt with these problems; address every one:\n${priorProblems}\n` : ''}
Migrate the round-3 reproducers for your files from the qa-round3 test files named in the reports into the canonical test files (rename by behaviour) and delete the qa-round3 file when the reports say you own it. Then run your test files three times, biome/prettier on your files, and \`pnpm exec tsc --noEmit\`.

Write the full report to /docs/qa/round3/fix-${g.key}.md and return the structured summary.`
}

function verifyPrompt(g, fix, lens) {
  return `You are an adversarial verifier with no prior context. A coder claims to have fixed round-3 QA findings for the \`${g.key}\` group. Your lens: ${lens}. Default to refuted=true if you are not convinced.

Read ${BRIEF} (environment facts, rules: do not edit tracked files, no build/dev/e2e/server commands). Read the coder's report /docs/qa/round3/fix-${g.key}.md and the QA reports ${g.reports.join(', ')}.

The findings that were supposed to be fixed:
${g.findings}

Coder's summary: fixed=${JSON.stringify(fix.fixed)}; notFixed=${JSON.stringify(fix.notFixed)}; filesChanged=${JSON.stringify(fix.filesChanged)}.

Do: read every changed file; run the coder's test files (\`pnpm exec vitest run --project browser <file>\` or \`--project unit\`) three times; for at least three of the fixes, copy the source to a scratch dir, patch the fix out, run the test, restore byte-identically (git diff --stat must be empty for it) and confirm the test fails; check no round-3 reproducer file the coder owns remains; check \`pnpm exec tsc --noEmit\`, \`pnpm exec biome check <changed files>\`, \`pnpm exec prettier --check <changed files>\`; check that \`notFixed\` items have a sound reason. Refute if any fix is missing, wrong, untested, or leaves the tree dirty/red. List concrete problems with file:line and the command output that shows them.`
}

const VERIFY_LENSES = ['correctness of the fix', 'test quality and mutation resistance', 'regressions and side effects on neighbours']

phase('Fix')
const results = await pipeline(
  GROUPS,
  (g) => agent(fixPrompt(g, 1), { label: `fix:${g.key}`, phase: 'Fix', schema: FIX_SCHEMA, model: 'opus', agentType: 'general-purpose' }),
  async (fix, g) => {
    if (!fix) return null
    let current = fix
    for (let attempt = 1; attempt <= 2; attempt++) {
      const votes = (await parallel(VERIFY_LENSES.map((lens) => () =>
        agent(verifyPrompt(g, current, lens), { label: `verify:${g.key}:${lens.split(' ')[0]}`, phase: 'Verify', schema: VERDICT_SCHEMA, agentType: 'general-purpose' })
      ))).filter(Boolean)
      const refuted = votes.filter((v) => v.refuted)
      if (refuted.length === 0) return { group: g.key, fix: current, verified: true, attempts: attempt }
      if (attempt === 2) return { group: g.key, fix: current, verified: false, attempts: attempt, problems: refuted.flatMap((v) => v.problems) }
      const problems = refuted.flatMap((v) => v.problems).map((p) => `- ${p}`).join('\n')
      log(`${g.key}: refuted by ${refuted.length}/${votes.length} verifiers; repairing`)
      const repaired = await agent(fixPrompt(g, attempt + 1, problems), { label: `repair:${g.key}`, phase: 'Fix', schema: FIX_SCHEMA, model: 'opus', agentType: 'general-purpose' })
      if (!repaired) return { group: g.key, fix: current, verified: false, attempts: attempt, problems: refuted.flatMap((v) => v.problems) }
      current = repaired
    }
    return null
  }
)

phase('Manifest')
const MANIFEST_SCHEMA = {
  type: 'object',
  properties: { applied: { type: 'array', items: { type: 'string' } }, corrected: { type: 'array', items: { type: 'string' } }, report: { type: 'string' } },
  required: ['applied', 'corrected', 'report'],
}
const manifest = await agent(`You are a fresh coder integrating deferred manifest changes. Read ${BRIEF}. You own ONLY registry/ai/registry.json and registry/blocks/registry.json. Read every round-3 fix report (/docs/qa/round3/fix-*.md) and apply each "Registry entry changes" string, verifying every sentence against the current source file first (correct the string to the code when they disagree and say so). Keep the Base UI sentence first in every docs; descriptions ≤ 900 chars; items sorted; run pnpm exec prettier --write on both files, pnpm registry:validate, pnpm exec vitest run --project unit. Do not commit. Write a report to /docs/qa/round3/fix-manifest.md and return the structured summary.`, { label: 'manifest', phase: 'Manifest', schema: MANIFEST_SCHEMA, model: 'opus', agentType: 'general-purpose' })

phase('Critic')
const summary = results.filter(Boolean).map((r) => `- ${r.group}: verified=${r.verified} attempts=${r.attempts}${r.problems ? ` problems=${JSON.stringify(r.problems)}` : ''}`).join('\n')
const critic = await agent(`You are a completeness critic with no prior context. Read ${BRIEF}. Three QA rounds and three fix rounds have run on <repo>; the round-3 fix results are:\n${summary}\n\nRead every round-3 QA report (/docs/qa/round3/*.md) and every fix report there (fix-*.md). Then answer: what is still missing before this registry is shared publicly and submitted to the shadcn directory? Check: any finding rated blocker/high in any round that is not verifiably fixed in the current tree (grep the code, run the test); any leftover qa-round* files or in-place mutations (\`git status --porcelain\`, and \`git diff\` for tracked files); any claim in README/AGENTS/CHANGELOG/docs/architecture.md contradicted by the code; the gate commands (\`pnpm format:check\`, \`pnpm lint\`, \`pnpm typecheck\`, \`pnpm registry:validate\`, \`pnpm exec vitest run\`) green; anything the reviewers said they could not reach that a maintainer must do before release. Do not edit tracked files. Return a verdict (ship / not yet) with the blocking list and write a full report to /docs/qa/round3/critic.md.`, { label: 'critic', phase: 'Critic', schema: CRITIC_SCHEMA, agentType: 'general-purpose' })

return { results: results.filter(Boolean), manifest, critic }
