/** Minimal top bar: date, a time-of-day greeting and a quiet line of philosophy (tap for another). */
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import { Settings2 } from './icons'
import { PressableScale } from './PressableScale'
import { Eyebrow, Sans, Serif } from './Type'
import { greetingFor, quoteFor } from '../lib/greeting'
import { haptic } from '../lib/haptics'
import { openSheet } from '../state/ui'
import { colors } from '../theme'

function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

export function Header() {
  const now = useNow()
  const [offset, setOffset] = useState(0)
  const greeting = greetingFor(now)
  const quote = quoteFor(now, offset)
  const date = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        <Eyebrow>Your Sanctuary · {date}</Eyebrow>
        <PressableScale
          onPress={() => openSheet({ type: 'settings' })}
          hapticOnPress
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Settings"
          style={styles.iconBtn}
        >
          <Settings2 size={18} color={colors.parchmentDim} strokeWidth={1.6} />
        </PressableScale>
      </View>
      <Serif size={40} style={styles.greeting} accessibilityRole="header">
        {greeting.title}
      </Serif>
      <Pressable
        onPress={() => {
          haptic.tap()
          setOffset((o) => o + 1)
        }}
        accessibilityRole="button"
        accessibilityHint="Shows another quote"
      >
        <Animated.View key={quote.text} entering={FadeIn.duration(500)} exiting={FadeOut.duration(200)}>
          <Serif italic size={17} style={styles.quote}>
            “{quote.text}”
          </Serif>
          <Sans size={11.5} style={styles.author}>
            — {quote.author}
          </Sans>
        </Animated.View>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 6 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239,230,210,0.06)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  greeting: { marginTop: 6, color: colors.parchment, letterSpacing: 0.2 },
  quote: { marginTop: 8, color: colors.parchmentDim, opacity: 0.9 },
  author: { marginTop: 4, color: colors.mistDim, letterSpacing: 0.4 },
})
