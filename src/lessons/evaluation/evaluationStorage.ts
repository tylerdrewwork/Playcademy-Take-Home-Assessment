import type { Finding } from './evaluationTypes.js'

export interface ProblemEpisodeSummary {
  problemId: string
  shownAt: number
  endedAt: number | null
  attemptCount: number
  eventCounts: Record<string, number>
}

export interface EvaluationRecord {
  // Bumped when the record shape changes; a mismatched stored record is
  // discarded on load, same policy as contentVersion in LessonProgress.
  schemaVersion: number
  lessonId: string
  contentVersion: number
  startedAt: number
  updatedAt: number
  findings: Finding[]
  episodes: ProblemEpisodeSummary[]
}

export const EVALUATION_SCHEMA_VERSION = 1

// The pluggable sink: IndexedDB today, potentially an Analytics or remote
// sink later without touching the recorder.
export abstract class EvaluationStorage {
  abstract load(): Promise<EvaluationRecord | null>
  abstract save(record: EvaluationRecord): Promise<void>
  abstract clear(): Promise<void>
}

// A separate database from lesson progress so neither store's versioning or
// reset semantics constrains the other.
const DB_NAME = 'playcademy-lesson-evaluation'
const DB_VERSION = 1
const STORE_NAME = 'evaluation'
const RECORD_KEY = 'current'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export class IndexedDbEvaluationStorage extends EvaluationStorage {
  async save(record: EvaluationRecord): Promise<void> {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).put(record, RECORD_KEY)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }

  async load(): Promise<EvaluationRecord | null> {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly')
      const request = transaction.objectStore(STORE_NAME).get(RECORD_KEY)
      request.onsuccess = () => resolve(request.result ?? null)
      request.onerror = () => reject(request.error)
    })
  }

  async clear(): Promise<void> {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).delete(RECORD_KEY)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }
}
