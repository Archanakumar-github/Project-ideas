import { create } from 'zustand'

/**
 * Rest timer state. It stores an absolute end time, so it stays correct while the phone
 * is locked or the app is in the background.
 */
interface RestState {
  endAt?: number
  total: number
  label?: string
  start: (seconds: number, label?: string) => void
  add: (seconds: number) => void
  stop: () => void
}

export const useRest = create<RestState>((set, get) => ({
  total: 0,
  start: (seconds, label) => {
    unlockAudio()
    set({ endAt: Date.now() + seconds * 1000, total: seconds, label })
  },
  add: (seconds) => {
    const { endAt, total } = get()
    if (!endAt) return
    const next = Math.max(Date.now() + 1000, endAt + seconds * 1000)
    set({ endAt: next, total: Math.max(1, total + seconds) })
  },
  stop: () => set({ endAt: undefined }),
}))

let ctx: AudioContext | undefined

/** iOS only plays Web Audio after a user gesture: call this from the tap that starts rest. */
export function unlockAudio() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    ctx ??= new AC()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    // Audio is a nice-to-have.
  }
}

export function chime() {
  try {
    if (!ctx) return
    const now = ctx.currentTime
    ;[0, 0.18, 0.36].forEach((offset, i) => {
      const osc = ctx!.createOscillator()
      const gain = ctx!.createGain()
      osc.type = 'sine'
      osc.frequency.value = i === 2 ? 1046 : 880
      gain.gain.setValueAtTime(0.0001, now + offset)
      gain.gain.exponentialRampToValueAtTime(0.25, now + offset + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.16)
      osc.connect(gain).connect(ctx!.destination)
      osc.start(now + offset)
      osc.stop(now + offset + 0.18)
    })
  } catch {
    // ignore
  }
  try {
    navigator.vibrate?.([120, 80, 120])
  } catch {
    // ignore
  }
}
