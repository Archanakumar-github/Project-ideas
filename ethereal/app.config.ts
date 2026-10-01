import type { ExpoConfig } from 'expo/config'

/**
 * EXPO_BASE_URL is set only for the web build published on GitHub Pages, where Ethereal lives
 * at /<repo>/. Native builds ignore it.
 */
const baseUrl = process.env.EXPO_BASE_URL?.replace(/\/$/, '') ?? ''

const config: ExpoConfig = {
  name: 'Ethereal',
  slug: 'ethereal',
  scheme: 'ethereal',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  backgroundColor: '#0E0F26',
  ios: {
    bundleIdentifier: 'com.ethereal.sanctuary',
    supportsTablet: true,
    infoPlist: {
      NSPhotoLibraryUsageDescription: 'Ethereal lets you add photos from your library to your vision board.',
      NSCameraUsageDescription: 'Ethereal lets you photograph things you dream of and add them to your board.',
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'com.ethereal.sanctuary',
    adaptiveIcon: {
      backgroundColor: '#0E0F26',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    name: 'Ethereal',
    shortName: 'Ethereal',
    favicon: './assets/favicon.png',
    output: 'single',
    themeColor: '#0E0F26',
    backgroundColor: '#0E0F26',
  },
  plugins: [
    'expo-sqlite',
    'expo-font',
    'expo-web-browser',
    [
      'expo-image-picker',
      {
        photosPermission: 'Ethereal lets you add photos from your library to your vision board.',
        cameraPermission: 'Ethereal lets you photograph things you dream of and add them to your board.',
      },
    ],
    [
      'expo-splash-screen',
      { image: './assets/splash-icon.png', imageWidth: 160, resizeMode: 'contain', backgroundColor: '#0E0F26' },
    ],
  ],
  experiments: {
    baseUrl,
  },
}

export default config
