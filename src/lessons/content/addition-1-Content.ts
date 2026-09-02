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
  // v2: prompts no longer state the group counts — the student counts the
  // balloons instead of reading the numbers.
  readonly problemSetVersion = 2
  readonly instruction = {
    screens: [
      { id: 'intro', component: IntroScreen },
      { id: 'counting-combining', component: CountingCombiningScreen },
    ] satisfies InstructionScreen[],
  }
  readonly problems: Addition1Problem[] = [
    { id: 'p1', prompt: 'How many balloons in total?', groups: [{ count: 1, object: 'ball' }, { count: 1, object: 'ball' }], answer: 2 },
    { id: 'p2', prompt: 'How many balloons in total?', groups: [{ count: 2, object: 'ball' }, { count: 2, object: 'ball' }], answer: 4 },
    { id: 'p3', prompt: 'How many balloons in total?', groups: [{ count: 1, object: 'ball' }, { count: 2, object: 'ball' }], answer: 3 },
    { id: 'p4', prompt: 'How many balloons in total?', groups: [{ count: 5, object: 'ball' }, { count: 1, object: 'ball' }], answer: 6 },
    { id: 'p5', prompt: 'How many balloons in total?', groups: [{ count: 3, object: 'ball' }, { count: 2, object: 'ball' }], answer: 5 },
    { id: 'p6', prompt: 'How many balloons in total?', groups: [{ count: 4, object: 'ball' }, { count: 3, object: 'ball' }], answer: 7 },
    { id: 'p7', prompt: 'How many balloons in total?', groups: [{ count: 2, object: 'ball' }, { count: 7, object: 'ball' }], answer: 9 },
    { id: 'p8', prompt: 'How many balloons in total?', groups: [{ count: 0, object: 'ball' }, { count: 0, object: 'ball' }], answer: 0 },
    { id: 'p9', prompt: 'How many balloons in total?', groups: [{ count: 5, object: 'ball' }, { count: 5, object: 'ball' }], answer: 10 },
    { id: 'p10', prompt: 'How many balloons in total?', groups: [{ count: 4, object: 'ball' }, { count: 4, object: 'ball' }], answer: 8 },
  ]
}

export const addition1Content = new Addition1Content()
