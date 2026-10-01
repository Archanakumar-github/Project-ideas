import { useEffect, useState } from 'react'
import { useCoverSrc } from '../../hooks/useCoverSrc'
import { cx, hashString } from '../../lib/utils'

/** Cloth-bound colourways for generated covers, all within the warm palette. */
const BINDINGS = [
  { from: '#3a2e24', to: '#221c17', ink: '#e8c9a0' }, // walnut & amber
  { from: '#2c3a32', to: '#1b231f', ink: '#b9d8c8' }, // forest sage
  { from: '#43271f', to: '#261713', ink: '#f0b9a6' }, // terracotta
  { from: '#35302a', to: '#1f1c18', ink: '#f2ebe1' }, // parchment
  { from: '#2e2a36', to: '#1c1a21', ink: '#d9c7e6' }, // dusk plum
  { from: '#3b3322', to: '#231e14', ink: '#ead39b' }, // old gold
]

interface BookCoverProps {
  title: string
  authors?: string[]
  coverId?: string
  coverUrl?: string
  className?: string
  /** Typography scale for the generated cover. */
  size?: 'xs' | 'sm' | 'md' | 'lg'
  rounded?: string
}

export function BookCover({ title, authors, coverId, coverUrl, className, size = 'md', rounded = 'rounded-[10px]' }: BookCoverProps) {
  const src = useCoverSrc(coverId, coverUrl)
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setFailed(false)
    setLoaded(false)
  }, [src])

  const showImage = src && !failed
  return (
    <div className={cx('relative aspect-[2/3] overflow-hidden bg-card', rounded, className)}>
      {(!showImage || !loaded) && <GeneratedCover title={title} author={authors?.[0]} size={size} />}
      {showImage && (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          referrerPolicy="no-referrer"
          onLoad={(e) => {
            // Google's "image not available" stub and OL's 1px placeholders are tiny.
            const img = e.currentTarget
            if (img.naturalWidth < 20) setFailed(true)
            else setLoaded(true)
          }}
          onError={() => setFailed(true)}
          className={cx(
            'absolute inset-0 size-full object-cover transition-opacity duration-200',
            loaded ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}
      {/* Subtle spine highlight + vignette so real and generated covers feel like objects. */}
      <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-[6%] bg-gradient-to-r from-black/35 to-transparent" />
      <span aria-hidden className="pointer-events-none absolute inset-0 ring-1 ring-white/5 ring-inset" style={{ borderRadius: 'inherit' }} />
    </div>
  )
}

function GeneratedCover({ title, author, size }: { title: string; author?: string; size: BookCoverProps['size'] }) {
  const b = BINDINGS[hashString(title) % BINDINGS.length]
  const titleSize = size === 'xs' ? 'text-[7px]' : size === 'sm' ? 'text-[10px]' : size === 'lg' ? 'text-xl' : 'text-[13px]'
  const authorSize = size === 'xs' || size === 'sm' ? 'hidden' : size === 'lg' ? 'text-sm' : 'text-[10px]'
  const pad = size === 'xs' ? 'p-1' : size === 'sm' ? 'p-1.5' : size === 'lg' ? 'p-5' : 'p-3'
  return (
    <div
      aria-hidden
      className={cx('absolute inset-0 flex flex-col items-center justify-center text-center', pad)}
      style={{ background: `linear-gradient(160deg, ${b.from}, ${b.to})`, color: b.ink }}
    >
      <span className="absolute inset-x-[12%] top-[9%] h-px opacity-40" style={{ background: b.ink }} />
      <span className={cx('line-clamp-5 font-serif leading-tight font-medium', titleSize)}>{title}</span>
      {author && (
        <span className={cx('mt-[8%] line-clamp-2 tracking-[0.14em] uppercase opacity-70', authorSize)}>{author}</span>
      )}
      <span className="absolute inset-x-[12%] bottom-[9%] h-px opacity-40" style={{ background: b.ink }} />
    </div>
  )
}
