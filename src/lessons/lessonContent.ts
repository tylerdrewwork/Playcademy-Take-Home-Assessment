export interface InstructionStep {
  id: string
  title: string
  body: string
}

export interface Problem {
  id: string
  prompt: string
  answer: number
}

export abstract class LessonContent<
  TStep extends InstructionStep = InstructionStep,
  TProblem extends Problem = Problem,
> {
  abstract readonly lessonId: string
  abstract readonly contentVersion: number
  abstract readonly instruction: { steps: TStep[] }
  abstract readonly problems: TProblem[]

  findProblem(id: string): TProblem | undefined {
    return this.problems.find((problem) => problem.id === id)
  }
}
