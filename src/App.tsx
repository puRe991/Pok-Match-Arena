import { useEffect } from 'react'
import { useGameStore } from './store/gameStore'
import { MainMenu } from './components/MainMenu'
import { LobbyScreen } from './components/LobbyScreen'
import { SetupScreen } from './components/SetupScreen'
import { GameBoard } from './components/GameBoard'

function App() {
  const init = useGameStore((s) => s.init)
  const screen = useGameStore((s) => s.screen)
  const gameState = useGameStore((s) => s.gameState)

  useEffect(() => {
    init()
  }, [init])

  if (!gameState) {
    if (screen === 'menu') return <MainMenu />
    return <LobbyScreen />
  }
  if (gameState.phase === 'setup') return <SetupScreen />
  return <GameBoard />
}

export default App
