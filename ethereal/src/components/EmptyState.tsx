import { StyleSheet, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { Moon } from './icons'
import { Sans, Serif } from './Type'
import { colors } from '../theme'

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <Animated.View entering={FadeIn.duration(600)} style={styles.wrap}>
      <View style={styles.moon}>
        <Moon size={26} color={colors.goldSoft} strokeWidth={1.3} />
      </View>
      <Serif size={28} style={styles.title}>
        {title}
      </Serif>
      <Sans style={styles.body}>{body}</Sans>
      <Serif italic size={16} style={styles.hint}>
        Tap the golden orb to add a desire…
      </Serif>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingHorizontal: 40, paddingTop: 56 },
  moon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(217,178,111,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(217,178,111,0.2)',
    marginBottom: 18,
  },
  title: { textAlign: 'center' },
  body: { textAlign: 'center', marginTop: 10, maxWidth: 320 },
  hint: { textAlign: 'center', marginTop: 18, color: colors.mistDim },
})
