/**
 * After `expo export -p web`: writes the precache list and a content hash into dist/sw.js, so
 * the installed web app opens offline and updates cleanly when a new version is published.
 */
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const dist = new URL('../dist/', import.meta.url).pathname
const skip = new Set(['sw.js', 'metadata.json'])

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

const files = walk(dist)
  .map((p) => relative(dist, p).split(sep).join('/'))
  .filter((p) => !skip.has(p))
  .sort()

const hash = createHash('sha256')
for (const f of files) hash.update(f).update(readFileSync(join(dist, f)))
const version = hash.digest('hex').slice(0, 12)

const precache = ['./', ...files.map((f) => `./${f}`)]
const swPath = join(dist, 'sw.js')
const sw = readFileSync(swPath, 'utf8')
  .replace("'__VERSION__'", JSON.stringify(version))
  .replace('__PRECACHE__', JSON.stringify(precache, null, 2))
writeFileSync(swPath, sw)

const kb = files.reduce((n, f) => n + statSync(join(dist, f)).size, 0) / 1024
console.log(`sw.js: version ${version}, ${precache.length} files precached (${(kb / 1024).toFixed(1)} MB)`)
