import { useState, useEffect, useRef } from 'react'
import { Camera, Images, Minus, Maximize2, X } from 'lucide-react'
import { config } from './config'
import { getLocation } from './utils/getLocation'
import { preloadSeg } from './utils/selfieSegSingleton'
import { prewarmCamera } from './utils/cameraStreamSingleton'
import IntroScreen from './components/IntroScreen'
import SetupStep from './components/SetupStep'
import ShootingStep from './components/ShootingStep'
import SelectStep from './components/SelectStep'
import ShareStep from './components/ShareStep'
import GalleryView from './components/GalleryView'

// ─── Step type ───────────────────────────────────────────────────────────────
// 'intro' | 'setup' | 'shooting' | 'select' | 'share' | 'gallery'

const SETTINGS_KEY = 'photobooth_settings'

function loadSettings() {
  const defaultLayout = config.layouts.find(l => l.id === '1x4') ?? config.layouts[0]
  const defaults = {
    totalShots:       config.totalShots,
    selectCount:      defaultLayout.cols * defaultLayout.rows,
    intervalSeconds:  config.intervalSeconds,
    countdownSeconds: config.countdownSeconds,
    layout:           defaultLayout,
    bgEffect:         'none',
    frameColor:       config.frameColors[0],
    enableLocation:   true,
  }
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}')
    // layout / frameColor는 id로 저장했다가 config에서 다시 찾아서 복원
    const layout    = config.layouts.find(l => l.id === saved.layoutId) ?? defaultLayout
    const frameColor = config.frameColors.find(c => c.id === saved.frameColorId) ?? config.frameColors[0]
    return {
      ...defaults,
      ...(saved.totalShots       != null && { totalShots:       saved.totalShots       }),
      ...(saved.intervalSeconds  != null && { intervalSeconds:  saved.intervalSeconds  }),
      ...(saved.countdownSeconds != null && { countdownSeconds: saved.countdownSeconds }),
      ...(saved.bgEffect         != null && { bgEffect:         saved.bgEffect         }),
      ...(saved.enableLocation   != null && { enableLocation:   saved.enableLocation   }),
      layout,
      frameColor,
      selectCount: layout.cols * layout.rows,
    }
  } catch {
    return defaults
  }
}

function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      totalShots:       settings.totalShots,
      intervalSeconds:  settings.intervalSeconds,
      countdownSeconds: settings.countdownSeconds,
      bgEffect:         settings.bgEffect,
      enableLocation:   settings.enableLocation,
      layoutId:         settings.layout?.id,
      frameColorId:     settings.frameColor?.id,
    }))
  } catch { /* 저장 실패 무시 */ }
}

export default function App() {
  const [step, setStep] = useState('intro')
  const [settings, setSettings] = useState(loadSettings)

  // settings 바뀔 때마다 자동 저장
  useEffect(() => { saveSettings(settings) }, [settings])

  const [capturedPhotos, setCapturedPhotos] = useState([])
  const [compositeImage, setCompositeImage] = useState(null)

  // ── 앱 초기 로딩 ─────────────────────────────────────────────────────────
  // WASM 모델 + 위치 정보를 병렬 프리로드. 완료 전까지 IntroScreen 버튼 비활성.
  const locationRef   = useRef(null)
  const [winLocStatus, setWinLocStatus] = useState(null)
  const [loadingItems, setLoadingItems] = useState(() => {
    const saved = loadSettings()
    const items = [{ id: 'wasm', label: 'AI 배경 모델', done: false, failed: false }]
    if (saved.enableLocation) items.push({ id: 'location', label: '위치 정보', done: false, failed: false })
    return items
  })

  // loadingItems가 모두 done이면 바로 true — 별도 state 없이 같은 렌더 사이클에서 반영
  const appReady = loadingItems.every(item => item.done)

  useEffect(() => {
    const mark = (id, failed = false) =>
      setLoadingItems(prev => prev.map(item => item.id === id ? { ...item, done: true, failed } : item))

    // Task 1: MediaPipe WASM 프리로드 — 실패해도 done 처리, failed 플래그로 구분
    preloadSeg().then(() => mark('wasm', false)).catch(() => mark('wasm', true))

    // Task 2: 위치 정보 + Windows 서비스 상태 확인 (설정이 켜진 경우만)
    if (settings.enableLocation) {
      Promise.all([
        getLocation()
          .then(loc => { if (loc?.status === 'OK') locationRef.current = loc })
          .catch(() => {}),
        window.electronAPI.checkWindowsLocation()
          .then(r => setWinLocStatus(r.enabled))
          .catch(() => {}),
      ]).finally(() => mark('location', false))
    }

  }, []) // 마운트 1회만

  // 설정 일부 변경 시 즉시 App state + localStorage 반영
  // useEffect 타이밍에 의존하지 않고 동기적으로 저장 (토글 등 즉시 반영)
  const settingsRef = useRef(settings)
  useEffect(() => { settingsRef.current = settings }, [settings])

  const handleSettingsChange = (partial) => {
    const next = { ...settingsRef.current, ...partial }
    setSettings(next)
    saveSettings(next)
  }

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleStart = (newSettings) => {
    setSettings(newSettings)
    setCapturedPhotos([])
    setCompositeImage(null)
    // AI 모드이면 카메라를 지금 바로 열기 시작 — ShootingStep 렌더보다 먼저 시작해
    // BackgroundBlurCamera 마운트 시 getUserMedia 대기 없이 스트림 바로 사용 가능
    if (newSettings.bgEffect !== 'none') prewarmCamera().catch(() => {})
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
          <IntroScreen
            onReady={() => setStep('setup')}
            isReady={appReady}
            loadingItems={loadingItems}
          />
        )}

        {step === 'setup' && (
          <SetupStep
            defaultSettings={settings}
            onStart={handleStart}
            winLocStatus={winLocStatus}
            onSettingsChange={handleSettingsChange}
          />
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
            location={locationRef.current}
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
