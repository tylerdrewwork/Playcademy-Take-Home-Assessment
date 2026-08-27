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
