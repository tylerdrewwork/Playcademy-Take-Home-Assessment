import type { ScreenStep } from './lessonContent.js'

// Debug-only visibility into which step within the active instruction
// screen is currently showing. Each instruction-screen component (e.g.
// IntroScreen, CountingCombiningScreen) writes its own local step here as
// it advances; this is never read by lesson/progression logic itself.
class CurrentInstructionStep {
  step: ScreenStep | null = $state.raw(null)
}

export const currentInstructionStep = new CurrentInstructionStep()
