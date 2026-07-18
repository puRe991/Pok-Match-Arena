import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'io.pokmatch.arena',
  appName: 'Pokémon Duell-Arena',
  webDir: 'dist',
  backgroundColor: '#0b1020',
  android: {
    // Erlaubt den WebRTC-/API-Traffic (PeerJS, Pokemon TCG API, Supabase)
    allowMixedContent: true,
  },
  server: {
    androidScheme: 'https',
  },
}

export default config
