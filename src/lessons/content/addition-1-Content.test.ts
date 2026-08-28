import { describe, expect, it } from 'vitest'
import { addition1Content } from './addition-1-Content.js'

describe('addition1Content', () => {
  it('has 10 problems with unique ids', () => {
    expect(addition1Content.problems).toHaveLength(10)
    const ids = addition1Content.problems.map((problem) => problem.id)
    expect(new Set(ids).size).toBe(10)
  })

  it('every problem answer equals the sum of its groups', () => {
    for (const problem of addition1Content.problems) {
      const sum = problem.groups.reduce((total, group) => total + group.count, 0)
      expect(problem.answer).toBe(sum)
    }
  })

  it('has at least one instruction screen', () => {
    expect(addition1Content.instruction.screens.length).toBeGreaterThan(0)
  })
})
