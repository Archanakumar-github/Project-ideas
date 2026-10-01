/**
 * Item Sanctuary View: a calm full-screen page for one desire. Everything is editable in
 * place with a single tap: title, thoughts, tags, link, photo, status and category. Changes
 * save as you go. Swipe down to return to the board.
 */
import { useEffect, useRef, useState } from 'react'
import { Linking, Platform, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import * as WebBrowser from 'expo-web-browser'
import Animated, { FadeIn } from 'react-native-reanimated'
import {
  Camera,
  ChevronRight,
  ExternalLink,
  FolderTree,
  ImagePlus,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  X,
} from '../components/icons'
import { GhostButton, IconButton } from '../components/Buttons'
import { Glass } from '../components/Glass'
import { PressableScale } from '../components/PressableScale'
import { SheetScrollView, useSheet } from '../components/Sheet'
import { StatusPicker } from '../components/StatusPicker'
import { Eyebrow, Sans } from '../components/Type'
import type { Item } from '../db/types'
import { useImageUri } from '../images/useImageUri'
import { haptic } from '../lib/haptics'
import { pickFromLibrary, takePhoto } from '../lib/pickImage'
import { clampAspect } from '../lib/masonry'
import { extractUrl, hostLabel } from '../lib/text'
import { pathOf } from '../lib/tree'
import { deleteItem, enrich, library, setItemPhoto, updateItem } from '../state/library'
import { openSheet, showToast } from '../state/ui'
import { colors, fonts, gradients, radius } from '../theme'

/** Local text state that saves itself a moment after you stop typing, and on blur. */
function useAutosave(value: string, save: (v: string) => void, delay = 600) {
  const [draft, setDraft] = useState(value)
  const latest = useRef({ draft, value, save })
  latest.current = { draft, value, save }
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Accept outside changes (e.g. a lookup filling the title) while not mid-edit.
  useEffect(() => {
    if (!timer.current) setDraft(value)
  }, [value])

  const flush = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    const { draft: d, value: v, save: s } = latest.current
    if (d !== v) s(d)
  }
  useEffect(() => flush, [])

  const onChange = (v: string) => {
    setDraft(v)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(flush, delay)
  }
  return { draft, onChange, flush }
}

export async function openLink(url: string) {
  try {
    if (Platform.OS === 'web') window.open(url, '_blank', 'noopener,noreferrer')
    else await WebBrowser.openBrowserAsync(url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET })
  } catch {
    void Linking.openURL(url)
  }
}

function Tags({ item }: { item: Item }) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const commit = () => {
    const t = name.trim()
    setName('')
    setAdding(false)
    if (t) void updateItem(item.id, { tags: [...item.tags, t] })
  }
  return (
    <View style={styles.tags}>
      {item.tags.map((t) => (
        <PressableScale
          key={t}
          onPress={() => {
            haptic.tap()
            void updateItem(item.id, { tags: item.tags.filter((x) => x !== t) })
          }}
          accessibilityRole="button"
          accessibilityLabel={`Remove tag ${t}`}
          style={styles.tag}
        >
          <Sans size={12.5} style={{ color: colors.lavender }}>
            #{t}
          </Sans>
          <X size={11} color={colors.mistDim} />
        </PressableScale>
      ))}
      {adding ? (
        <TextInput
          autoFocus
          value={name}
          onChangeText={setName}
          onSubmitEditing={commit}
          onBlur={commit}
          placeholder="tag"
          placeholderTextColor={colors.mistFaint}
          autoCapitalize="none"
          style={styles.tagInput}
          maxLength={32}
          accessibilityLabel="New tag"
        />
      ) : (
        <PressableScale onPress={() => setAdding(true)} accessibilityRole="button" style={[styles.tag, styles.tagAdd]}>
          <Plus size={12} color={colors.goldSoft} />
          <Sans size={12.5} style={{ color: colors.goldSoft }}>
            Tag
          </Sans>
        </PressableScale>
      )}
    </View>
  )
}

