import * as ImagePicker from 'expo-image-picker'
import type { PickedImage } from '../state/library'
import { showToast } from '../state/ui'

const OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  quality: 0.9,
  exif: false,
  allowsMultipleSelection: false,
}

function first(res: ImagePicker.ImagePickerResult): PickedImage | null {
  if (res.canceled || !res.assets?.length) return null
  const a = res.assets[0]
  return { uri: a.uri, width: a.width || 0, height: a.height || 0 }
}

/** The system photo picker: no library permission needed, Ethereal only sees the chosen photo. */
export async function pickFromLibrary(): Promise<PickedImage | null> {
  try {
    return first(await ImagePicker.launchImageLibraryAsync(OPTIONS))
  } catch {
    showToast('The photo library could not be opened')
    return null
  }
}

export async function takePhoto(): Promise<PickedImage | null> {
  try {
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) {
      showToast('Camera access is off for Ethereal in Settings')
      return null
    }
    return first(await ImagePicker.launchCameraAsync(OPTIONS))
  } catch {
    showToast('The camera could not be opened')
    return null
  }
}
