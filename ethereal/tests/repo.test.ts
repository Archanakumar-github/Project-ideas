import { beforeEach, describe, expect, it } from 'vitest'
import { Repo } from '../src/db/repo'
import { DEFAULT_TAXONOMY } from '../src/db/seed'
import { childrenOf, pathLabel } from '../src/lib/tree'
import { nodeDriver } from './nodeDriver'

let repo: Repo

beforeEach(async () => {
  repo = new Repo(nodeDriver())
  await repo.init()
})

describe('first launch', () => {
  it('seeds the five dream categories with four sub-categories each, in order', async () => {
    const cats = await repo.listCategories()
    const tops = childrenOf(cats, null)
    expect(tops.map((c) => c.name)).toEqual([
      'Dream Home',
      'Dream Place',
      'Dream Life',
      'Dream Materials',
      'Dream Bookshelf',
    ])
    expect(tops.map((c) => c.kind)).toEqual(['home', 'place', 'life', 'materials', 'books'])
    for (const [i, top] of tops.entries()) {
      expect(childrenOf(cats, top.id).map((c) => c.name)).toEqual(DEFAULT_TAXONOMY[i].children)
    }
    expect(cats).toHaveLength(25)
  })

  it('never seeds twice, even after the user deletes every category', async () => {
    for (const c of childrenOf(await repo.listCategories(), null)) await repo.deleteCategory(c.id)
    expect(await repo.listCategories()).toHaveLength(0)
    expect(await repo.init()).toEqual({ seeded: false })
    expect(await repo.listCategories()).toHaveLength(0)
  })
})

describe('categories', () => {
  it('adds custom categories and sub-categories at any depth', async () => {
    const custom = await repo.createCategory('  Dream   Kitchen ', null)
    expect(custom.name).toBe('Dream Kitchen')
    expect(custom.position).toBe(5)

    const sub = await repo.createCategory('Copper Pans', custom.id)
    const subsub = await repo.createCategory('Hand-hammered', sub.id)
    const cats = await repo.listCategories()
    expect(pathLabel(cats, subsub.id)).toBe('Dream Kitchen · Copper Pans · Hand-hammered')

    // A sub-category under a pre-loaded category, too.
    const home = childrenOf(cats, null)[0]
    const extra = await repo.createCategory('Observatory Dome', home.id)
    expect(extra.position).toBe(4)
  })

  it('rejects empty names and unknown parents', async () => {
    await expect(repo.createCategory('   ', null)).rejects.toThrow(/name/)
    await expect(repo.createCategory('Orphan', 'nope')).rejects.toThrow(/no longer exists/)
  })

  it('renames and reorders siblings', async () => {
    const tops = childrenOf(await repo.listCategories(), null)
    await repo.renameCategory(tops[4].id, 'Library of Dreams')
    await repo.reorderCategories([tops[4].id, ...tops.slice(0, 4).map((c) => c.id)])
    const after = childrenOf(await repo.listCategories(), null)
    expect(after.map((c) => c.name)[0]).toBe('Library of Dreams')
    expect(after.map((c) => c.position)).toEqual([0, 1, 2, 3, 4])
    // Renaming keeps the kind, so the bookshelf is still recognised.
    expect(after[0].kind).toBe('books')
  })

  it('moves a category under another, but never inside itself', async () => {
    const cats = await repo.listCategories()
    const [home, place] = childrenOf(cats, null)
    const nook = childrenOf(cats, home.id).find((c) => c.name === 'Reading Nook')!
    await repo.moveCategory(nook.id, place.id)
    const moved = (await repo.getCategory(nook.id))!
    expect(moved.parentId).toBe(place.id)
    expect(moved.position).toBe(4)

    const inner = await repo.createCategory('Window Seat', nook.id)
    await expect(repo.moveCategory(nook.id, inner.id)).rejects.toThrow(/inside itself/)
    await expect(repo.moveCategory(nook.id, nook.id)).rejects.toThrow(/inside itself/)
  })

  it('deleting a branch keeps its items by moving them up to the parent', async () => {
    const cats = await repo.listCategories()
    const home = childrenOf(cats, null)[0]
    const arch = childrenOf(cats, home.id)[0]
    const deep = await repo.createCategory('Brutalist', arch.id)
    const a = await repo.createItem({ title: 'Glass house', categoryId: arch.id })
    const b = await repo.createItem({ title: 'Concrete chapel', categoryId: deep.id })

    const res = await repo.deleteCategory(arch.id)
    expect(res.movedItems).toBe(2)
    expect(res.removedIds.sort()).toEqual([arch.id, deep.id].sort())
    expect((await repo.getItem(a.id))!.categoryId).toBe(home.id)
    expect((await repo.getItem(b.id))!.categoryId).toBe(home.id)
    // Remaining siblings are renumbered without gaps.
    expect(childrenOf(await repo.listCategories(), home.id).map((c) => c.position)).toEqual([0, 1, 2])
  })

  it('deleting a top-level category leaves its items unsorted', async () => {
    const top = childrenOf(await repo.listCategories(), null)[1]
    const item = await repo.createItem({ title: 'Isle of Skye', categoryId: top.id })
    await repo.deleteCategory(top.id)
    expect((await repo.getItem(item.id))!.categoryId).toBeNull()
    expect(await repo.listItems()).toHaveLength(1)
  })
})

