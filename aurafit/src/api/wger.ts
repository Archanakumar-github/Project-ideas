import { getJSON } from './http'

/** wger.de: open exercise database with images and descriptions. */

export interface ExerciseInfo {
  name: string
  description?: string
  images: string[]
  muscles: string[]
  url?: string
}

interface SearchResponse {
  suggestions?: Array<{ value: string; data: { id: number; base_id?: number; name: string; image?: string | null; image_thumbnail?: string | null } }>
}

interface InfoResponse {
  id: number
  uuid?: string
  images?: Array<{ image: string; is_main?: boolean }>
  muscles?: Array<{ name_en?: string; name?: string }>
  translations?: Array<{ name: string; description?: string; language: number }>
}

const BASE = 'https://wger.de'

export function stripHtml(html: string) {
  return html
    .replace(/<\/(p|li|h\d)>/gi, '\n')
    .replace(/<li>/gi, '• ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const abs = (u?: string | null) => (u ? (u.startsWith('http') ? u : `${BASE}${u}`) : undefined)

export async function exerciseInfo(name: string, signal?: AbortSignal): Promise<ExerciseInfo | undefined> {
  const term = name.replace(/\(.*?\)/g, '').replace(/^(barbell|dumbbell|banded|kettlebell|cable|machine)\s+/i, '').trim()
  const search = await getJSON<SearchResponse>(`${BASE}/api/v2/exercise/search/?language=en&term=${encodeURIComponent(term)}`, { signal })
  const hit = search.suggestions?.[0]
  if (!hit) return undefined
  const baseId = hit.data.base_id ?? hit.data.id
  const images: string[] = []
  const thumb = abs(hit.data.image)
  if (thumb) images.push(thumb)
  let description: string | undefined
  let muscles: string[] = []
  try {
    const info = await getJSON<InfoResponse>(`${BASE}/api/v2/exerciseinfo/${baseId}/`, { signal })
    for (const img of info.images ?? []) {
      const u = abs(img.image)
      if (u && !images.includes(u)) images.push(u)
    }
    const en = info.translations?.find((t) => t.language === 2) ?? info.translations?.[0]
    if (en?.description) description = stripHtml(en.description)
    muscles = (info.muscles ?? []).map((m) => m.name_en || m.name || '').filter(Boolean)
  } catch {
    // The search hit alone is still useful.
  }
  return { name: hit.data.name || hit.value, description, images, muscles, url: `${BASE}/en/exercise/${baseId}/view/` }
}
