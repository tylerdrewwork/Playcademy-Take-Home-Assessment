import type { Problem } from './lessonContent.js'

// While a correct answer's send-off animation plays, progression has
// already advanced (progress stays the single source of truth — GSAP only
// times the visuals). This holds the just-answered problem so the UI can
// keep showing it until the celebration ends, and so LessonScreen keeps
// the problems screen mounted through the final problem's celebration
// even though the phase has already flipped to 'complete'.
class Celebration {
  problem: Problem | null = $state.raw(null)

  get active(): boolean {
    return this.problem !== null
  }

  start(problem: Problem): void {
    this.problem = problem
  }

  end(): void {
    this.problem = null
  }
}

export const celebration = new Celebration()
