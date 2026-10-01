/**
 * One desire on the board. With an image: the picture at its own shape, a whisper of text
 * beneath. Without: a glass card set in serif, like a line in a journal.
 * Tap opens the sanctuary view; long-press opens quick actions.
 */
import { memo, useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import Animated, {
  FadeInDown,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { Link2, Sparkles } from './icons'
import { Glass } from './Glass'
import { PressableScale } from './PressableScale'
import { Sans, Serif } from './Type'
import type { Item } from '../db/types'
import { useImageUri } from '../images/useImageUri'
import { haptic } from '../lib/haptics'
import { clampAspect } from '../lib/masonry'
import { hostLabel, truncate } from '../lib/text'
import { library } from '../state/library'
import { openSheet } from '../state/ui'
import { colors, radius, statusMeta } from '../theme'

function StatusDot({ status }: { status: Item['status'] }) {
  const meta = statusMeta[status]
  if (status === 'manifested') return <Sparkles size={13} color={meta.color} strokeWidth={1.8} />
  return <View style={[styles.dot, { backgroundColor: meta.color, shadowColor: meta.color }]} />
}

function Shimmer() {
  const t = useSharedValue(0)
  const reduced = useReducedMotion()
  useEffect(() => {
    if (!reduced) t.value = withRepeat(withTiming(1, { duration: 1400 }), -1, true)
  }, [reduced, t])
  const style = useAnimatedStyle(() => ({ opacity: 0.25 + t.value * 0.35 }))
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.shimmer, style]} />
}

interface Props {
  item: Item
  width: number
  index: number
  subtitle?: string
}

export const ItemCard = memo(function ItemCard({ item, width, index, subtitle }: Props) {
  const uri = useImageUri(item.imageUri)
  const [failed, setFailed] = useState(false)
  const showImage = !!item.imageUri && !failed
  const pending = library.use((s) => !!s.enriching[item.id])

  const open = () => openSheet({ type: 'item', itemId: item.id })
  const quick = () => {
    haptic.press()
    openSheet({ type: 'actions', itemId: item.id })
  }
  const byline = item.meta.byline ?? item.meta.siteName ?? (item.url ? hostLabel(item.url) : subtitle)

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 10) * 45).springify().damping(18)}
      exiting={FadeOut.duration(200)}
      layout={LinearTransition.springify().damping(20)}
      style={{ width }}
    >
      <PressableScale
        onPress={open}
        onLongPress={quick}
        delayLongPress={350}
        scaleTo={0.97}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}, ${statusMeta[item.status].label}`}
        accessibilityHint="Opens it. Long-press for quick actions."
      >
        {showImage ? (
          <View>
            <View style={[styles.imageWrap, { height: width / clampAspect(item.imageAspect) }]}>
              {uri ? (
                <Image
                  source={{ uri }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={350}
                  cachePolicy="memory-disk"
                  recyclingKey={item.id}
                  onError={() => setFailed(true)}
                  accessibilityIgnoresInvertColors
                />
              ) : null}
              {pending ? <Shimmer /> : null}
              <View style={styles.badge}>
                <StatusDot status={item.status} />
              </View>
            </View>
            <View style={styles.caption}>
              <Serif size={17} numberOfLines={2}>
                {item.title}
              </Serif>
              {byline ? (
                <Sans size={11.5} numberOfLines={1} style={styles.byline}>
                  {byline}
                </Sans>
              ) : null}
            </View>
          </View>
        ) : (
          <Glass rounded={radius.md} style={styles.textCard}>
            {pending ? <Shimmer /> : null}
            <Serif size={30} style={styles.quoteMark}>
              “
            </Serif>
            <Serif size={20} numberOfLines={5}>
              {item.title}
            </Serif>
            {item.notes ? (
              <Serif italic size={15} numberOfLines={3} style={styles.notes}>
                {truncate(item.notes, 140)}
              </Serif>
            ) : null}
            <View style={styles.footer}>
              <StatusDot status={item.status} />
              <Sans size={11} numberOfLines={1} style={styles.footerText}>
                {pending ? 'Gathering details…' : (byline ?? statusMeta[item.status].label)}
              </Sans>
              {item.url ? <Link2 size={12} color={colors.mistDim} /> : null}
            </View>
          </Glass>
        )}
      </PressableScale>
    </Animated.View>
  )
})

const styles = StyleSheet.create({
  imageWrap: {
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.indigoMid,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(14,15,38,0.55)',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    shadowOpacity: 0.9,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
  },
  caption: { paddingHorizontal: 4, paddingTop: 8, paddingBottom: 2 },
  byline: { marginTop: 2, color: colors.mistDim },
  textCard: { padding: 16, paddingTop: 6 },
  quoteMark: { color: colors.gold, opacity: 0.7, height: 26 },
  notes: { marginTop: 8, color: colors.mist },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 14 },
  footerText: { flex: 1, color: colors.mistDim },
  shimmer: { backgroundColor: colors.lavenderSoft, borderRadius: radius.md },
})