function Hero({ item }: { item: Item }) {
  const { width, height } = useWindowDimensions()
  const uri = useImageUri(item.imageUri)
  const h = Math.min(height * 0.56, Math.min(width, 720) / clampAspect(item.imageAspect))

  const changePhoto = async (from: 'library' | 'camera') => {
    const picked = from === 'camera' ? await takePhoto() : await pickFromLibrary()
    if (picked) void setItemPhoto(item.id, picked)
  }

  if (!item.imageUri) {
    return (
      <View style={styles.noImage}>
        <LinearGradient colors={['rgba(185,168,227,0.14)', 'rgba(217,178,111,0.06)', 'rgba(14,15,38,0)']} style={StyleSheet.absoluteFill} />
        <View style={styles.photoRow}>
          <GhostButton label="Add a photo" icon={<ImagePlus size={16} color={colors.parchmentDim} />} onPress={() => changePhoto('library')} />
          {Platform.OS !== 'web' ? (
            <GhostButton label="Camera" icon={<Camera size={16} color={colors.parchmentDim} />} onPress={() => changePhoto('camera')} />
          ) : null}
        </View>
      </View>
    )
  }
  return (
    <View style={{ height: h }}>
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} /> : null}
      <LinearGradient colors={gradients.hero} locations={[0.5, 0.78, 1]} style={StyleSheet.absoluteFill} />
      <View style={styles.heroActions}>
        <IconButton label="Change photo" onPress={() => changePhoto('library')}>
          <ImagePlus size={16} color={colors.parchment} />
        </IconButton>
        <IconButton label="Remove photo" onPress={() => void setItemPhoto(item.id, null)}>
          <Trash2 size={16} color={colors.parchment} />
        </IconButton>
      </View>
    </View>
  )
}

export function ItemSheet({ itemId, focus }: { itemId: string; focus?: 'title' | 'notes' }) {
  const { close } = useSheet()
  const item = library.use((s) => s.items.find((i) => i.id === itemId))
  const categories = library.use((s) => s.categories)
  const online = library.use((s) => s.online)

  // The item was deleted (here or in another tab): leave quietly.
  useEffect(() => {
    if (!item) close()
  }, [item, close])
  if (!item) return null
  return <ItemBody item={item} categories={categories} online={online} focus={focus} close={close} />
}

