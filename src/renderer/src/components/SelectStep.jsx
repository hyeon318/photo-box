import { useState, useEffect } from 'react'
import { ArrowLeft, Check, ChevronRight, SlidersHorizontal } from 'lucide-react'
import { config } from '../config'
import { compositePhotos } from '../utils/canvasComposite'
import { useFrameDesign } from '../hooks/useFrameDesign'
import FilterSelector from './FilterSelector'
import FrameDesignPicker from './FrameDesignPicker'

export default function SelectStep({ photos, settings, onComplete, onReshoot }) {
  const { selectCount, layout } = settings

  // ── 슬롯 비율 계산 ───────────────────────────────────────────────────────────
  const dims           = config.frameDimensions[layout.id] || { width: 640, height: 1920 }
  const slotW          = (dims.width  - config.photoMargin * (layout.cols + 1)) / layout.cols
  const slotH          = (dims.height - config.footerHeight - config.photoMargin * (layout.rows + 1)) / layout.rows
  const photoAspectRatio = `${Math.round(slotW)} / ${Math.round(slotH)}`

  // ── 상태 ─────────────────────────────────────────────────────────────────────
  const [selected,       setSelected]       = useState([])
  const [selectedFilter, setSelectedFilter] = useState(config.photoFilters[0])
  const [previewUrl,     setPreviewUrl]     = useState(null)
  const [composing,      setComposing]      = useState(false)

  // frameDesign: bgEffect(촬영 카메라 설정)와 완전히 독립된 프레임 디자인 상태
  const { frameDesign, setType, setColor, setPattern } = useFrameDesign(
    settings.frameColor?.value ?? config.frameColors[0].value
  )

  // ── 실시간 합성 미리보기 ─────────────────────────────────────────────────────
  useEffect(() => {
    if (selected.length < selectCount) { setPreviewUrl(null); return }

    let cancelled = false
    const urls = selected.map(i => photos[i])
    compositePhotos(urls, layout, frameDesign, selectedFilter.filter).then(url => {
      if (!cancelled) setPreviewUrl(url)
    })
    return () => { cancelled = true }
  }, [selected, frameDesign, selectedFilter, layout, photos, selectCount])

  // ── 사진 선택 토글 ───────────────────────────────────────────────────────────
  const togglePhoto = (idx) => {
    setSelected(prev => {
      if (prev.includes(idx)) return prev.filter(i => i !== idx)
      if (prev.length >= selectCount) return prev
      return [...prev, idx]
    })
  }

  // ── 최종 합성 & 완료 ─────────────────────────────────────────────────────────
  const handleComplete = async () => {
    if (selected.length < selectCount || composing) return
    setComposing(true)
    const urls      = selected.map(i => photos[i])
    const composite = await compositePhotos(urls, layout, frameDesign, selectedFilter.filter)
    setComposing(false)
    onComplete(composite)
  }

  // 블러 미리보기용 — 첫 번째 선택 사진 (없으면 첫 번째 촬영 사진)
  const blurPreviewPhoto = photos[selected[0]] ?? photos[0] ?? null

  return (
    <div className="flex h-full">
      {/* ── 좌측: 사진 그리드 + 옵션 패널 ───────────────────────────────── */}
      <div className="flex-1 flex flex-col py-5 px-6 gap-4 overflow-y-auto scrollable min-w-0">

        {/* 헤더 */}
        <div>
          <h2 className="text-lg font-bold">사진 선택</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {selectCount}장을 순서대로 선택하세요.&nbsp;
            <span className="text-pink-400 font-semibold">({selected.length} / {selectCount})</span>
          </p>
        </div>

        {/* 사진 그리드 */}
        <div className="grid grid-cols-4 gap-2">
          {photos.map((photo, idx) => {
            const selIdx   = selected.indexOf(idx)
            const isSel    = selIdx !== -1
            const isLocked = !isSel && selected.length >= selectCount

            return (
              <button
                key={idx}
                onClick={() => togglePhoto(idx)}
                disabled={isLocked}
                className={`relative rounded-xl overflow-hidden transition-all focus:outline-none ${
                  isSel
                    ? 'ring-[3px] ring-pink-500 ring-offset-2 ring-offset-gray-950'
                    : 'ring-1 ring-gray-700 hover:ring-gray-500'
                } ${isLocked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                style={{ aspectRatio: photoAspectRatio }}
              >
                <img
                  src={photo}
                  alt={`shot ${idx + 1}`}
                  className="w-full h-full object-cover transition-[filter] duration-200"
                  style={{ filter: selectedFilter.id !== 'original' ? selectedFilter.filter : undefined }}
                />
                {isSel && (
                  <div className="absolute inset-0 bg-pink-500/20 flex items-start justify-start p-1.5">
                    <div className="bg-pink-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow">
                      {selIdx + 1}
                    </div>
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* 구분선 */}
        <div className="border-t border-gray-800" />

        {/* 보정 필터 */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <SlidersHorizontal size={13} className="text-gray-400" />
            <span className="text-sm font-semibold text-gray-300">보정 필터</span>
            {selectedFilter.id !== 'original' && (
              <span className="ml-auto text-xs text-pink-400">{selectedFilter.label}</span>
            )}
          </div>
          <FilterSelector selected={selectedFilter} onChange={setSelectedFilter} />
        </div>

        {/* 구분선 */}
        <div className="border-t border-gray-800" />

        {/* 프레임 디자인 — bgEffect 와 완전히 독립 */}
        <FrameDesignPicker
          frameDesign={frameDesign}
          setType={setType}
          setColor={setColor}
          setPattern={setPattern}
          previewPhoto={blurPreviewPhoto}
        />

        {/* 액션 버튼 */}
        <div className="flex gap-3 mt-auto pt-1">
          <button
            onClick={onReshoot}
            className="flex items-center gap-2 px-5 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm font-medium transition-colors"
          >
            <ArrowLeft size={15} />
            다시 촬영
          </button>
          <button
            onClick={handleComplete}
            disabled={selected.length < selectCount || composing}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-pink-500 hover:bg-pink-400 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all"
          >
            <Check size={17} />
            {composing ? '합성 중...' : '합성하기'}
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* ── 우측: 실시간 미리보기 ────────────────────────────────────────── */}
      <div className="w-60 flex-shrink-0 border-l border-gray-800 bg-gray-900/40 flex flex-col py-5 px-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          미리보기
        </h3>

        <div className="flex-1 flex items-center justify-center">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="composite preview"
              className="w-full rounded-xl shadow-lg"
            />
          ) : (
            <p className="text-center text-gray-600 text-sm px-4 leading-relaxed">
              {selectCount}장을 선택하면<br />미리보기가 표시됩니다
            </p>
          )}
        </div>

        {/* 현재 디자인 요약 */}
        {previewUrl && (
          <div className="mt-3 text-[11px] text-gray-500 space-y-0.5">
            <div className="flex justify-between">
              <span>프레임</span>
              <span className="text-gray-400">
                {config.frameDesignTypes.find(t => t.id === frameDesign.type)?.label}
                {frameDesign.type === 'pattern' && frameDesign.patternId && (
                  <> · {config.framePatterns.find(p => p.id === frameDesign.patternId)?.label}</>
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span>필터</span>
              <span className="text-gray-400">{selectedFilter.label}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
