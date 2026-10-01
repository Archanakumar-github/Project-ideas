/**
 * Bottom sheets and full-screen "sanctuary" modals. Both spring in, sit above the keyboard, and
 * close with a swipe down (from anywhere once the content is scrolled to the top), a tap on the
 * dimmed background, or programmatically through useSheet().close().
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { BackHandler, Platform, Pressable, StyleSheet, useWindowDimensions, View, type ScrollViewProps } from 'react-native'
import { Gesture, GestureDetector, type NativeGesture } from 'react-native-gesture-handler'
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BlurView } from 'expo-blur'
import { useKeyboardInset } from '../hooks/useKeyboardInset'
import { haptic } from '../lib/haptics'
import { closeSheet } from '../state/ui'
import { colors, radius, springs } from '../theme'

interface SheetCtx {
  close: () => void
  scrollY: SharedValue<number>
  native: NativeGesture
}

const Ctx = createContext<SheetCtx | null>(null)

export function useSheet() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useSheet must be used inside a Sheet')
  return ctx
}

interface Props {
  sheetKey: number
  children: ReactNode
  variant?: 'bottom' | 'full'
  /** Rendered under higher sheets: dim it a touch more. */
  covered?: boolean
  onClosed?: () => void
}

export function Sheet({ sheetKey, children, variant = 'bottom', covered = false, onClosed }: Props) {
  const { height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const keyboard = useKeyboardInset()
  const offset = useSharedValue(height)
  const drag = useSharedValue(0)
  const scrollY = useSharedValue(0)
  const closing = useRef(false)

  useEffect(() => {
    offset.value = withSpring(0, springs.sheet)
  }, [offset])

  const finish = useCallback(() => {
    closeSheet(sheetKey)
    onClosed?.()
  }, [sheetKey, onClosed])

  const close = useCallback(() => {
    if (closing.current) return
    closing.current = true
    offset.value = withTiming(height, { duration: 260 }, (done) => {
      if (done) scheduleOnRN(finish)
    })
  }, [finish, height, offset])

  useEffect(() => {
    if (Platform.OS !== 'android') return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (covered) return false
      close()
      return true
    })
    return () => sub.remove()
  }, [close, covered])

  const native = useMemo(() => Gesture.Native(), [])
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .simultaneousWithExternalGesture(native)
        .activeOffsetY([-8, 8])
        .failOffsetX([-24, 24])
        .onUpdate((e) => {
          // Follow the finger down only while the content is at its top.
          drag.value = scrollY.value <= 0 ? Math.max(0, e.translationY) : 0
        })
        .onEnd((e) => {
          if (drag.value > 110 || (drag.value > 20 && e.velocityY > 800)) {
            scheduleOnRN(haptic.soft)
            offset.value = drag.value
            drag.value = 0
            scheduleOnRN(close)
          } else {
            drag.value = withSpring(0, springs.snappy)
          }
        }),
    [close, drag, native, offset, scrollY],
  )

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value + drag.value - (variant === 'bottom' ? keyboard.value : 0) }],
  }))
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(offset.value + drag.value, [0, height], [1, 0]),
  }))

  const ctx = useMemo(() => ({ close, scrollY, native }), [close, scrollY, native])

  return (
    <Ctx.Provider value={ctx}>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <Animated.View style={[StyleSheet.absoluteFill, scrimStyle]}>
          <Pressable
            style={[StyleSheet.absoluteFill, { backgroundColor: covered ? 'rgba(8,8,24,0.7)' : colors.scrim }]}
            onPress={close}
            accessibilityLabel="Close"
            accessibilityRole="button"
          />
        </Animated.View>
        <GestureDetector gesture={pan}>
          <Animated.View
            accessibilityViewIsModal
            style={[
              variant === 'full'
                ? [styles.full, { top: insets.top + (Platform.OS === 'ios' ? 10 : 0) }]
                : [styles.bottom, { maxHeight: height - insets.top - 24, paddingBottom: Math.max(insets.bottom, 16) }],
              sheetStyle,
            ]}
          >
            {Platform.OS !== 'android' ? (
              <BlurView tint="dark" intensity={50} style={StyleSheet.absoluteFill} />
            ) : null}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: variant === 'full' ? colors.night : colors.glassStrong }]} />
            <View style={styles.handleZone} accessible={false}>
              <View style={styles.handle} />
            </View>
            {children}
          </Animated.View>
        </GestureDetector>
      </View>
    </Ctx.Provider>
  )
}

/** A ScrollView that cooperates with the sheet's swipe-to-dismiss. */
export function SheetScrollView({ children, ...rest }: ScrollViewProps & { children?: ReactNode }) {
  const { scrollY, native } = useSheet()
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y
  })
  return (
    <GestureDetector gesture={native}>
      <Animated.ScrollView
        {...rest}
        onScroll={onScroll}
        scrollEventThrottle={16}
        bounces={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {children}
      </Animated.ScrollView>
    </GestureDetector>
  )
}

const styles = StyleSheet.create({
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.glassBorderStrong,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 640,
  },
  full: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.glassBorder,
  },
  handleZone: { alignItems: 'center', paddingTop: 8, paddingBottom: 4, zIndex: 2 },
  handle: { width: 38, height: 5, borderRadius: 3, backgroundColor: 'rgba(239,230,210,0.25)' },
})
