/**
 * AES-GCM-256 encryption via WebCrypto.
 *
 *  - Device mode (default): a random key generated with `extractable: false` and stored as a
 *    CryptoKey object in IndexedDB. Scripts can use it but can never read its bytes, so the
 *    database files on disk (and any copied storage) are ciphertext.
 *  - Passcode mode (optional): the key is derived from your passcode with PBKDF2-SHA-256
 *    (600,000 iterations) and lives only in memory while the app is unlocked.
 *
 * Each document gets a fresh 96-bit IV.
 */

export const PBKDF2_ITERATIONS = 600_000

export function cryptoAvailable(): boolean {
  return typeof crypto !== 'undefined' && !!crypto.subtle && typeof crypto.subtle.encrypt === 'function'
}

export function generateDeviceKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

export function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(n))
  crypto.getRandomValues(out)
  return out
}

export async function deriveKey(passcode: string, salt: Uint8Array<ArrayBuffer>, iterations = PBKDF2_ITERATIONS): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passcode.normalize('NFKC')), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

export interface Sealed {
  iv: Uint8Array<ArrayBuffer>
  ct: ArrayBuffer
}

export async function seal(key: CryptoKey, value: unknown): Promise<Sealed> {
  const iv = randomBytes(12)
  const data = new TextEncoder().encode(JSON.stringify(value))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data)
  return { iv, ct }
}

export async function open<T = unknown>(key: CryptoKey, sealed: Sealed): Promise<T> {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: sealed.iv }, key, sealed.ct)
  return JSON.parse(new TextDecoder().decode(plain)) as T
}

const CHECK = 'aurafit-passcode-check'

export async function makeVerifier(key: CryptoKey): Promise<Sealed> {
  return seal(key, CHECK)
}

export async function verify(key: CryptoKey, verifier: Sealed): Promise<boolean> {
  try {
    return (await open<string>(key, verifier)) === CHECK
  } catch {
    return false
  }
}
