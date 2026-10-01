/**
 * Downscale + re-encode cover images before storing them in IndexedDB. A 3000px phone photo
 * (~4 MB) becomes a ~60 KB JPEG, which keeps the library fast and the backup file small.
 */
export async function compressImage(
  input: Blob,
  { maxWidth = 600, maxHeight = 900, quality = 0.82 }: { maxWidth?: number; maxHeight?: number; quality?: number } = {},
): Promise<Blob> {
  if (typeof document === 'undefined') return input
  const source = await decode(input)
  try {
    const scale = Math.min(1, maxWidth / source.width, maxHeight / source.height)
    // Small, already-compressed images are kept as-is.
    if (scale === 1 && input.size < 150_000 && /jpe?g|webp/.test(input.type)) return input
    const width = Math.max(1, Math.round(source.width * scale))
    const height = Math.max(1, Math.round(source.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return input
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(source.image, 0, 0, width, height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    return blob && blob.size < input.size ? blob : input
  } finally {
    source.release()
  }
}

interface Decoded {
  image: CanvasImageSource
  width: number
  height: number
  release: () => void
}

async function decode(blob: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(blob)
      return { image: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close() }
    } catch {
      /* fall through to <img> (older Safari, HEIC) */
    }
  }
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    return { image: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) }
  } catch (err) {
    URL.revokeObjectURL(url)
    throw err
  }
}

/** Placeholder images (1x1 GIFs, "image not available" stubs) are tiny; real covers aren't. */
export function looksLikeRealCover(blob: Blob): boolean {
  return blob.type.startsWith('image/') && blob.size > 1500
}
