import { Bookmark } from 'lucide-react'
import { addShelf } from '../../db/repo'
import { useLibrary } from '../../hooks/useLibrary'
import { Chip } from '../ui/Chip'
import { InlineCreate } from './InlineCreate'

/** Multi-select custom shelves (quick-filter tags) with inline creation. */
export function ShelfPicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const lib = useLibrary()
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])
  return (
    <div className="flex flex-wrap gap-2">
      {lib.orderedShelves.map((s) => (
        <Chip
          key={s.id}
          active={value.includes(s.id)}
          tone="var(--color-amber-glow)"
          icon={<Bookmark size={13} />}
          onClick={() => toggle(s.id)}
        >
          {s.name}
        </Chip>
      ))}
      <InlineCreate
        label="Shelf"
        placeholder="New shelf"
        onCreate={async (name) => {
          const shelf = await addShelf(name)
          if (!value.includes(shelf.id)) onChange([...value, shelf.id])
        }}
      />
    </div>
  )
}
