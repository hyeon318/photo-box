import {
  useEffect, useRef, useState, useCallback,
  forwardRef, useImperativeHandle,
} from 'react'
import { getSeg, preloadSeg, releaseSeg } from '../utils/selfieSegSingleton'
import { getPrewarmStream } from '../utils/cameraStreamSingleton'

const PREVIEW_W  = 640
const PREVIEW_H  = 360

/**
 * BackgroundBlurCamera
 *
 * AI 배경 교체 카메라. bgEffect에 따라 배경을 처리합니다.
 *
 * Pipeline (매 프레임):
 *   RAW VIDEO (un-mirrored)
 *     ├─▶ bgCanvas     : 'blur' → blur 필터 / 'solid' → 단색 fill
 *     └─▶ personCanvas : video × segmentation mask (인물만 추출)
 *   outputCanvas = bgCanvas ⊕ personCanvas  (scaleX(-1) 셀피 미러)
 *
 * Props:
 *   bgEffect   : 'solid' | 'blur'   — 배경 처리 방식
 *   frameColor : '#RRGGBB'          — 단색 배경 색상 (solid 전용)
 *   onReady    : () => void         — 카메라+모델 준비 완료 콜백
 *
 * Ref API:
 *   ref.current.captureFrame() → dataURL | null
 */
