import type { Progress } from './progression.js'

export abstract class ProgressionStorage {
  abstract saveProgress(progress: Progress): Promise<void>
  abstract loadProgress(): Promise<Progress | null>
  abstract clearProgress(): Promise<void>
}

const DB_NAME = 'playcademy-lesson-progress'
const DB_VERSION = 1
const STORE_NAME = 'progress'
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

export class IndexedDbProgressionStorage extends ProgressionStorage {
  async saveProgress(progress: Progress): Promise<void> {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).put(progress, RECORD_KEY)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }

  async loadProgress(): Promise<Progress | null> {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly')
      const request = transaction.objectStore(STORE_NAME).get(RECORD_KEY)
      request.onsuccess = () => resolve(request.result ?? null)
      request.onerror = () => reject(request.error)
    })
  }

  async clearProgress(): Promise<void> {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).delete(RECORD_KEY)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }
}
