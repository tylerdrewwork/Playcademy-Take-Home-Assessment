# TypeScript Conversion: Lesson Progress Classes + Lesson-Specific Base Classes

## Context

The lesson progress subsystem (`lessonProgress.svelte.js`, `lessonProgressSingleton.svelte.js`,
`progression.js`, `progressStorage.js`) is currently plain JS using factory functions, not classes.
Three of these four files are already lesson-agnostic (they take `content` as a parameter with no
addition-1-specific logic baked in). `lessonProgressSingleton.svelte.js` and `LessonInstruction.svelte`,
however, both hardcode `addition1Content` and are genuinely lesson-specific — the singleton wires up
that one lesson's content/storage, and the instruction component contains addition-1's specific GSAP
"combine balloons" animation and `Balloon` usage.

Goal: convert the progress subsystem to TypeScript as real classes, introduce a base-class pattern so
future lesson content (beyond addition-1) can be added without touching generic code, and relocate the
two genuinely lesson-specific files into `src/lessons/content/` with lesson-specific names.

## TypeScript tooling

- Add `typescript` as a devDependency. `vitePreprocess()` is already configured in `svelte.config.js`,
  so `<script lang="ts">` in `.svelte` files and plain `.ts` files work immediately — esbuild strips
  types at build time; the build itself does not type-check (standard Vite behavior).
- Add `tsconfig.json` extending `@tsconfig/svelte/tsconfig.json`.
- Add `svelte-check` as a devDependency plus a `"check": "svelte-check --tsconfig ./tsconfig.json"`
  script for manual/CI type-checking. Not wired into `build`.
- Runes-based classes outside `.svelte` files use the `.svelte.ts` extension, mirroring the existing
  `.svelte.js` convention.
- `vite.config.js` test `include` gains `src/**/*.test.ts` alongside the existing `.test.js` pattern.
- Conversion is incremental: files not touched by this change stay `.js`/`.svelte` without `lang="ts"`.

## File structure

Generic base logic — stays in `src/lessons/`, converted to TypeScript:

- `src/lessons/lessonContent.ts` — **new**. Abstract `LessonContent` base class.
- `src/lessons/progression.ts` — `Progression` class (static state-transition methods), replaces the
  functional exports in `progression.js`.
- `src/lessons/progressStorage.ts` — abstract `ProgressionStorage` base class + concrete
  `IndexedDbProgressionStorage`, replaces `progressStorage.js`.
- `src/lessons/lessonProgress.svelte.ts` — `LessonProgress` class (reactive, runes as class fields),
  replaces `createLessonProgressStore` in `lessonProgress.svelte.js`.

Lesson-specific — moves to `src/lessons/content/`:

- `content/addition-1-Content.ts` — `Addition1Content extends LessonContent`, replaces
  `addition-1-Content.js`.
- `content/addition-1-LessonProgress.ts` — instantiates `LessonProgress` with addition-1's content and
  storage; replaces `lessonProgressSingleton.svelte.js`. Exports `addition1LessonProgress`.
- `content/addition-1-LessonInstruction.svelte` — renamed/moved from `src/lessons/LessonInstruction.svelte`.
  Keeps its full markup and GSAP "combine balloons" animation and `Balloon` usage unchanged; only its
  imports change to point at the new base/content modules.

Call sites updated to the new paths/export name: `LessonScreen.svelte`, `LessonProblems.svelte`,
`LessonComplete.svelte`, `AdminTools.svelte`.

## Base class member design

```ts
// src/lessons/lessonContent.ts
export interface InstructionStep {
  id: string
  title: string
  body: string
  groups?: unknown[]
  showCombined?: boolean
}
export interface Problem {
  id: string
  prompt: string
  groups: unknown[]
  answer: number
}
export abstract class LessonContent<
  TStep extends InstructionStep = InstructionStep,
  TProblem extends Problem = Problem
> {
  abstract readonly lessonId: string
  abstract readonly contentVersion: number
  abstract readonly instruction: { steps: TStep[] }
  abstract readonly problems: TProblem[]

  findProblem(id: string): TProblem | undefined {
    return this.problems.find((p) => p.id === id)
  }
}
```

`Addition1Content` supplies the balloon-specific step/problem shapes (`groups: { count: number; color:
string }[]`, etc.) via the generic parameters — no `any`.