const BackgroundBlurCamera = forwardRef(function BackgroundBlurCamera(
  { bgEffect = 'blur', frameColor = '#ffffff', photoFilter = 'none', onReady },
  ref,
) {
  // ── DOM refs ──────────────────────────────────────────────────────────────
  const videoRef        = useRef(null)
  const outputCanvasRef = useRef(null)
  const bgCanvasRef     = useRef(null)
  const personCanvasRef = useRef(null)

  // ── Runtime refs ──────────────────────────────────────────────────────────
  const streamRef          = useRef(null)
  const segRef             = useRef(null)
  const rafRef             = useRef(null)
  // 고해상도 캡처 요청 — { resolve, timeout } | null
  const pendingCaptureRef  = useRef(null)
  // 마스크 페더링용 재사용 캔버스 (매 프레임 할당 방지, 지연 초기화)
  const featherMaskRef     = useRef(null)
  // 블러 배경용 다운샘플 임시 캔버스 (ctx.filter 대체)
  const blurTempRef        = useRef(null)

  // ── State ─────────────────────────────────────────────────────────────────
  const [blurAmount,    setBlurAmount]    = useState(15)
  const [featherAmount, setFeatherAmount] = useState(4)   // 단색 경계 부드러움 (0=선명, 12=매우부드)
  const [status,        setStatus]        = useState('loading')
  const [errorMsg,      setErrorMsg]      = useState('')

  // Props를 ref로 미러링 — stable callback 안에서 최신값 읽기 위함
  const bgEffectRef     = useRef(bgEffect)
  const frameColorRef   = useRef(frameColor)
  const blurAmountRef   = useRef(blurAmount)
  const featherAmountRef= useRef(featherAmount)
  const photoFilterRef  = useRef(photoFilter)
  useEffect(() => { bgEffectRef.current     = bgEffect     }, [bgEffect])
  useEffect(() => { frameColorRef.current   = frameColor   }, [frameColor])
  useEffect(() => { blurAmountRef.current   = blurAmount   }, [blurAmount])
  useEffect(() => { featherAmountRef.current= featherAmount}, [featherAmount])
  useEffect(() => { photoFilterRef.current  = photoFilter  }, [photoFilter])

  // ── Ref API ───────────────────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({ captureFrame: captureHighRes }), [])

  // ── High-resolution capture ───────────────────────────────────────────────
  // 다음 onResults 프레임에서 live segmentationMask로 고해상도 합성 후 resolve.
  // 2초 내 프레임이 오지 않으면 null로 resolve (타임아웃 안전망).
  function captureHighRes() {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        if (pendingCaptureRef.current) {
          pendingCaptureRef.current = null
          resolve(null)
        }
      }, 2000)
      pendingCaptureRef.current = { resolve, timeout }
    })
  }

  // ── Frame rendering (seg.onResults 에서 매 프레임 호출) ─────────────────
  const renderFrame = useCallback((results) => {
    const { segmentationMask } = results
    if (!segmentationMask) return

    const output = outputCanvasRef.current
    const bg     = bgCanvasRef.current
    const person = personCanvasRef.current
    const video  = videoRef.current
    if (!output || !bg || !person || !video) return

    const W = PREVIEW_W
    const H = PREVIEW_H
    const outputCtx = output.getContext('2d')
    const bgCtx     = bg.getContext('2d')
    const personCtx = person.getContext('2d')

    // ── Step 1: Background (clearRect로 잔상 방지) ───────────────────────────
    bgCtx.clearRect(0, 0, W, H)
    if (bgEffectRef.current === 'blur') {
      // ctx.filter = 'blur()' 는 Electron 환경에서 실패할 수 있으므로
      // 다운샘플 → 업샘플 방식으로 블러 효과를 구현 (크로스 플랫폼 안전)
      const bl    = blurAmountRef.current
      const scale = Math.max(0.04, 0.6 / (1 + bl * 0.5))
      const bW    = Math.max(1, Math.round(W * scale))
      const bH    = Math.max(1, Math.round(H * scale))
      if (!blurTempRef.current) blurTempRef.current = document.createElement('canvas')
      const tmp = blurTempRef.current
      if (tmp.width !== bW || tmp.height !== bH) { tmp.width = bW; tmp.height = bH }
      tmp.getContext('2d').drawImage(video, 0, 0, bW, bH)
      bgCtx.save()
      bgCtx.imageSmoothingEnabled = true
      bgCtx.imageSmoothingQuality = 'high'
      bgCtx.drawImage(tmp, 0, 0, bW, bH, 0, 0, W, H)
      bgCtx.restore()
    } else {
      bgCtx.fillStyle = frameColorRef.current
      bgCtx.fillRect(0, 0, W, H)
    }

    // ── Step 2: Person cutout — 페더링된 마스크로 경계 부드럽게 ─────────────
    // 재사용 캔버스 지연 초기화 (매 프레임 할당 방지)
    if (!featherMaskRef.current) {
      featherMaskRef.current = typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(W, H)
        : Object.assign(document.createElement('canvas'), { width: W, height: H })
    }
    const fCtx = featherMaskRef.current.getContext('2d')
    fCtx.clearRect(0, 0, W, H)
    fCtx.filter = `blur(${featherAmountRef.current}px)`
    fCtx.drawImage(segmentationMask, 0, 0, W, H)
    fCtx.filter = 'none'

    personCtx.clearRect(0, 0, W, H)
    personCtx.drawImage(video, 0, 0, W, H)
    personCtx.globalCompositeOperation = 'destination-in'
    personCtx.drawImage(featherMaskRef.current, 0, 0, W, H)
    personCtx.globalCompositeOperation = 'source-over'

    // ── Step 3: Composite → output (scaleX(-1) 셀피 미러, 필터 적용) ────────
    outputCtx.clearRect(0, 0, W, H)
    outputCtx.save()
    outputCtx.translate(W, 0)
    outputCtx.scale(-1, 1)
    outputCtx.filter = photoFilterRef.current
    outputCtx.drawImage(bg,     0, 0)
    outputCtx.drawImage(person, 0, 0)
    outputCtx.restore() // filter도 restore로 초기화됨

    // ── Step 4: 고해상도 캡처 요청 처리 ────────────────────────────────────
    // captureHighRes() 호출 후 첫 프레임에서 live mask로 full-res 합성
    const pending = pendingCaptureRef.current
    if (!pending) return

    pendingCaptureRef.current = null
    clearTimeout(pending.timeout)

    const VW = video.videoWidth  || PREVIEW_W * 2
    const VH = video.videoHeight || PREVIEW_H * 2

    // 임시 캔버스 헬퍼 (toDataURL 불필요한 것은 OffscreenCanvas 사용)
    const mkOffscreen = (w, h) => typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(w, h)
      : Object.assign(document.createElement('canvas'), { width: w, height: h })

    // 페더링 마스크 (고해상도 비례 블러)
    const scaledFeather = Math.round(featherAmountRef.current * (VW / PREVIEW_W))
    const hMask    = mkOffscreen(VW, VH)
    const hMaskCtx = hMask.getContext('2d')
    hMaskCtx.filter = `blur(${scaledFeather}px)`
    hMaskCtx.drawImage(segmentationMask, 0, 0, VW, VH)
    hMaskCtx.filter = 'none'

    // 배경 (고해상도)
    const hBg    = mkOffscreen(VW, VH)
    const hBgCtx = hBg.getContext('2d')
    if (bgEffectRef.current === 'blur') {
      const bl     = blurAmountRef.current
      const scale  = Math.max(0.04, 0.6 / (1 + bl * 0.5))
      const bW     = Math.max(1, Math.round(VW * scale))
      const bH     = Math.max(1, Math.round(VH * scale))
      const hTmp   = mkOffscreen(bW, bH)
      hTmp.getContext('2d').drawImage(video, 0, 0, bW, bH)
      hBgCtx.imageSmoothingEnabled = true
      hBgCtx.imageSmoothingQuality = 'high'
      hBgCtx.drawImage(hTmp, 0, 0, bW, bH, 0, 0, VW, VH)
    } else {
      hBgCtx.fillStyle = frameColorRef.current
      hBgCtx.fillRect(0, 0, VW, VH)
    }

    // 인물 컷아웃 (고해상도 + 페더링 마스크)
    const hPerson    = mkOffscreen(VW, VH)
    const hPersonCtx = hPerson.getContext('2d')
    hPersonCtx.drawImage(video, 0, 0, VW, VH)
    hPersonCtx.globalCompositeOperation = 'destination-in'
    hPersonCtx.drawImage(hMask, 0, 0, VW, VH)
    hPersonCtx.globalCompositeOperation = 'source-over'

    // 최종 합성 (toDataURL 필요 → 일반 canvas, 필터 적용)
    const hOut    = document.createElement('canvas')
    hOut.width = VW; hOut.height = VH
    const hOutCtx = hOut.getContext('2d')
    hOutCtx.translate(VW, 0); hOutCtx.scale(-1, 1)
    hOutCtx.filter = photoFilterRef.current
    hOutCtx.drawImage(hBg,     0, 0)
    hOutCtx.drawImage(hPerson, 0, 0)

    pending.resolve(hOut.toDataURL('image/png'))
  }, [])

  // ── MediaPipe + 카메라 초기화 ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    async function init() {
      // 싱글톤에서 이미 초기화된 인스턴스를 가져옴.
      // 인트로에서 preloadSeg()가 완료됐다면 즉시 반환.
      // 아직 없으면 fallback으로 직접 로드 (인트로 건너뛴 경우 등).
      let seg = getSeg()
      if (!seg) {
        await preloadSeg()
        if (cancelled) return
        seg = getSeg()
        if (!seg) throw new Error('SelfieSegmentation 초기화 실패')
      }

      seg.onResults(renderFrame)
      segRef.current = seg
      if (cancelled) return  // cleanup이 이미 releaseSeg() 처리

      // prewarm 완료까지 대기 후 스트림 수신.
      // consumePrewarmedStream() 대신 getPrewarmStream()을 사용해
      // prewarm과 병렬로 자체 getUserMedia를 여는 충돌(NotReadableError)을 방지.
      let stream = await getPrewarmStream()
      // ⚠️ async 취소 경로에서는 releaseSeg() 호출 금지.
      // cleanup이 이미 releaseSeg()를 실행했으므로, 여기서 다시 호출하면
      // React StrictMode 두 번째 마운트의 seg.onResults(renderFrame)을 덮어쓰게 됨.
      if (cancelled) { stream?.getTracks().forEach(t => t.stop()); return }
      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: false,
        })
      }
      if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
      streamRef.current = stream
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      if (cancelled) return

      setStatus('ready')
      onReady?.()

      const loop = async () => {
        if (cancelled) return
        const v = videoRef.current
        const s = segRef.current
        if (v && s && v.readyState >= 2 && !v.paused) {
          try { await s.send({ image: v }) } catch (_) {}
        }
        if (!cancelled) rafRef.current = requestAnimationFrame(loop)
      }
      rafRef.current = requestAnimationFrame(loop)
    }

    init().catch(err => {
      if (!cancelled) {
        setStatus('error')
        setErrorMsg(err?.message ?? String(err))
        console.error('[BackgroundBlurCamera] init failed:', err)
      }
    })

    return () => {
      cancelled = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
      // 싱글톤이므로 close() 금지 — onResults를 빈 함수로 교체해 in-flight 콜백 무해 처리
      releaseSeg()
      // 미처리 캡처 요청이 있으면 null로 resolve
      if (pendingCaptureRef.current) {
        clearTimeout(pendingCaptureRef.current.timeout)
        pendingCaptureRef.current.resolve(null)
        pendingCaptureRef.current = null
      }
      // 페더링 캔버스 해제
      featherMaskRef.current = null
      blurTempRef.current    = null
    }
  }, [renderFrame])

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full h-full">
      <video ref={videoRef} autoPlay playsInline muted className="hidden" />
      <canvas ref={bgCanvasRef}     width={PREVIEW_W} height={PREVIEW_H} className="hidden" />
      <canvas ref={personCanvasRef} width={PREVIEW_W} height={PREVIEW_H} className="hidden" />

      <canvas
        ref={outputCanvasRef}
        width={PREVIEW_W}
        height={PREVIEW_H}
        className="w-full h-full object-cover"
        style={{ willChange: 'transform' }}
      />

      {/* Loading */}
      {status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/90 gap-3">
          <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-300">카메라 연결 중…</p>
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/90 gap-2 px-4">
          <p className="text-sm text-red-400 font-semibold">카메라 또는 AI 모델을 시작할 수 없습니다.</p>
          {errorMsg && <p className="text-xs text-gray-500 text-center break-all">{errorMsg}</p>}
        </div>
      )}

      {/* Controls (ready 상태에서만 표시) */}
      {status === 'ready' && (
        <div className="absolute bottom-3 left-3 right-3">
          <div className="flex items-center gap-3 bg-black/60 backdrop-blur-sm rounded-xl px-3 py-2">

            {bgEffect === 'blur' ? (
              // 블러 모드: 강도 슬라이더
              <>
                <span className="text-xs text-gray-300 whitespace-nowrap">블러 강도</span>
                <span className="text-[10px] text-gray-400">약</span>
                <input
                  type="range" min={1} max={20} step={1}
                  value={blurAmount}
                  onChange={e => setBlurAmount(Number(e.target.value))}
                  className="flex-1 accent-pink-500 cursor-pointer h-1"
                />
                <span className="text-[10px] text-gray-400">강</span>
                <span className="text-xs text-pink-400 font-mono w-5 text-right">{blurAmount}</span>
              </>
            ) : (
              // 단색 모드: 색상 표시 + 경계 부드러움 슬라이더
              <>
                <div
                  className="w-4 h-4 rounded-full border-2 border-white/30 shadow flex-shrink-0"
                  style={{ backgroundColor: frameColor }}
                />
                <span className="text-xs text-gray-300 whitespace-nowrap">경계</span>
                <span className="text-[10px] text-gray-400">선명</span>
                <input
                  type="range" min={0} max={12} step={1}
                  value={featherAmount}
                  onChange={e => setFeatherAmount(Number(e.target.value))}
                  className="flex-1 accent-pink-500 cursor-pointer h-1"
                />
                <span className="text-[10px] text-gray-400">부드럽</span>
                <span className="text-xs text-pink-400 font-mono w-5 text-right">{featherAmount}</span>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  )
})

export default BackgroundBlurCamera
