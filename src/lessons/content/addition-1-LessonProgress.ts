import { LessonProgress } from '../lessonProgress.svelte.js'
import { IndexedDbProgressionStorage } from '../progressStorage.js'
import { addition1Content } from './addition-1-Content.js'

export const addition1LessonProgress = new LessonProgress(
  addition1Content,
  new IndexedDbProgressionStorage()
)
