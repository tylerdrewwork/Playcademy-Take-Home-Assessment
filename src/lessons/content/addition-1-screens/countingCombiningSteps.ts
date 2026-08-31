// Keep this file data + type-imports only. The voice-clips generator
// (tools/voice-clips-generator/) imports it under plain Node, where a
// runtime import's '.js' specifier would fail to resolve — type-only
// imports are erased by Node's type-stripping, so they're safe.
import type { ScreenStep } from '../../lessonContent.js'

export const countingCombiningSteps: ScreenStep[] = [
  {
    label: 'i-do-start',
    title: 'Counting one group',
    transcript: "Watch how I count these balloons.",
  },
  {
    label: 'group-1',
    title: 'Counting one group',
    transcript: "Here are some blue balloons. I'll count them.",
  },
  {
    label: 'both-groups',
    title: 'Counting the second group',
    transcript: "Over here are some yellow balloons. I'll count them.",
  },
  {
    label: 'combine',
    title: 'How to Combine Groups',
    transcript: "Now let's put both groups together and count all the balloons. There are 5 balloons in all.",
  },
  {
    label: 'we-do-start',
    title: '',
    transcript: "Now, let's do it together! Touch the balloons as we count them.",
  },
  {
    label: 'we-do-group-1',
    title: '',
    transcript: "Let's count the blue balloons together. There are 4 blue balloons.",
  },
  {
    label: 'we-do-group-2',
    title: '',
    transcript: "Now let's count the yellow balloons together. There are 5 yellow balloons.",
  },
  {
    label: 'we-do-group-combined',
    title: '',
    transcript: "Now let's put both groups together and count all the balloons. There are 9 balloons!",
  },
  {
    label: 'problems-pre-transition',
    title: '',
    transcript: "Now, you try.",
  },
]
