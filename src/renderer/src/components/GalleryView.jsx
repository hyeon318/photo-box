import { useEffect, useState, useCallback } from 'react'
import { ArrowLeft, Folder, ImageOff, X, Share2, ExternalLink, RefreshCw, Check } from 'lucide-react'

export default function GalleryView({ onBack }) {
  const [grouped,     setGrouped]     = useState({})
  const [loading,     setLoading]     = useState(true)
  const [lightbox,    setLightbox]    = useState(null)
  const [copySuccess, setCopySuccess] = useState(false) // 클립보드 복사 피드백

  const loadPhotos = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.electronAPI.getPhotos()
      if (result.success) setGrouped(result.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadPhotos() }, [loadPhotos])

  // Electron에서 navigator.share 미지원 → 클립보드 복사로 대체
  const handleShare = async (dataUrl) => {
    try {
      const result = await window.electronAPI.copyToClipboard(dataUrl)
      if (result.success) {
        setCopySuccess(true)
        setTimeout(() => setCopySuccess(false), 3000)
      }
    } catch (err) {
      console.error('Share failed:', err)
    }
  }

  const dates = Object.keys(grouped)

  return (
    <div className="flex flex-col h-full">
      {/* Sub-header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft size={17} />
          </button>
          <div>
            <h2 className="font-bold text-base leading-tight">앨범</h2>
            <p className="text-xs text-gray-500">
              {dates.length > 0 ? `${dates.length}일의 추억` : '저장된 사진 없음'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadPhotos}
            disabled={loading}
            className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
            title="새로고침"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => window.electronAPI.openFolder()}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-gray-800"
          >
            <Folder size={15} />
            폴더 열기
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollable px-6 py-5">
        {loading ? (
          <div className="flex items-center justify-center py-28 text-gray-500 text-sm gap-2">
            <RefreshCw size={16} className="animate-spin" />
            불러오는 중...
          </div>
        ) : dates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 text-gray-600">
            <ImageOff size={52} className="mb-4 opacity-40" />
            <p className="font-medium text-gray-500">저장된 사진이 없습니다</p>
            <p className="text-sm mt-1.5">촬영 후 저장하면 여기에 날짜별로 표시됩니다.</p>
          </div>
        ) : (
          <div className="space-y-9">
            {dates.map(date => (
              <section key={date}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="bg-gray-800 text-sm font-semibold px-3 py-1 rounded-full">
                    {formatKoreanDate(date)}
                  </span>
                  <span className="text-xs text-gray-600">{grouped[date].length}장</span>
                </div>

                <div className="grid grid-cols-5 gap-2.5">
                  {grouped[date].map(photo => (
                    <button
                      key={photo.filename}
                      onClick={() => setLightbox(photo)}
                      className="aspect-[3/4] bg-gray-900 rounded-xl overflow-hidden hover:ring-2 hover:ring-pink-500 hover:scale-[1.02] transition-all"
                    >
                      <img
                        src={photo.dataUrl}
                        alt={photo.filename}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {/* ── Lightbox ── */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/92 z-50 flex items-center justify-center p-8"
          onClick={() => setLightbox(null)}
        >
          <div
            className="relative max-w-xs w-full"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setLightbox(null)}
              className="absolute -top-10 right-0 text-gray-400 hover:text-white transition-colors"
            >
              <X size={22} />
            </button>

            <img
              src={lightbox.dataUrl}
              alt=""
              className="w-full rounded-2xl shadow-2xl"
            />

            <p className="text-center text-xs text-gray-500 mt-3">
              {formatKoreanDate(lightbox.date)} · {lightbox.filename}
            </p>

            {/* 클립보드 복사 성공 안내 */}
            {copySuccess && (
              <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-emerald-400 bg-emerald-900/30 border border-emerald-700/50 rounded-lg py-2">
                <Check size={13} />
                클립보드에 복사됨 — Ctrl+V로 붙여넣기 하세요
              </div>
            )}

            <div className="flex gap-2 mt-3">
              <button
                onClick={() => handleShare(lightbox.dataUrl)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 font-semibold rounded-xl transition-all active:scale-95 ${
                  copySuccess
                    ? 'bg-emerald-600 text-white'
                    : 'bg-pink-500 hover:bg-pink-400 text-white'
                }`}
              >
                {copySuccess ? <Check size={17} /> : <Share2 size={17} />}
                {copySuccess ? '복사됨' : '공유하기'}
              </button>
              <button
                onClick={() => window.electronAPI.openFile(lightbox.path)}
                title="파일 열기"
                className="flex items-center gap-2 px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl transition-all"
              >
                <ExternalLink size={17} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function formatKoreanDate(dateStr) {
  const [y, m, d] = dateStr.split('-')
  return `${y}년 ${parseInt(m)}월 ${parseInt(d)}일`
}
