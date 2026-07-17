import { useEffect, useState } from 'react'
import { useGameStore } from './store/gameStore'
import { useCollectionStore } from './store/collectionStore'
import { MainMenu } from './components/MainMenu'
import { LobbyScreen } from './components/LobbyScreen'
import { SetupScreen } from './components/SetupScreen'
import { GameBoard } from './components/GameBoard'
import { PackOpeningScreen } from './components/PackOpeningScreen'
import { DeckBuilderScreen } from './components/DeckBuilderScreen'
import { ProfileScreen } from './components/ProfileScreen'

export type View = 'home' | 'packs' | 'deckbuilder' | 'profile'

function App() {
  const ensureStarterDeck = useCollectionStore((s) => s.ensureStarterDeck)
  const screen = useGameStore((s) => s.screen)
  const gameState = useGameStore((s) => s.gameState)
  const [view, setView] = useState<View>('home')

  useEffect(() => {
    ensureStarterDeck()
  }, [ensureStarterDeck])

  if (!gameState) {
    if (view === 'packs') return <PackOpeningScreen onBack={() => setView('home')} />
    if (view === 'deckbuilder') return <DeckBuilderScreen onBack={() => setView('home')} />
    if (view === 'profile') return <ProfileScreen onBack={() => setView('home')} />
    if (screen === 'menu') return <MainMenu onNavigate={setView} />
    return <LobbyScreen />
  }
  if (gameState.phase === 'setup') return <SetupScreen />
  return <GameBoard />
}

export default App
