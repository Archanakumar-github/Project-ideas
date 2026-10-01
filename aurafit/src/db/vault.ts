import { cryptoAvailable, deriveKey, generateDeviceKey, makeVerifier, open, PBKDF2_ITERATIONS, randomBytes, seal, verify, type Sealed } from './crypto'
import { clearStore, get, getAll, openDB, replaceAll, writeBatch } from './idb'

/**
 * The encrypted document store. Every app document (profile, plan, each day's log, each
 * journal entry, settings, chat) is one record, sealed with AES-GCM before it touches disk.
 */

export type KeyMode = 'device' | 'passcode' | 'none'

type KeyRecord =
  | { id: 'master'; mode: 'device'; key: CryptoKey }
  | { id: 'master'; mode: 'passcode'; salt: Uint8Array<ArrayBuffer>; iterations: number; check: Sealed }
  | { id: 'master'; mode: 'none' }

interface DocRecord {
  k: string
  at: number
  iv?: Uint8Array<ArrayBuffer>
  ct?: ArrayBuffer
  /** Only when WebCrypto is unavailable (plain-http dev servers); migrated on next secure load. */
  plain?: unknown
}

export class Vault {
  private constructor(
    private db: IDBDatabase,
    public mode: KeyMode,
    private key: CryptoKey | undefined,
    private keyRecord: KeyRecord,
  ) {}

  /** Opens storage. In passcode mode the vault starts locked. */
  static async open(dbName?: string): Promise<Vault> {
    const db = await openDB(dbName)
    let rec = await get<KeyRecord>(db, 'keys', 'master')
    if (!rec) {
      if (cryptoAvailable()) {
        rec = { id: 'master', mode: 'device', key: await generateDeviceKey() }
      } else {
        rec = { id: 'master', mode: 'none' }
      }
      await writeBatch(db, 'keys', [rec])
    } else if (rec.mode === 'none' && cryptoAvailable()) {
      // Upgrade: we're on a secure origin now, so encrypt what was stored in the clear.
      const docs = await getAll<DocRecord>(db, 'docs')
      const key = await generateDeviceKey()
      const next: KeyRecord = { id: 'master', mode: 'device', key }
      const sealed = await Promise.all(docs.map(async (d) => ({ k: d.k, at: d.at, ...(await seal(key, d.plain)) })))
      await replaceAll(db, 'docs', sealed)
      await writeBatch(db, 'keys', [next])
      rec = next
    }
    const key = rec.mode === 'device' ? rec.key : undefined
    return new Vault(db, rec.mode, key, rec)
  }

  get locked() {
    return this.mode === 'passcode' && !this.key
  }

  get encrypted() {
    return this.mode !== 'none'
  }

  async unlock(passcode: string): Promise<boolean> {
    if (this.keyRecord.mode !== 'passcode') return true
    const key = await deriveKey(passcode, this.keyRecord.salt, this.keyRecord.iterations)
    if (!(await verify(key, this.keyRecord.check))) return false
    this.key = key
    return true
  }

  lock() {
    if (this.mode === 'passcode') this.key = undefined
  }

  async loadAll(): Promise<Map<string, unknown>> {
    if (this.locked) throw new Error('Vault is locked')
    const docs = await getAll<DocRecord>(this.db, 'docs')
    const out = new Map<string, unknown>()
    for (const d of docs) {
      try {
        if (d.ct && d.iv && this.key) out.set(d.k, await open(this.key, { iv: d.iv, ct: d.ct }))
        else if ('plain' in d) out.set(d.k, d.plain)
      } catch {
        // A record we can't decrypt (corrupt or foreign) is skipped rather than crashing the app.
        console.warn(`AuraFit: could not decrypt ${d.k}`)
      }
    }
    return out
  }

  private async record(k: string, value: unknown): Promise<DocRecord> {
    const at = Date.now()
    if (this.mode === 'none') return { k, at, plain: value }
    if (!this.key) throw new Error('Vault is locked')
    return { k, at, ...(await seal(this.key, value)) }
  }

  /** Encrypts and writes several documents atomically; `undefined` values delete. */
  async write(entries: Array<[string, unknown]>): Promise<void> {
    const puts: DocRecord[] = []
    const deletes: string[] = []
    for (const [k, v] of entries) {
      if (v === undefined) deletes.push(k)
      else puts.push(await this.record(k, v))
    }
    await writeBatch(this.db, 'docs', puts, deletes)
  }

  /** Re-encrypts every document under a new key (passcode on/off/change). */
  private async rekey(next: KeyRecord, key: CryptoKey | undefined, docs: Map<string, unknown>) {
    const prev = { mode: this.mode, key: this.key }
    this.mode = next.mode
    this.key = key
    try {
      const records = await Promise.all([...docs.entries()].map(([k, v]) => this.record(k, v)))
      await replaceAll(this.db, 'docs', records)
      await writeBatch(this.db, 'keys', [next])
      this.keyRecord = next
    } catch (err) {
      this.mode = prev.mode
      this.key = prev.key
      throw err
    }
  }

  async setPasscode(passcode: string, docs: Map<string, unknown>): Promise<void> {
    if (!cryptoAvailable()) throw new Error('Encryption needs a secure (HTTPS) connection')
    const salt = randomBytes(16)
    const key = await deriveKey(passcode, salt)
    const next: KeyRecord = { id: 'master', mode: 'passcode', salt, iterations: PBKDF2_ITERATIONS, check: await makeVerifier(key) }
    await this.rekey(next, key, docs)
  }

  async removePasscode(docs: Map<string, unknown>): Promise<void> {
    const key = await generateDeviceKey()
    await this.rekey({ id: 'master', mode: 'device', key }, key, docs)
  }

  /** Deletes every document and key: a fresh start. */
  async wipe(): Promise<void> {
    await clearStore(this.db, 'docs')
    await clearStore(this.db, 'keys')
    const rec: KeyRecord = cryptoAvailable() ? { id: 'master', mode: 'device', key: await generateDeviceKey() } : { id: 'master', mode: 'none' }
    await writeBatch(this.db, 'keys', [rec])
    this.keyRecord = rec
    this.mode = rec.mode
    this.key = rec.mode === 'device' ? rec.key : undefined
  }

  close() {
    this.db.close()
  }
}
