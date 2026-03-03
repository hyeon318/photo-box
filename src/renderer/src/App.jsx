import { useState } from 'react'
import { Camera, Images, Minus, Maximize2, X } from 'lucide-react'
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
  const [captureLocation, setCaptureLocation] = useState(null) // { lat, lng, accuracy, status }

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleStart = (newSettings) => {
    setSettings(newSettings)
    setCapturedPhotos([])
    setCompositeImage(null)
    setStep('shooting')
  }

  const handleShootingComplete = (photos, location) => {
    setCapturedPhotos(photos)
    setCaptureLocation(location ?? null)
    setStep('select')
  }

  const handleSelectionComplete = (composite) => {
    setCompositeImage(composite)
    setStep('share')
  }

  const handleRestart = () => {
    setCapturedPhotos([])
    setCompositeImage(null)
    setCaptureLocation(null)
    setStep('setup')
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white overflow-hidden">
      {/* ── 윈도우 컨트롤 — 항상 최상단 고정 (인트로 포함 전 스텝에서 표시) ── */}
      <WindowControls />

      {/* Top navigation bar — 인트로에서는 숨김 */}
      <header
        className={`flex-shrink-0 flex items-center justify-between pl-6 pr-32 py-3 bg-gray-900/80 backdrop-blur border-b border-gray-800 z-40 ${step === 'intro' ? 'hidden' : ''}`}
        style={{ WebkitAppRegion: 'drag' }}
      >
        <button
          onClick={() => step !== 'shooting' && setStep('setup')}
          className="flex items-center gap-2 text-pink-400 font-bold text-xl hover:text-pink-300 transition-colors"
          style={{ WebkitAppRegion: 'no-drag' }}
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
          style={{ WebkitAppRegion: 'no-drag' }}
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
            location={captureLocation}
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

// ─── Window Controls ─────────────────────────────────────────────────────────
// frame: false 환경에서 항상 표시되는 커스텀 타이틀바 버튼
// 헤더(pr-32) 와 겹치지 않도록 동일 높이(h-9 = 36px) + z-[9999]로 최상위 배치

function WindowControls() {
  return (
    <div
      className="fixed top-0 right-0 z-[9999] flex items-center"
      style={{ WebkitAppRegion: 'no-drag' }}
    >
      {/* 최소화 */}
      <button
        onClick={() => window.electronAPI?.windowMinimize()}
        className="w-10 h-9 flex items-center justify-center text-gray-500 hover:text-white hover:bg-gray-700/90 transition-colors"
        title="최소화"
      >
        <Minus size={13} />
      </button>

      {/* 최대화 / 복원 */}
      <button
        onClick={() => window.electronAPI?.windowMaximize()}
        className="w-10 h-9 flex items-center justify-center text-gray-500 hover:text-white hover:bg-gray-700/90 transition-colors"
        title="최대화"
      >
        <Maximize2 size={12} />
      </button>

      {/* 닫기 */}
      <button
        onClick={() => window.electronAPI?.windowClose()}
        className="w-10 h-9 flex items-center justify-center text-gray-500 hover:text-white hover:bg-red-600 transition-colors"
        title="닫기"
      >
        <X size={13} />
      </button>
    </div>
  )
}

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
