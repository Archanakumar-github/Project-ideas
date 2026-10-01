import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'

/** Photos are stored at most this many pixels on their long edge: sharp on any iPhone, small on disk. */
export const MAX_EDGE = 1600
export const LOCAL_PREFIX = 'local:'

export const isLocal = (uri: string | null | undefined): uri is string => !!uri?.startsWith(LOCAL_PREFIX)
export const localName = (uri: string) => uri.slice(LOCAL_PREFIX.length)

export interface StoredImage {
  /** `local:<file name>` */
  uri: string
  aspect: number
}

/** Downscales (never upscales) and re-encodes as JPEG, which also strips location metadata. */
export async function compress(sourceUri: string, width: number, height: number) {
  const ctx = ImageManipulator.manipulate(sourceUri)
  const long = Math.max(width, height)
  if (long > MAX_EDGE) {
    ctx.resize(width >= height ? { width: MAX_EDGE } : { height: MAX_EDGE })
  }
  const ref = await ctx.renderAsync()
  const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.82 })
  return { uri: out.uri, width: out.width || width, height: out.height || height }
}
