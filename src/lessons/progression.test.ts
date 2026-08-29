import { describe, expect, it } from 'vitest'
import type { Component } from 'svelte'
import { Progression } from './progression.js'
import { LessonContent, type InstructionScreen, type Problem } from './lessonContent.js'

// These are pure logic tests that never render, so the component reference
// only needs to satisfy the type.
const DummyComponent = (() => {}) as unknown as Component

class TestContent extends LessonContent<InstructionScreen, Problem> {
  readonly lessonId = 'test-lesson'
  readonly contentVersion = 1
  readonly problemSetVersion = 1
  readonly instruction = {
    screens: [
      { id: 'screen-1', component: DummyComponent },
      { id: 'screen-2', component: DummyComponent },
    ],
  }
  readonly problems = [
    { id: 'p1', prompt: '', answer: 5 },
    { id: 'p2', prompt: '', answer: 6 },
    { id: 'p3', prompt: '', answer: 7 },
  ]
}

const testContent = new TestContent()

describe('createInitialProgress', () => {
  it('starts in the instruction phase at screen 0', () => {
    const progress = Progression.createInitialProgress(testContent)
    expect(progress.phase).toBe('instruction')
    expect(progress.instruction.currentScreenIndex).toBe(0)
    expect(progress.instruction.completedAt).toBeNull()
  })

  it('seeds the problem sequence 1:1 from content order, at index 0', () => {
    const progress = Progression.createInitialProgress(testContent)
    expect(progress.problems.sequence).toEqual(['p1', 'p2', 'p3'])
    expect(progress.problems.currentIndex).toBe(0)
    expect(progress.problems.attempts).toEqual({})
    expect(progress.problems.adaptations).toEqual([])
  })

  it('carries the lessonId and contentVersion from content', () => {
    const progress = Progression.createInitialProgress(testContent)
    expect(progress.lessonId).toBe('test-lesson')
    expect(progress.contentVersion).toBe(1)
    expect(progress.lessonCompletedAt).toBeNull()
  })
})

describe('advanceInstructionStep', () => {
  it('moves to the next instruction screen', () => {
    const progress = Progression.createInitialProgress(testContent)
    const next = Progression.advanceInstructionStep(progress, testContent)
    expect(next.instruction.currentScreenIndex).toBe(1)
    expect(next.phase).toBe('instruction')
  })

  it('transitions to the problems phase after the last screen', () => {
    const progress = Progression.createInitialProgress(testContent)
    const afterStep1 = Progression.advanceInstructionStep(progress, testContent)
    const afterStep2 = Progression.advanceInstructionStep(afterStep1, testContent)
    expect(afterStep2.phase).toBe('problems')
    expect(afterStep2.instruction.completedAt).not.toBeNull()
  })
})

function progressAtFirstProblem() {
  const progress = Progression.createInitialProgress(testContent)
  const afterStep1 = Progression.advanceInstructionStep(progress, testContent)
  return Progression.advanceInstructionStep(afterStep1, testContent) // now in 'problems' phase
}

describe('submitProblemAnswer', () => {
  it('records a correct answer and advances to the next problem', () => {
    const progress = progressAtFirstProblem()
    const next = Progression.submitProblemAnswer(progress, testContent, '5')
    expect(next.problems.currentIndex).toBe(1)
    expect(next.problems.attempts.p1).toHaveLength(1)
    expect(next.problems.attempts.p1[0]).toMatchObject({ value: '5', correct: true, contentVersion: 1 })
    expect(next.phase).toBe('problems')
  })

  it('records a wrong answer, does not advance, and stamps a null studentEvaluationTag', () => {
    const progress = progressAtFirstProblem()
    const next = Progression.submitProblemAnswer(progress, testContent, '4')
    expect(next.problems.currentIndex).toBe(0)
    expect(next.problems.attempts.p1).toHaveLength(1)
    expect(next.problems.attempts.p1[0]).toMatchObject({ value: '4', correct: false, studentEvaluationTag: null })
  })

  it('stamps the provided studentEvaluationTag on the attempt', () => {
    const progress = progressAtFirstProblem()
    const wrong = Progression.submitProblemAnswer(progress, testContent, '4', 'off-by-one')
    expect(wrong.problems.attempts.p1[0]).toMatchObject({ correct: false, studentEvaluationTag: 'off-by-one' })
    const right = Progression.submitProblemAnswer(wrong, testContent, '5', 'solved-without-merge')
    expect(right.problems.attempts.p1[1]).toMatchObject({ correct: true, studentEvaluationTag: 'solved-without-merge' })
  })

  it('keeps a wrong attempt in history when the student then answers correctly', () => {
    const progress = progressAtFirstProblem()
    const afterWrong = Progression.submitProblemAnswer(progress, testContent, '4')
    const afterCorrect = Progression.submitProblemAnswer(afterWrong, testContent, '5')
    expect(afterCorrect.problems.attempts.p1).toHaveLength(2)
    expect(afterCorrect.problems.currentIndex).toBe(1)
  })

  it('transitions to complete and stamps lessonCompletedAt after the last problem', () => {
    let progress = progressAtFirstProblem()
    progress = Progression.submitProblemAnswer(progress, testContent, '5') // p1 -> index 1
    progress = Progression.submitProblemAnswer(progress, testContent, '6') // p2 -> index 2
    progress = Progression.submitProblemAnswer(progress, testContent, '7') // p3 -> complete
    expect(progress.phase).toBe('complete')
    expect(progress.problems.currentIndex).toBe(3)
    expect(progress.lessonCompletedAt).not.toBeNull()
    expect(progress.problems.completedAt).not.toBeNull()
  })
})

describe('jumpToPhase', () => {
  it('jumps to the instruction phase at screen 0 from anywhere', () => {
    const progress = progressAtFirstProblem()
    const next = Progression.jumpToPhase(progress, 'instruction')
    expect(next.phase).toBe('instruction')
    expect(next.instruction.currentScreenIndex).toBe(0)
  })

  it('jumps to the problems phase without touching attempts or sequence', () => {
    const initial = Progression.createInitialProgress(testContent)
    const next = Progression.jumpToPhase(initial, 'problems')
    expect(next.phase).toBe('problems')
    expect(next.problems.currentIndex).toBe(0)
    expect(next.problems.attempts).toEqual(initial.problems.attempts)
    expect(next.problems.sequence).toEqual(initial.problems.sequence)
  })

  it('clamps currentIndex back to the last problem when jumping in from complete', () => {
    let progress = progressAtFirstProblem()
    progress = Progression.submitProblemAnswer(progress, testContent, '5')
    progress = Progression.submitProblemAnswer(progress, testContent, '6')
    progress = Progression.submitProblemAnswer(progress, testContent, '7')
    expect(progress.phase).toBe('complete')
    const next = Progression.jumpToPhase(progress, 'problems')
    expect(next.phase).toBe('problems')
    expect(next.problems.currentIndex).toBe(2)
  })
})

describe('isMultiplayerUnlocked', () => {
  it('is false before the lesson is complete and true after', () => {
    let progress = progressAtFirstProblem()
    expect(Progression.isMultiplayerUnlocked(progress)).toBe(false)
    progress = Progression.submitProblemAnswer(progress, testContent, '5')
    progress = Progression.submitProblemAnswer(progress, testContent, '6')
    progress = Progression.submitProblemAnswer(progress, testContent, '7')
    expect(Progression.isMultiplayerUnlocked(progress)).toBe(true)
  })
})
