import type { Library } from '../../hooks/useLibrary'
import { normalize } from '../../lib/utils'

const ALIASES: Record<string, string[]> = {
  'sci fi': ['science fiction', 'sf', 'scifi'],
  fantasy: ['fantasy fiction', 'magic'],
  'mystery thriller': ['mystery', 'thriller', 'detective', 'crime', 'suspense'],
  'non fiction': ['nonfiction', 'history', 'biography', 'science'],
  philosophy: ['philosophy', 'ethics', 'stoicism'],
  'literary fiction': ['literary', 'classics', 'fiction literary'],
  'dark academia': ['campus', 'boarding school', 'universities and colleges'],
}

/** Best-effort mapping from provider subjects ("Science fiction") to the user's categories. */
export function suggestCategory(subjects: string[], lib: Library): { categoryId?: string; subCategoryId?: string } {
  if (!subjects.length) return {}
  const subjectText = subjects.map(normalize)
  const matches = (name: string) => {
    const n = normalize(name)
    const variants = [n, ...(ALIASES[n] ?? [])]
    return subjectText.some((s) => variants.some((v) => v && (s === v || s.includes(v))))
  }
  for (const top of lib.topCategories) {
    const subs = lib.subCategories.get(top.id) ?? []
    const sub = subs.find((s) => matches(s.name))
    if (sub) return { categoryId: top.id, subCategoryId: sub.id }
    if (matches(top.name)) return { categoryId: top.id }
  }
  return {}
}
