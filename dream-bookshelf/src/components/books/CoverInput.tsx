import { forwardRef } from 'react'
import { compressImage } from '../../lib/image'
import { ui } from '../../store/ui'

/**
 * Hidden file input for covers. On iOS, `accept="image/*"` offers Photo Library, Take Photo
 * and Files — all of which work offline.
 */
export const CoverInput = forwardRef<HTMLInputElement, { onPicked: (blob: Blob) => void }>(function CoverInput({ onPicked }, ref) {
  return (
    <input
      ref={ref}
      type="file"
      accept="image/*"
      className="sr-only"
      tabIndex={-1}
      aria-hidden
      onChange={async (e) => {
        const file = e.target.files?.[0]
        e.target.value = ''
        if (!file) return
        try {
          onPicked(await compressImage(file))
        } catch {
          ui.toast({ message: "That image couldn't be read. Try a JPEG or PNG.", tone: 'error' })
        }
      }}
    />
  )
})
