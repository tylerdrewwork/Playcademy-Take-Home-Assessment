# Lesson State Tracking — Design

Date: 2026-08-27
Status: Draft, pending review
Scope: single lesson only (CCSS 2.MD.C.8 — combining two groups of objects and counting the total). No curriculum/multi-lesson layer is included; see "Non-goals."

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
- **No adaptive/branching difficulty.** The problem sequence is fixed and linear; performance does not skip, reorder, or insert problems.
- **No in-app remediation logic yet.** Wrong-answer data is captured in a structured, stable shape, but nothing in this design *acts* on it (no hints triggered, no replay of instruction steps, no teacher/parent view). That is explicitly deferred — see "Future: error classification."
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
    currentProblemIndex: 0,          // 0-9, fixed order
    attempts: {
      p1: [
        { value: '4', correct: false, studentErrorTag: null, contentVersion: 1, timestamp },
        { value: '5', correct: true,  studentErrorTag: null, contentVersion: 1, timestamp }
      ]
      // ...p2..p10, keyed by problem id
    },
    completedAt: null
  },

  lessonCompletedAt: null,
  updatedAt: timestamp
}
```

Notes:

- `lessonId` and problem ids (`p1`...`p10`) shown above are illustrative; actual id strings are decided when the content module is authored, not by this design.
- `contentVersion` appears both at the top level (the version this record is currently playing against) and on each individual attempt (the version *that specific problem* was answered against). This matters if content is updated mid-session (e.g. an app redeploy while a tab is open, or resuming an old stored record after an update) — each historical answer stays self-describing regardless of what the top-level field says later.
- `studentErrorTag` is a slot for a future misconception classifier. It is `null` until that classifier exists (see "Future: error classification" — deciding the actual taxonomy of misconceptions is a pedagogy question, not a data-shape one, and is explicitly out of scope for this design).
- `attempts` is keyed by problem id (not a flat array) so a specific problem's history can be looked up directly without scanning.
- `currentStepIndex` and `currentProblemIndex` are positions into the content module's `instruction.steps` / `problems` arrays (`content.problems[currentProblemIndex].id` gives the current problem's id, which is the key used in `attempts`). Content order is authoritative; progress never stores its own copy of the sequence.
- `timestamp` fields are `Date.now()`-style epoch milliseconds (numbers), for simple storage and chronological sorting in IndexedDB.

## Progression / gating logic

Implemented as plain, pure functions in one module (e.g. `progression.js`), not scattered across UI components and not driven by animation timelines — GSAP is visual-only and must never be the source of truth for lesson state (per CLAUDE.md).

- `advanceInstructionStep(progress)` — increments `instruction.currentStepIndex`. When it passes the last step, transitions `phase` to `'problems'` and stamps `instruction.completedAt`.
- `submitProblemAnswer(progress, content, value)` — compares `value` to the current problem's correct answer.
  - **Correct:** records the attempt, marks the problem solved, advances `problems.currentProblemIndex`. At problem 10, transitions `phase` to `'complete'` and stamps `lessonCompletedAt`.
  - **Incorrect:** records the attempt (with `studentErrorTag` set by a classifier if one exists, else `null`) and does **not** advance — the student retries the same problem.
- `isMultiplayerUnlocked(progress)` — `progress.phase === 'complete'`. This is the one function the rest of the app (a route guard, a menu item) needs to know about; everything else about lesson internals stays encapsulated behind the progress module.

## Architecture

- A Svelte 5 runes store module (e.g. `lessonProgress.svelte.js`) holds the `$state` progress object and exposes the action functions above, plus `$derived` getters (`isMultiplayerUnlocked`, `currentProblem`, etc.). UI components call actions and read derived state; they never mutate progress directly or embed gating rules themselves.
- A small IndexedDB wrapper loads the single progress record on app init and persists it after each mutating action. Single record, single student/device — consistent with the project's existing decision not to sync lesson progress through Firebase.
- `resetProgress()` clears the stored record and reinitializes state, for the options-menu reset-progress button (already decided in CLAUDE.md).
- Lesson content is a plain imported data module, loaded once, never persisted.

## Future: error classification

`studentErrorTag` is reserved for a classifier that maps a wrong answer to a likely misconception (e.g. "counted only one group," "off-by-one," "added the wrong groups"). Designing that taxonomy is a pedagogy decision — what a given wrong number actually implies about a 2nd-grader's understanding — not a data-modeling one, and should go through a pedagogy review when it's actually built. This design only guarantees the field exists and is captured on every attempt, so nothing downstream needs to change shape when that classifier lands.

## Alternatives considered

- **Event-sourced log** (append-only events; progress derived by replaying them). Would give a full audit trail "for free," which could nicely serve a future teacher/parent report. Rejected for now: more moving parts (event schema, reducer, log growth) than a single 10-problem lesson needs, and the snapshot shape above already captures full attempt history per problem. If reporting becomes a concrete requirement later, that's a storage/derivation change, not a rework of the gating logic.
- **Unified activity-sequence model** (instruction steps and problems as entries in one generic array sharing a cursor and gating rule). Rejected: only pays off with multiple lessons or mixed/reorderable activity types, neither of which is in scope. Instruction and problems are gated in fundamentally different ways (linear-advance vs. correct-required-with-retry) and forcing them into one shape adds indirection without a second use case to justify it.

## Testing

Gating logic is pure functions over plain data (`content` + `progress` in, next `progress` out), so it is testable without touching Svelte, IndexedDB, or GSAP — feed fixture content and progress objects into `advanceInstructionStep` / `submitProblemAnswer` and assert the resulting transitions directly.
