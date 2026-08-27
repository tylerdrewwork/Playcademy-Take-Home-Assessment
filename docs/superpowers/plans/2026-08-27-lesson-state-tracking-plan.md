# Lesson State Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the lesson state-tracking engine — content/progress separation, progression gating logic, IndexedDB persistence, and a Svelte 5 runes store — so the app can track where a student is in the lesson, gate advancement on correct answers, and know when to unlock multiplayer. Mount it behind minimal, unstyled placeholder screens (no visual design, no GSAP) so the engine is exercised end-to-end in the running app while real UI/UX waits on reference files the stakeholder will provide separately.

**Architecture:** Static lesson content (instruction steps + 10 problems) lives in a plain data module. A pure-function module (`progression.js`) computes the next progress state from `(content, progress, input)` with no framework or storage dependency. A Svelte 5 runes store wraps those pure functions, holds the live `$state`, and persists to IndexedDB after each mutation via an injectable storage interface (so the store is unit-testable without a real IndexedDB, and the IndexedDB layer is unit-testable without Svelte).

**Tech Stack:** Svelte 5 (runes), Vite, Vitest (new dev dependency — no test runner exists yet), fake-indexeddb (new dev dependency, for testing the persistence layer without a browser).

**Spec:** `docs/superpowers/specs/2026-08-27-lesson-state-tracking-design.md`

## Global Constraints

- Progress is persisted locally via IndexedDB only — never Firebase (spec "Architecture"; CLAUDE.md "Student progress persistence").
- GSAP (if/when used elsewhere) must never be the source of truth for lesson state — this code is the source of truth (CLAUDE.md "Tech Stack").
- Reactive state uses Svelte 5 runes (`$state`, `$derived`) (spec "Architecture").
- `contentVersion` is stamped both at the top level of a progress record and on every individual attempt (spec "Progress state shape").
- `timestamp` fields are epoch milliseconds via `Date.now()` (spec "Progress state shape" notes).
- Scope is a single lesson only: no curriculum/multi-lesson layer, no adaptive/branching difficulty, no in-app remediation logic (spec "Non-goals"). `problems.sequence` and `problems.adaptations` exist in the schema but are only ever seeded/left empty by this plan — nothing here reads or mutates them beyond that (spec "Future considerations").
- Reaching the end of the problem sequence (not a score/mastery threshold) is what unlocks multiplayer (spec "Lesson shape").

---

### Task 1: Progression engine (pure functions)

**Files:**
- Modify: `package.json` (add `vitest` dev dependency and a `test` script)
- Modify: `vite.config.js` (add a `test` block so Vitest picks up the Svelte plugin and test file glob)
- Create: `src/lessons/progression.js`
- Test: `src/lessons/progression.test.js`