describe('items', () => {
  it('creates items with calm defaults and lists newest first', async () => {
    const first = await repo.createItem({ title: '  A cabin   by the fjord ' }, 1000)
    const second = await repo.createItem({ title: '', tags: ['#calm', 'Calm', ' slow living '] }, 2000)
    expect(first.title).toBe('A cabin by the fjord')
    expect(first.status).toBe('dreaming')
    expect(second.title).toBe('Untitled desire')
    expect(second.tags).toEqual(['calm', 'slow living'])
    expect((await repo.listItems()).map((i) => i.id)).toEqual([second.id, first.id])
  })

  it('round-trips every field', async () => {
    const item = await repo.createItem({
      title: 'Refractor telescope',
      url: 'https://example.com/scope',
      imageUri: 'local:abc.jpg',
      imageAspect: 0.75,
      status: 'refining',
      tags: ['optics'],
      meta: { byline: 'Example Optics', price: '$1,200' },
      notes: 'For the dark-sky weekends.',
    })
    expect(await repo.getItem(item.id)).toEqual(item)
  })

  it('updates only the fields given', async () => {
    const item = await repo.createItem({ title: 'Meditations', notes: 'Read slowly' }, 1000)
    await repo.updateItem(item.id, { status: 'manifested', tags: ['stoic'] }, 5000)
    const after = (await repo.getItem(item.id))!
    expect(after.status).toBe('manifested')
    expect(after.tags).toEqual(['stoic'])
    expect(after.notes).toBe('Read slowly')
    expect(after.updatedAt).toBe(5000)
    expect(after.createdAt).toBe(1000)
  })

  it('soft-deletes for the undo window, restores, then purges', async () => {
    const keep = await repo.createItem({ title: 'Keep' })
    const gone = await repo.createItem({ title: 'Gone', imageUri: 'local:gone.jpg' })

    await repo.softDeleteItem(gone.id, 10_000)
    expect((await repo.listItems()).map((i) => i.id)).toEqual([keep.id])

    await repo.restoreItem(gone.id)
    expect(await repo.listItems()).toHaveLength(2)

    await repo.softDeleteItem(gone.id, 10_000)
    expect(await repo.purgeDeleted(9_999)).toEqual([])
    const purged = await repo.purgeDeleted(15_000)
    expect(purged.map((i) => i.imageUri)).toEqual(['local:gone.jpg'])
    expect(await repo.getItem(gone.id)).toBeNull()
    expect(await repo.referencedImages()).toEqual(new Set())
  })
})

describe('settings and backup', () => {
  it('stores settings', async () => {
    expect(await repo.getSetting('enrich')).toBeNull()
    await repo.setSetting('enrich', 'off')
    await repo.setSetting('enrich', 'on')
    expect(await repo.getSetting('enrich')).toBe('on')
  })

  it('exports and re-imports everything into a fresh database', async () => {
    const cats = await repo.listCategories()
    const sub = await repo.createCategory('Ritual Teas', cats[0].id)
    await repo.createItem({ title: 'Morning matcha', categoryId: sub.id, tags: ['tea'], status: 'refining' })
    await repo.setSetting('enrich', 'off')
    const backup = JSON.parse(JSON.stringify(await repo.exportAll()))

    const fresh = new Repo(nodeDriver())
    await fresh.init()
    const res = await fresh.importAll(backup)
    expect(res).toEqual({ categories: 26, items: 1 })
    expect(await fresh.listCategories()).toEqual(await repo.listCategories())
    expect(await fresh.listItems()).toEqual(await repo.listItems())
    expect(await fresh.getSetting('enrich')).toBe('off')
  })

  it('refuses files that are not backups, leaving data untouched', async () => {
    await repo.createItem({ title: 'Safe' })
    await expect(repo.importAll({ hello: 'world' })).rejects.toThrow(/isn't an Ethereal backup/)
    expect(await repo.listItems()).toHaveLength(1)
  })

  it('rolls back a failed transaction', async () => {
    const driver = nodeDriver()
    const r = new Repo(driver)
    await r.init()
    await expect(
      driver.transaction(async () => {
        await driver.run("INSERT INTO kv (key, value) VALUES ('x', '1')")
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
    expect(await r.getSetting('x')).toBeNull()
  })
})
