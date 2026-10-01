/** Pure helpers over the flat category list (any depth of sub-categories). */
import type { Category } from '../db/types'

export function sortByPosition<T extends { position: number; createdAt: number }>(list: T[]): T[] {
  return [...list].sort((a, b) => a.position - b.position || a.createdAt - b.createdAt)
}

export function childrenOf(categories: Category[], parentId: string | null): Category[] {
  return sortByPosition(categories.filter((c) => c.parentId === parentId))
}

export function byId(categories: Category[]): Map<string, Category> {
  return new Map(categories.map((c) => [c.id, c]))
}

/** The category and everything beneath it. */
export function subtreeIds(categories: Category[], rootId: string): Set<string> {
  const kids = new Map<string | null, string[]>()
  for (const c of categories) {
    const list = kids.get(c.parentId) ?? []
    list.push(c.id)
    kids.set(c.parentId, list)
  }
  const out = new Set<string>()
  const stack = [rootId]
  while (stack.length) {
    const id = stack.pop()!
    if (out.has(id)) continue
    out.add(id)
    stack.push(...(kids.get(id) ?? []))
  }
  return out
}

/** Root-first chain of ancestors ending with the category itself. */
export function pathOf(categories: Category[], id: string | null): Category[] {
  if (!id) return []
  const map = byId(categories)
  const out: Category[] = []
  const seen = new Set<string>()
  let cur = map.get(id)
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id)
    out.unshift(cur)
    cur = cur.parentId ? map.get(cur.parentId) : undefined
  }
  return out
}

export function rootOf(categories: Category[], id: string | null): Category | null {
  return pathOf(categories, id)[0] ?? null
}

export function pathLabel(categories: Category[], id: string | null, sep = ' · '): string {
  return pathOf(categories, id)
    .map((c) => c.name)
    .join(sep)
}

/** True if `id` is `ancestorId` or sits somewhere below it. */
export function isWithin(categories: Category[], id: string | null, ancestorId: string): boolean {
  return pathOf(categories, id).some((c) => c.id === ancestorId)
}

/** Moves `id` to `toIndex` within its list, returning the new order. */
export function reorder<T>(list: T[], fromIndex: number, toIndex: number): T[] {
  const out = [...list]
  const clamped = Math.max(0, Math.min(out.length - 1, toIndex))
  const [moved] = out.splice(fromIndex, 1)
  if (moved === undefined) return list
  out.splice(clamped, 0, moved)
  return out
}

export function countDescendants(categories: Category[], id: string): number {
  return subtreeIds(categories, id).size - 1
}
