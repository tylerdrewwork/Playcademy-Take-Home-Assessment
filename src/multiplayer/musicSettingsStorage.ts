export interface MusicSettingsRecord {
  muted: boolean
}

export abstract class MusicSettingsStorage {
  abstract load(): Promise<MusicSettingsRecord | null>
  abstract save(record: MusicSettingsRecord): Promise<void>
}

// A separate database from lesson progress/evaluation so neither store's
// versioning or reset semantics constrains the others.
const DB_NAME = 'playcademy-music-settings'
const DB_VERSION = 1
const STORE_NAME = 'settings'
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

export class IndexedDbMusicSettingsStorage extends MusicSettingsStorage {
  async save(record: MusicSettingsRecord): Promise<void> {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).put(record, RECORD_KEY)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }

  async load(): Promise<MusicSettingsRecord | null> {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly')
      const request = transaction.objectStore(STORE_NAME).get(RECORD_KEY)
      request.onsuccess = () => resolve(request.result ?? null)
      request.onerror = () => reject(request.error)
    })
  }
}