**Interfaces:**
- Consumes: nothing (first task; only depends on a `content` object shaped per the spec's "Progress state shape" — `{ lessonId, contentVersion, instruction: { steps: [{id, ...}] }, problems: [{id, answer, ...}] }`).
- Produces (used by Task 4):
  - `createInitialProgress(content): Progress`
  - `advanceInstructionStep(progress, content): Progress`
  - `submitProblemAnswer(progress, content, value): Progress`
  - `isMultiplayerUnlocked(progress): boolean`

- [ ] **Step 1: Install Vitest and add the test script**

```bash
npm install -D vitest
```

Edit `package.json` `scripts` to add:

```json
"test": "vitest run"
```

- [ ] **Step 2: Point Vitest at the Svelte plugin and test files**

Edit `vite.config.js`:

```js
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  test: {
    include: ['src/**/*.test.js'],
  },
})
```

- [ ] **Step 3: Write failing tests for `createInitialProgress`**

Create `src/lessons/progression.test.js`:

```js
import { describe, expect, it } from 'vitest'
import { createInitialProgress } from './progression.js'

const testContent = {
  lessonId: 'test-lesson',
  contentVersion: 1,
  instruction: {
    steps: [{ id: 'step-1' }, { id: 'step-2' }],
  },
  problems: [
    { id: 'p1', answer: 5 },
    { id: 'p2', answer: 6 },
    { id: 'p3', answer: 7 },
  ],
}

describe('createInitialProgress', () => {
  it('starts in the instruction phase at step 0', () => {
    const progress = createInitialProgress(testContent)
    expect(progress.phase).toBe('instruction')
    expect(progress.instruction.currentStepIndex).toBe(0)
    expect(progress.instruction.completedAt).toBeNull()
  })

  it('seeds the problem sequence 1:1 from content order, at index 0', () => {
    const progress = createInitialProgress(testContent)
    expect(progress.problems.sequence).toEqual(['p1', 'p2', 'p3'])
    expect(progress.problems.currentIndex).toBe(0)
    expect(progress.problems.attempts).toEqual({})
    expect(progress.problems.adaptations).toEqual([])
  })

  it('carries the lessonId and contentVersion from content', () => {
    const progress = createInitialProgress(testContent)
    expect(progress.lessonId).toBe('test-lesson')
    expect(progress.contentVersion).toBe(1)
    expect(progress.lessonCompletedAt).toBeNull()
  })
})
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `progression.js` does not exist / does not export `createInitialProgress`.

- [ ] **Step 5: Implement `createInitialProgress`**

Create `src/lessons/progression.js`:

```js
export function createInitialProgress(content) {
  const now = Date.now()
  return {
    lessonId: content.lessonId,
    contentVersion: content.contentVersion,
    phase: 'instruction',
    instruction: {
      currentStepIndex: 0,
      completedAt: null,
    },
    problems: {
      sequence: content.problems.map((problem) => problem.id),
      currentIndex: 0,
      attempts: {},
      adaptations: [],
      completedAt: null,
    },
    lessonCompletedAt: null,
    updatedAt: now,
  }
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test`
Expected: PASS (3 tests)

- [ ] **Step 7: Write failing tests for `advanceInstructionStep`**

Append to `src/lessons/progression.test.js`:

```js
import { advanceInstructionStep } from './progression.js'

describe('advanceInstructionStep', () => {
  it('moves to the next instruction step', () => {
    const progress = createInitialProgress(testContent)
    const next = advanceInstructionStep(progress, testContent)
    expect(next.instruction.currentStepIndex).toBe(1)
    expect(next.phase).toBe('instruction')
  })

  it('transitions to the problems phase after the last step', () => {
    const progress = createInitialProgress(testContent)
    const afterStep1 = advanceInstructionStep(progress, testContent)
    const afterStep2 = advanceInstructionStep(afterStep1, testContent)
    expect(afterStep2.phase).toBe('problems')
    expect(afterStep2.instruction.completedAt).not.toBeNull()
  })
})
```

(Update the `import` line at the top of the file to include `advanceInstructionStep` instead of adding a second import statement.)

- [ ] **Step 8: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `advanceInstructionStep` is not exported.

- [ ] **Step 9: Implement `advanceInstructionStep`**

Add to `src/lessons/progression.js`:

```js
export function advanceInstructionStep(progress, content) {
  if (progress.phase !== 'instruction') return progress

  const now = Date.now()
  const nextIndex = progress.instruction.currentStepIndex + 1
  const reachedEnd = nextIndex >= content.instruction.steps.length

  return {
    ...progress,
    phase: reachedEnd ? 'problems' : 'instruction',
    instruction: {
      currentStepIndex: nextIndex,
      completedAt: reachedEnd ? now : progress.instruction.completedAt,
    },
    updatedAt: now,
  }
}
```

- [ ] **Step 10: Run the test to verify it passes**

Run: `npm test`
Expected: PASS (5 tests)

- [ ] **Step 11: Write failing tests for `submitProblemAnswer`**

Append to `src/lessons/progression.test.js` (and add `submitProblemAnswer` to the import):

```js
function progressAtFirstProblem() {
  const progress = createInitialProgress(testContent)
  const afterStep1 = advanceInstructionStep(progress, testContent)
  return advanceInstructionStep(afterStep1, testContent) // now in 'problems' phase
}

describe('submitProblemAnswer', () => {
  it('records a correct answer and advances to the next problem', () => {
    const progress = progressAtFirstProblem()
    const next = submitProblemAnswer(progress, testContent, '5')
    expect(next.problems.currentIndex).toBe(1)
    expect(next.problems.attempts.p1).toHaveLength(1)
    expect(next.problems.attempts.p1[0]).toMatchObject({ value: '5', correct: true, contentVersion: 1 })
    expect(next.phase).toBe('problems')
  })

  it('records a wrong answer, does not advance, and stamps a null studentErrorTag', () => {
    const progress = progressAtFirstProblem()
    const next = submitProblemAnswer(progress, testContent, '4')
    expect(next.problems.currentIndex).toBe(0)
    expect(next.problems.attempts.p1).toHaveLength(1)
    expect(next.problems.attempts.p1[0]).toMatchObject({ value: '4', correct: false, studentErrorTag: null })
  })

  it('keeps a wrong attempt in history when the student then answers correctly', () => {
    const progress = progressAtFirstProblem()
    const afterWrong = submitProblemAnswer(progress, testContent, '4')
    const afterCorrect = submitProblemAnswer(afterWrong, testContent, '5')
    expect(afterCorrect.problems.attempts.p1).toHaveLength(2)
    expect(afterCorrect.problems.currentIndex).toBe(1)
  })

  it('transitions to complete and stamps lessonCompletedAt after the last problem', () => {
    let progress = progressAtFirstProblem()
    progress = submitProblemAnswer(progress, testContent, '5') // p1 -> index 1
    progress = submitProblemAnswer(progress, testContent, '6') // p2 -> index 2
    progress = submitProblemAnswer(progress, testContent, '7') // p3 -> complete
    expect(progress.phase).toBe('complete')
    expect(progress.problems.currentIndex).toBe(3)
    expect(progress.lessonCompletedAt).not.toBeNull()
    expect(progress.problems.completedAt).not.toBeNull()
  })
})
```

- [ ] **Step 12: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `submitProblemAnswer` is not exported.

- [ ] **Step 13: Implement `submitProblemAnswer`**

Add to `src/lessons/progression.js`:

```js
function normalizeAnswer(value) {
  return typeof value === 'number' ? value : Number(String(value).trim())
}

export function submitProblemAnswer(progress, content, value) {
  if (progress.phase !== 'problems') return progress

  const now = Date.now()
  const { sequence, currentIndex, attempts } = progress.problems
  const problemId = sequence[currentIndex]
  const problem = content.problems.find((candidate) => candidate.id === problemId)
  const correct = normalizeAnswer(value) === normalizeAnswer(problem.answer)

  const attempt = {
    value,
    correct,
    studentErrorTag: null,
    contentVersion: progress.contentVersion,
    timestamp: now,
  }
  const attemptsForProblem = attempts[problemId] ?? []
  const nextAttempts = { ...attempts, [problemId]: [...attemptsForProblem, attempt] }

  if (!correct) {
    return {
      ...progress,
      problems: { ...progress.problems, attempts: nextAttempts },
      updatedAt: now,
    }
  }

  const nextIndex = currentIndex + 1
  const reachedEnd = nextIndex >= sequence.length

  return {
    ...progress,
    phase: reachedEnd ? 'complete' : 'problems',
    problems: {
      ...progress.problems,
      attempts: nextAttempts,
      currentIndex: nextIndex,
      completedAt: reachedEnd ? now : progress.problems.completedAt,
    },
    lessonCompletedAt: reachedEnd ? now : progress.lessonCompletedAt,
    updatedAt: now,
  }
}
```

- [ ] **Step 14: Run the test to verify it passes**

Run: `npm test`
Expected: PASS (9 tests)

- [ ] **Step 15: Write a failing test for `isMultiplayerUnlocked`**

Append to `src/lessons/progression.test.js` (add `isMultiplayerUnlocked` to the import):

```js
describe('isMultiplayerUnlocked', () => {
  it('is false before the lesson is complete and true after', () => {
    let progress = progressAtFirstProblem()
    expect(isMultiplayerUnlocked(progress)).toBe(false)
    progress = submitProblemAnswer(progress, testContent, '5')
    progress = submitProblemAnswer(progress, testContent, '6')
    progress = submitProblemAnswer(progress, testContent, '7')
    expect(isMultiplayerUnlocked(progress)).toBe(true)
  })
})
```

- [ ] **Step 16: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `isMultiplayerUnlocked` is not exported.

- [ ] **Step 17: Implement `isMultiplayerUnlocked`**

Add to `src/lessons/progression.js`:

```js
export function isMultiplayerUnlocked(progress) {
  return progress.phase === 'complete'
}
```

- [ ] **Step 18: Run the test to verify it passes**

Run: `npm test`
Expected: PASS (10 tests)

- [ ] **Step 19: Commit**

```bash
git add package.json package-lock.json vite.config.js src/lessons/progression.js src/lessons/progression.test.js
git commit -m "Add pure progression engine for lesson state"
```

---

### Task 2: Lesson content module

**Files:**
- Create: `src/lessons/content/combiningGroupsContent.js`
- Test: `src/lessons/content/combiningGroupsContent.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces (used by Tasks 3-4 and, later, by the lesson UI once it exists): `combiningGroupsContent` — a `content` object matching the shape `progression.js` expects (`lessonId`, `contentVersion`, `instruction.steps[]`, `problems[]` with `id` and `answer`).

This is functional example data (real, correct group counts and answers) that exercises the engine end-to-end — it is **not** final authored lesson copy (voiceover script wording, animation timing, illustration choices). Swapping in final content later is a data change only; it does not touch `progression.js`, storage, or the store.

- [ ] **Step 1: Write a failing structural test for the content module**

Create `src/lessons/content/combiningGroupsContent.test.js`:

```js
import { describe, expect, it } from 'vitest'
import { combiningGroupsContent } from './combiningGroupsContent.js'

describe('combiningGroupsContent', () => {
  it('has 10 problems with unique ids', () => {
    expect(combiningGroupsContent.problems).toHaveLength(10)
    const ids = combiningGroupsContent.problems.map((problem) => problem.id)
    expect(new Set(ids).size).toBe(10)
  })

  it('every problem answer equals the sum of its groups', () => {
    for (const problem of combiningGroupsContent.problems) {
      const sum = problem.groups.reduce((total, group) => total + group.count, 0)
      expect(problem.answer).toBe(sum)
    }
  })

  it('has at least one instruction step', () => {
    expect(combiningGroupsContent.instruction.steps.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `combiningGroupsContent.js` does not exist.

- [ ] **Step 3: Write the content module**

Create `src/lessons/content/combiningGroupsContent.js`:

```js
export const combiningGroupsContent = {
  lessonId: 'combining-groups-2mdc8',
  contentVersion: 1,
  instruction: {
    steps: [
      {
        id: 'intro',
        title: 'Meet the balls',
        body: 'Today we are going to combine two groups of balls and count how many there are in all.',
      },
      {
        id: 'example-1',
        title: 'Counting one group',
        body: "Here are 2 balls. Let's count them: 1, 2.",
      },
      {
        id: 'example-2',
        title: 'Counting the second group',
        body: "Here are 3 more balls. Let's count them: 1, 2, 3.",
      },
      {
        id: 'example-3',
        title: 'Combining the groups',
        body: "Now let's put both groups together and count all the balls: 1, 2, 3, 4, 5. There are 5 balls in all.",
      },
    ],
  },
  problems: [
    { id: 'p1', prompt: 'There are 2 balls and 3 more balls. How many balls in all?', groups: [{ count: 2, object: 'ball' }, { count: 3, object: 'ball' }], answer: 5 },
    { id: 'p2', prompt: 'There are 4 balls and 1 more ball. How many balls in all?', groups: [{ count: 4, object: 'ball' }, { count: 1, object: 'ball' }], answer: 5 },
    { id: 'p3', prompt: 'There are 3 balls and 3 more balls. How many balls in all?', groups: [{ count: 3, object: 'ball' }, { count: 3, object: 'ball' }], answer: 6 },
    { id: 'p4', prompt: 'There are 5 balls and 2 more balls. How many balls in all?', groups: [{ count: 5, object: 'ball' }, { count: 2, object: 'ball' }], answer: 7 },
    { id: 'p5', prompt: 'There is 1 ball and 6 more balls. How many balls in all?', groups: [{ count: 1, object: 'ball' }, { count: 6, object: 'ball' }], answer: 7 },
    { id: 'p6', prompt: 'There are 4 balls and 4 more balls. How many balls in all?', groups: [{ count: 4, object: 'ball' }, { count: 4, object: 'ball' }], answer: 8 },
    { id: 'p7', prompt: 'There are 2 balls and 7 more balls. How many balls in all?', groups: [{ count: 2, object: 'ball' }, { count: 7, object: 'ball' }], answer: 9 },
    { id: 'p8', prompt: 'There are 6 balls and 1 more ball. How many balls in all?', groups: [{ count: 6, object: 'ball' }, { count: 1, object: 'ball' }], answer: 7 },
    { id: 'p9', prompt: 'There are 3 balls and 5 more balls. How many balls in all?', groups: [{ count: 3, object: 'ball' }, { count: 5, object: 'ball' }], answer: 8 },
    { id: 'p10', prompt: 'There are 4 balls and 3 more balls. How many balls in all?', groups: [{ count: 4, object: 'ball' }, { count: 3, object: 'ball' }], answer: 7 },
  ],
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS (13 tests total)

- [ ] **Step 5: Commit**

```bash
git add src/lessons/content/combiningGroupsContent.js src/lessons/content/combiningGroupsContent.test.js
git commit -m "Add example lesson content for the combining-groups lesson"
```

---

### Task 3: IndexedDB persistence layer

**Files:**
- Create: `src/lessons/progressStorage.js`
- Test: `src/lessons/progressStorage.test.js`

**Interfaces:**
- Consumes: nothing (operates on plain `progress` objects; doesn't import `progression.js` or content).
- Produces (used by Task 4): `saveProgress(progress): Promise<void>`, `loadProgress(): Promise<Progress | null>`, `clearProgress(): Promise<void>`.

- [ ] **Step 1: Install fake-indexeddb**

```bash
npm install -D fake-indexeddb
```

- [ ] **Step 2: Write failing tests for the storage functions**

Create `src/lessons/progressStorage.test.js`:

```js
import { beforeEach, describe, expect, it } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { saveProgress, loadProgress, clearProgress } from './progressStorage.js'

beforeEach(() => {
  // Fresh in-memory IndexedDB per test so records don't leak across tests.
  globalThis.indexedDB = new IDBFactory()
})

describe('progressStorage', () => {
  it('returns null when nothing has been saved', async () => {
    const loaded = await loadProgress()
    expect(loaded).toBeNull()
  })

  it('saves and loads a progress record', async () => {
    const progress = { phase: 'instruction', lessonId: 'test-lesson' }
    await saveProgress(progress)
    const loaded = await loadProgress()
    expect(loaded).toEqual(progress)
  })

  it('overwrites the previous record on a second save', async () => {
    await saveProgress({ phase: 'instruction' })
    await saveProgress({ phase: 'problems' })
    const loaded = await loadProgress()
    expect(loaded).toEqual({ phase: 'problems' })
  })

  it('clears the stored record', async () => {
    await saveProgress({ phase: 'complete' })
    await clearProgress()
    const loaded = await loadProgress()
    expect(loaded).toBeNull()
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `progressStorage.js` does not exist.

- [ ] **Step 4: Implement the storage module**

Create `src/lessons/progressStorage.js`:

```js
const DB_NAME = 'playcademy-lesson-progress'
const DB_VERSION = 1
const STORE_NAME = 'progress'
const RECORD_KEY = 'current'

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveProgress(progress) {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).put(progress, RECORD_KEY)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
}

export async function loadProgress() {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly')
    const request = transaction.objectStore(STORE_NAME).get(RECORD_KEY)
    request.onsuccess = () => resolve(request.result ?? null)
    request.onerror = () => reject(request.error)
  })
}

export async function clearProgress() {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).delete(RECORD_KEY)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test`
Expected: PASS (17 tests total)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lessons/progressStorage.js src/lessons/progressStorage.test.js
git commit -m "Add IndexedDB persistence for lesson progress"
```

---

### Task 4: Svelte 5 runes store

**Files:**
- Create: `src/lessons/lessonProgress.svelte.js`
- Test: `src/lessons/lessonProgress.svelte.test.js`

**Interfaces:**
- Consumes: `createInitialProgress`, `advanceInstructionStep`, `submitProblemAnswer`, `isMultiplayerUnlocked` from `./progression.js` (Task 1); `saveProgress`, `loadProgress`, `clearProgress` from `./progressStorage.js` (Task 3, shaped to the same three-function interface so a fake can substitute for it in tests); `combiningGroupsContent` from `./content/combiningGroupsContent.js` (Task 2).
- Produces (for later UI work — not built in this plan): `createLessonProgressStore({ content, storage }): LessonProgressStore` (the injectable factory, used directly in tests) and a ready-to-use `lessonProgress` singleton wired to the real content and real IndexedDB storage, with:
  - `ready: Promise<void>`
  - `get progress()`, `get isMultiplayerUnlocked()`, `get currentProblem()`
  - `advanceInstructionStep(): Promise<void>`, `submitProblemAnswer(value): Promise<void>`, `resetProgress(): Promise<void>`

- [ ] **Step 1: Write failing tests using an in-memory fake storage**

Create `src/lessons/lessonProgress.svelte.test.js`:

```js
import { describe, expect, it } from 'vitest'
import { createLessonProgressStore } from './lessonProgress.svelte.js'

const testContent = {
  lessonId: 'test-lesson',
  contentVersion: 1,
  instruction: { steps: [{ id: 'step-1' }] },
  problems: [
    { id: 'p1', answer: 5 },
    { id: 'p2', answer: 6 },
  ],
}

function createFakeStorage() {
  let record = null
  return {
    async loadProgress() {
      return record
    },
    async saveProgress(progress) {
      record = progress
    },
    async clearProgress() {
      record = null
    },
  }
}

describe('createLessonProgressStore', () => {
  it('initializes to instruction phase and persists the initial record when storage is empty', async () => {
    const storage = createFakeStorage()
    const store = createLessonProgressStore({ content: testContent, storage })
    await store.ready

    expect(store.progress.phase).toBe('instruction')
    expect(await storage.loadProgress()).toEqual(store.progress)
  })

  it('loads an existing stored record instead of creating a new one', async () => {
    const storage = createFakeStorage()
    await storage.saveProgress({ phase: 'complete', marker: 'existing' })
    const store = createLessonProgressStore({ content: testContent, storage })
    await store.ready

    expect(store.progress).toEqual({ phase: 'complete', marker: 'existing' })
  })

  it('advanceInstructionStep updates state and persists it', async () => {
    const storage = createFakeStorage()
    const store = createLessonProgressStore({ content: testContent, storage })
    await store.ready

    await store.advanceInstructionStep()

    expect(store.progress.phase).toBe('problems')
    expect((await storage.loadProgress()).phase).toBe('problems')
  })

  it('submitProblemAnswer advances on a correct answer and exposes currentProblem', async () => {
    const storage = createFakeStorage()
    const store = createLessonProgressStore({ content: testContent, storage })
    await store.ready
    await store.advanceInstructionStep()

    expect(store.currentProblem).toEqual({ id: 'p1', answer: 5 })
    await store.submitProblemAnswer('5')
    expect(store.currentProblem).toEqual({ id: 'p2', answer: 6 })
  })

  it('isMultiplayerUnlocked flips to true once every problem is solved', async () => {
    const storage = createFakeStorage()
    const store = createLessonProgressStore({ content: testContent, storage })
    await store.ready
    await store.advanceInstructionStep()

    expect(store.isMultiplayerUnlocked).toBe(false)
    await store.submitProblemAnswer('5')
    await store.submitProblemAnswer('6')
    expect(store.isMultiplayerUnlocked).toBe(true)
  })

  it('resetProgress clears storage and reinitializes to instruction phase', async () => {
    const storage = createFakeStorage()
    const store = createLessonProgressStore({ content: testContent, storage })
    await store.ready
    await store.advanceInstructionStep()

    await store.resetProgress()

    expect(store.progress.phase).toBe('instruction')
    expect((await storage.loadProgress()).phase).toBe('instruction')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `lessonProgress.svelte.js` does not exist.

- [ ] **Step 3: Implement the store**

Create `src/lessons/lessonProgress.svelte.js`:

```js
import {
  createInitialProgress,
  advanceInstructionStep as advanceInstructionStepPure,
  submitProblemAnswer as submitProblemAnswerPure,
  isMultiplayerUnlocked as isMultiplayerUnlockedPure,
} from './progression.js'
import { combiningGroupsContent } from './content/combiningGroupsContent.js'
import * as indexedDbStorage from './progressStorage.js'

export function createLessonProgressStore({ content, storage }) {
  let progress = $state(null)

  const ready = (async () => {
    const stored = await storage.loadProgress()
    progress = stored ?? createInitialProgress(content)
    if (!stored) {
      await storage.saveProgress(progress)
    }
  })()

  async function advanceInstructionStep() {
    progress = advanceInstructionStepPure(progress, content)
    await storage.saveProgress(progress)
  }

  async function submitProblemAnswer(value) {
    progress = submitProblemAnswerPure(progress, content, value)
    await storage.saveProgress(progress)
  }

  async function resetProgress() {
    progress = createInitialProgress(content)
    await storage.clearProgress()
    await storage.saveProgress(progress)
  }

  return {
    ready,
    get progress() {
      return progress
    },
    get isMultiplayerUnlocked() {
      return progress ? isMultiplayerUnlockedPure(progress) : false
    },
    get currentProblem() {
      if (!progress || progress.phase !== 'problems') return null
      const problemId = progress.problems.sequence[progress.problems.currentIndex]
      return content.problems.find((problem) => problem.id === problemId) ?? null
    },
    advanceInstructionStep,
    submitProblemAnswer,
    resetProgress,
  }
}

export const lessonProgress = createLessonProgressStore({
  content: combiningGroupsContent,
  storage: indexedDbStorage,
})
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS (23 tests total)

- [ ] **Step 5: Sanity-check the production build**

Run: `npm run build`
Expected: Build succeeds with no errors (confirms the `lessonProgress` singleton wiring — real content + real IndexedDB storage — has no import or syntax errors, even though nothing consumes it yet).

- [ ] **Step 6: Commit**

```bash
git add src/lessons/lessonProgress.svelte.js src/lessons/lessonProgress.svelte.test.js
git commit -m "Add Svelte 5 runes store wiring progression engine to persistence"
```

---

### Task 5: Minimal placeholder lesson UI

**Files:**
- Create: `src/lessons/LessonScreen.svelte`
- Create: `src/lessons/LessonInstruction.svelte`
- Create: `src/lessons/LessonProblems.svelte`
- Create: `src/lessons/LessonComplete.svelte`
- Modify: `src/App.svelte` (replace the Vite/Svelte template placeholder with `<LessonScreen />`)

**Interfaces:**
- Consumes: `lessonProgress` (the singleton store) and `combiningGroupsContent` from Task 4/2.
- Produces: nothing consumed by other tasks — this is the top of the tree.

These screens are deliberately plain (default browser form/button styling, no layout design, no animation) — they exist to prove the engine end-to-end in the running app, not as the real lesson experience. Real visual design and GSAP sequencing are separate future work once reference files arrive; swapping these components for designed ones won't touch `progression.js`, `progressStorage.js`, or `lessonProgress.svelte.js`. No dedicated automated tests are added for this task (there's no meaningful logic here beyond what Tasks 1-4 already test) — verification is the manual smoke check in Step 5.

