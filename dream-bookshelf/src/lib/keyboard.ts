/**
 * iOS only shows the keyboard when focus() happens synchronously inside a user gesture.
 * Our search input lives in a sheet that mounts (and animates) *after* the tap, so we
 * "prime" the keyboard by focusing an invisible proxy input during the tap, then move focus
 * to the real input once it exists — iOS keeps the keyboard up across that hand-off.
 */
let proxy: HTMLInputElement | null = null

export function primeKeyboard() {
  if (typeof document === 'undefined') return
  if (!proxy) {
    proxy = document.createElement('input')
    proxy.setAttribute('aria-hidden', 'true')
    proxy.tabIndex = -1
    proxy.type = 'text'
    Object.assign(proxy.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '1px',
      height: '1px',
      opacity: '0',
      fontSize: '16px',
      pointerEvents: 'none',
      border: '0',
      padding: '0',
    } satisfies Partial<CSSStyleDeclaration>)
    document.body.appendChild(proxy)
  }
  proxy.focus({ preventScroll: true })
}

/** Moves focus to the real input (keyboard stays open if it was primed). */
export function focusInput(el: HTMLInputElement | HTMLTextAreaElement | null | undefined) {
  if (!el) return
  el.focus({ preventScroll: true })
}
