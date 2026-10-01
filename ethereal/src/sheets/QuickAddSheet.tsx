/**
 * Quick Add portal, two gentle steps:
 *   1. Name it, paste a link, or choose a photo.
 *   2. Choose where it belongs (category pills, sub-category pills, "+ Sub-category" inline).
 * Links are previewed while you choose, and that preview is saved with the item. Nothing ever
 * waits on the network: Save is always instant, and missing details fill in afterwards.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Platform, StyleSheet, TextInput, View } from 'react-native'
import Animated, { FadeIn, FadeInRight, FadeOutLeft } from 'react-native-reanimated'
import { Image } from 'expo-image'
import * as Clipboard from 'expo-clipboard'
import { ArrowLeft, ArrowRight, Camera, ClipboardPaste, ImagePlus, Link2, X } from '../components/icons'
import { GhostButton, GoldButton, IconButton } from '../components/Buttons'
import { CategoryPicker } from '../components/CategoryPicker'
import { Glass } from '../components/Glass'
import { SheetScrollView, useSheet } from '../components/Sheet'
import { StatusPicker } from '../components/StatusPicker'
import { Eyebrow, Sans, Serif } from '../components/Type'
import type { ItemStatus } from '../db/types'
import type { Enrichment } from '../enrich'
import { haptic } from '../lib/haptics'
import { pickFromLibrary, takePhoto } from '../lib/pickImage'
import { suggestCategory } from '../lib/suggest'
import { extractUrl, hostLabel, titleFromUrl } from '../lib/text'
import { isWithin, pathLabel, rootOf } from '../lib/tree'
import { addItem, library, previewLink, type PickedImage } from '../state/library'
import { setBrowse, showToast, ui } from '../state/ui'
import { colors, fonts, radius } from '../theme'

function useLinkPreview(url: string | null) {
  const [state, setState] = useState<{ url: string; data: Enrichment | null; loading: boolean } | null>(null)
  useEffect(() => {
    if (!url) {
      setState(null)
      return
    }
    const controller = new AbortController()
    setState({ url, data: null, loading: true })
    const t = setTimeout(() => {
      previewLink(url, controller.signal)
        .then((data) => !controller.signal.aborted && setState({ url, data, loading: false }))
        .catch(() => !controller.signal.aborted && setState({ url, data: null, loading: false }))
    }, 450)
    return () => {
      clearTimeout(t)
      controller.abort()
    }
  }, [url])
  return state?.url === url ? state : null
}

export function QuickAddSheet() {
  const { close } = useSheet()
  const categories = library.use((s) => s.categories)
  const online = library.use((s) => s.online)
  const [step, setStep] = useState<1 | 2>(1)
  const [text, setText] = useState('')
  const [image, setImage] = useState<PickedImage | null>(null)
  const [status, setStatus] = useState<ItemStatus>('dreaming')
  const input = useRef<TextInput>(null)

  // Default category: wherever you're browsing; refined by a guess from what you typed.
  const browsing = ui.get().focusId ?? ui.get().activeRootId
  const [categoryId, setCategoryId] = useState<string | null>(browsing)
  const touchedCategory = useRef(false)

  const url = useMemo(() => extractUrl(text), [text])
  const titleText = useMemo(() => (url ? text.replace(url, '').replace(/https?:\/\//, '').trim() : text.trim()), [text, url])
  const preview = useLinkPreview(url)
  const canContinue = !!(text.trim() || image)

  const goToStep2 = () => {
    if (!canContinue) return
    if (!touchedCategory.current) {
      const guess = suggestCategory(categories, titleText || preview?.data?.title || '', url)
      // Keep the browsed category unless the guess sits inside it (more specific) or nothing was browsed.
      if (guess && (!browsing || rootOf(categories, guess)?.id === rootOf(categories, browsing)?.id)) setCategoryId(guess)
    }
    haptic.tap()
    setStep(2)
  }

  const paste = async () => {
    const clip = (await Clipboard.getStringAsync().catch(() => '')).trim()
    if (!clip) return showToast('Nothing to paste yet')
    haptic.tap()
    setText((t) => (t.trim() ? `${t.trim()} ${clip}` : clip))
  }

  const choosePhoto = async (from: 'library' | 'camera') => {
    const picked = from === 'camera' ? await takePhoto() : await pickFromLibrary()
    if (picked) {
      haptic.soft()
      setImage(picked)
    }
  }

  const save = () => {
    const fallbackTitle = url ? titleFromUrl(url) : image ? 'A quiet vision' : ''
    const title = titleText || fallbackTitle
    const item = addItem(
      {
        title,
        url,
        categoryId,
        status,
        meta: !titleText && url ? { autoTitle: true } : {},
      },
      image,
      preview && !preview.loading ? preview.data : null,
    )
    haptic.success()
    close()
    const scope = ui.get().focusId ?? ui.get().activeRootId
    const visible = !scope || isWithin(library.get().categories, item.categoryId, scope)
    showToast(
      'Placed on your horizon',
      visible || !item.categoryId
        ? {}
        : {
            actionLabel: 'View',
            onAction: () => {
              const root = rootOf(library.get().categories, item.categoryId)
              setBrowse(root?.id ?? null, item.categoryId !== root?.id ? item.categoryId : null)
            },
          },
    )
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        {step === 2 ? (
          <IconButton label="Back" onPress={() => setStep(1)}>
            <ArrowLeft size={18} color={colors.parchmentDim} />
          </IconButton>
        ) : (
          <View style={{ width: 38 }} />
        )}
        <Eyebrow>{step === 1 ? 'A new desire · 1 of 2' : 'Where it belongs · 2 of 2'}</Eyebrow>
        <IconButton label="Close" onPress={close}>
          <X size={18} color={colors.parchmentDim} />
        </IconButton>
      </View>

      <SheetScrollView contentContainerStyle={styles.body}>
        {step === 1 ? (
          <Animated.View key="s1" entering={FadeIn.duration(200)} exiting={FadeOutLeft.duration(160)}>
            <Serif size={30} style={styles.title}>
              What are you dreaming of?
            </Serif>
            <TextInput
              ref={input}
              autoFocus
              multiline
              value={text}
              onChangeText={setText}
              placeholder="Add a desire…"
              placeholderTextColor={colors.mistFaint}
              style={styles.input}
              maxLength={600}
              accessibilityLabel="Title or link"
              submitBehavior="blurAndSubmit"
              returnKeyType="next"
              onSubmitEditing={goToStep2}
            />
            <Sans size={12} style={styles.hint}>
              A title, a book, a place, or a link to paste. Details gather on their own.
            </Sans>

            <View style={styles.actions}>
              <GhostButton label="Paste" icon={<ClipboardPaste size={16} color={colors.parchmentDim} />} onPress={paste} />
              <GhostButton label="Photo" icon={<ImagePlus size={16} color={colors.parchmentDim} />} onPress={() => choosePhoto('library')} />
              {Platform.OS !== 'web' ? (
                <GhostButton label="Camera" icon={<Camera size={16} color={colors.parchmentDim} />} onPress={() => choosePhoto('camera')} />
              ) : null}
            </View>

            {image ? (
              <Animated.View entering={FadeIn} style={styles.thumbWrap}>
                <Image source={{ uri: image.uri }} style={[styles.thumb, { aspectRatio: Math.max(0.7, Math.min(1.6, image.width / Math.max(1, image.height))) }]} contentFit="cover" />
                <View style={styles.thumbClose}>
                  <IconButton label="Remove photo" onPress={() => setImage(null)}>
                    <X size={16} color={colors.parchment} />
                  </IconButton>
                </View>
              </Animated.View>
            ) : null}

            {url ? (
              <Animated.View entering={FadeIn}>
                <Glass rounded={radius.md} style={styles.preview}>
                  {preview?.data?.imageUrl && !image ? (
                    <Image source={{ uri: preview.data.imageUrl }} style={styles.previewImg} contentFit="cover" transition={250} />
                  ) : null}
                  <View style={styles.previewText}>
                    <View style={styles.previewHost}>
                      <Link2 size={12} color={colors.goldSoft} />
                      <Sans size={11.5} style={{ color: colors.goldSoft }} numberOfLines={1}>
                        {hostLabel(url)}
                      </Sans>
                    </View>
                    <Serif size={18} numberOfLines={2}>
                      {preview?.data?.title ?? titleFromUrl(url)}
                    </Serif>
                    <Sans size={12} numberOfLines={2} style={{ color: colors.mistDim }}>
                      {!online
                        ? 'Offline — saved now, details gather when you reconnect.'
                        : preview?.loading
                          ? 'Gathering details…'
                          : (preview?.data?.description ?? 'Details will gather on their own.')}
                    </Sans>
                  </View>
                </Glass>
              </Animated.View>
            ) : null}

            <View style={styles.footer}>
              <GoldButton label="Next" icon={<ArrowRight size={18} color={colors.night} />} onPress={goToStep2} disabled={!canContinue} />
            </View>
          </Animated.View>
        ) : (
          <Animated.View key="s2" entering={FadeInRight.springify().damping(20)}>
            <Serif size={26} style={styles.title} numberOfLines={2}>
              {titleText || preview?.data?.title || (url ? titleFromUrl(url) : 'A quiet vision')}
            </Serif>
            <View style={{ marginHorizontal: -20 }}>
              <CategoryPicker
                value={categoryId}
                onChange={(id) => {
                  touchedCategory.current = true
                  setCategoryId(id)
                }}
              />
            </View>
            <Eyebrow style={{ marginTop: 18, marginBottom: 8 }}>Status</Eyebrow>
            <StatusPicker value={status} onChange={setStatus} />
            <Sans size={12} style={[styles.hint, { marginTop: 14 }]}>
              {categoryId ? `Placing in ${pathLabel(categories, categoryId)}` : 'No category — it will rest in All.'}
            </Sans>
            <View style={styles.footer}>
              <GoldButton label="Place on my horizon" onPress={save} />
            </View>
          </Animated.View>
        )}
      </SheetScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flexShrink: 1 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 4 },
  body: { paddingHorizontal: 20, paddingBottom: 12 },
  title: { marginTop: 8, marginBottom: 12 },
  input: {
    fontFamily: fonts.serif,
    fontSize: 22,
    lineHeight: 28,
    color: colors.parchment,
    minHeight: 64,
    maxHeight: 160,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorderStrong,
    backgroundColor: 'rgba(14,15,38,0.45)',
    textAlignVertical: 'top',
    outlineWidth: 0,
  },
  hint: { color: colors.mistDim, marginTop: 8 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 16, flexWrap: 'wrap' },
  thumbWrap: { marginTop: 16 },
  thumb: { width: '100%', borderRadius: radius.md },
  thumbClose: { position: 'absolute', top: 8, right: 8 },
  preview: { marginTop: 16, flexDirection: 'row' },
  previewImg: { width: 92, minHeight: 92, alignSelf: 'stretch' },
  previewText: { flex: 1, padding: 12, gap: 4 },
  previewHost: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  footer: { marginTop: 22 },
})
