import { useState } from 'react'
import { Camera, Images } from 'lucide-react'
import { config } from './config'
import IntroScreen from './components/IntroScreen'
import SetupStep from './components/SetupStep'
import ShootingStep from './components/ShootingStep'
import SelectStep from './components/SelectStep'
import ShareStep from './components/ShareStep'
import GalleryView from './components/GalleryView'

// ─── Step type ───────────────────────────────────────────────────────────────
// 'intro' | 'setup' | 'shooting' | 'select' | 'share' | 'gallery'

export default function App() {
  const [step, setStep] = useState('intro')

  // Default to 1x4 (the classic 인생네컷 format)
  const defaultLayout = config.layouts.find(l => l.id === '1x4') ?? config.layouts[0]

  const [settings, setSettings] = useState({
    totalShots: config.totalShots,
    selectCount: defaultLayout.cols * defaultLayout.rows,
    intervalSeconds: config.intervalSeconds,
    countdownSeconds: config.countdownSeconds,
    layout: defaultLayout,
    bgEffect: 'none',
    frameColor: config.frameColors[0],
  })

  const [capturedPhotos, setCapturedPhotos] = useState([])   // dataUrl[]
  const [compositeImage, setCompositeImage] = useState(null) // dataUrl

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleStart = (newSettings) => {
    setSettings(newSettings)
    setCapturedPhotos([])
    setCompositeImage(null)
    setStep('shooting')
  }

  const handleShootingComplete = (photos) => {
    setCapturedPhotos(photos)
    setStep('select')
  }

  const handleSelectionComplete = (composite) => {
    setCompositeImage(composite)
    setStep('share')
  }

  const handleRestart = () => {
    setCapturedPhotos([])
    setCompositeImage(null)
    setStep('setup')
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white overflow-hidden">
      {/* Top navigation bar — 인트로에서는 숨김 */}
      <header className={`flex-shrink-0 flex items-center justify-between px-6 py-3 bg-gray-900/80 backdrop-blur border-b border-gray-800 z-40 ${step === 'intro' ? 'hidden' : ''}`}>
        <button
          onClick={() => step !== 'shooting' && setStep('setup')}
          className="flex items-center gap-2 text-pink-400 font-bold text-xl hover:text-pink-300 transition-colors"
        >
          <Camera size={22} />
          PhotoBooth
        </button>

        {/* Step indicator */}
        <StepIndicator current={step} />

        <button
          onClick={() => step !== 'shooting' && setStep('gallery')}
          disabled={step === 'shooting'}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Images size={18} />
          앨범
        </button>
      </header>

      {/* Main content area */}
      <main className="flex-1 overflow-hidden scrollable">
        {step === 'intro' && (
          <IntroScreen onReady={() => setStep('setup')} />
        )}

        {step === 'setup' && (
          <SetupStep defaultSettings={settings} onStart={handleStart} />
        )}

        {step === 'shooting' && (
          <ShootingStep
            settings={settings}
            onComplete={handleShootingComplete}
            onCancel={() => setStep('setup')}
          />
        )}

        {step === 'select' && (
          <SelectStep
            photos={capturedPhotos}
            settings={settings}
            onComplete={handleSelectionComplete}
            onReshoot={() => setStep('shooting')}
          />
        )}

        {step === 'share' && (
          <ShareStep
            compositeImage={compositeImage}
            onRestart={handleRestart}
          />
        )}

        {step === 'gallery' && (
          <GalleryView onBack={() => setStep('setup')} />
        )}
      </main>
    </div>
  )
}

// ─── Step Indicator ──────────────────────────────────────────────────────────

const STEPS = [
  { id: 'setup',    label: '설정' },
  { id: 'shooting', label: '촬영' },
  { id: 'select',   label: '선택' },
  { id: 'share',    label: '공유' },
]

function StepIndicator({ current }) {
  const idx = STEPS.findIndex(s => s.id === current)

  return (
    <div className="hidden sm:flex items-center gap-1">
      {STEPS.map((s, i) => (
        <div key={s.id} className="flex items-center gap-1">
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full transition-all ${
              i === idx
                ? 'bg-pink-500 text-white'
                : i < idx
                ? 'text-pink-400'
                : 'text-gray-600'
            }`}
          >
            {s.label}
          </span>
          {i < STEPS.length - 1 && (
            <span className={`text-xs ${i < idx ? 'text-pink-600' : 'text-gray-700'}`}>›</span>
          )}
        </div>
      ))}
    </div>
  )
}
