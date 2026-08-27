# Lesson State Tracking — Design

Date: 2026-08-27
Status: Draft, pending review
Scope: single lesson only — combining two groups of objects and counting the total, the lesson focus on the way to the CCSS 2.MD.C.8 capstone standard (per CLAUDE.md). No curriculum/multi-lesson layer is included; see "Non-goals."

## Purpose

The app needs a way to track where a student is in the lesson, what conditions must be met to advance, and what happened when they got a problem wrong — so that:

1. The UI can render the correct step/problem and know whether the student can advance.
2. Progress survives a page reload (persisted locally, per the project's existing IndexedDB decision — see CLAUDE.md).
3. Reaching the end of the lesson can gate access to the multiplayer game.
4. A record of wrong answers is captured in a stable shape, for a future (not-yet-built) remediation or reporting feature to consume.

## Lesson shape (confirmed with stakeholder)

The lesson has two phases, played in a fixed linear order:

1. **Instruction** — step-by-step direct instruction with voiceover, animation, and minor interactions. Advancing is simple linear playback (voiceover/animation end, or a "next" click) — no per-step interaction-completion state is tracked.
2. **Problems** — 10 fixed, hand-authored problems, presented one at a time on the same screen, answered via text input. A problem requires a **correct answer to advance**; on a wrong answer the student **retries the same problem** until correct. Every attempt (right or wrong) is logged.

Reaching the end of the problem set (all 10 solved) marks the lesson complete and **unlocks the multiplayer game**. This is a completion gate, not a mastery/score threshold — a student who struggles through every problem with many wrong attempts still unlocks multiplayer once they finish, same as one who answers everything on the first try.

## Non-goals

- **No curriculum/multi-lesson layer.** This design covers a single lesson. If more lessons are added later, a layer above this (a lesson list/registry) can be introduced without reshaping the structures below.
- **No adaptive/branching difficulty — yet.** The problem sequence is seeded 1:1 from content and never mutated by this implementation; performance does not skip, reorder, or insert problems today. The sequence is stored explicitly (see below) specifically so this can change later without restructuring — see "Future considerations."
- **No in-app remediation or scaffolding logic yet.** Wrong-answer data is captured in a structured, stable shape, but nothing in this design *acts* on it (no hints, no inserted/removed problems, no replay of instruction steps, no teacher/parent view). That is explicitly deferred — see "Future considerations."
- **No per-instruction-step completion tracking.** Instruction steps are simple linear playback; the state model only tracks *which* step the student is on, not per-step interaction completion.

## Content vs. progress

Two separate, differently-lifecycled pieces of data:

- **Lesson content** is static and authored — the instruction step list and the 10 problems (prompts, group counts/objects, correct answers). It ships as a plain data module in source control and never changes at runtime. It is versioned (`contentVersion`) so that future edits to the problem set can be distinguished from the version a given student's progress record was created against.
- **Progress state** is the only thing that is dynamic and persisted. It tracks where the student is and what they answered, referencing content by id rather than duplicating it. This separation keeps gating logic testable against fixed content fixtures, independent of persistence, and means editing lesson content (e.g. fixing a prompt's wording) never touches a student's stored progress.

## Progress state shape

```js
{
  lessonId: 'combining-groups-2mdc8',
  contentVersion: 1,                 // version this record is currently playing against
  phase: 'instruction' | 'problems' | 'complete',

  instruction: {
    currentStepIndex: 0,
    completedAt: null
  },

  problems: {
    sequence: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10'], // ordered problem ids for this student
    currentIndex: 0,                 // position within `sequence`, not directly into content
    attempts: {
      p1: [
        { value: '4', correct: false, studentErrorTag: null, contentVersion: 1, timestamp },
        { value: '5', correct: true,  studentErrorTag: null, contentVersion: 1, timestamp }
      ]
      // ...p2..p10, keyed by problem id
    },
    adaptations: [],                 // reserved for a future scaffolding engine; unused and unpopulated by this design
    completedAt: null
  },

  lessonCompletedAt: null,
  updatedAt: timestamp
}
```

Notes:

- `lessonId` and problem ids (`p1`...`p10`) shown above are illustrative; actual id strings are decided when the content module is authored, not by this design.
- `contentVersion` appears both at the top level (the version this record is currently playing against) and on each individual attempt (the version *that specific problem* was answered against). This matters if content is updated mid-session (e.g. an app redeploy while a tab is open, or resuming an old stored record after an update) — each historical answer stays self-describing regardless of what the top-level field says later.
- `studentErrorTag` is a slot for a future misconception signal. It is `null` until something populates it (see "Future considerations" — deciding what a wrong answer implies, and what to do about it, is a pedagogy decision, not a data-shape one, and is explicitly out of scope for this design).
- `attempts` is keyed by problem id (not a flat array) so a specific problem's history can be looked up directly without scanning.
- `currentStepIndex` is a position into the content module's `instruction.steps` array.
- `problems.sequence` is an explicit, persisted, ordered list of problem ids — **not** derived from `content.problems` at read time. Today it's simply a 1:1 copy of content's order, written once when the lesson starts, and this design never mutates it. It's stored explicitly (rather than as an implicit index into content) so that a future capability can insert, remove, or reorder problems for a given student by editing `sequence` — a targeted, additive change — instead of restructuring how progress is represented. `problems.currentIndex` is a position within `sequence` (`content.problems.find(p => p.id === sequence[currentIndex])` gives the current problem's definition); "the student reached the end" means `currentIndex === sequence.length`, which stays correct even if a future engine changes `sequence`'s length mid-lesson.
- `problems.adaptations` is a reserved, currently-always-empty array for a future scaffolding engine to log what it did (e.g. inserted a problem, showed a hint, adjusted difficulty) — see "Future considerations." Nothing reads or writes it yet.
- `timestamp` fields are `Date.now()`-style epoch milliseconds (numbers), for simple storage and chronological sorting in IndexedDB.

## Progression / gating logic

Implemented as plain, pure functions in one module (e.g. `progression.js`), not scattered across UI components and not driven by animation timelines — GSAP is visual-only and must never be the source of truth for lesson state (per CLAUDE.md).

- `advanceInstructionStep(progress)` — increments `instruction.currentStepIndex`. When it passes the last step, transitions `phase` to `'problems'` and stamps `instruction.completedAt`.
- `submitProblemAnswer(progress, content, value)` — resolves the current problem as `content.problems.find(p => p.id === progress.problems.sequence[progress.problems.currentIndex])`, then compares `value` to its correct answer.
  - **Correct:** records the attempt, marks the problem solved, advances `problems.currentIndex`. When `currentIndex` reaches `sequence.length`, transitions `phase` to `'complete'` and stamps `lessonCompletedAt`.
  - **Incorrect:** records the attempt (with `studentErrorTag` set if something populates it, else `null`) and does **not** advance — the student retries the same problem.
- `isMultiplayerUnlocked(progress)` — `progress.phase === 'complete'`. This is the one function the rest of the app (a route guard, a menu item) needs to know about; everything else about lesson internals stays encapsulated behind the progress module.

## Architecture

- A Svelte 5 runes store module (e.g. `lessonProgress.svelte.js`) holds the `$state` progress object and exposes the action functions above, plus plain getters (`isMultiplayerUnlocked`, `currentProblem`, etc.) that read it. UI components call actions and read that state; they never mutate progress directly or embed gating rules themselves.
- A small IndexedDB wrapper loads the single progress record on app init and persists it after each mutating action. Single record, single student/device — consistent with the project's existing decision not to sync lesson progress through Firebase.
- `resetProgress()` clears the stored record and reinitializes state, for the options-menu reset-progress button (already decided in CLAUDE.md).
- Lesson content is a plain imported data module, loaded once, never persisted.

## Future considerations

Raised during pedagogy review of this spec (2026-08-27). Not being designed or built now — recorded here so the data shapes above don't have to be reworked when they are.

- **Adaptive scaffolding engine.** Retry-until-correct with no differentiated support risks turning a stuck problem into blind trial-and-error, and reaching-the-end (not accuracy) is what unlocks multiplayer, so the design currently gives a struggling student no help beyond "wrong, try again." The eventual fix isn't a single hardcoded hint string per problem — it's a proper scaffolding system that can respond to how a student is doing: showing a hint, inserting or removing problems, or giving more guided support, dynamically, per student. This is a pedagogy design problem (when to intervene, with what, informed by what taxonomy of misconceptions) and needs its own design pass — including a `pedagogy-review` pass — when it's actually built. Two things in this design exist specifically so that system can be *added* later without restructuring progress: `problems.sequence` (an explicit, mutable list of problem ids for a given student, rather than an implicit index into static content) and `problems.adaptations` (a reserved log of what such a system did). `studentErrorTag` is the per-attempt signal such a system would consume.
- **Retry/mastery signal weakness.** Unlimited retries with no differentiated feedback means "eventually correct" is a weak signal — a student can converge by elimination rather than understanding, and the completion-gated multiplayer unlock doesn't discourage that. The full fix is part of the scaffolding engine above (e.g. escalating support keyed off `attempts[problemId].length`, which this design already captures). No schema change beyond what's already here is anticipated for this one — the data needed (per-attempt history) already exists.

## Alternatives considered

- **Event-sourced log** (append-only events; progress derived by replaying them). Would give a full audit trail "for free," which could nicely serve a future teacher/parent report. Rejected for now: more moving parts (event schema, reducer, log growth) than a single 10-problem lesson needs, and the snapshot shape above already captures full attempt history per problem. If reporting becomes a concrete requirement later, that's a storage/derivation change, not a rework of the gating logic.
- **Unified activity-sequence model** (instruction steps and problems as entries in one generic array sharing a cursor and gating rule). Rejected: only pays off with multiple lessons or mixed/reorderable activity types, neither of which is in scope. Instruction and problems are gated in fundamentally different ways (linear-advance vs. correct-required-with-retry) and forcing them into one shape adds indirection without a second use case to justify it.

## Testing

Gating logic is pure functions over plain data (`content` + `progress` in, next `progress` out), so it is testable without touching Svelte, IndexedDB, or GSAP — feed fixture content and progress objects into `advanceInstructionStep` / `submitProblemAnswer` and assert the resulting transitions directly.
