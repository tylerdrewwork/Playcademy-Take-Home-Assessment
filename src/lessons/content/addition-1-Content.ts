import { LessonContent, type InstructionStep, type Problem } from '../lessonContent.js'

export interface Addition1Group {
  count: number
  color: string
}

export interface Addition1Step extends InstructionStep {
  groups?: Addition1Group[]
  showCombined?: boolean
}

export interface Addition1ProblemGroup {
  count: number
  object: string
}

export interface Addition1Problem extends Problem {
  groups: Addition1ProblemGroup[]
}

class Addition1Content extends LessonContent<Addition1Step, Addition1Problem> {
  readonly lessonId = 'combining-groups-2mdc8'
  readonly contentVersion = 1
  readonly instruction = {
    steps: [
      {
        id: 'intro',
        title: 'Meet the balloons',
        body: 'Today we are going to combine two groups of balloons and count how many there are in all.',
      },
      {
        id: 'example-1',
        title: 'Counting one group',
        body: "Here are 2 balloons. Let's count them: 1, 2.",
        groups: [{ count: 2, color: 'blue' }],
      },
      {
        id: 'example-2',
        title: 'Counting the second group',
        body: "Here are 3 more balloons. Let's count them: 1, 2, 3.",
        groups: [
          { count: 2, color: 'blue' },
          { count: 3, color: 'yellow' },
        ],
      },
      {
        id: 'example-3',
        title: 'How to Combine Groups',
        body: "Now let's put both groups together and count all the balloons: 1, 2, 3, 4, 5. There are 5 balloons in all.",
        groups: [
          { count: 2, color: 'blue' },
          { count: 3, color: 'yellow' },
        ],
        showCombined: true,
      },
    ] satisfies Addition1Step[],
  }
  readonly problems: Addition1Problem[] = [
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
  ]
}

export const addition1Content = new Addition1Content()
