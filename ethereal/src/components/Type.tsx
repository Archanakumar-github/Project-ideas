/** Typography: classic serif for anything poetic, clean sans-serif for anything functional. */
import { Text, type TextProps } from 'react-native'
import { colors, fonts } from '../theme'

export function Serif({ style, italic, size = 22, ...rest }: TextProps & { italic?: boolean; size?: number }) {
  return (
    <Text
      {...rest}
      style={[
        { fontFamily: italic ? fonts.serifItalic : fonts.serif, fontSize: size, color: colors.parchment, lineHeight: size * 1.18 },
        style,
      ]}
    />
  )
}

export function Sans({
  style,
  size = 14,
  weight = 'regular',
  ...rest
}: TextProps & { size?: number; weight?: 'regular' | 'medium' | 'semi' }) {
  const family = weight === 'semi' ? fonts.sansSemi : weight === 'medium' ? fonts.sansMedium : fonts.sans
  return (
    <Text {...rest} style={[{ fontFamily: family, fontSize: size, color: colors.mist, lineHeight: size * 1.45 }, style]} />
  )
}

/** Small spaced-out capitals used for section labels. */
export function Eyebrow({ style, ...rest }: TextProps) {
  return (
    <Text
      {...rest}
      style={[
        { fontFamily: fonts.sansMedium, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: colors.mistDim },
        style,
      ]}
    />
  )
}
