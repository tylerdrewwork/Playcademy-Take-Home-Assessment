import { createLessonProgressStore } from './lessonProgress.svelte.js'
import { addition1Content } from './content/addition-1-Content.js'
import * as indexedDbStorage from './progressStorage.js'

export const lessonProgress = createLessonProgressStore({
  content: addition1Content,
  storage: indexedDbStorage,
})
