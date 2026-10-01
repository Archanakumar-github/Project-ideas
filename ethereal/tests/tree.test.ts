import { describe, expect, it } from 'vitest'
import type { Category } from '../src/db/types'
import { childrenOf, countDescendants, isWithin, pathLabel, reorder, rootOf, subtreeIds } from '../src/lib/tree'

const cat = (id: string, parentId: string | null, position = 0): Category => ({
  id,
  parentId,
  name: id.toUpperCase(),
  kind: null,
  position,
  createdAt: 0,
  updatedAt: 0,
})

const cats = [cat('a', null, 1), cat('b', null, 0), cat('a1', 'a', 1), cat('a0', 'a', 0), cat('a00', 'a0')]

describe('tree', () => {
  it('lists children in position order', () => {
    expect(childrenOf(cats, null).map((c) => c.id)).toEqual(['b', 'a'])
    expect(childrenOf(cats, 'a').map((c) => c.id)).toEqual(['a0', 'a1'])
  })

  it('walks subtrees, paths and roots', () => {
    expect([...subtreeIds(cats, 'a')].sort()).toEqual(['a', 'a0', 'a00', 'a1'])
    expect(pathLabel(cats, 'a00')).toBe('A · A0 · A00')
    expect(rootOf(cats, 'a00')?.id).toBe('a')
    expect(rootOf(cats, null)).toBeNull()
    expect(isWithin(cats, 'a00', 'a')).toBe(true)
    expect(isWithin(cats, 'b', 'a')).toBe(false)
    expect(countDescendants(cats, 'a')).toBe(3)
  })

  it('survives a corrupted cycle', () => {
    const loop = [cat('x', 'y'), cat('y', 'x')]
    expect(pathLabel(loop, 'x')).toBe('Y · X')
    expect([...subtreeIds(loop, 'x')].sort()).toEqual(['x', 'y'])
  })

  it('reorders and clamps', () => {
    expect(reorder([1, 2, 3, 4], 0, 2)).toEqual([2, 3, 1, 4])
    expect(reorder([1, 2, 3], 2, -5)).toEqual([3, 1, 2])
    expect(reorder([1, 2, 3], 0, 99)).toEqual([2, 3, 1])
  })
})
