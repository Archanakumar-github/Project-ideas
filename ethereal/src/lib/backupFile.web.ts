/** Saving and opening backup files in the browser: a download, and a file chooser. */
export async function saveBackupFile(name: string, json: string): Promise<void> {
  const blob = new Blob([json], { type: 'application/json' })
  const file = new File([blob], name, { type: 'application/json' })
  // iOS Safari: the share sheet offers "Save to Files"; elsewhere, a plain download.
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name })
      return
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function openBackupFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json'
    input.onchange = () => {
      const f = input.files?.[0]
      if (!f) return resolve(null)
      f.text().then(resolve, () => resolve(null))
    }
    input.click()
  })
}
