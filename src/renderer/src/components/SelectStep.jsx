import { useState, useEffect } from 'react'
import { ArrowLeft, Check, ChevronRight, Palette } from 'lucide-react'
import { config } from '../config'
import { compositePhotos } from '../utils/canvasComposite'

export default function SelectStep({ photos, settings, onComplete, onReshoot }) {
  const { selectCount, layout } = settings

  const [selected,   setSelected]   = useState([])   // ordered indices
  const [frameColor, setFrameColor] = useState(config.frameColors[0])
  const [previewUrl, setPreviewUrl] = useState(null)
  const [composing,  setComposing]  = useState(false)

  // Regenerate preview whenever selection or colour changes
  useEffect(() => {
    if (selected.length < selectCount) {
      setPreviewUrl(null)
      return
    }
    let cancelled = false
    const selectedUrls = selected.map(i => photos[i])
    compositePhotos(selectedUrls, layout, frameColor.value).then(url => {
      if (!cancelled) setPreviewUrl(url)
    })
    return () => { cancelled = true }
  }, [selected, frameColor, layout, photos, selectCount])

  const togglePhoto = (idx) => {
    setSelected(prev => {
      if (prev.includes(idx)) return prev.filter(i => i !== idx)
      if (prev.length >= selectCount) return prev
      return [...prev, idx]
    })
  }

  const handleComplete = async () => {
    if (selected.length < selectCount || composing) return
    setComposing(true)
    const selectedUrls = selected.map(i => photos[i])
    const composite = await compositePhotos(selectedUrls, layout, frameColor.value)
    setComposing(false)
    onComplete(composite)
  }

  return (
    <div className="flex h-full">
      {/* ── Left: photo grid + controls ── */}
      <div className="flex-1 flex flex-col py-6 px-6 gap-5 overflow-y-auto scrollable">
        <div>
          <h2 className="text-lg font-bold">사진 선택</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {selectCount}장을 순서대로 선택하세요.&nbsp;
            <span className="text-pink-400 font-semibold">
              ({selected.length} / {selectCount})
            </span>
          </p>
        </div>

        {/* Photo grid */}
        <div className="grid grid-cols-4 gap-2.5">
          {photos.map((photo, idx) => {
            const selIdx   = selected.indexOf(idx)
            const isSel    = selIdx !== -1
            const isLocked = !isSel && selected.length >= selectCount

            return (
              <button
                key={idx}
                onClick={() => togglePhoto(idx)}
                disabled={isLocked}
                className={`relative aspect-video rounded-xl overflow-hidden transition-all focus:outline-none ${
                  isSel
                    ? 'ring-3 ring-pink-500 ring-offset-2 ring-offset-gray-950'
                    : 'ring-1 ring-gray-700 hover:ring-gray-500'
                } ${isLocked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <img
                  src={photo}
                  alt={`photo ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
                {/* Selection badge */}
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

        {/* Frame colour picker */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Palette size={14} className="text-gray-400" />
            <span className="text-sm font-semibold text-gray-300">프레임 색상</span>
          </div>
          <div className="flex gap-2.5">
            {config.frameColors.map(color => (
              <button
                key={color.id}
                onClick={() => setFrameColor(color)}
                title={color.label}
                className={`w-9 h-9 rounded-full border-2 transition-all ${
                  frameColor.id === color.id
                    ? 'border-pink-500 scale-110 shadow-md shadow-pink-500/30'
                    : 'border-gray-700 hover:border-gray-400'
                }`}
                style={{ backgroundColor: color.value }}
              />
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 mt-auto pt-2">
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

      {/* ── Right: live preview ── */}
      <div className="w-64 flex-shrink-0 border-l border-gray-800 bg-gray-900/40 flex flex-col py-6 px-4">
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
            <div className="text-center text-gray-600 text-sm px-4 leading-relaxed">
              {selectCount}장을 선택하면<br />미리보기가 표시됩니다
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
