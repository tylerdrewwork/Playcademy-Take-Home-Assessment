// Keep this file data + type-imports only. The voice-clips generator
// (tools/voice-clips-generator/) imports it under plain Node, where a
// runtime import's '.js' specifier would fail to resolve — type-only
// imports are erased by Node's type-stripping, so they're safe.
import type { ScreenStep } from '../../lessonContent.js'

export const introSteps: ScreenStep[] = [
  {
    label: 'begin',
    title: 'Meet the balloons',
    transcript:
      'Today we are going to combine two groups of balloons and count how many there are in all.',
  },
]
