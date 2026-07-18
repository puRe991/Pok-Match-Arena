import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'framer-motion'
import './index.css'
import App from './App.tsx'
import { initNative } from './native.ts'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Respektiert die Betriebssystem-Einstellung „Bewegung reduzieren“ –
        Framer-Motion-Animationen werden dann automatisch abgeschaltet. */}
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </StrictMode>,
)

// Native (Android) Setup – im Browser ein No-Op.
void initNative()
