/**
 * Browser image store: JPEG Blobs in IndexedDB, shown through object URLs created on demand.
 */
import { compress, isLocal, localName, type StoredImage } from './common'
import { idb } from '../lib/idb'
import { uid } from '../lib/id'

export * from './common'

const urls = new Map<string, string>()

function size(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => reject(new Error('Could not read that image'))
    img.src = src
  })
}

async function store(blobUrl: string, width: number, height: number): Promise<StoredImage> {
  const dims = width && height ? { width, height } : await size(blobUrl)
  const small = await compress(blobUrl, dims.width, dims.height)
  const blob = await (await fetch(small.uri)).blob()
  const name = `${uid()}.jpg`
  await idb.put('images', name, blob)
  urls.set(name, small.uri)
  return { uri: `local:${name}`, aspect: small.width / Math.max(1, small.height) }
}

export function saveLocalImage(sourceUri: string, width = 0, height = 0): Promise<StoredImage> {
  return store(sourceUri, width, height)
}

/** Most sites don't allow other pages to read their images (CORS); those stay as links. */
export async function downloadImage(url: string): Promise<StoredImage | null> {
  try {
    const res = await fetch(url, { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' })
    if (!res.ok) return null
    const blobUrl = URL.createObjectURL(await res.blob())
    try {
      return await store(blobUrl, 0, 0)
    } finally {
      URL.revokeObjectURL(blobUrl)
    }
  } catch {
    return null
  }
}

export async function deleteLocalImage(uri: string | null | undefined): Promise<void> {
  if (!isLocal(uri)) return
  const name = localName(uri)
  await idb.delete('images', name)
  const url = urls.get(name)
  if (url) URL.revokeObjectURL(url)
  urls.delete(name)
}

export function resolveLocalSync(uri: string): string | null {
  return urls.get(localName(uri)) ?? null
}

export async function resolveLocal(uri: string): Promise<string | null> {
  const name = localName(uri)
  const cached = urls.get(name)
  if (cached) return cached
  const blob = await idb.get<Blob>('images', name)
  if (!blob) return null
  const url = URL.createObjectURL(blob)
  urls.set(name, url)
  return url
}

export async function cleanOrphans(referenced: Set<string>): Promise<number> {
  let removed = 0
  for (const key of await idb.keys('images')) {
    if (!referenced.has(`local:${String(key)}`)) {
      await idb.delete('images', String(key))
      removed++
    }
  }
  return removed
}

/** For backups: a local image as base64 JPEG. */
export async function readLocalBase64(uri: string): Promise<string | null> {
  const blob = await idb.get<Blob>('images', localName(uri))
  if (!blob) return null
  const buf = new Uint8Array(await blob.arrayBuffer())
  let bin = ''
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  return btoa(bin)
}

export async function writeLocalBase64(uri: string, base64: string): Promise<void> {
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  await idb.put('images', localName(uri), new Blob([bytes], { type: 'image/jpeg' }))
}
