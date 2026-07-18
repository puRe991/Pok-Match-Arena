import { useEffect, useState } from 'react'
import { useGameStore } from './store/gameStore'
import { useCollectionStore } from './store/collectionStore'
import { useAuthStore } from './store/authStore'
import { MainMenu } from './components/MainMenu'
import { LobbyScreen } from './components/LobbyScreen'
import { SetupScreen } from './components/SetupScreen'
import { GameBoard } from './components/GameBoard'
import { PackOpeningScreen } from './components/PackOpeningScreen'
import { DeckBuilderScreen } from './components/DeckBuilderScreen'
import { LeagueScreen } from './components/LeagueScreen'
import { ProfileScreen } from './components/ProfileScreen'
import { ProgressScreen } from './components/ProgressScreen'
import { SealedScreen } from './components/SealedScreen'

export type View = 'home' | 'packs' | 'deckbuilder' | 'league' | 'profile' | 'progress' | 'sealed'

function App() {
  const ensureStarterDeck = useCollectionStore((s) => s.ensureStarterDeck)
  const initAuth = useAuthStore((s) => s.init)
  const screen = useGameStore((s) => s.screen)
  const gameState = useGameStore((s) => s.gameState)
  const [view, setView] = useState<View>('home')

  useEffect(() => {
    ensureStarterDeck()
    initAuth()
  }, [ensureStarterDeck, initAuth])

  if (!gameState) {
    if (view === 'packs') return <PackOpeningScreen onBack={() => setView('home')} />
    if (view === 'deckbuilder') return <DeckBuilderScreen onBack={() => setView('home')} />
    if (view === 'league') return <LeagueScreen onNavigate={setView} />
    if (view === 'profile') return <ProfileScreen onBack={() => setView('home')} />
    if (view === 'progress') return <ProgressScreen onBack={() => setView('home')} />
    if (view === 'sealed') return <SealedScreen onBack={() => setView('home')} />
    if (screen === 'menu') return <MainMenu onNavigate={setView} />
    return <LobbyScreen />
  }
  if (gameState.phase === 'setup') return <SetupScreen />
  return <GameBoard />
}

export default App
