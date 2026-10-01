/** Saving and opening backup files: the share sheet on iOS / Android. */
import { File, Paths } from 'expo-file-system'
import * as DocumentPicker from 'expo-document-picker'
import * as Sharing from 'expo-sharing'

export async function saveBackupFile(name: string, json: string): Promise<void> {
  const file = new File(Paths.cache, name)
  if (file.exists) file.delete()
  file.create()
  file.write(json)
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save your Ethereal backup', UTI: 'public.json' })
}

export async function openBackupFile(): Promise<string | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true })
  if (res.canceled || !res.assets?.length) return null
  return new File(res.assets[0].uri).text()
}
