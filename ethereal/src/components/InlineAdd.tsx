/** A dashed "+ Sub-category" pill that turns into a text field in place. */
import { useState } from 'react'
import { StyleSheet, TextInput, View } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import { Check, Plus } from './icons'
import { Pill } from './Pill'
import { PressableScale } from './PressableScale'
import { haptic } from '../lib/haptics'
import { colors, fonts, radius } from '../theme'

interface Props {
  label: string
  placeholder: string
  onCreate: (name: string) => void | Promise<void>
}

export function InlineAdd({ label, placeholder, onCreate }: Props) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')

  const submit = async () => {
    const clean = name.trim()
    setEditing(false)
    setName('')
    if (!clean) return
    haptic.success()
    await onCreate(clean)
  }

  if (!editing) {
    return (
      <Pill
        label={label}
        dashed
        small
        icon={<Plus size={14} color={colors.goldSoft} strokeWidth={1.8} />}
        onPress={() => setEditing(true)}
      />
    )
  }
  return (
    <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} style={styles.field}>
      <TextInput
        autoFocus
        value={name}
        onChangeText={setName}
        placeholder={placeholder}
        placeholderTextColor={colors.mistFaint}
        returnKeyType="done"
        onSubmitEditing={submit}
        onBlur={() => void submit()}
        style={styles.input}
        maxLength={48}
        accessibilityLabel={placeholder}
      />
      <View style={styles.sep} />
      <PressableScale onPress={submit} accessibilityLabel="Add" accessibilityRole="button" style={styles.ok}>
        <Check size={15} color={colors.night} strokeWidth={2.2} />
      </PressableScale>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    minWidth: 180,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: 'rgba(14,15,38,0.6)',
    paddingLeft: 12,
    paddingRight: 3,
  },
  input: {
    outlineWidth: 0,
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 16,
    color: colors.parchment,
    paddingVertical: 0,
    minWidth: 120,
  },
  sep: { width: 6 },
  ok: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