- [ ] **Step 1: Create the instruction screen**

Create `src/lessons/LessonInstruction.svelte`:

```svelte
<script>
  import { lessonProgress } from './lessonProgress.svelte.js'
  import { combiningGroupsContent } from './content/combiningGroupsContent.js'

  let step = $derived(
    combiningGroupsContent.instruction.steps[lessonProgress.progress.instruction.currentStepIndex]
  )
</script>

<section>
  <h2>{step.title}</h2>
  <p>{step.body}</p>
  <button onclick={() => lessonProgress.advanceInstructionStep()}>Next</button>
</section>
```

- [ ] **Step 2: Create the problems screen**

Create `src/lessons/LessonProblems.svelte`:

```svelte
<script>
  import { lessonProgress } from './lessonProgress.svelte.js'

  let inputValue = $state('')

  function handleSubmit(event) {
    event.preventDefault()
    lessonProgress.submitProblemAnswer(inputValue)
    inputValue = ''
  }
</script>

<section>
  <p>Problem {lessonProgress.progress.problems.currentIndex + 1} of {lessonProgress.progress.problems.sequence.length}</p>
  <p>{lessonProgress.currentProblem?.prompt}</p>
  <form onsubmit={handleSubmit}>
    <input type="text" inputmode="numeric" bind:value={inputValue} />
    <button type="submit">Submit</button>
  </form>
</section>
```

