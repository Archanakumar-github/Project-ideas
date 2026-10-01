/**
 * iOS / Android image store: JPEGs in <documents>/images. Items keep `local:<name>`, never an
 * absolute path, because iOS moves the app's container on every update.
 */
import { Directory, File, Paths } from 'expo-file-system'
import { Image } from 'expo-image'
import { compress, isLocal, localName, type StoredImage } from './common'
import { uid } from '../lib/id'

export * from './common'

function dir(): Directory {
  const d = new Directory(Paths.document, 'images')
  if (!d.exists) d.create({ intermediates: true, idempotent: true })
  return d
}

/** Copies a picked photo into the app's own storage. */
export async function saveLocalImage(sourceUri: string, width = 0, height = 0): Promise<StoredImage> {
  const small = await compress(sourceUri, width, height)
  const name = `${uid()}.jpg`
  await new File(small.uri).move(new File(dir(), name))
  return { uri: `local:${name}`, aspect: small.width / Math.max(1, small.height) }
}

/** Keeps a fetched web image on the device, so it shows offline and survives the site changing. */
export async function downloadImage(url: string): Promise<StoredImage | null> {
  const tmp = new File(Paths.cache, `dl-${uid()}`)
  try {
    const file = await File.downloadFileAsync(url, tmp, { idempotent: true })
    const ref = await Image.loadAsync(file.uri)
    const saved = await saveLocalImage(file.uri, ref.width, ref.height)
    return saved
  } catch {
    return null
  } finally {
    if (tmp.exists) tmp.delete()
  }
}

export async function deleteLocalImage(uri: string | null | undefined): Promise<void> {
  if (!isLocal(uri)) return
  const f = new File(dir(), localName(uri))
  if (f.exists) f.delete()
}

export function resolveLocalSync(uri: string): string | null {
  return new File(dir(), localName(uri)).uri
}

export async function resolveLocal(uri: string): Promise<string | null> {
  return resolveLocalSync(uri)
}

/** Removes image files no item points at (left behind by a crash mid-delete). */
export async function cleanOrphans(referenced: Set<string>): Promise<number> {
  let removed = 0
  for (const entry of dir().list()) {
    if (entry instanceof File && !referenced.has(`local:${entry.name}`)) {
      entry.delete()
      removed++
    }
  }
  return removed
}

/** For backups: a local image as base64 JPEG. */
export async function readLocalBase64(uri: string): Promise<string | null> {
  const f = new File(dir(), localName(uri))
  return f.exists ? f.base64() : null
}

export async function writeLocalBase64(uri: string, base64: string): Promise<void> {
  const f = new File(dir(), localName(uri))
  if (!f.exists) f.create()
  f.write(base64, { encoding: 'base64' })
}
