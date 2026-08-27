import { describe, expect, it } from 'vitest'
import { createInitialProgress, advanceInstructionStep, submitProblemAnswer, isMultiplayerUnlocked } from './progression.js'

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
