import { createLessonProgressStore } from './lessonProgress.svelte.js'
import { combiningGroupsContent } from './content/combiningGroupsContent.js'
import * as indexedDbStorage from './progressStorage.js'

export const lessonProgress = createLessonProgressStore({
  content: combiningGroupsContent,
  storage: indexedDbStorage,
})