function ItemBody({ item, categories, online, focus, close }: {
  item: Item
  categories: ReturnType<typeof library.get>['categories']
  online: boolean
  focus?: 'title' | 'notes'
  close: () => void
}) {
  const [finding, setFinding] = useState(false)
  const title = useAutosave(item.title, (v) => {
    const meta = { ...item.meta }
    delete meta.autoTitle
    void updateItem(item.id, { title: v, meta })
  })
  const notes = useAutosave(item.notes, (v) => void updateItem(item.id, { notes: v }))
  const link = useAutosave(item.url ?? '', (v) => void updateItem(item.id, { url: extractUrl(v) ?? (v.trim() || null) }), 900)
  const [showAll, setShowAll] = useState(false)
  const path = pathOf(categories, item.categoryId)
  const added = new Date(item.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })

  const find = async () => {
    setFinding(true)
    const res = await enrich(item.id, { manual: true })
    setFinding(false)
    if (res === 'done') {
      haptic.success()
      showToast('Details gathered')
    } else if (res === 'offline') showToast('Offline — try again when connected')
    else if (res === 'failed') showToast('The lookup could not be completed')
    else showToast('Nothing certain found — add details by hand')
  }

  const remove = () => {
    haptic.warning()
    close()
    setTimeout(() => deleteItem(item.id), 220)
  }

  return (
    <View style={styles.flex}>
      <LinearGradient pointerEvents="none" colors={['rgba(14,15,38,0.85)', 'rgba(14,15,38,0)']} style={styles.topFade} />
      <View style={styles.topBar} pointerEvents="box-none">
        <IconButton label="Close" onPress={close}>
          <X size={18} color={colors.parchment} />
        </IconButton>
        <IconButton label="More actions" onPress={() => openSheet({ type: 'actions', itemId: item.id })}>
          <MoreHorizontal size={18} color={colors.parchment} />
        </IconButton>
      </View>
      <SheetScrollView contentContainerStyle={styles.scroll}>
        <Hero item={item} />
        <Animated.View entering={FadeIn.duration(300)} style={styles.content}>
          <TextInput
            value={title.draft}
            onChangeText={title.onChange}
            onBlur={title.flush}
            multiline
            autoFocus={focus === 'title'}
            style={styles.titleInput}
            placeholder="Name this desire"
            placeholderTextColor={colors.mistFaint}
            accessibilityLabel="Title"
            maxLength={200}
          />
          {item.meta.byline || item.meta.price || item.meta.year ? (
            <Sans size={13} style={styles.byline}>
              {[item.meta.byline, item.meta.year, item.meta.price].filter(Boolean).join('  ·  ')}
            </Sans>
          ) : null}

          <View style={styles.section}>
            <StatusPicker value={item.status} onChange={(s) => void updateItem(item.id, { status: s })} />
          </View>

          <PressableScale
            onPress={() => openSheet({ type: 'recategorize', itemId: item.id })}
            hapticOnPress
            accessibilityRole="button"
            accessibilityHint="Choose a different category"
            style={styles.section}
          >
            <Glass rounded={radius.md} style={styles.row}>
              <FolderTree size={16} color={colors.goldSoft} strokeWidth={1.6} />
              <Sans size={14} style={styles.rowText} numberOfLines={1}>
                {path.length ? path.map((c) => c.name).join('  ›  ') : 'Unsorted'}
              </Sans>
              <ChevronRight size={16} color={colors.mistDim} />
            </Glass>
          </PressableScale>

          <View style={styles.section}>
            <Eyebrow>Your thoughts</Eyebrow>
            <TextInput
              value={notes.draft}
              onChangeText={notes.onChange}
              onBlur={notes.flush}
              multiline
              autoFocus={focus === 'notes'}
              placeholder="Write what this means to you…"
              placeholderTextColor={colors.mistFaint}
              style={styles.notes}
              accessibilityLabel="Your thoughts"
            />
          </View>

          {item.description ? (
            <View style={styles.section}>
              <Eyebrow>{item.meta.siteName ? `From ${item.meta.siteName}` : 'Description'}</Eyebrow>
              <Sans size={14} style={styles.description} numberOfLines={showAll ? undefined : 6} onPress={() => setShowAll((v) => !v)}>
                {item.description}
              </Sans>
            </View>
          ) : null}

          <View style={styles.section}>
            <Eyebrow>Tags</Eyebrow>
            <Tags item={item} />
          </View>

          <View style={styles.section}>
            <Eyebrow>Link</Eyebrow>
            <Glass rounded={radius.md} style={styles.row}>
              <TextInput
                value={link.draft}
                onChangeText={link.onChange}
                onBlur={link.flush}
                placeholder="Paste a web link"
                placeholderTextColor={colors.mistFaint}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                style={styles.linkInput}
                accessibilityLabel="Web link"
              />
              {item.url ? (
                <PressableScale onPress={() => openLink(item.url!)} hitSlop={10} accessibilityRole="link" accessibilityLabel={`Open ${hostLabel(item.url)}`}>
                  <ExternalLink size={17} color={colors.goldSoft} />
                </PressableScale>
              ) : null}
            </Glass>
          </View>

          <View style={[styles.section, styles.footerRow]}>
            <GhostButton
              label={finding ? 'Searching…' : 'Find details online'}
              icon={<Search size={15} color={colors.goldSoft} />}
              tone="gold"
              busy={finding}
              disabled={!online}
              onPress={find}
            />
            <GhostButton label="Release" icon={<Trash2 size={15} color={colors.rose} />} tone="danger" onPress={remove} />
          </View>

          <Sans size={12} style={styles.added}>
            Added {added}
            {item.updatedAt - item.createdAt > 60_000
              ? ` · tended ${new Date(item.updatedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`
              : ''}
          </Sans>
        </Animated.View>
      </SheetScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    zIndex: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  topFade: { position: 'absolute', top: 0, left: 0, right: 0, height: 76, zIndex: 4 },
  scroll: { paddingBottom: 60 },
  noImage: { height: 150, justifyContent: 'flex-end', paddingHorizontal: 20, paddingBottom: 8 },
  photoRow: { flexDirection: 'row', gap: 8 },
  heroActions: { position: 'absolute', right: 14, bottom: 16, flexDirection: 'row', gap: 8 },
  content: { paddingHorizontal: 20, maxWidth: 720, width: '100%', alignSelf: 'center' },
  titleInput: {
    outlineWidth: 0,
    fontFamily: fonts.serif,
    fontSize: 34,
    lineHeight: 40,
    color: colors.parchment,
    paddingVertical: 4,
    marginTop: 6,
  },
  byline: { color: colors.mist, marginTop: 4 },
  section: { marginTop: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, minHeight: 50 },
  rowText: { flex: 1, color: colors.parchmentDim },
  notes: {
    outlineWidth: 0,
    marginTop: 8,
    fontFamily: fonts.serifItalic,
    fontSize: 19,
    lineHeight: 27,
    color: colors.parchment,
    minHeight: 90,
    textAlignVertical: 'top',
    paddingVertical: 4,
  },
  description: { marginTop: 8, color: colors.mist },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.lavenderSoft,
  },
  tagAdd: { backgroundColor: 'transparent', borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(232,204,151,0.45)' },
  tagInput: {
    outlineWidth: 0,
    height: 30,
    minWidth: 90,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.gold,
    color: colors.parchment,
    fontFamily: fonts.sans,
    fontSize: 16,
    paddingVertical: 0,
  },
  linkInput: {
    outlineWidth: 0, flex: 1, color: colors.parchment, fontFamily: fonts.sans, fontSize: 16, paddingVertical: 12 },
  footerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  added: { marginTop: 22, color: colors.mistFaint },
})
