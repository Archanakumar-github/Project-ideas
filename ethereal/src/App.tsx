import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { useNetworkState } from 'expo-network'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useFonts } from 'expo-font'
// Deep imports: only the six faces used are bundled, not every weight of both families.
import { CormorantGaramond_500Medium } from '@expo-google-fonts/cormorant-garamond/500Medium'
import { CormorantGaramond_500Medium_Italic } from '@expo-google-fonts/cormorant-garamond/500Medium_Italic'
import { CormorantGaramond_600SemiBold } from '@expo-google-fonts/cormorant-garamond/600SemiBold'
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular'
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium'
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold'
import { Backdrop } from './components/Backdrop'
import { Serif, Sans } from './components/Type'
import { HomeScreen } from './screens/HomeScreen'
import { SheetHost } from './components/SheetHost'
import { ToastHost } from './components/ToastHost'
import { boot, library, setOnline } from './state/library'
import { colors } from './theme'

void SplashScreen.preventAutoHideAsync().catch(() => undefined)
void boot()

function NetworkWatcher() {
  const net = useNetworkState()
  useEffect(() => {
    // isInternetReachable is null while unknown: only treat an explicit "no" as offline.
    const online = net.isConnected !== false && net.isInternetReachable !== false
    setOnline(online)
  }, [net.isConnected, net.isInternetReachable])
  return null
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    CormorantGaramond_500Medium,
    CormorantGaramond_500Medium_Italic,
    CormorantGaramond_600SemiBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  })
  const status = library.use((s) => s.status)
  const error = library.use((s) => s.error)
  const ready = (fontsLoaded || !!fontError) && status !== 'loading'

  useEffect(() => {
    if (ready) SplashScreen.hide()
  }, [ready])

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <NetworkWatcher />
        <Backdrop />
        {!ready ? null : status === 'error' ? (
          <View style={styles.center}>
            <Serif size={28} style={{ textAlign: 'center' }}>
              The sanctuary could not open
            </Serif>
            <Sans style={{ textAlign: 'center', marginTop: 12 }}>{error}</Sans>
          </View>
        ) : (
          <>
            <HomeScreen />
            <SheetHost />
            <ToastHost />
          </>
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.night },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
})
