import { useState } from 'react'
import { Play, Settings } from 'lucide-react'
import { config } from '../config'

// Shot count options — filter to those ≥ selectCount
const ALL_SHOT_OPTIONS = [2, 4, 6, 8]

export default function SetupStep({ defaultSettings, onStart }) {
  const [settings, setSettings] = useState(defaultSettings)

  const handleLayoutChange = (layout) => {
    const newSelectCount = layout.cols * layout.rows
    const validOptions   = ALL_SHOT_OPTIONS.filter(n => n >= newSelectCount)
    const totalShots     = validOptions.includes(settings.totalShots)
      ? settings.totalShots
      : validOptions[0]

    setSettings(s => ({ ...s, layout, selectCount: newSelectCount, totalShots }))
  }

  const shotOptions   = ALL_SHOT_OPTIONS.filter(n => n >= settings.selectCount)
  const totalTimeSec  = settings.totalShots * settings.intervalSeconds
  const minutes       = Math.floor(totalTimeSec / 60)
  const seconds       = totalTimeSec % 60

  return (
    <div className="flex items-center justify-center h-full py-8 px-4 scrollable overflow-y-auto">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-pink-500/10 text-pink-400 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
            <Settings size={14} />
            촬영 설정
          </div>
          <h1 className="text-4xl font-black tracking-tight mb-2">PhotoBooth</h1>
          <p className="text-gray-400 text-sm">설정을 확인하고 촬영을 시작하세요.</p>
        </div>

        {/* Config card */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 space-y-8">

          {/* ── 레이아웃 (visual preview cards) ────────────────────────── */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-4">
              프레임 레이아웃
            </label>
            <div className="grid grid-cols-4 gap-3">
              {config.layouts.map(layout => (
                <FramePreviewCard
                  key={layout.id}
                  layout={layout}
                  active={settings.layout.id === layout.id}
                  onClick={() => handleLayoutChange(layout)}
                />
              ))}
            </div>
          </div>

          {/* ── 총 촬영 횟수 ─────────────────────────────────────────────── */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-3">
              총 촬영 횟수{' '}
              <span className="text-gray-500 font-normal text-xs">
                ({settings.selectCount}컷 중 {settings.selectCount}장 선택)
              </span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {shotOptions.map(n => (
                <button
                  key={n}
                  onClick={() => setSettings(s => ({ ...s, totalShots: n }))}
                  className={`py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    settings.totalShots === n
                      ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/25'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  {n}장
                </button>
              ))}
            </div>
          </div>

          {/* ── 촬영 간격 + 카운트다운 (2-column) ─────────────────────── */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="flex justify-between items-baseline mb-2">
                <label className="text-sm font-semibold text-gray-300">촬영 간격</label>
                <span className="text-pink-400 font-bold text-sm">{settings.intervalSeconds}초</span>
              </div>
              <input
                type="range" min={4} max={15} step={1}
                value={settings.intervalSeconds}
                onChange={e => setSettings(s => ({ ...s, intervalSeconds: Number(e.target.value) }))}
                className="w-full h-2 bg-gray-700 rounded-full appearance-none cursor-pointer accent-pink-500"
              />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>4초</span><span>15초</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-baseline mb-2">
                <label className="text-sm font-semibold text-gray-300">카운트다운</label>
                <span className="text-pink-400 font-bold text-sm">{settings.countdownSeconds}초</span>
              </div>
              <input
                type="range" min={1} max={5} step={1}
                value={settings.countdownSeconds}
                onChange={e => setSettings(s => ({ ...s, countdownSeconds: Number(e.target.value) }))}
                className="w-full h-2 bg-gray-700 rounded-full appearance-none cursor-pointer accent-pink-500"
              />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>1초</span><span>5초</span>
              </div>
            </div>
          </div>

          {/* ── Summary ─────────────────────────────────────────────────── */}
          <div className="bg-gray-800/60 rounded-xl p-3 text-xs text-gray-400 flex items-center justify-between">
            <span>예상 촬영 시간</span>
            <span className="text-white font-semibold">
              약 {minutes > 0 ? `${minutes}분 ` : ''}{seconds}초
            </span>
          </div>
        </div>

        {/* Start button */}
        <button
          onClick={() => onStart(settings)}
          className="w-full mt-5 py-4 bg-pink-500 hover:bg-pink-400 active:scale-95 text-white font-bold text-lg rounded-2xl transition-all shadow-xl shadow-pink-500/20 flex items-center justify-center gap-3"
        >
          <Play size={20} fill="currentColor" />
          촬영 시작
        </button>
      </div>
    </div>
  )
}

// ─── FramePreviewCard ─────────────────────────────────────────────────────────
// Renders a miniature of the actual output frame proportions,
// with photo slots placed exactly as compositePhotos() would draw them.

function FramePreviewCard({ layout, active, onClick }) {
  const { cols, rows } = layout
  const dims = config.frameDimensions[layout.id] || { width: 640, height: 1280 }

  // ── Scale SVG to fit in a 140 × 92 px bounding box ───────────────────────
  const PREVIEW_H = 140
  const MAX_W     = 92
  const aspectRatio = dims.height / dims.width   // H/W (>1 means portrait)

  let svgH = PREVIEW_H
  let svgW = PREVIEW_H / aspectRatio
  if (svgW > MAX_W) {
    svgW = MAX_W
    svgH = MAX_W * aspectRatio
  }

  // ── Photo slot positions in the actual canvas coordinate space ────────────
  const { photoMargin: m, footerHeight: fh } = config
  const W = dims.width
  const H = dims.height
  const photoW = (W - m * (cols + 1)) / cols
  const photoH = (H - fh - m * (rows + 1)) / rows
  const footerY = H - fh

  // ── Colours ───────────────────────────────────────────────────────────────
  const frameBg    = active ? '#2d0a1a'   : '#111827'
  const slotFill   = active ? '#ec4899'   : '#374151'
  const slotOpacity = active ? 0.75 : 1
  const dividerClr = active ? '#9d174d'   : '#1f2937'
  const borderClr  = active ? '#ec4899'   : '#374151'

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-3 py-4 px-2 rounded-2xl border-2 transition-all focus:outline-none ${
        active
          ? 'border-pink-500 bg-pink-950/40 shadow-lg shadow-pink-500/15'
          : 'border-gray-700 bg-gray-800/30 hover:border-gray-500 hover:bg-gray-800/50'
      }`}
    >
      {/* ── Miniature frame ── */}
      <div
        className="flex items-center justify-center"
        style={{ height: PREVIEW_H, width: MAX_W }}
      >
        <svg
          width={svgW}
          height={svgH}
          viewBox={`0 0 ${W} ${H}`}
          style={{ borderRadius: 6, overflow: 'hidden' }}
        >
          {/* Frame background */}
          <rect x="0" y="0" width={W} height={H} fill={frameBg} />

          {/* Photo slots */}
          {Array.from({ length: rows }).flatMap((_, r) =>
            Array.from({ length: cols }).map((_, c) => (
              <rect
                key={`${r}-${c}`}
                x={m + c * (photoW + m)}
                y={m + r * (photoH + m)}
                width={photoW}
                height={photoH}
                rx={20}
                fill={slotFill}
                opacity={slotOpacity}
              />
            ))
          )}

          {/* Footer divider */}
          <rect
            x={m * 2} y={footerY + 8}
            width={W - m * 4} height={6}
            rx={3}
            fill={dividerClr}
          />

          {/* Frame border overlay */}
          <rect
            x="1" y="1" width={W - 2} height={H - 2}
            rx="4" fill="none"
            stroke={borderClr} strokeWidth="6"
          />
        </svg>
      </div>

      {/* ── Label ── */}
      <div className="text-center leading-tight">
        <div className={`text-sm font-bold ${active ? 'text-pink-400' : 'text-gray-300'}`}>
          {layout.label}
        </div>
        <div className="text-xs text-gray-500 mt-0.5">
          {cols * rows}장 선택
        </div>
      </div>
    </button>
  )
}
