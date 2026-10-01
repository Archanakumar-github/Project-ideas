import { describe, expect, it } from 'vitest'
import { Vault } from './vault'
import { getAll, openDB } from './idb'

let n = 0
const fresh = () => `aurafit-test-${Date.now()}-${n++}`

describe('Vault', () => {
  it('encrypts documents at rest and reads them back', async () => {
    const name = fresh()
    const v = await Vault.open(name)
    expect(v.mode).toBe('device')
    await v.write([['profile', { name: 'Alex', weightKg: 74 }], ['day:2026-10-01', { water: [250] }]])
    const raw = await getAll<Record<string, unknown>>(await openDB(name), 'docs')
    expect(raw).toHaveLength(2)
    for (const r of raw) {
      expect(r.plain).toBeUndefined()
      expect(JSON.stringify(r)).not.toContain('Alex')
    }
    v.close()
    const again = await Vault.open(name)
    const docs = await again.loadAll()
    expect(docs.get('profile')).toEqual({ name: 'Alex', weightKg: 74 })
  })

  it('deletes documents written as undefined', async () => {
    const v = await Vault.open(fresh())
    await v.write([['a', 1], ['b', 2]])
    await v.write([['a', undefined]])
    expect([...(await v.loadAll()).keys()]).toEqual(['b'])
  })

  it('locks behind a passcode and re-keys every document', async () => {
    const name = fresh()
    const v = await Vault.open(name)
    await v.write([['profile', { name: 'Sam' }]])
    await v.setPasscode('2468', await v.loadAll())
    v.close()

    const locked = await Vault.open(name)
    expect(locked.locked).toBe(true)
    await expect(locked.loadAll()).rejects.toThrow(/locked/)
    expect(await locked.unlock('1111')).toBe(false)
    expect(await locked.unlock('2468')).toBe(true)
    expect((await locked.loadAll()).get('profile')).toEqual({ name: 'Sam' })

    await locked.removePasscode(await locked.loadAll())
    locked.close()
    const reopened = await Vault.open(name)
    expect(reopened.locked).toBe(false)
    expect((await reopened.loadAll()).get('profile')).toEqual({ name: 'Sam' })
  }, 30_000)

  it('wipes everything', async () => {
    const v = await Vault.open(fresh())
    await v.write([['profile', { a: 1 }]])
    await v.wipe()
    expect((await v.loadAll()).size).toBe(0)
  })
})
