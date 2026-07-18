// Native App-Initialisierung (Capacitor / Android).
// Auf der Web-Plattform sind alle Aufrufe No-Ops, damit dieselbe
// Codebasis weiterhin unverändert im Browser läuft.
import { Capacitor } from '@capacitor/core'

export async function initNative(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    await StatusBar.setStyle({ style: Style.Dark })
    // Overlay, damit das dunkle App-Layout bis unter die Statusbar reicht
    await StatusBar.setOverlaysWebView({ overlay: true })
  } catch {
    // StatusBar nicht verfügbar – ignorieren
  }

  try {
    const { SplashScreen } = await import('@capacitor/splash-screen')
    await SplashScreen.hide()
  } catch {
    // SplashScreen nicht verfügbar – ignorieren
  }

  try {
    // Hardware-Zurück-Taste: schließt die App auf dem Startbildschirm,
    // ansonsten navigiert der Browser-Verlauf zurück.
    const { App } = await import('@capacitor/app')
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back()
      } else {
        App.exitApp()
      }
    })
  } catch {
    // App-Plugin nicht verfügbar – ignorieren
  }
}