- [ ] **Step 3: Create the completion screen**

Create `src/lessons/LessonComplete.svelte`:

```svelte
<script>
  import { lessonProgress } from './lessonProgress.svelte.js'
</script>

<section>
  <h2>Lesson complete!</h2>
  <p>Multiplayer unlocked: {lessonProgress.isMultiplayerUnlocked}</p>
  <button onclick={() => lessonProgress.resetProgress()}>Reset progress</button>
</section>
```

- [ ] **Step 4: Create the phase switcher and mount it**

Create `src/lessons/LessonScreen.svelte`:

```svelte
<script>
  import { lessonProgress } from './lessonProgress.svelte.js'
  import LessonInstruction from './LessonInstruction.svelte'
  import LessonProblems from './LessonProblems.svelte'
  import LessonComplete from './LessonComplete.svelte'
</script>

{#await lessonProgress.ready}
  <p>Loading lesson...</p>
{:then}
  {#if lessonProgress.progress.phase === 'instruction'}
    <LessonInstruction />
  {:else if lessonProgress.progress.phase === 'problems'}
    <LessonProblems />
  {:else}
    <LessonComplete />
  {/if}
{/await}
```

Replace the contents of `src/App.svelte` with:

```svelte
<script>
  import LessonScreen from './lessons/LessonScreen.svelte'
</script>

<main>
  <LessonScreen />
</main>
```

