import { useEffect, useRef, useState, useCallback } from 'react'
import { X } from 'lucide-react'

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

// ─── Component ────────────────────────────────────────────────────────────────

export default function ShootingStep({ settings, onComplete, onCancel }) {
  const videoRef  = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const stoppedRef = useRef(false)

  const [photos,    setPhotos]    = useState([])
  const [shotCount, setShotCount] = useState(0)
  const [countdown, setCountdown] = useState(null)
  const [isFlashing, setIsFlashing] = useState(false)
  const [phase,     setPhase]     = useState('init') // init | shooting | done
  const [message,   setMessage]   = useState('카메라 준비 중...')

  const { totalShots, intervalSeconds, countdownSeconds } = settings

  // Capture one frame from the video element (already mirrored via CSS)
  const captureFrame = useCallback(() => {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return null

    canvas.width  = video.videoWidth  || 1280
    canvas.height = video.videoHeight || 720

    const ctx = canvas.getContext('2d')
    // Mirror horizontally to match the preview
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0)

    return canvas.toDataURL('image/png')
  }, [])

  // ── Main shooting sequence ──────────────────────────────────────────────
  useEffect(() => {
    stoppedRef.current = false
    const capturedList = []

    const run = async () => {
      // 1. Acquire camera
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
      } catch (err) {
        setMessage(`카메라를 열 수 없습니다: ${err.message}`)
        return
      }

      // 2. Brief pause so video is stable
      await delay(1200)
      if (stoppedRef.current) return

      setPhase('shooting')
      setMessage('')

      // 3. Shooting loop
      for (let i = 0; i < totalShots; i++) {
        if (stoppedRef.current) break

        // Silent wait before countdown (skip on first shot)
        if (i > 0) {
          const silentWait = (intervalSeconds - countdownSeconds) * 1000
          if (silentWait > 0) {
            setMessage('다음 촬영 준비 중...')
            await delay(silentWait)
            setMessage('')
          }
        }

        if (stoppedRef.current) break

        // Countdown
        for (let c = countdownSeconds; c >= 1; c--) {
          if (stoppedRef.current) break
          setCountdown(c)
          await delay(1000)
        }
        setCountdown(null)

        if (stoppedRef.current) break

        // Shoot
        const dataUrl = captureFrame()
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
        streamRef.current?.getTracks().forEach(t => t.stop())
        await delay(700)
        onComplete(capturedList)
      }
    }

    run()

    return () => {
      stoppedRef.current = true
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, []) // intentional empty deps — runs once on mount

  const handleCancel = () => {
    stoppedRef.current = true
    streamRef.current?.getTracks().forEach(t => t.stop())
    onCancel()
  }

  return (
    <div className="flex flex-col items-center justify-center h-full py-6 px-6">
      {/* Shutter flash overlay */}
      {isFlashing && (
        <div className="fixed inset-0 bg-white z-50 pointer-events-none" />
      )}

      <div className="w-full max-w-5xl grid grid-cols-3 gap-6">
        {/* ── Camera preview (2/3 width) ── */}
        <div className="col-span-2 flex flex-col gap-3">
          <div className="relative rounded-2xl overflow-hidden bg-gray-900 aspect-video shadow-2xl">
            <video
              ref={videoRef}
              autoPlay playsInline muted
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />

            {/* Countdown overlay */}
            {countdown !== null && (
              <div className="absolute inset-0 flex items-center justify-center">
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
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <span className="text-3xl font-bold text-white">✓ 촬영 완료</span>
              </div>
            )}

            {/* Progress bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gray-800/70">
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
          </div>
        </div>

        {/* ── Thumbnail strip (1/3 width) ── */}
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">촬영된 사진</h3>
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: totalShots }).map((_, i) => (
              <div
                key={i}
                className={`aspect-video rounded-lg overflow-hidden transition-all ${
                  photos[i] ? 'ring-1 ring-pink-500/40' : 'bg-gray-800/60'
                }`}
              >
                {photos[i] ? (
                  <img
                    src={photos[i]}
                    alt={`shot ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
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

      {/* Hidden canvas used for frame capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
