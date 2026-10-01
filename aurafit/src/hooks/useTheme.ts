import { useEffect } from 'react'
import { useApp } from '../store/app'

const COLORS = { dark: '#0B0D12', light: '#F4F5F8' }

/** Applies the theme preference to <html data-theme> and the browser chrome colour. */
export function useTheme() {
  const pref = useApp((s) => s.settings.theme)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = pref === 'dark' || (pref === 'system' && mq.matches)
      const mode = dark ? 'dark' : 'light'
      document.documentElement.dataset.theme = mode
      document.documentElement.style.backgroundColor = COLORS[mode]
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLORS[mode])
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [pref])
}
