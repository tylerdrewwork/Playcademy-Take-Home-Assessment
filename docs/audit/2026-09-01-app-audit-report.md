# Full-App Audit Report — 2026-09-01 (Part 1: Tasks 1–3)

Generated from `docs/superpowers/plans/2026-09-01-full-app-audit-plan.md`. **This report covers Task 1 (project structure & architecture), Task 2 (lesson content & problems), and Task 3 (multiplayer game) only** — Tasks 4–7 (Firebase config, Vitest coverage, internal tools, cross-cutting concerns) were stopped mid-run at the user's request and are deferred; re-run them from the plan file when ready to continue.

## Priority Rubric

- **`critical`** — Actively broken, insecure, or blocking: data-integrity bugs in the shared multiplayer total, a write path that bypasses intended access control, a defect that can strand a student mid-lesson, or a deployment/config error that means the app cannot actually ship. Fix before anything else.
- **`high`** — Real, bounded-impact gap: incorrect/missing pedagogy or evaluation logic, an authoritative code path with no test coverage, a documented tech-stack decision that isn't actually implemented, a resource leak. Fix soon.
- **`low`** — Code quality, duplication, missing nice-to-have coverage, or a doc/reality mismatch with no real user-facing impact. Fix opportunistically.

## Summary Table

| # | Finding | File(s) | Priority | Subsystem |
|---|---|---|---|---|
| 1 | "We do" step has no interactive practice — student is told to touch balloons but no click handler exists anywhere | `countingCombiningSteps.ts:29-31`, `CountingCombiningScreen.svelte:94-103`, `Balloon.svelte:37` | **high** | Lesson |
| 2 | Wrong-answer feedback is generic ("Not quite — try again") despite the app already computing *why* it's wrong | `LessonProblems.svelte:330-332`, `addition-1-Evaluation.ts:24-46` | **high** | Lesson |
| 3 | Problem difficulty is fixed/non-adaptive; `adaptations` field exists but is dead/unwired | `addition-1-Content.ts:31-40`, `progression.ts:29,59` | **high** | Lesson |
| 4 | No comprehension gate between instruction phases — advance is timer/narration-driven only | `CountingCombiningScreen.svelte:105-136` | **high** | Lesson |
| 5 | No automated check that `answer === sum(groups[].count)`; all 10 current problems are correct, but nothing would catch a future mistake | `addition-1-Content.ts`, `addition-1-Content.test.ts` | **high** | Lesson |
| 6 | Behavioral detectors (`detectDistraction`, `detectRageClicks`) likely misclassify normal child behavior (tracing objects while counting, excited double-taps) as distraction/rage-clicking | `behavioralDetectors.ts:7-61,103-211` | **high** | Lesson |
| 7 | `submitAnswer.ts` has no idempotency guard — a retried/duplicated call for an already-answered problem could double-award cents into the shared `totalMoney` | `submitAnswer.ts:92-127` | **high** | Multiplayer |
| 8 | Zero test coverage for any Cloud Function (`joinGame`, `submitAnswer`, `coinProblem`, `rateLimit`, `playerNames`) | `firebase/functions/src/*.ts` | **high** | Multiplayer |
| 9 | Coin-game jumps straight to multi-denomination coins (up to 100¢) with no built-in ramp; the only easier mode is admin-only, not student-progressed | `coinProblem.ts:1-2,6,14`, `MultiplayerScreen.svelte` | **high** | Multiplayer |
| 10 | Coin-game feedback on a wrong answer is generic, with no per-coin/denomination diagnostic | `MultiplayerScreen.svelte:297` | **high** | Multiplayer |
| 11 | "Total money" (sum of each player's own separately-counted coin pile) is a task-design mismatch with the lesson's "combine two groups" framing | `submitAnswer.ts:122-126` | **high** | Multiplayer |
| 12 | Balloon-rendering accessibility: every balloon is `aria-hidden="true"` with no accessible count exposed, in a lesson whose entire task is counting objects | `Balloon.svelte:37` | low | Lesson |
| 13 | `design/counting-problems/counting-problems-mockup.html` is a 2.4MB tracked file with zero references from `src/` | `design/counting-problems/` | low | Structure |
| 14 | Design docs (`docs/superpowers/specs/*.md`) have drifted from implementation (steps→screens rename, undocumented evaluation subsystem, `jumpToPhase`/`areProblemsComplete`) — normal, healthy drift, not a defect | `docs/superpowers/specs/2026-08-27*.md`, `2026-08-28*.md` | low | Structure |
| 15 | `object: 'ball'` field in problem data is dead/unused — never read for rendering, prompt text says "balloons," `Balloon.svelte` always renders balloons regardless | `addition-1-Content.ts:31-40`, `LessonProblems.svelte:12-14` | low | Lesson |
| 16 | `Progression`'s `jumpToPhase`/`areProblemsComplete` and the whole `evaluation/` subsystem exist with no corresponding design spec | `progression.ts:70,149`, `src/lessons/evaluation/` | low | Structure |
| — | No mismatches/dead code/gitignore issues found in general project structure sweep (config files, `App.svelte` view switch, module boundaries) — confirmed clean | — | — (no finding) | Structure |
| — | `MAX_PLAYERS=20` cap and RTDB rules (`database.rules.json`) verified correctly atomic/safe on every path checked, including `rateLimits/{uid}` | `joinGame.ts:70-90`, `database.rules.json` | — (no finding — verified safe) | Multiplayer |
| — | `problemSetVersion`/`contentVersion` bump discipline has been followed correctly in every historical commit | `addition-1-Content.ts` git history | — (no finding — verified correct) | Lesson |
| — | `npm run test` and `npm run check` both currently pass clean (117/117 tests, 0 type errors) | — | — (no finding — green baseline) | Lesson |
| — | `firstPlayer`/warmup mechanism fires exactly once per empty-room transition and doesn't block the player's own UI | `joinGame.ts:69-72,103`, `gameSession.svelte.ts:139-148` | — (no finding — verified correct) | Multiplayer |
| — | No client-writable RTDB path lets a player set `totalMoney` or another player's data directly | `database.rules.json` | — (no finding — verified secure) | Multiplayer |

---

## 1. Project Structure & Architecture

**Overall:** Clean. No dead code, no gitignore/build-artifact issues, module boundaries (`src/lessons/` vs `src/multiplayer/`) are fully decoupled with zero cross-imports.

- **`dist/` and `firebase/functions/lib/`** — both correctly gitignored, no build output ever committed, no git history of either. **`low`** (confirmed clean, no action needed).
- **`App.svelte`'s hand-rolled `view` switch (no router)** — traced every writer of `view`; it only ever takes `'lesson'`/`'multiplayer'`, no orphaned state. A page reload mid-multiplayer-game returns the student to the lesson-complete screen (multiplayer state isn't restored on reload) rather than resuming the game — a UX quirk, not a dead end, since multiplayer is one click away again. **`low`**.
- **Design docs vs. implementation drift** — `docs/superpowers/specs/2026-08-27-lesson-state-tracking-design.md` and `2026-08-28-typescript-lesson-classes-design.md` predate: (a) the steps→screens rename (`Progress.instruction.currentScreenIndex` vs. the spec's `currentStepIndex`), (b) the `studentErrorTag`→`studentEvaluationTag` rename plus the entire `src/lessons/evaluation/` subsystem, which has no spec at all, and (c) `Progression.jumpToPhase`/`areProblemsComplete`. This is healthy drift (the code evolved past two dated design docs, not an unintentional divergence) — already listed as a Long-Term item in the audit plan. **`low`**.
- **Dead code sweep** — `adminSettings.svelte.ts`, `AdminTools.svelte`, `DebugOverlay.svelte`, `svelte.d.ts` all confirmed live/used; no unused exports found. **`low`** (no issue).
- **`design/counting-problems/` mockups** — confirmed zero references from `src/` (genuinely inert design artifacts). Flagging one repo-hygiene note: `counting-problems-mockup.html` is 2.4MB and tracked in git — no functional impact (outside the Vite build graph) but permanent repo bloat. **`low`**.

## 2. Lesson & Problems

**Overall:** The problem *data* is currently correct (all 10 answers verified against their group sums) and version-bump discipline has been followed correctly in every historical commit, but the pedagogy review surfaced several real scaffolding/feedback gaps, and there's a missing validation guardrail.

- **"We do" isn't actually guided practice (`high`)** — `countingCombiningSteps.ts:29-31` narrates "Now, let's do it together! Touch the balloons as we count them," but `CountingCombiningScreen.svelte:94-103` routes the "we do" steps through the identical auto-play sequence as "I do" (just bigger numbers, 4+5 vs 2+3). `Balloon.svelte:37` is `aria-hidden="true"` with zero click handlers anywhere in the lesson. The scaffold collapses to I-do/I-do-again/you-do-at-full-stakes — the student's own counting is never exercised until the graded problems, with no checkpoint to catch a misconception earlier.
- **Generic wrong-answer feedback despite rich diagnostics (`high`)** — `LessonProblems.svelte:330-332` always shows "Not quite — try again." Meanwhile `addition-1-Evaluation.ts:24-46` already classifies *why* (partial-counting, off-by-one, far-off, invalid-input) but this signal only ever reaches the evaluation recorder for later analysis, never the student in the moment.
- **Fixed, non-adaptive difficulty (`high`)** — sums across the 10 problems are 5,5,6,7,7,8,9,7,8,7 (not ramping), and `Progress.problems.adaptations: unknown[]` (`progression.ts:29`) is seeded to `[]` and never read/written anywhere else — dead scaffolding for a feature that was apparently planned but never built.
- **No comprehension gate between instruction phases (`high`)** — intro→I-do→we-do→problems advances purely on narration-end/timer (`CountingCombiningScreen.svelte:105-136`), with no check the student is tracking and no replay affordance if lost.
- **No automated `answer === sum(groups[].count)` check (`high`)** — manually verified all 10 problems are currently correct, but neither `addition-1-Content.test.ts` nor any build step enforces this invariant; a future edit could silently ship a wrong answer key.
- **Behavioral detectors likely produce false positives for normal child behavior (`high`)** — `detectDistraction` (`behavioralDetectors.ts:7-61`) fires on ≥8s of pointer movement with no click, which is exactly what a child tracing objects to count them looks like; `detectRageClicks` (lines 103-211) can trip on excited repeat-tapping or ordinary touch-motor noise from a 7-8 year old. Thresholds read as generic defaults, not calibrated for this age group. Existing tests verify the algorithm matches its own thresholds but don't test against modeled child-interaction scenarios.
- **Strengths worth keeping:** problems require counting rendered objects rather than reading digits (a deliberate, well-documented v2 change matching CCSS 2.MD.C.8's "represented by groups of objects" language); retries are unlimited and never punitive; progress is legible ("Problem X of N").
- **`object: 'ball'` field is dead data, not a wording bug (`low`)** — confirmed it's never read for rendering (`LessonProblems.svelte:12-14`); balloons always render regardless of this field's value. No student-visible impact.
- **Accessibility (`low`)** — every balloon is `aria-hidden="true"` with no accessible count exposed anywhere; flagged low only because CLAUDE.md scopes this app to one known student.
- **Baseline verified green:** `npm run test -- src/lessons` → 117/117 passing; `npm run check` → 0 errors, 0 warnings.

## 3. Multiplayer

**Overall:** The concurrency-safety and access-control fundamentals are solid (RTDB transactions correctly serialize concurrent joins/answers, rules verified to block every bypass path checked), but there's a real correctness gap around partial failure/idempotency, zero test coverage on the authoritative backend, and pedagogy gaps in the coin game's difficulty ramp and feedback.

- **No idempotency guard on `submitAnswer` (`high`)** — `submitAnswer.ts:92-127` runs the per-player correctness transaction and the `totalMoney` increment transaction as two independent, sequentially-awaited operations with no all-or-nothing guarantee. If the function dies between the two, a player's board shows an award never reflected in the shared total. A retried/duplicated call for an already-answered problem has no guard against double-awarding cents into `totalMoney`.
- **Zero test coverage on Cloud Functions (`high`)** — confirmed no test files anywhere under `firebase/functions/`. A minimal suite would need: seat-reuse/idempotent-rejoin/`MAX_PLAYERS`-abort/`firstPlayer` correctness for `joinGame`; correct/incorrect branching, `totalMoney` increment-on-correct-only, `warmup`/`regenerate` behavior for `submitAnswer`; feasibility/coin-count bounds for `coinProblem`; window-reset/abort behavior for `rateLimit`.
- **Coin-game difficulty has no built-in ramp (`high`)** — jumps straight to multi-denomination coins summing up to 100¢; the only easier mode (`SIMPLE_MAX_SUM=10`) is gated behind an admin-only toggle, not something the student progresses through themselves.
- **Coin-game wrong-answer feedback is generic (`high`)** — `MultiplayerScreen.svelte:297` shows one message regardless of whether the miscount was a misread coin, bad addition, or denomination confusion.
- **Task-design mismatch: "total money" vs. the lesson's "combine two groups" framing (`high`)** — the shared total sums each player's own separately-counted single pile; conceptually this is "count a mixed coin collection," not "combine two given groups," which risks it reading as a scoreboard rather than reinforcing the target skill.
- **Verified safe/correct (no action needed):** `MAX_PLAYERS=20` cap is atomic (whole-collection transaction forces true serialization — no window for 21+ joins); `database.rules.json` default-deny holds on every path checked including `rateLimits/{uid}` (no rule exists for it, so it inherits the root deny); no client-writable path lets a player set `totalMoney` or another player's data directly; the `firstPlayer`/warmup mechanism fires exactly once per empty-room transition and doesn't block the player's own UI.
- **Positive design choice to preserve:** unlimited retries on the same problem — no punitive restart.

---

## Deferred (not run this pass — resume from the plan)

Per the user's instruction, Tasks 4–7 were stopped mid-investigation and are **not** reflected in this report:

- **Task 4 — Firebase config & deployment audit.** Partial evidence already gathered before stopping: no `.env` secrets ever committed (confirmed via git history), `firebase/functions/package.json` lists `firebase-functions-test` as a devDependency but it's never wired up (no `test` script, no test files) — carry this into the re-run. The `firebase.json` "Hosting" vs. "App Hosting" ambiguity flagged in the plan is still unresolved.
- **Task 5 — Vitest/testing coverage audit.** Not completed; the same `firebase-functions-test`-installed-but-unused finding applies here too.
- **Task 6 — Internal tools (voice-clips generator) audit.** Not started.
- **Task 7 — Cross-cutting audit** (GSAP cleanup across 8 files, IndexedDB triplication, Performance Monitoring/Analytics gap, AdminTools exposure). Not completed; partway through reading GSAP-using files when stopped.

Re-run these four directly from `docs/superpowers/plans/2026-09-01-full-app-audit-plan.md` (Tasks 4–7) when ready to continue, and merge their findings into this report's Summary Table.
