import { LessonContent, type InstructionScreen, type Problem } from '../lessonContent.js'
import IntroScreen from './addition-1-screens/IntroScreen.svelte'
import CountingCombiningScreen from './addition-1-screens/CountingCombiningScreen.svelte'

export interface Addition1ProblemGroup {
  count: number
  object: string
}

export interface Addition1Problem extends Problem {
  groups: Addition1ProblemGroup[]
}

class Addition1Content extends LessonContent<InstructionScreen, Addition1Problem> {
  readonly lessonId = 'combining-groups-2mdc8'
  // v2: instruction restructured from flat steps to screens, so progress
  // saved under v1 is discarded on load rather than misread.
  readonly contentVersion = 2
  // Bump whenever the problems below change in any way; evaluation findings
  // are stamped with this so they stay traceable to the set the student saw.
  readonly problemSetVersion = 1
  readonly instruction = {
    screens: [
      { id: 'intro', component: IntroScreen },
      { id: 'counting-combining', component: CountingCombiningScreen },
    ] satisfies InstructionScreen[],
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
