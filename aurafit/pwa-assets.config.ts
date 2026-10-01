import {
  createAppleSplashScreens,
  defineConfig,
  minimal2023Preset,
} from '@vite-pwa/assets-generator/config'

// Regenerate with `npm run icons` after editing public/logo.svg.
// Outputs are committed so builds never need `sharp`.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    png: { compressionLevel: 9, palette: false },
    maskable: {
      ...minimal2023Preset.maskable,
      padding: 0.14,
      resizeOptions: { background: '#0B0D12' },
    },
    apple: {
      ...minimal2023Preset.apple,
      padding: 0.1,
      resizeOptions: { background: '#0B0D12' },
    },
    appleSplashScreens: createAppleSplashScreens(
      {
        padding: 0.42,
        resizeOptions: { background: '#0B0D12', fit: 'contain' },
        linkMediaOptions: { log: true, addMediaScreen: true, basePath: '/', xhtml: false },
        png: { compressionLevel: 9, palette: false },
        name: (landscape, size) =>
          `splash/apple-splash-${landscape ? 'landscape' : 'portrait'}-${size.width}x${size.height}.png`,
      },
      ['iPhone 17 Pro Max', 'iPhone 17 Pro', 'iPhone Air', 'iPhone 16 Plus', 'iPhone 16', 'iPhone 14', 'iPhone 13 mini', 'iPhone 11 Pro Max', 'iPhone 11', 'iPhone X', 'iPhone SE 4.7"'],
    ),
  },
  images: ['public/logo.svg'],
})
