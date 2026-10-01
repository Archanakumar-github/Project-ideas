import { useState } from 'react'
import { Platform, StyleSheet, Switch, View } from 'react-native'
import { Download, FolderTree, Upload, X } from '../components/icons'
import { ActionList } from '../components/ActionList'
import { IconButton } from '../components/Buttons'
import { Glass } from '../components/Glass'
import { SheetScrollView, useSheet } from '../components/Sheet'
import { Eyebrow, Sans, Serif } from '../components/Type'
import { openBackupFile, saveBackupFile } from '../lib/backupFile'
import { haptic } from '../lib/haptics'
import { exportBackup, importBackup, library, setEnrich } from '../state/library'
import { replaceSheet, showToast } from '../state/ui'
import { colors, radius } from '../theme'

/** Settings: online look-ups, categories, and your own backups. */
export function SettingsSheet() {
  const { close } = useSheet()
  const settings = library.use((s) => s.settings)
  const count = library.use((s) => s.items.length)
  const [confirmImport, setConfirmImport] = useState<string | null>(null)

  const doExport = async () => {
    try {
      const backup = await exportBackup()
      const date = new Date().toISOString().slice(0, 10)
      await saveBackupFile(`ethereal-${date}.json`, JSON.stringify(backup))
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'The backup could not be made')
    }
  }

  const pickImport = async () => {
    const text = await openBackupFile().catch(() => null)
    if (text) setConfirmImport(text)
  }

  const doImport = async () => {
    if (!confirmImport) return
    try {
      const res = await importBackup(JSON.parse(confirmImport))
      haptic.success()
      showToast(`Restored ${res.items} desire${res.items === 1 ? '' : 's'} and ${res.categories} categories`)
      close()
    } catch (err) {
      showToast(err instanceof Error ? err.message : "That file isn't an Ethereal backup")
    } finally {
      setConfirmImport(null)
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Serif size={30}>Settings</Serif>
        <IconButton label="Close" onPress={close}>
          <X size={18} color={colors.parchmentDim} />
        </IconButton>
      </View>
      <SheetScrollView contentContainerStyle={styles.body}>
        <Glass rounded={radius.lg} style={styles.card}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Sans size={15} weight="medium" style={{ color: colors.parchment }}>
                Gather details online
              </Sans>
              <Sans size={12.5} style={{ color: colors.mistDim, marginTop: 2 }}>
                When connected, links bring their picture and description, books their cover, places their portrait.
                Only the link or title is sent.
              </Sans>
            </View>
            <Switch
              value={settings.enrich}
              onValueChange={(v) => {
                haptic.tap()
                setEnrich(v)
              }}
              trackColor={{ false: colors.indigoSoft, true: colors.gold }}
              thumbColor={colors.parchment}
              accessibilityLabel="Gather details online"
            />
          </View>
        </Glass>

        <Eyebrow style={styles.label}>Library</Eyebrow>
        <ActionList
          actions={[
            {
              key: 'cats',
              label: 'Curate categories',
              icon: <FolderTree size={18} color={colors.parchmentDim} />,
              onPress: () => replaceSheet({ type: 'categories', parentId: null }),
            },
            {
              key: 'export',
              label: 'Export a backup',
              hint: `${count} desire${count === 1 ? '' : 's'}`,
              icon: <Download size={18} color={colors.parchmentDim} />,
              onPress: doExport,
            },
            { key: 'import', label: 'Restore from a backup', icon: <Upload size={18} color={colors.parchmentDim} />, onPress: pickImport },
          ]}
        />
        {confirmImport ? (
          <Glass rounded={radius.lg} style={[styles.card, { marginTop: 12 }]}>
            <Sans size={14} style={{ color: colors.parchment }}>
              Restoring replaces everything here with the backup’s contents.
            </Sans>
            <View style={styles.confirmRow}>
              <Sans size={14} weight="semi" style={{ color: colors.mist }} onPress={() => setConfirmImport(null)}>
                Cancel
              </Sans>
              <Sans size={14} weight="semi" style={{ color: colors.gold }} onPress={doImport}>
                Replace and restore
              </Sans>
            </View>
          </Glass>
        ) : null}

        <Eyebrow style={styles.label}>Privacy</Eyebrow>
        <Sans size={13} style={styles.prose}>
          Ethereal has no account, no analytics and no cloud. Your board lives only on this{' '}
          {Platform.OS === 'web' ? 'device, in this browser' : 'device'}. Backups are files you keep yourself; they
          include your photos.
          {Platform.OS === 'web'
            ? ' In the browser, link previews come through microlink.io (it sees the link only), because browsers do not let one site read another.'
            : ''}
        </Sans>
        <Serif italic size={16} style={styles.colophon}>
          Ethereal · a quiet place to curate your horizon
        </Serif>
      </SheetScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flexShrink: 1 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 8 },
  body: { paddingHorizontal: 16, paddingBottom: 24 },
  card: { padding: 16 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  label: { marginTop: 22, marginBottom: 8, paddingHorizontal: 4 },
  prose: { paddingHorizontal: 4, color: colors.mist },
  confirmRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 22, marginTop: 14 },
  colophon: { textAlign: 'center', marginTop: 28, color: colors.mistDim },
})
