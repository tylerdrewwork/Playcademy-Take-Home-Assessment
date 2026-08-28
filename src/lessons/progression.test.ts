import { describe, expect, it } from 'vitest'
import { Progression } from './progression.js'
import { LessonContent, type InstructionStep, type Problem } from './lessonContent.js'

class TestContent extends LessonContent<InstructionStep, Problem> {
  readonly lessonId = 'test-lesson'
  readonly contentVersion = 1
  readonly instruction = {
    steps: [
      { id: 'step-1', title: '', body: '' },
      { id: 'step-2', title: '', body: '' },
    ],
  }
  readonly problems = [
    { id: 'p1', prompt: '', groups: [], answer: 5 },
    { id: 'p2', prompt: '', groups: [], answer: 6 },
    { id: 'p3', prompt: '', groups: [], answer: 7 },
  ]
}

const testContent = new TestContent()

describe('createInitialProgress', () => {
  it('starts in the instruction phase at step 0', () => {
    const progress = Progression.createInitialProgress(testContent)
    expect(progress.phase).toBe('instruction')
    expect(progress.instruction.currentStepIndex).toBe(0)
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
  it('moves to the next instruction step', () => {
    const progress = Progression.createInitialProgress(testContent)
    const next = Progression.advanceInstructionStep(progress, testContent)
    expect(next.instruction.currentStepIndex).toBe(1)
    expect(next.phase).toBe('instruction')
  })

  it('transitions to the problems phase after the last step', () => {
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

  it('records a wrong answer, does not advance, and stamps a null studentErrorTag', () => {
    const progress = progressAtFirstProblem()
    const next = Progression.submitProblemAnswer(progress, testContent, '4')
    expect(next.problems.currentIndex).toBe(0)
    expect(next.problems.attempts.p1).toHaveLength(1)
    expect(next.problems.attempts.p1[0]).toMatchObject({ value: '4', correct: false, studentErrorTag: null })
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