- [ ] **Step 5: Manually verify the flow in the dev server**

Run: `npm run dev`, open the printed local URL, and walk through:
1. Click "Next" through all instruction steps until the problems screen appears.
2. Submit a wrong answer for problem 1 (e.g. `4`) — confirm it does not advance.
3. Submit the correct answer (`5`) — confirm it advances to problem 2 of 10.
4. Answer all 10 problems correctly — confirm the completion screen appears with "Multiplayer unlocked: true".
5. Reload the page — confirm it resumes on the completion screen (progress persisted via IndexedDB).
6. Click "Reset progress" — confirm it returns to the first instruction step, and reload the page again to confirm the reset also persisted.

Expected: all six behaviors match. Stop and fix before committing if any step doesn't.

- [ ] **Step 6: Run the full test suite once more**

Run: `npm test`
Expected: PASS (23 tests total — this task added no new automated tests)

- [ ] **Step 7: Commit**

```bash
git add src/App.svelte src/lessons/LessonScreen.svelte src/lessons/LessonInstruction.svelte src/lessons/LessonProblems.svelte src/lessons/LessonComplete.svelte
git commit -m "Add minimal placeholder lesson UI wired to the progress store"
```

---

## Explicitly out of scope for this plan

- Real visual design, layout, styling, and GSAP animation/sequencing for the lesson screens — Task 5's screens are structural placeholders only, pending reference files from the stakeholder.
- The options-menu reset-progress button as actual menu UI — `resetProgress()` exists on the store and Task 5 exposes it via a plain button, but no options menu has been designed.
- The adaptive scaffolding engine, hint content, and `studentErrorTag` classification logic (spec "Future considerations") — `problems.adaptations` stays an empty array and `studentErrorTag` stays `null` everywhere this plan writes an attempt.
- Final authored lesson content (voiceover script, animation timing/assets, final problem wording) — `combiningGroupsContent.js` is functional example data, swappable later without touching the engine.
