import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
  type Modifier,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cx } from '../../lib/utils'

export interface DragHandleProps {
  attributes: DraggableAttributes
  listeners: DraggableSyntheticListeners
  setActivatorNodeRef: (el: HTMLElement | null) => void
  isDragging: boolean
}

const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 })

function SortableRow({ id, children }: { id: string; children: (handle: DragHandleProps) => ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cx('relative list-none', isDragging && 'z-10 [&>*]:shadow-glow')}
    >
      {children({ attributes, listeners, setActivatorNodeRef, isDragging })}
    </li>
  )
}

/**
 * Drag-and-drop reorderable list (touch, mouse and keyboard). Only the grip handle starts a
 * drag, so scrolling the list with a finger still works normally on iOS.
 */
export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  renderItem,
  className,
}: {
  items: T[]
  onReorder: (orderedIds: string[]) => void
  renderItem: (item: T, handle: DragHandleProps) => ReactNode
  className?: string
}) {
  const idsKey = items.map((i) => i.id).join('|')
  const [order, setOrder] = useState(() => items.map((i) => i.id))
  // Re-sync when the underlying data changes (adds, deletes, other tabs).
  useEffect(() => setOrder(idsKey ? idsKey.split('|') : []), [idsKey])

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const ordered = order.map((id) => byId.get(id)).filter((i): i is T => !!i)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const next = arrayMove(order, order.indexOf(String(active.id)), order.indexOf(String(over.id)))
    setOrder(next)
    onReorder(next)
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <ul className={cx('flex flex-col gap-2', className)}>
          {ordered.map((item) => (
            <SortableRow key={item.id} id={item.id}>
              {(handle) => renderItem(item, handle)}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}
