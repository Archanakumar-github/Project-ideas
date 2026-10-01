/**
 * The board. Greeting and quote up top, the category switcher, sub-category pills for the
 * chosen category, then the masonry grid. Swipe the grid sideways to change category; on iOS,
 * pull the board down past the top to add a desire.
 */
import { useMemo, useRef } from 'react'
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  Extrapolation,
  FadeIn,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BlurView } from 'expo-blur'
import { Plus, WifiOff } from '../components/icons'
import { CategorySwitcher } from '../components/CategorySwitcher'
import { EmptyState } from '../components/EmptyState'
import { Fab } from '../components/Fab'
import { Header } from '../components/Header'
import { MasonryGrid } from '../components/MasonryGrid'
import { SubPills } from '../components/SubPills'
import { Sans } from '../components/Type'
import { haptic } from '../lib/haptics'
import { subtreeIds } from '../lib/tree'
import { library, topCategories } from '../state/library'
import { openSheet, setBrowse, ui } from '../state/ui'
import { colors, springs } from '../theme'

const PULL_TO_ADD = 90

export function HomeScreen() {
  const { width } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const categories = library.use((s) => s.categories)
  const items = library.use((s) => s.items)
  const online = library.use((s) => s.online)
  const rootId = ui.use((s) => s.activeRootId)
  const focusId = ui.use((s) => s.focusId)

  const roots = useMemo(() => topCategories(categories), [categories])
  // If the active category was deleted elsewhere, fall back to "All".
  const activeRoot = rootId && roots.some((r) => r.id === rootId) ? rootId : null
  const scopeId = activeRoot ? (focusId && categories.some((c) => c.id === focusId) ? focusId : activeRoot) : null

  const visible = useMemo(() => {
    if (!scopeId) return items
    const ids = subtreeIds(categories, scopeId)
    return items.filter((i) => i.categoryId && ids.has(i.categoryId))
  }, [items, categories, scopeId])

  const order = useMemo(() => [null, ...roots.map((r) => r.id)], [roots])
  const orderRef = useRef(order)
  orderRef.current = order
  const step = (dir: 1 | -1) => {
    const list = orderRef.current
    const at = list.indexOf(ui.get().activeRootId)
    const next = list[Math.max(0, Math.min(list.length - 1, (at < 0 ? 0 : at) + dir))]
    if (next !== ui.get().activeRootId || at < 0) {
      haptic.tap()
      setBrowse(next ?? null)
    }
  }

  // Sideways swipe on the grid: the content leans with the finger, then the category changes.
  const shift = useSharedValue(0)
  const swipe = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-22, 22])
        .failOffsetY([-14, 14])
        .onUpdate((e) => {
          shift.value = e.translationX * 0.35
        })
        .onEnd((e) => {
          const far = Math.abs(e.translationX) > 70 || Math.abs(e.velocityX) > 650
          if (far) scheduleOnRN(step, e.translationX < 0 ? 1 : -1)
          shift.value = withSpring(0, springs.gentle)
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const gridStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shift.value }],
    opacity: interpolate(Math.abs(shift.value), [0, 80], [1, 0.6], Extrapolation.CLAMP),
  }))

  // Pull-to-add (iOS rubber-band overscroll).
  const scrollY = useSharedValue(0)
  const armed = useSharedValue(false)
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y
      const pulled = -e.contentOffset.y > PULL_TO_ADD
      if (pulled !== armed.value) {
        armed.value = pulled
        if (pulled) scheduleOnRN(haptic.soft)
      }
    },
    onEndDrag: (e) => {
      if (-e.contentOffset.y > PULL_TO_ADD) scheduleOnRN(openSheet, { type: 'add' })
    },
  })
  const pullHint = useAnimatedStyle(() => ({
    opacity: interpolate(-scrollY.value, [20, PULL_TO_ADD], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(-scrollY.value, [20, PULL_TO_ADD], [0.8, 1], Extrapolation.CLAMP) }],
  }))

  const activeName = roots.find((r) => r.id === activeRoot)?.name

  return (
    <View style={[styles.flex, { paddingTop: insets.top }]}>
      {Platform.OS === 'ios' ? (
        <Animated.View pointerEvents="none" style={[styles.pullHint, { top: insets.top + 6 }, pullHint]}>
          <Plus size={14} color={colors.goldSoft} />
          <Sans size={12} style={{ color: colors.goldSoft }}>
            Release to add a desire
          </Sans>
        </Animated.View>
      ) : null}
      <Animated.ScrollView
        style={styles.flex}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        stickyHeaderIndices={[1]}
      >
        <Header />
        <View style={styles.sticky}>
          {Platform.OS !== 'android' ? <BlurView tint="dark" intensity={40} style={StyleSheet.absoluteFill} /> : null}
          <View style={[StyleSheet.absoluteFill, styles.stickyTint]} />
          <CategorySwitcher roots={roots} activeId={activeRoot} onSelect={(id) => setBrowse(id)} />
          {activeRoot ? (
            <Animated.View key={activeRoot} entering={FadeIn.duration(250)}>
              <SubPills
                categories={categories}
                rootId={activeRoot}
                selectedId={focusId}
                onSelect={(id) => setBrowse(activeRoot, id === activeRoot ? null : id)}
                allLabel={`All of ${activeName ?? ''}`.trim()}
              />
            </Animated.View>
          ) : null}
        </View>
        {!online ? (
          <View style={styles.offline}>
            <WifiOff size={12} color={colors.mistDim} />
            <Sans size={11.5} style={{ color: colors.mistDim }}>
              Offline — everything still saves to this device.
            </Sans>
          </View>
        ) : null}
        {/* The sideways swipe lives on the grid only, so the pill rows above scroll freely. */}
        <GestureDetector gesture={swipe}>
          <Animated.View style={[styles.gridWrap, gridStyle]}>
            {visible.length ? (
              <MasonryGrid key={scopeId ?? 'all'} items={visible} width={width} categories={categories} />
            ) : (
              <EmptyState
                title={activeName ? 'An open horizon' : 'Your horizon is open'}
                body={
                  activeName
                    ? `Nothing in ${activeName} yet. Curate your horizon, one desire at a time.`
                    : 'Paste a link, choose a photo, or simply name something you long for.'
                }
              />
            )}
          </Animated.View>
        </GestureDetector>
      </Animated.ScrollView>
      <Fab onPress={() => openSheet({ type: 'add' })} />
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sticky: { paddingBottom: 6, zIndex: 0 },
  stickyTint: {
    zIndex: -1,
    backgroundColor: Platform.OS === 'android' ? 'rgba(14,15,38,0.94)' : 'rgba(14,15,38,0.45)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  gridWrap: { paddingTop: 10, minHeight: 420 },
  pullHint: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    zIndex: 1,
  },
  offline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    marginTop: 8,
  },
})
