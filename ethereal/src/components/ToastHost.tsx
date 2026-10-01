/** The quiet notice bar at the bottom: messages, and the 5-second Undo after a delete. */
import { useEffect } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  FadeInDown,
  FadeOutDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Glass } from './Glass'
import { Sans } from './Type'
import { haptic } from '../lib/haptics'
import { dismissToast, ui, type Toast } from '../state/ui'
import { colors, radius } from '../theme'

function ToastBar({ toast }: { toast: Toast }) {
  const progress = useSharedValue(1)
  useEffect(() => {
    progress.value = 1
    progress.value = withTiming(0, { duration: toast.duration, easing: Easing.linear })
  }, [toast, progress])
  const bar = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value }] }))

  return (
    <Glass strong rounded={radius.md} style={styles.toast}>
      <View style={styles.row} accessibilityLiveRegion="polite">
        <Sans size={14} style={styles.message} numberOfLines={2}>
          {toast.message}
        </Sans>
        {toast.actionLabel ? (
          <Pressable
            onPress={() => {
              haptic.success()
              dismissToast(toast.id)
              toast.onAction?.()
            }}
            hitSlop={12}
            accessibilityRole="button"
            style={styles.action}
          >
            <Sans size={14} weight="semi" style={{ color: colors.gold }}>
              {toast.actionLabel}
            </Sans>
          </Pressable>
        ) : null}
      </View>
      {toast.actionLabel ? <Animated.View style={[styles.progress, bar]} /> : null}
    </Glass>
  )
}

export function ToastHost() {
  const toast = ui.use((s) => s.toast)
  const insets = useSafeAreaInsets()
  return (
    <View pointerEvents="box-none" style={[styles.host, { bottom: Math.max(insets.bottom, 12) + 96 }]}>
      {toast ? (
        <Animated.View key={toast.id} entering={FadeInDown.springify().damping(18)} exiting={FadeOutDown.duration(180)}>
          <ToastBar toast={toast} />
        </Animated.View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  toast: { width: '100%', maxWidth: 480 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  message: { flex: 1, color: colors.parchment },
  action: { marginLeft: 12, paddingHorizontal: 6 },
  progress: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    backgroundColor: colors.gold,
    transformOrigin: 'left',
  },
})
