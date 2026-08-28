import type { Component } from 'svelte'

export interface InstructionScreen {
  id: string
  component: Component<any>
  props?: Record<string, unknown>
}

export interface Problem {
  id: string
  prompt: string
  answer: number
}

export abstract class LessonContent<
  TScreen extends InstructionScreen = InstructionScreen,
  TProblem extends Problem = Problem,
> {
  abstract readonly lessonId: string
  abstract readonly contentVersion: number
  abstract readonly instruction: { screens: TScreen[] }
  abstract readonly problems: TProblem[]

  findProblem(id: string): TProblem | undefined {
    return this.problems.find((problem) => problem.id === id)
  }
}
