# Fix round 2: common brief for every fixer

You are a fresh coder. Read `/docs/qa/round1/BRIEF-fix-common.md` first: its "What the repo is", "Environment facts", "Cite, don't remember", "File ownership", "Engineering rules", "Test rules", "Do not" and "Report" sections all still apply, with these differences:

- The round-1 fixes are in. The test suite is now 991 tests, all green; `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm registry:validate` are clean; `pnpm build` passes. Keep it that way: every command you run on your files must stay green.
- The browser project has a fail-on-console guard (`tests/setup.ts`, `allowConsole()` opts a single test out; never silence React errors with `vi.spyOn(console, …).mockImplementation`) and shared helpers in `tests/a11y.ts`.
- A PRODUCTION server (`pnpm start`) runs on `http://localhost:3000`; do not start or stop servers.
- Round-2 QA reports live in `/docs/qa/round2/<lens>.md` and their reproducers in `tests/browser/qa-round2/<lens>.test.tsx` / `tests/unit/qa-round2-<lens>.test.ts` (committed; if a file is gone, `git show 1e732c0:<path>`). Read the round-2 report(s) named in your prompt in full: Findings, Mutation log, Test-quality issues.
- Migrate every round-2 reproducer for your files into the canonical test files (rename by behaviour; drop exotica) and delete the round-2 file when your prompt says you own it. Tests the reviewer wrote to kill a survived mutation are mandatory to migrate.
- Fix every test-quality issue the reviewer listed for your files (fixtures in `<main>`, no fixed sleeps where a poll works, no `vi.spyOn` silencing, no wall-clock timing assertions: use fake timers, misnamed tests, vacuous assertions).
- Registry manifests (`registry/**/registry.json`) are still off-limits to component fixers: put exact replacement `docs`/`description` strings under `## Registry entry changes`.
- Server-component preview pages you own may export `metadata = { title: "<Name>" }` (Next 16 app router; read `node_modules/next/dist/docs/` on `metadata` exports); client pages cannot.
- Prove each fix with a test that failed first; mutation-check it; run each test file three times.
- Report to `/docs/qa/round2/fix-<lens>.md` in the round-1 report format.
