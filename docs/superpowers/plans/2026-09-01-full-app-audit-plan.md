# Full-App Audit Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) to execute this plan task-by-task — each task below is an independent, read-only investigation and maps to one dispatched subagent. superpowers:dispatching-parallel-agents applies too, since Tasks 1–7 have no dependencies on each other and can run concurrently; only Task 8 (compiling the report) depends on all of them finishing. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a single, prioritized Audit Report covering the lesson/problems system, the multiplayer game (client + Cloud Functions), Firebase configuration, the Vitest test suite, internal tooling (voice-clips generator), and overall project structure/architecture — with every finding tagged `critical` / `high` / `low`.

**Architecture:** This is a review plan, not an implementation plan — no code is written or changed during audit execution. Each task is a bounded, read-only investigation of one subsystem (already scoped against the codebase inventory below) that produces a findings section. Task 8 merges all findings sections into one report file. No task modifies application code, tests, or config — the audit only *proposes* fixes; implementing them is a separate, later effort explicitly out of scope for this plan (per CLAUDE.md's Workflow section: no PRs, verify locally, then request merge approval — that applies to the *fix* work, not this audit).

**Tech Stack under audit:** Svelte 5 (runes, no SvelteKit/router) + Vite + TypeScript, Firebase (RTDB, Cloud Functions v2, Anonymous Auth, App Hosting), Vitest + fake-indexeddb, GSAP, a Node/Replicate-based internal voice-clip generator.

**Spec:** This plan is scoped directly from the user's audit request (2026-09-01) and the codebase inventory gathered via an Explore subagent survey the same day (file/line counts below reflect that survey and may drift slightly by execution time — each task should re-confirm current line counts rather than trust this document blindly).

## Global Constraints

- **Read-only during audit.** No task in this plan edits application source, tests, Firebase rules, or config. Findings are documented, not fixed, here.
- **No unapproved installs.** If a task identifies a tooling gap that would require installing a package (e.g. `@vitest/coverage-v8` for coverage numbers, `@testing-library/svelte` for component tests), do **not** install it to produce the audit — note the gap as a finding and let the user approve the install separately.
- **Priority tags are `critical` / `high` / `low` only** (no "medium") — see rubric below. Every finding in the final report must carry exactly one tag.
- **Use `pedagogy-review`** for any finding touching instructional design, scaffolding, feedback loops, or difficulty progression in the lesson or multiplayer game — this is a standing CLAUDE.md requirement, not optional for this audit.
- **`security-review` and `code-review` are diff-scoped tools** (they review "pending changes on the current branch"). Since there is no in-flight diff to review here, don't invoke them expecting a full-codebase report — use them only if the audit branch ends up with actual proposed diffs (e.g. a rules-file tightening) that need a second look; otherwise rely on the manual checklists in each task below.
- **Superpower skills are approved for this task** (user confirmed 2026-09-01) — this approval does not carry to other agents/sessions.
- **When fixes are eventually implemented from this report:** follow CLAUDE.md's Workflow (no PRs; verify locally; explicitly request merge approval) and bump `problemSetVersion` on `Addition1Content` (currently `2`) if any problem's prompt/groups/answer changes.

## Priority Rubric

Apply consistently across all tasks:

- **`critical`** — Actively broken, insecure, or blocking: data-integrity bugs in the shared multiplayer total, a write path that bypasses intended access control, a defect that can strand a student mid-lesson, or a deployment/config error that means the app cannot actually ship. Fix before anything else.
- **`high`** — Real, bounded-impact gap: incorrect/missing pedagogy or evaluation logic, an authoritative code path (Cloud Functions, problem content) with no test coverage, a documented tech-stack decision (e.g. Performance Monitoring/Analytics logging) that isn't actually implemented, a resource leak (e.g. GSAP not cleaned up on unmount). Fix soon.
- **`low`** — Code quality, duplication, missing nice-to-have coverage, or a doc/reality mismatch with no real user-facing impact. Fix opportunistically.

---

### Task 0: Report skeleton and rubric sign-off

**Files:**
- Create: `docs/audit/2026-09-01-app-audit-report.md`

- [ ] **Step 1:** Create the report file with one `##` section per Task 1–7 below (Project Structure, Lesson & Problems, Multiplayer, Firebase Config, Vitest/Testing, Internal Tools, Cross-Cutting), a `## Priority Rubric` section (copy the rubric above verbatim so the report is self-contained), and a `## Summary Table` section (columns: Finding | File(s) | Priority | Subsystem) left empty for Task 8 to fill in.
- [ ] **Step 2:** Confirm with the user that the rubric's three tiers (no "medium") are still what they want before the real audit tasks begin, since every downstream finding depends on it.

---

### Task 1: Project structure & architecture audit

**Areas:**
- `package.json`, `vite.config.js`, `svelte.config.js`, `tsconfig.json`
- `src/App.svelte`, `src/main.js`, top-level loose files (`AdminTools.svelte`, `DebugOverlay.svelte`, `adminSettings.svelte.ts`, `app.css`, `svelte.d.ts`)
- `src/lessons/` vs `src/multiplayer/` module boundaries; absence of a `stores/` dir (state lives in `.svelte.ts` rune classes instead)
- `docs/superpowers/specs/` and `docs/superpowers/plans/` (design docs) vs. actual code — check for drift between what was designed and what was built
- `design/counting-problems/` mockups — confirm these are truly unused design artifacts and not stale references from code
- `dist/` — confirm it's gitignored and not accidentally committed

**Method:** Manual read-through (these are all small config files) + `git check-ignore -v dist firebase/functions/lib` to confirm build artifacts are ignored + `grep`/`Grep` for any import of `design/` files from `src/`.

**Checklist (anticipated priority in parens — confirm or revise during audit):**
- [ ] Is `dist/` (and `firebase/functions/lib/`) actually gitignored, or committed as build output? (`low` if ignored and clean; `high` if committed build artifacts are tracked and drifting from source)
- [ ] Does the hand-rolled `view` state switch in `App.svelte` (no router) create any dead-end navigation states (e.g. browser back button, deep linking) that matter for this app's usage pattern? (`low` — likely fine for a kiosk-style single-session app, but confirm)
- [ ] Do the three design docs under `docs/superpowers/specs/`/`plans/` still match the current `lessonContent.ts`/`Addition1Content` implementation, or has the code diverged from the documented design? (`low`)
- [ ] Is there any dead code among the root-level loose `.svelte`/`.ts` files (unused exports, orphaned components)? (`low`)

**Deliverable:** Fill in the `## Project Structure` section of the report with confirmed findings, each tagged.

---

### Task 2: Lesson content & problems audit

**Areas:**
- `src/lessons/lessonContent.ts` (base `LessonContent` class)
- `src/lessons/content/addition-1-Content.ts` (10 hardcoded problems, `contentVersion = 2`, `problemSetVersion = 2`)
- `src/lessons/content/addition-1-Evaluation.ts`, `addition-1-EvaluationRecorder.ts`, `addition-1-LessonProgress.ts`
- `src/lessons/content/addition-1-screens/` (`IntroScreen.svelte`, `CountingCombiningScreen.svelte`, `GroupsDisplay.svelte`, `introSteps.ts`, `countingCombiningSteps.ts`)
- `src/lessons/progression.ts` + `progression.test.ts`
- `src/lessons/evaluation/` (`evaluationRecorder.ts`, `evaluationTypes.ts`, `submitEvaluators.ts`, `behavioralDetectors.ts`, `evaluationStorage.ts`) and their test files
- `src/lessons/progressStorage.ts`, `lessonProgress.svelte.ts`

**Method:** Invoke **`pedagogy-review`** against the addition-1 lesson flow (instruction screens → problems → completion) and the evaluators/behavioral-detectors specifically — this is the CLAUDE.md-mandated check for scaffolding, feedback loops, and difficulty progression against CCSS 2.MD.C.8. Separately, manually verify problem-data correctness (each `Addition1Problem.answer` actually equals the sum of its `groups[].count`) since there is no automated schema/validator for this today. Run `npm run test -- src/lessons` and `npm run check` (svelte-check) to catch any current failures.

**Checklist:**
- [ ] Pedagogy review of the 10 addition-1 problems' difficulty progression and the intro→problems→complete phase flow, via `pedagogy-review` (`high` if scaffolding/feedback gaps found — this is the capstone lesson)
- [ ] Manually verify all 10 problems' `answer` fields match their `groups` sums — there is no build-time check for this (`critical` if any mismatch is found — a wrong answer key directly breaks the lesson; `high` for the missing validation tooling itself even if no current mismatch exists)
- [ ] Confirm `problemSetVersion`/`contentVersion` bump discipline has actually been followed historically for this file (check git history) and that the evaluation recorder's stamped version matches what's live (`low`)
- [ ] Review `evaluationRecorder.ts` (307 lines) and its behavioral detectors (`detectDistraction`, `detectRageClicks`) for false-positive/false-negative risk — a miscalibrated detector could misclassify normal child behavior as "distracted" or "raging" (`high`, since this is the CLAUDE.md-cited answer-evaluation recorder driving pedagogy decisions)
- [ ] Check whether `problems.adaptations: unknown[]` in `progression.ts`'s `Progress` type is dead/unused or planned-but-unwired (`low`)
- [ ] Confirm `npm run test -- src/lessons` and `npm run check` currently pass clean (`critical` if either is currently red — a broken baseline blocks everything downstream)

**Deliverable:** Fill in `## Lesson & Problems` section.

---

### Task 3: Multiplayer game audit (client + Cloud Functions)

**Areas:**
- Client: `src/multiplayer/gameSession.svelte.ts` (225 lines — RTDB sync, `signInAnonymously`, `onValue`/`onDisconnect`, warmup call), `MultiplayerScreen.svelte`, `OtherPlayerColumn.svelte`, `CharacterQueue.svelte`, `CoinJar*.svelte`, `CoinScatter.svelte`
- Cloud Functions: `firebase/functions/src/joinGame.ts`, `submitAnswer.ts`, `coinProblem.ts`, `rateLimit.ts`, `playerNames.ts`, `gameConfig.ts`
- `firebase/database.rules.json`

**Method:** Invoke **`pedagogy-review`** on the coin-counting game's feedback loop (does a correct/incorrect answer give the child clear, timely feedback; does the shared "total money" concept reinforce or confuse the counting objective). Manually trace both RTDB transactions in `submitAnswer.ts` (the answer-correctness transaction and the `totalMoney` increment transaction) for race conditions across up to 20 concurrent players. Spin up `npx firebase emulators:start` and drive `joinGame`/`submitAnswer` directly (or via the running app pointed at emulators) to observe rule enforcement live, since Cloud Functions have zero automated tests today. Read `database.rules.json` line-by-line against the threat model in CLAUDE.md (explicitly out of scope: anti-cheat, chat, profiles).

**Checklist:**
- [ ] Do the two RTDB transactions in `submitAnswer.ts` (per-player result + `totalMoney` increment) correctly serialize under concurrent submissions from many players, with no lost-update window? (`critical` if a race can corrupt the shared total; this is the one piece of "money-like" shared state in the whole app)
- [ ] Zero test coverage exists for `joinGame.ts`, `submitAnswer.ts`, `coinProblem.ts`, `rateLimit.ts`, `playerNames.ts` — confirm this and scope what a minimal authoritative-logic test suite would need to cover (`high` — this is the CLAUDE.md-designated single source of truth for multiplayer state)
- [ ] Verify `MAX_PLAYERS = 20` in `gameConfig.ts` is actually enforced atomically in `joinGame.ts`'s seat-assignment transaction (no window where 21+ players can join) (`high`)
- [ ] Confirm `database.rules.json` default-deny posture holds for every path, including the `rateLimits/{uid}` path used by `rateLimit.ts` (Admin SDK bypasses rules, but confirm no client path can read/write it) (`high` — worth explicit verification even though the inventory suggests it's fine by default-deny)
- [ ] Confirm the `firstPlayer`/warmup mechanism actually fires exactly once per empty-room transition and that the fire-and-forget `submitAnswer({warmup:true})` call failing silently (e.g. on a flaky network) doesn't produce a visible cold-start delay for that player's *real* first answer anyway (`low` — it's a latency optimization, not correctness-critical)
- [ ] Pedagogy review of the coin-game's answer feedback loop and whether "total money" reinforces or distracts from the CCSS 2.MD.C.8 counting objective (`high`, per CLAUDE.md's mandated pedagogy-review requirement)
- [ ] Confirm no client-writable RTDB path lets a player directly set `totalMoney` or another player's `lastAward`/`problem` (bypassing Cloud Functions) (`critical` if found — direct rule bypass of the stated authoritative-state design)

**Deliverable:** Fill in `## Multiplayer` section.

---

### Task 4: Firebase config & deployment audit

**Areas:**
- `firebase/firebase.json`, `firebase/.firebaserc`, `firebase/apphosting.yaml`
- `firebase/database.rules.json` (cross-reference with Task 3's rules findings, don't duplicate — just confirm consistency)
- `src/lib/firebase.js` (client SDK init/config)
- `firebase/functions/package.json`, `tsconfig.json`, `.eslintrc.js`
- `.env` (root, gitignored — confirm no other `.env` files exist and nothing is leaking into git)

**Method:** Manual read of every config file listed. Run `git log --all --full-history -- '**/.env*'` and `git log -p -- firebase/functions/lib` (or similar) to confirm no secrets were ever committed. Check `.gitignore` covers `.env`, `dist/`, and `firebase/functions/lib/`.

**Checklist:**
- [ ] `firebase.json` has no `hosting` block, only `apphosting` — CLAUDE.md says "Hosting: Firebase Hosting" but the actual config uses Firebase App Hosting, a different product. Determine which is actually intended and reconcile the doc or the config. (`critical` to *resolve which is true* — if the intended deploy target and the actual config genuinely disagree, the app may not be deployable as documented at all; downgrade to `low` if this turns out to be an intentional, already-known switch to App Hosting that CLAUDE.md just hasn't caught up to)
- [ ] Confirm no API keys/tokens beyond the expected client Firebase config (non-secret by design) appear in any committed file; specifically confirm `REPLICATE_API_TOKEN` has never been committed (`critical` if a real secret is found in git history)
- [ ] Confirm `firebase/apphosting.yaml`'s commented-out secrets/env sections are genuinely inert (no live env vars silently in effect) (`low`)
- [ ] No App Check is configured — confirm this is an accepted risk consistent with CLAUDE.md's stated threat model (no anti-cheat needed yet), not an oversight (`low` per current threat model; flag for revisit if the threat model ever changes)
- [ ] Confirm `firebase/functions`'s `predeploy: npm run lint && npm run build` actually runs clean today (`high` if broken — blocks any deploy)

**Deliverable:** Fill in `## Firebase Config` section.

---

### Task 5: Vitest / testing coverage audit

**Areas:**
- `vite.config.js` (`test.include`), root `package.json` `test` script
- All 13 existing test files under `src/lessons/` and `src/multiplayer/`
- Confirmed-untested authoritative code: `firebase/functions/src/*.ts`, `src/multiplayer/gameSession.svelte.ts`, all `.svelte` components (no `@testing-library/svelte` present), `tools/voice-clips-generator/*.ts`

**Method:** Run `npm run test` and `npm run check` fresh to confirm current green/red baseline. Do **not** install `@vitest/coverage-v8` or any testing-library package to generate this audit (see Global Constraints) — instead produce a manual coverage map (tested vs. untested file list) from the file inventory, which is already largely done above.

**Checklist:**
- [ ] Confirm `npm run test` and `npm run check` both currently pass with no failures/type errors (`critical` if either is red — that's a broken baseline, not a future risk)
- [ ] No test coverage for any Cloud Function (`joinGame`, `submitAnswer`, `coinProblem`, `rateLimit`, `playerNames`) — cross-reference with Task 3's finding, report once (`high`)
- [ ] No test coverage for `gameSession.svelte.ts`, the 225-line client multiplayer sync core (`high`)
- [ ] No component-level tests for any `.svelte` file, and no `@testing-library/svelte` dependency to write them with — note as a gap, do not install (`low` given this is a two-view app with mostly presentational components, but call out `AdminTools.svelte`'s reset/toggle logic and `CoinJarDeposit.svelte`'s GSAP-driven visuals specifically as the two components where a regression would be hardest to catch manually)
- [ ] No coverage-percentage tooling configured at all — note as a gap requiring an install the user must approve (`low`)
- [ ] `tools/voice-clips-generator/*.ts` has no tests, but is build-time-only tooling not shipped in the app — confirm this is acceptably low priority (`low`)

**Deliverable:** Fill in `## Vitest / Testing` section.

---

### Task 6: Internal tools audit (voice-clips generator)

**Areas:**
- `tools/voice-clips-generator/generate-voice-clips.ts` (455 lines), `clean-voice-clips.ts` (391 lines), `manifest.json` (352 lines), `README.md`
- `src/assets/lesson/addition-1/transcripts/` and `src/assets/general/numbers/` (generated output)
- `package.json` scripts: `generate:voice-clips`, `clean:voice-clips`

**Method:** Read both scripts end-to-end (they're the two largest files in this subsystem) plus the README. Check the currently-modified `.wav` files and new `begin.wav` shown in git status against `manifest.json` to see if the manifest is stale relative to on-disk clips (this looks live/in-progress right now, so note it rather than treating it as settled).

**Checklist:**
- [ ] Does `manifest.json` currently match the on-disk `.wav` files, given git status shows several transcript `.wav` files modified and one (`begin.wav`) untracked/new? (`low` — likely just in-progress work, not a defect, but confirm the generator was actually re-run rather than the files being hand-edited)
- [ ] `clean-voice-clips.ts` depends on an external `ffmpeg`/`ffprobe` binary on `PATH` with no in-repo version pin or check — confirm the README documents the required version clearly and that a missing/wrong ffmpeg fails loudly rather than silently producing bad audio (`low`)
- [ ] Confirm `REPLICATE_API_TOKEN` handling in `generate-voice-clips.ts` never logs the token value (e.g. in error messages, `--dry-run` output, or the manifest) (`high` if a secret-leak path is found, otherwise `low`)
- [ ] Confirm the rate-limit pacing (10.1s between calls, abort on 429) is still correct against Replicate's current published rate limits — note if this needs re-verifying against current docs, but don't deep-dive Replicate's API in this audit (`low`)

**Deliverable:** Fill in `## Internal Tools` section.

---

### Task 7: Cross-cutting audit

**Areas:**
- GSAP cleanup across all 8 files using GSAP: `lessonContent.ts` (doc-comment only, skip), `celebration.svelte.ts`, `LessonProblems.svelte`, `LessonComplete.svelte`, `Balloon.svelte`, `CountingCombiningScreen.svelte`, `CoinJarDeposit.svelte`, `OtherPlayerColumn.svelte`
- Three independent raw IndexedDB implementations: `src/lessons/progressStorage.ts`, `src/lessons/evaluation/evaluationStorage.ts`, `src/multiplayer/musicSettingsStorage.ts`
- Documented-vs-implemented gap: CLAUDE.md states Firebase Performance Monitoring + Analytics-event error logging is the crash-monitoring strategy; no `getPerformance`/`getAnalytics`/`logEvent` calls exist anywhere in `src/`
- Unauthenticated `AdminTools.svelte` / `DebugOverlay.svelte` / Simple-Multiplayer toggle, visible to every visitor with no gating

**Method:** Use the **`gsap-svelte-cleanup`** skill's checklist against each of the 7 real GSAP-using files (confirm `.kill()`/`.revert()` on unmount for every tween/timeline/ScrollTrigger). Diff the three IndexedDB storage files side-by-side for structural duplication. Grep the full `src/` tree for `getPerformance|getAnalytics|logEvent|firebase/performance|firebase/analytics` to confirm the monitoring gap. Read `AdminTools.svelte` (280 lines) fully to enumerate exactly what an unauthenticated visitor can do (phase-jump, view evaluation log, toggle Simple Multiplayer, reset progress).

**Checklist:**
- [ ] Run the `gsap-svelte-cleanup` pattern check against all 7 GSAP-using files; report any tween/timeline not killed on unmount (`high` per file with a confirmed leak — repeated mount/unmount during a session, e.g. re-entering the lesson via Admin Tools' phase-jump, would compound the leak)
- [ ] CLAUDE.md documents Firebase Performance Monitoring + Analytics-event logging as the crash-monitoring strategy; confirm zero implementation exists and decide whether to flag as a gap to build or update CLAUDE.md (`high` — currently *no* error/crash visibility exists in production, contradicting the documented plan)
- [ ] Three separate raw `indexedDB.open(...)` implementations with no shared abstraction — assess whether the duplication is causing actual inconsistency (e.g. differing error handling, version-upgrade handling) or is just harmless repetition (`low` unless a real inconsistency is found, in which case `high`)
- [ ] Enumerate exactly what `AdminTools.svelte`/`DebugOverlay.svelte`/the Simple-Multiplayer toggle expose to an unauthenticated visitor, and confirm each is genuinely acceptable under CLAUDE.md's stated "no teacher/admin authorization exists yet" posture — pay specific attention to whether the evaluation-log panel exposes another student's behavioral data in the shared multiplayer context, and whether the Simple-Multiplayer toggle is global (affects all 20 players) or per-viewer (`critical` if any *other* player's individual data or progress is exposed/alterable through this panel; `low` if it only ever exposes the current browser's own local session data)

**Deliverable:** Fill in `## Cross-Cutting` section.

---

### Task 8: Compile the final Audit Report

**Files:**
- Modify: `docs/audit/2026-09-01-app-audit-report.md`

- [ ] **Step 1:** Once Tasks 1–7 have each filled in their section, populate the `## Summary Table` with every finding across all sections, sorted `critical` → `high` → `low`.
- [ ] **Step 2:** Add a `## Long-Term / Not Deeply Investigated` section (see seed list below) — one line each, no further research per the user's instruction to not dig into long-term items now.
- [ ] **Step 3:** Present the completed report to the user and stop — per this plan's Global Constraints, no fixes are implemented as part of this audit. Actual remediation is a separate, later effort that follows CLAUDE.md's Workflow (verify locally, no PRs, request merge approval).

**Seed list for the Long-Term section (noted, not researched):**
- Add `@testing-library/svelte` and component-level tests (requires install approval)
- Add `@vitest/coverage-v8` and wire a coverage script (requires install approval)
- Consolidate the three raw IndexedDB implementations into one shared helper
- Add CI to run `npm run test` + `npm run check` automatically
- Consider Firebase App Check if/when the stated "no anti-cheat needed" threat model ever changes
- Consider whether behavioral-data logging (rage-click/distraction detection, evaluation findings) for a child user has any privacy/compliance dimension (e.g. COPPA) worth a dedicated legal/policy review — flagged only, not assessed here
- Reconcile `docs/superpowers/specs/` design docs with implementation drift as the lesson content system evolves

---

## Self-Review

**Spec coverage:** Lesson ✅ (Task 2), Problems ✅ (Task 2), Multiplayer ✅ (Task 3), Vitest ✅ (Task 5), Internal tools/voice generation ✅ (Task 6), Firebase config ✅ (Task 4), Project structure/architecture ✅ (Task 1), cross-cutting concerns not in the user's original list but surfaced by the inventory ✅ (Task 7), priority tags on every checklist item ✅, long-term items noted without deep research ✅ (Task 8 seed list).

**Placeholder scan:** No "TBD"/"handle appropriately" items — every checklist line names the exact file(s), the exact concern, and an anticipated priority with the condition that would raise/lower it.

**Consistency check:** File paths, line counts, and function names above match the 2026-09-01 codebase inventory; anyone executing this plan should re-confirm current line counts since the repo is actively changing (git status shows in-flight voice-clip work).
