import { X } from 'lucide-react'
import { config } from '../config'
import { usePhotoBooth } from '../hooks/usePhotoBooth'
import FilterSelector from './FilterSelector'

// ─── Layout geometry ──────────────────────────────────────────────────────────

/** config 레이아웃에서 단일 슬롯의 CSS aspect-ratio 문자열 반환 */
function slotAspectRatio(layout) {
  const { cols, rows } = layout
  const dims = config.frameDimensions[layout.id]
  const { photoMargin, footerHeight } = config
  const photoW = (dims.width  - photoMargin * (cols + 1)) / cols
  const photoH = (dims.height - footerHeight - photoMargin * (rows + 1)) / rows
  return `${Math.round(photoW)} / ${Math.round(photoH)}`
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * CameraView
 *
 * 최적화 아키텍처:
 *  ┌─────────────────────────────────────────┐
 *  │  <video>  ← getUserMedia (1080p 원본)   │  (hidden)
 *  │  <canvas previewCanvasRef>              │  RAF: mirror + center-crop + 1280px 상한
 *  │    style.filter = selectedFilter.filter │  ← GPU CSS filter (실시간, 가벼움)
 *  │  <canvas captureCanvasRef>              │  (hidden) 촬영 시 ctx.filter 픽셀 합성
 *  └─────────────────────────────────────────┘
 */
export default function CameraView({ settings, onComplete, onCancel }) {
  const {
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
  } = usePhotoBooth({ settings, onComplete, onCancel })

  const { totalShots, layout } = settings
  const aspectRatio = slotAspectRatio(layout)

  return (
    <div className="flex flex-col items-center justify-center h-full py-6 px-6">
      {/* 셔터 플래시 */}
      {isFlashing && (
        <div className="fixed inset-0 bg-white z-50 pointer-events-none" />
      )}

      <div className="w-full max-w-5xl grid grid-cols-3 gap-6">

        {/* ── 카메라 미리보기 (2/3) ─────────────────────────────────────── */}
        <div className="col-span-2 flex flex-col gap-3">
          <div
            className="relative rounded-2xl overflow-hidden bg-gray-900 shadow-2xl"
            style={{ aspectRatio }}
          >
            {/* 숨김 비디오 소스 */}
            <video ref={videoRef} autoPlay playsInline muted className="hidden" />

            {/*
              미리보기 캔버스
              - RAF 루프: mirror + center-crop (ctx.filter 없음)
              - CSS filter → GPU 가속, 프레임당 추가 연산 0
            */}
            <canvas
              ref={previewCanvasRef}
              className="w-full h-full"
              style={{
                filter: selectedFilter.id !== 'original' ? selectedFilter.filter : undefined,
                imageRendering: 'auto',
              }}
            />

            {/* 카운트다운 */}
            {countdown !== null && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div
                  key={countdown}
                  className="text-[10rem] font-black text-white leading-none
                             drop-shadow-[0_0_40px_rgba(236,72,153,0.8)]
                             animate-countdown-pop"
                >
                  {countdown}
                </div>
              </div>
            )}

            {/* 완료 오버레이 */}
            {phase === 'done' && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center pointer-events-none">
                <span className="text-3xl font-bold text-white">✓ 촬영 완료</span>
              </div>
            )}

            {/* 진행 바 */}
            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gray-800/70 pointer-events-none">
              <div
                className="h-full bg-pink-500 transition-all duration-500 ease-out"
                style={{ width: `${(shotCount / totalShots) * 100}%` }}
              />
            </div>
          </div>

          {/* 상태 / 취소 행 */}
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

          {/* 필터 선택기 */}
          <FilterSelector
            filters={config.photoFilters}
            selected={selectedFilter}
            onChange={setSelectedFilter}
          />
        </div>

        {/* ── 썸네일 스트립 (1/3) ──────────────────────────────────────── */}
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            촬영된 사진
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: totalShots }).map((_, i) => (
              <div
                key={i}
                className={`rounded-lg overflow-hidden transition-all ${
                  photos[i] ? 'ring-1 ring-pink-500/40' : 'bg-gray-800/60'
                }`}
                style={{ aspectRatio }}
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

      {/* 캡처 전용 숨김 캔버스 — ctx.filter 픽셀 합성용 */}
      <canvas ref={captureCanvasRef} className="hidden" />
    </div>
  )
}
