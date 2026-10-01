import 'fake-indexeddb/auto'

// Minimal in-memory localStorage / sessionStorage for the Node test environment.
class MemoryStorage implements Storage {
  private map = new Map<string, string>()
  get length() {
    return this.map.size
  }
  clear() {
    this.map.clear()
  }
  getItem(key: string) {
    return this.map.has(key) ? this.map.get(key)! : null
  }
  key(i: number) {
    return Array.from(this.map.keys())[i] ?? null
  }
  removeItem(key: string) {
    this.map.delete(key)
  }
  setItem(key: string, value: string) {
    this.map.set(key, String(value))
  }
}

const g = globalThis as Record<string, unknown>
if (!g.localStorage) g.localStorage = new MemoryStorage()
if (!g.sessionStorage) g.sessionStorage = new MemoryStorage()
