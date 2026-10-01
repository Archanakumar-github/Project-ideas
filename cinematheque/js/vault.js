// Cinémathèque — on-device storage.
// Plain mode keeps the library as JSON in localStorage. With a passcode set, the library is
// encrypted with AES-GCM (256-bit) under a key derived from the passcode via PBKDF2-SHA-256;
// the passcode itself is never stored, so a wrong one simply fails to decrypt.

const DATA = 'cinematheque:v1';
const VAULT = 'cinematheque:vault:v1';
const ITERATIONS = 310000;

const enc = new TextEncoder();
const dec = new TextDecoder();

function toB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromB64(str) {
  const s = atob(str);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function derive(pass, salt, iterations) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function readRecord() {
  const rec = JSON.parse(localStorage.getItem(VAULT));
  if (!rec || !rec.salt || !rec.iv || !rec.ct) throw new Error('Vault is damaged');
  return rec;
}

async function open(pass, rec) {
  const salt = fromB64(rec.salt);
  const key = await derive(pass, salt, rec.iter || ITERATIONS);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(rec.iv) }, key, fromB64(rec.ct));
  return { key, salt, data: JSON.parse(dec.decode(plain)) };
}

export const vault = {
  key: null,
  salt: null,
  iter: ITERATIONS,

  get supported() {
    return !!(globalThis.isSecureContext && globalThis.crypto && crypto.subtle);
  },

  get enabled() {
    return localStorage.getItem(VAULT) !== null;
  },

  get unlocked() {
    return this.key !== null;
  },

  readPlain() {
    const s = localStorage.getItem(DATA);
    return s ? JSON.parse(s) : null;
  },

  /** Decrypts the library. Throws if the passcode is wrong. */
  async unlock(pass) {
    const rec = readRecord();
    const { key, salt, data } = await open(pass, rec);
    this.key = key;
    this.salt = salt;
    this.iter = rec.iter || ITERATIONS;
    return data;
  },

  async verify(pass) {
    try {
      await open(pass, readRecord());
      return true;
    } catch {
      return false;
    }
  },

  async save(db) {
    const json = JSON.stringify(db);
    if (!this.key) {
      localStorage.setItem(DATA, json);
      return;
    }
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, this.key, enc.encode(json)));
    localStorage.setItem(
      VAULT,
      JSON.stringify({ v: 1, kdf: 'PBKDF2-SHA256', iter: this.iter, salt: toB64(this.salt), iv: toB64(iv), ct: toB64(ct) }),
    );
  },

  /** Turn encryption on (or change the passcode). */
  async enable(pass, db) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await derive(pass, salt, ITERATIONS);
    const prev = { key: this.key, salt: this.salt, iter: this.iter };
    Object.assign(this, { key, salt, iter: ITERATIONS });
    try {
      await this.save(db);
    } catch (err) {
      Object.assign(this, prev);
      throw err;
    }
    localStorage.removeItem(DATA);
  },

  async disable(db) {
    localStorage.setItem(DATA, JSON.stringify(db));
    localStorage.removeItem(VAULT);
    this.key = null;
    this.salt = null;
  },

  lock() {
    this.key = null;
    this.salt = null;
  },

  wipe() {
    localStorage.removeItem(DATA);
    localStorage.removeItem(VAULT);
    this.lock();
  },
};
