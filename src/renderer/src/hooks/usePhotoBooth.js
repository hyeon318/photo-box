import { useRef, useState, useCallback, useEffect } from 'react'
import { config } from '../config'

// ─── Audio ────────────────────────────────────────────────────────────────────
function playShutter() {
  try {
    const ctx  = new AudioContext()
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(900, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.12)
    gain.gain.setValueAtTime(0.35, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18)
    osc.start()
    osc.stop(ctx.currentTime + 0.18)
  } catch (_) {}
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ─── Geometry helpers ────────────────────────────────────────────────────────

/**
 * config 레이아웃으로부터 단일 슬롯의 가로/세로 비율을 계산한다.
 * e.g. 1x4 → ~1.40  /  2x2 → ~1.01
 */
function computeSlotAspect(layout) {
  const { cols, rows } = layout
  const dims = config.frameDimensions[layout.id]
  const { photoMargin, footerHeight } = config
  const photoW = (dims.width  - photoMargin * (cols + 1)) / cols
  const photoH = (dims.height - footerHeight - photoMargin * (rows + 1)) / rows
  return photoW / photoH
}

/**
 * 웹캠 프레임을 슬롯 비율로 center-crop 하는 소스 좌표를 반환한다.
 * @returns {{ sx, sy, sw, sh }}
 */
function centerCrop(videoW, videoH, slotAspect) {
  const videoAspect = videoW / videoH
  let sx = 0, sy = 0, sw = videoW, sh = videoH
  if (videoAspect > slotAspect) {
    // 좌우 크롭
    sw = videoH * slotAspect
    sx = (videoW - sw) / 2
  } else {
    // 상하 크롭
    sh = videoW / slotAspect
    sy = (videoH - sh) / 2
  }
  return { sx, sy, sw, sh }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * usePhotoBooth
 *
 * 최적화 전략:
 *  - 미리보기: RAF 루프에서 mirror + center-crop만 수행, ctx.filter 미사용
 *    → CSS filter를 캔버스 요소에 적용해 GPU에 위임 (프레임당 오버헤드 0)
 *  - 미리보기 캔버스 상한: 1280px (렉 방지)
 *  - 촬영 캡처: ctx.filter로 5종 필터를 픽셀에 직접 합성 (캡처 시에만 실행)
 *  - MediaPipe 연동 시: 입력을 480p로 제한하여 세그멘테이션 속도 최적화 가능 (isAIMode)
 */
export function usePhotoBooth({ settings, onComplete, onCancel }) {
  const videoRef         = useRef(null)
  const previewCanvasRef = useRef(null)   // 미리보기 (1280px 상한, CSS filter 위임)
  const captureCanvasRef = useRef(null)   // 캡처 전용 (웹캠 원본 해상도, ctx.filter 적용)
  const streamRef        = useRef(null)
  const rafRef           = useRef(null)
  const stoppedRef       = useRef(false)

  const [phase,          setPhase]          = useState('init') // init | shooting | done
  const [countdown,      setCountdown]      = useState(null)
  const [isFlashing,     setIsFlashing]     = useState(false)
  const [photos,         setPhotos]         = useState([])
  const [shotCount,      setShotCount]      = useState(0)
  const [message,        setMessage]        = useState('')
  const [selectedFilter, setSelectedFilter] = useState(config.photoFilters[0])
  const selectedFilterRef = useRef(config.photoFilters[0])
  useEffect(() => { selectedFilterRef.current = selectedFilter }, [selectedFilter])

  const { layout, totalShots, intervalSeconds, countdownSeconds } = settings
  const slotAspect = computeSlotAspect(layout)

  // ── RAF 미리보기 루프 ──────────────────────────────────────────────────────
  // 필터는 CSS에 위임하므로 ctx.filter 미사용 → 프레임당 연산 최소화
  const startPreviewLoop = useCallback(() => {
    const video  = videoRef.current
    const canvas = previewCanvasRef.current
    if (!video || !canvas) return

    const tick = () => {
      if (video.readyState >= 2) {
        const vw = video.videoWidth
        const vh = video.videoHeight
        const { sx, sy, sw, sh } = centerCrop(vw, vh, slotAspect)

        // 미리보기 해상도 상한 1280px
        const previewScale = Math.min(1, 1280 / sw)
        const cw = Math.round(sw * previewScale)
        const ch = Math.round(sh * previewScale)

        if (canvas.width !== cw || canvas.height !== ch) {
          canvas.width  = cw
          canvas.height = ch
        }

        const ctx = canvas.getContext('2d', { alpha: false, powerPreference: 'high-performance' })
        ctx.save()
        ctx.translate(cw, 0)
        ctx.scale(-1, 1)
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, cw, ch)
        ctx.restore()
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [slotAspect])

  // ── 캡처 (촬영 시에만 ctx.filter 적용) ───────────────────────────────────
  // 목표 해상도: 웹캠 원본 → 자동으로 유지
  // 향후 인화 품질(2419px)이 필요하면 CAPTURE_TARGET_W 상수를 늘리면 됨
  const captureFrame = useCallback(() => {
    const video  = videoRef.current
    const canvas = captureCanvasRef.current
    if (!video || !canvas) return null

    const vw = video.videoWidth
    const vh = video.videoHeight
    const { sx, sy, sw, sh } = centerCrop(vw, vh, slotAspect)

    canvas.width  = Math.round(sw)
    canvas.height = Math.round(sh)

    const ctx = canvas.getContext('2d', { powerPreference: 'high-performance' })

    // 캡처 전 캔버스 초기화 필수
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    ctx.save()
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    // 캡처 시에만 5종 필터 픽셀 합성
    ctx.filter = selectedFilterRef.current.filter
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
    ctx.filter = 'none'
    ctx.restore()

    return canvas.toDataURL('image/png')
  }, [slotAspect])

  // ── 촬영 시퀀스 ───────────────────────────────────────────────────────────
  const runShootingSequence = useCallback(async () => {
    const capturedList = []
    setPhase('shooting')
    setMessage('')

    for (let i = 0; i < totalShots; i++) {
      if (stoppedRef.current) break

      const silentMs = (intervalSeconds - countdownSeconds) * 1000
      if (silentMs > 0) {
        setMessage(i === 0 ? '촬영 준비 중...' : '다음 촬영 준비 중...')
        await delay(silentMs)
        setMessage('')
      }

      if (stoppedRef.current) break

      for (let c = countdownSeconds; c >= 1; c--) {
        if (stoppedRef.current) break
        setCountdown(c)
        await delay(1000)
      }
      setCountdown(null)

      if (stoppedRef.current) break

      const dataUrl = captureFrame()
      playShutter()
      setIsFlashing(true)
      setTimeout(() => setIsFlashing(false), 180)

      if (dataUrl) {
        capturedList.push(dataUrl)
        setPhotos(prev => [...prev, dataUrl])
        setShotCount(capturedList.length)
      }
    }

    if (!stoppedRef.current) {
      setPhase('done')
      setMessage('촬영 완료!')
      await delay(700)
      onComplete(capturedList)
    }
  }, [totalShots, intervalSeconds, countdownSeconds, captureFrame, onComplete])

  // ── 카메라 초기화 ─────────────────────────────────────────────────────────
  useEffect(() => {
    stoppedRef.current = false

    const init = async () => {
      setMessage('카메라 준비 중...')
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width:  { ideal: 1920 },
            height: { ideal: 1080 },
            facingMode: 'user',
          },
          audio: false,
        })
        if (stoppedRef.current) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream

        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          await video.play()
        }
        await delay(800)
        setMessage('')
        startPreviewLoop()
        await runShootingSequence()
      } catch (err) {
        setMessage(`카메라를 열 수 없습니다: ${err.message}`)
      }
    }

    init()

    return () => {
      stoppedRef.current = true
      cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, []) // intentional: mount once

  const handleCancel = useCallback(() => {
    stoppedRef.current = true
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    onCancel()
  }, [onCancel])

  return {
    videoRef,
    previewCanvasRef,
    captureCanvasRef,
    phase,
    countdown,
    isFlashing,
    photos,
    shotCount,
    message,
    selectedFilter,
    setSelectedFilter,
    handleCancel,
    slotAspect,
  }
}