```ts
// src/lessons/progression.ts
export type Phase = 'instruction' | 'problems' | 'complete'

export interface Attempt {
  value: string | number
  correct: boolean
  studentErrorTag: string | null
  contentVersion: number
  timestamp: number
}

export interface Progress {
  lessonId: string
  contentVersion: number
  phase: Phase
  instruction: { currentStepIndex: number; completedAt: number | null }
  problems: {
    sequence: string[]
    currentIndex: number
    attempts: Record<string, Attempt[]>
    adaptations: unknown[]
    completedAt: number | null
  }
  lessonCompletedAt: number | null
  updatedAt: number
}

export class Progression {
  static createInitialProgress(content: LessonContent): Progress { /* same logic as today */ }
  static advanceInstructionStep(progress: Progress, content: LessonContent): Progress { /* same logic */ }
  static submitProblemAnswer(progress: Progress, content: LessonContent, value: string | number): Progress { /* same logic */ }
  static isMultiplayerUnlocked(progress: Progress): boolean { /* same logic */ }
}
```

```ts
// src/lessons/progressStorage.ts
export abstract class ProgressionStorage {
  abstract saveProgress(progress: Progress): Promise<void>
  abstract loadProgress(): Promise<Progress | null>
  abstract clearProgress(): Promise<void>
}

export class IndexedDbProgressionStorage extends ProgressionStorage {
  // same indexedDB implementation as today's progressStorage.js
}
```

```ts
// src/lessons/lessonProgress.svelte.ts
export class LessonProgress {
  #progress = $state.raw<Progress | null>(null)
  #error = $state.raw<unknown>(null)
  #content: LessonContent
  #storage: ProgressionStorage
  readonly ready: Promise<void>

  constructor(content: LessonContent, storage: ProgressionStorage) {
    this.#content = content
    this.#storage = storage
    this.ready = (async () => { /* same init logic as today */ })()
  }

  get progress() { return this.#progress }
  get error() { return this.#error }
  get isMultiplayerUnlocked() {
    return this.#progress ? Progression.isMultiplayerUnlocked(this.#progress) : false
  }
  get currentProblem() { /* same logic as today */ }
  get lastAttempt() { /* same logic as today */ }
  get isLastStep() {
    return this.#progress?.instruction.currentStepIndex === this.#content.instruction.steps.length - 1
  }

  async advanceStep() { /* same logic as today's advanceInstructionStep, renamed */ }
  async submitProblemAnswer(value: string | number) { /* same logic as today */ }
  async resetProgress() { /* same logic as today */ }
}
```

`isLastStep` moves onto the base class from its current location as an inline `$derived` computation
inside `LessonInstruction.svelte` — future lessons get it for free instead of recomputing it per lesson.
`advanceInstructionStep` is renamed to `advanceStep` to match the requested helper name; its two call
sites (in the renamed instruction component) are updated accordingly.

`content/addition-1-Content.ts` and `content/addition-1-LessonProgress.ts` become thin:

```ts
// content/addition-1-Content.ts
class Addition1Content extends LessonContent<Addition1Step, Addition1Problem> {
  lessonId = 'combining-groups-2mdc8'
  contentVersion = 1
  instruction = { steps: [ /* same data as today */ ] }
  problems = [ /* same data as today */ ]
}
export const addition1Content = new Addition1Content()
```

```ts
// content/addition-1-LessonProgress.ts
export const addition1LessonProgress = new LessonProgress(addition1Content, new IndexedDbProgressionStorage())
```

## Tests and call-site updates

- `progression.test.js` → `progression.test.ts`, calling `Progression.xxx(...)` static methods instead
  of bare function imports.
- `progressStorage.test.js` → `progressStorage.test.ts`, testing `IndexedDbProgressionStorage`.
- `lessonProgress.svelte.test.js` / `lessonProgress.integration.test.js` → `.test.ts`, constructing
  `new LessonProgress(content, storage)` instead of calling `createLessonProgressStore({...})`.
- `content/addition-1-Content.test.js` → `content/addition-1-Content.test.ts`.
- `LessonScreen.svelte`, `LessonProblems.svelte`, `LessonComplete.svelte`, `AdminTools.svelte` — update
  imports from `lessonProgressSingleton.svelte.js` / `LessonInstruction.svelte` to
  `content/addition-1-LessonProgress.ts` / `content/addition-1-LessonInstruction.svelte`, and the
  exported binding name from `lessonProgress` to `addition1LessonProgress`.

## Out of scope

- Converting `LessonScreen.svelte`, `LessonProblems.svelte`, `LessonComplete.svelte`, `Balloon.svelte`,
  or `App.svelte` to `lang="ts"` — only the files named above change.
- Wiring `svelte-check`/type-checking into CI — no CI is configured in this repo yet.
- Any change to the actual progression/storage business logic — this is a structural/type conversion,
  behavior is preserved exactly.
