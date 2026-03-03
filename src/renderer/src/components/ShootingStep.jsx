import { useEffect, useRef, useState, useCallback } from 'react'
import { X, Zap } from 'lucide-react'
import { config } from '../config'
import BackgroundBlurCamera from './BackgroundBlurCamera'
import { useLocation } from '../hooks/useLocation'

// ─── Web Audio shutter sound ──────────────────────────────────────────────────
function playShutter() {
  try {
    const ctx = new AudioContext()
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(900, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.12)
    gain.gain.setValueAtTime(0.35, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.18)
  } catch (_) { /* Audio not available */ }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// captureNowRef 또는 stoppedRef가 set되면 즉시 resolve되는 인터럽트 가능 delay
function makePollDelay(captureNowRef, stoppedRef) {
  return (ms) => new Promise(resolve => {
    if (captureNowRef.current || stoppedRef.current) { resolve(); return }
    const POLL = 40
    let elapsed = 0
    const id = setInterval(() => {
      elapsed += POLL
      if (captureNowRef.current || stoppedRef.current || elapsed >= ms) {
        clearInterval(id)
        resolve()
      }
    }, POLL)
  })
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ShootingStep({ settings, onComplete, onCancel }) {
  // 'none' → plain webcam   'solid' | 'blur' → AI background camera
  const isAIMode = settings.bgEffect !== 'none'

  // AI mode: BackgroundBlurCamera ref (exposes captureFrame)
  const aiCameraRef  = useRef(null)

  // none mode: original video + canvas capture
  const videoRef   = useRef(null)
  const canvasRef  = useRef(null)
  const streamRef  = useRef(null)

  const cameraReadyRef = useRef(false)
  const stoppedRef     = useRef(false)
  const captureNowRef  = useRef(false)

  const [photos,     setPhotos]     = useState([])
  const [shotCount,  setShotCount]  = useState(0)
  const [countdown,  setCountdown]  = useState(null)
  const [isFlashing, setIsFlashing] = useState(false)
  const [phase,      setPhase]      = useState('init') // init | shooting | done
  const [message,    setMessage]    = useState('')

  // prefetch: true → 카메라 준비(~0.8s) 동안 위치를 동시에 fetch해 촬영 시 지연 없음
  const { getSnapshot: getLocationSnapshot } = useLocation({ prefetch: true })

  const { totalShots, intervalSeconds, countdownSeconds } = settings

  // ── 슬롯 비율 계산 (레이아웃에 맞게 미리보기/캡처 비율 결정) ─────────────────
  const { cols, rows } = settings.layout
  const dims       = config.frameDimensions[settings.layout.id] || { width: 640, height: 1920 }
  const slotW      = (dims.width  - config.photoMargin * (cols + 1)) / cols
  const slotH      = (dims.height - config.footerHeight - config.photoMargin * (rows + 1)) / rows
  const slotAspect = slotW / slotH   // e.g. ~1.40 for 1x4
  const slotAspectRatio = `${Math.round(slotW)} / ${Math.round(slotH)}`

  // AI mode: called by BackgroundBlurCamera when AI model + webcam are ready
  const handleAICameraReady = useCallback(() => {
    cameraReadyRef.current = true
  }, [])

  // Unified capture — routes to the right implementation depending on mode
  const captureFrame = useCallback(async () => {
    if (isAIMode) {
      return (await aiCameraRef.current?.captureFrame()) ?? null
    }
    // None mode: mirror + center-crop to slot aspect ratio (필터는 SelectStep에서 적용)
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return null

    const vw = video.videoWidth  || 1280
    const vh = video.videoHeight || 720

    // Center-crop to slot aspect
    const videoAspect = vw / vh
    let sx = 0, sy = 0, sw = vw, sh = vh
    if (videoAspect > slotAspect) {
      sw = vh * slotAspect
      sx = (vw - sw) / 2
    } else {
      sh = vw / slotAspect
      sy = (vh - sh) / 2
    }

    canvas.width  = Math.round(sw)
    canvas.height = Math.round(sh)

    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
    ctx.restore()
    return canvas.toDataURL('image/png')
  }, [isAIMode, slotAspect])

  // ── Main shooting sequence ──────────────────────────────────────────────
  useEffect(() => {
    stoppedRef.current   = false
    cameraReadyRef.current = false
    const capturedList = []

    const run = async () => {
      // ── None mode: ShootingStep manages the camera directly ──────────────
      if (!isAIMode) {
        setMessage('카메라 준비 중...')
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
            audio: false,
          })
          if (stoppedRef.current) { stream.getTracks().forEach(t => t.stop()); return }
          streamRef.current = stream
          if (videoRef.current) {
            videoRef.current.srcObject = stream
            await videoRef.current.play()
          }
          await delay(800) // brief stabilisation pause
          cameraReadyRef.current = true
        } catch (err) {
          setMessage(`카메라를 열 수 없습니다: ${err.message}`)
          return
        }
      }

      // ── AI mode: wait for BackgroundBlurCamera to signal ready (max 30s) ─
      if (isAIMode) {
        setMessage('카메라 준비 중...')
        const deadline = Date.now() + 30_000
        while (!cameraReadyRef.current && !stoppedRef.current) {
          if (Date.now() > deadline) {
            setMessage('카메라를 시작할 수 없습니다.')
            return
          }
          await delay(200)
        }
      }

      if (stoppedRef.current) return

      setPhase('shooting')
      setMessage('')

      const pollDelay = makePollDelay(captureNowRef, stoppedRef)

      // ── Shooting loop ────────────────────────────────────────────────────
      for (let i = 0; i < totalShots; i++) {
        if (stoppedRef.current) break

        // 모든 컷(첫 번째 포함)에 동일하게 silent wait 적용
        const silentWait = (intervalSeconds - countdownSeconds) * 1000
        if (silentWait > 0 && !captureNowRef.current) {
          setMessage(i === 0 ? '촬영 준비 중...' : '다음 촬영 준비 중...')
          await pollDelay(silentWait)
          setMessage('')
        }

        if (stoppedRef.current) break

        // Countdown — captureNowRef가 이미 set이면 카운트다운 생략
        if (!captureNowRef.current) {
          for (let c = countdownSeconds; c >= 1; c--) {
            if (stoppedRef.current || captureNowRef.current) break
            setCountdown(c)
            await pollDelay(1000)
          }
        }
        setCountdown(null)
        captureNowRef.current = false  // 플래그 소비

        if (stoppedRef.current) break

        // Shoot
        const dataUrl = await captureFrame()
        playShutter()
        setIsFlashing(true)
        setTimeout(() => setIsFlashing(false), 180)

        if (dataUrl) {
          capturedList.push(dataUrl)
          setPhotos([...capturedList])
          setShotCount(capturedList.length)
        }
      }

      if (!stoppedRef.current) {
        setPhase('done')
        setMessage('촬영 완료!')
        if (!isAIMode) streamRef.current?.getTracks().forEach(t => t.stop())
        await delay(700)
        onComplete(capturedList, getLocationSnapshot())
      }
    }

    run()

    return () => {
      stoppedRef.current = true
      // none mode: stop the stream we opened
      if (!isAIMode) streamRef.current?.getTracks().forEach(t => t.stop())
      // AI mode: BackgroundBlurCamera handles its own cleanup on unmount
    }
  }, []) // intentional empty deps — runs once on mount

  const handleCancel = () => {
    stoppedRef.current = true
    if (!isAIMode) streamRef.current?.getTracks().forEach(t => t.stop())
    onCancel()
  }

  // Space bar → 즉시 촬영
  useEffect(() => {
    if (phase !== 'shooting') return
    const onKey = (e) => {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault()
        captureNowRef.current = true
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase])

  return (
    <div className="flex flex-col items-center justify-center h-full py-6 px-6">
      {/* Shutter flash overlay */}
      {isFlashing && (
        <div className="fixed inset-0 bg-white z-50 pointer-events-none" />
      )}

      <div className="w-full max-w-5xl grid grid-cols-3 gap-6">
        {/* ── Camera preview (2/3 width) ── */}
        <div className="col-span-2 flex flex-col gap-3">
          <div
            className="relative rounded-2xl overflow-hidden bg-gray-900 shadow-2xl"
            style={{ aspectRatio: slotAspectRatio }}
          >

            {/* ── AI mode: background compositing camera (solid / blur) ── */}
            {isAIMode && (
              <BackgroundBlurCamera
                ref={aiCameraRef}
                bgEffect={settings.bgEffect}
                frameColor={settings.frameColor?.value ?? '#ffffff'}
                onReady={handleAICameraReady}
              />
            )}

            {/* ── None mode: plain webcam ── */}
            {!isAIMode && (
              <video
                ref={videoRef}
                autoPlay playsInline muted
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }}
              />
            )}

            {/* Countdown overlay */}
            {countdown !== null && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div
                  key={countdown}
                  className="text-[10rem] font-black text-white drop-shadow-[0_0_40px_rgba(236,72,153,0.8)] animate-countdown-pop leading-none"
                >
                  {countdown}
                </div>
              </div>
            )}

            {/* Done overlay */}
            {phase === 'done' && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center pointer-events-none">
                <span className="text-3xl font-bold text-white">✓ 촬영 완료</span>
              </div>
            )}

            {/* Progress bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gray-800/70 pointer-events-none">
              <div
                className="h-full bg-pink-500 transition-all duration-500 ease-out"
                style={{ width: `${(shotCount / totalShots) * 100}%` }}
              />
            </div>
          </div>

          {/* Status / controls row */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleCancel}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-white transition-colors"
            >
              <X size={15} />
              촬영 취소
            </button>

            <span className="text-sm text-gray-400">
              {message || (
                <>
                  <span className="text-pink-400 font-bold">{shotCount}</span>
                  <span> / {totalShots}</span>
                </>
              )}
            </span>

            {phase === 'shooting' && (
              <button
                onClick={() => { captureNowRef.current = true }}
                className="flex items-center gap-1.5 text-sm text-pink-400 hover:text-pink-300 bg-pink-950/40 hover:bg-pink-950/70 px-3 py-1.5 rounded-lg transition-colors"
                title="즉시 촬영 (Space)"
              >
                <Zap size={14} />
                지금 찍기
              </button>
            )}
          </div>
        </div>

        {/* ── Thumbnail strip (1/3 width) ── */}
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">촬영된 사진</h3>
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: totalShots }).map((_, i) => (
              <div
                key={i}
                className={`rounded-lg overflow-hidden transition-all ${
                  photos[i] ? 'ring-1 ring-pink-500/40' : 'bg-gray-800/60'
                }`}
                style={{ aspectRatio: slotAspectRatio }}
              >
                {photos[i] ? (
                  <img src={photos[i]} alt={`shot ${i + 1}`} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-700 text-xs font-medium">
                    {i + 1}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hidden canvas for solid-mode frame capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
