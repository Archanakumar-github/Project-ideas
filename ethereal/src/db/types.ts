export type ItemStatus = 'dreaming' | 'refining' | 'manifested'

export const ITEM_STATUSES: ItemStatus[] = ['dreaming', 'refining', 'manifested']

/**
 * The five pre-loaded categories carry a `kind`, so the app can still recognise "the
 * bookshelf" after it has been renamed (e.g. to pick Google Books for enrichment).
 * Categories the user creates have no kind.
 */
export type CategoryKind = 'home' | 'place' | 'life' | 'materials' | 'books'

export interface Category {
  id: string
  /** null = a top-level category; anything else = a sub-category (any depth). */
  parentId: string | null
  name: string
  kind: CategoryKind | null
  /** Sibling order, 0-based. */
  position: number
  createdAt: number
  updatedAt: number
}

export type EnrichState = 'none' | 'pending' | 'done' | 'failed'

export interface ItemMeta {
  /** Book author(s), shop, publisher… shown under the title. */
  byline?: string
  siteName?: string
  price?: string
  year?: number
  /** Where a local image was downloaded from, so it can be fetched again. */
  remoteImageUrl?: string
  /** The title was made up from a link; a fetched page title may replace it. */
  autoTitle?: boolean
}

export interface Item {
  id: string
  title: string
  /** The user's own thoughts. */
  notes: string
  /** A description fetched from the web (never overwrites notes). */
  description: string
  url: string | null
  /** `local:<file>` for images on the device, or an https:// URL. */
  imageUri: string | null
  /** width / height, used to lay out the masonry grid before the image loads. */
  imageAspect: number | null
  status: ItemStatus
  categoryId: string | null
  tags: string[]
  meta: ItemMeta
  enrichState: EnrichState
  createdAt: number
  updatedAt: number
  /** Set while an item sits in the 5-second undo window; purged afterwards. */
  deletedAt: number | null
}

export type ItemDraft = Partial<Omit<Item, 'createdAt' | 'updatedAt' | 'deletedAt'>> & { title: string }

export type ItemPatch = Partial<Omit<Item, 'id' | 'createdAt'>>
