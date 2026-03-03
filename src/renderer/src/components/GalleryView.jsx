import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  ArrowLeft, Folder, ImageOff, X,
  Share2, ExternalLink, RefreshCw, Check,
  ChevronLeft, ChevronRight, Trash2, MapPin,
} from 'lucide-react'
import piexif from 'piexifjs'

// EXIF rational DMS → 소수점 좌표 변환
function extractGps(dataUrl) {
  try {
    const exif = piexif.load(dataUrl)
    const gps  = exif?.GPS
    if (!gps) return null

    const lat = gps[piexif.GPSIFD.GPSLatitude]
    const latRef = gps[piexif.GPSIFD.GPSLatitudeRef]
    const lng = gps[piexif.GPSIFD.GPSLongitude]
    const lngRef = gps[piexif.GPSIFD.GPSLongitudeRef]
    if (!lat || !lng) return null

    const toDecimal = (r, ref) => {
      const v = r[0][0]/r[0][1] + r[1][0]/r[1][1]/60 + r[2][0]/r[2][1]/3600
      return (ref === 'S' || ref === 'W') ? -v : v
    }
    return { lat: toDecimal(lat, latRef), lng: toDecimal(lng, lngRef) }
  } catch {
    return null
  }
}

export default function GalleryView({ onBack }) {
  const [grouped,       setGrouped]       = useState({})
  const [loading,       setLoading]       = useState(true)
  const [lightbox,      setLightbox]      = useState(null)   // 현재 상세보기 사진
  const [lightboxGps,   setLightboxGps]   = useState(null)   // 라이트박스 GPS 정보
  const [copySuccess,   setCopySuccess]   = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)  // 삭제 2단계 확인

  // ── 데이터 로드 ──────────────────────────────────────────────────────────────
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

  // ── 모든 사진 평탄화 (날짜 최신순 → 파일명 순) ──────────────────────────────
  const allPhotos = useMemo(() => Object.values(grouped).flat(), [grouped])

  const lightboxIdx = useMemo(
    () => lightbox
      ? allPhotos.findIndex(p => p.filename === lightbox.filename && p.date === lightbox.date)
      : -1,
    [lightbox, allPhotos]
  )

  const hasPrev = lightboxIdx > 0
  const hasNext = lightboxIdx < allPhotos.length - 1

  // ── 라이트박스 열기 / 닫기 ──────────────────────────────────────────────────
  const openLightbox = (photo) => {
    setLightbox(photo)
    setConfirmDelete(false)
    setLightboxGps(extractGps(photo.dataUrl))
  }
  const closeLightbox = () => { setLightbox(null); setLightboxGps(null); setConfirmDelete(false) }

  // ── 이전 / 다음 탐색 ─────────────────────────────────────────────────────────
  const goPrev = useCallback(() => {
    if (hasPrev) { openLightbox(allPhotos[lightboxIdx - 1]) }
  }, [hasPrev, lightboxIdx, allPhotos])

  const goNext = useCallback(() => {
    if (hasNext) { openLightbox(allPhotos[lightboxIdx + 1]) }
  }, [hasNext, lightboxIdx, allPhotos])

  // ── 키보드 이벤트 ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!lightbox) return
    const onKey = (e) => {
      if (e.key === 'ArrowLeft')  goPrev()
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'Escape')     closeLightbox()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox, goPrev, goNext])

  // ── 공유 (클립보드 복사) ────────────────────────────────────────────────────
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

  // ── 삭제 ─────────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!lightbox) return

    // 삭제 후 이동할 사진 미리 계산 (상태 업데이트 전)
    const remaining = allPhotos.filter(
      p => !(p.filename === lightbox.filename && p.date === lightbox.date)
    )
    const nextPhoto = remaining[lightboxIdx] ?? remaining[lightboxIdx - 1] ?? null

    const result = await window.electronAPI.deletePhoto(lightbox.path)
    if (!result.success) { console.error('Delete failed:', result.error); return }

    // grouped 상태에서 제거
    setGrouped(prev => {
      const updated = { ...prev }
      updated[lightbox.date] = (updated[lightbox.date] || [])
        .filter(p => p.filename !== lightbox.filename)
      if (updated[lightbox.date].length === 0) delete updated[lightbox.date]
      return updated
    })

    setConfirmDelete(false)
    setLightbox(nextPhoto)
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
                      onClick={() => openLightbox(photo)}
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

      {/* ── Lightbox ─────────────────────────────────────────────────────────── */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/92 z-50 flex items-center justify-center p-6"
          onClick={closeLightbox}
        >
          {/* 전체 레이아웃: 화살표 + 이미지 패널 */}
          <div
            className="flex items-center gap-3 max-h-full"
            onClick={e => e.stopPropagation()}
          >
            {/* ← 이전 버튼 */}
            <button
              onClick={goPrev}
              disabled={!hasPrev}
              className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
              title="이전 사진 (←)"
            >
              <ChevronLeft size={22} />
            </button>

            {/* 이미지 패널 */}
            <div className="relative flex flex-col items-center w-72">
              {/* 닫기 + 카운터 */}
              <div className="flex items-center justify-between w-full mb-2.5">
                <span className="text-xs text-gray-500 tabular-nums">
                  {lightboxIdx + 1} / {allPhotos.length}
                </span>
                <button
                  onClick={closeLightbox}
                  className="text-gray-400 hover:text-white transition-colors"
                  title="닫기 (Esc)"
                >
                  <X size={20} />
                </button>
              </div>

              {/* 사진 */}
              <img
                key={lightbox.filename}
                src={lightbox.dataUrl}
                alt=""
                className="w-full rounded-2xl shadow-2xl"
              />

              {/* 파일 정보 */}
              <p className="text-center text-xs text-gray-500 mt-2.5">
                {formatKoreanDate(lightbox.date)}&nbsp;·&nbsp;{lightbox.filename}
              </p>

              {/* GPS 정보 */}
              {lightboxGps && (
                <a
                  href={`https://www.google.com/maps?q=${lightboxGps.lat},${lightboxGps.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1.5 w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-gray-800/80 hover:bg-gray-700 text-xs text-gray-400 hover:text-white transition-colors"
                >
                  <MapPin size={12} className="text-pink-400 flex-shrink-0" />
                  <span className="tabular-nums">
                    {lightboxGps.lat.toFixed(5)}, {lightboxGps.lng.toFixed(5)}
                  </span>
                  <ExternalLink size={11} className="ml-auto flex-shrink-0 opacity-50" />
                </a>
              )}

              {/* 클립보드 복사 성공 안내 */}
              {copySuccess && (
                <div className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs text-emerald-400 bg-emerald-900/30 border border-emerald-700/50 rounded-lg py-2">
                  <Check size={13} />
                  클립보드에 복사됨 — Ctrl+V로 붙여넣기 하세요
                </div>
              )}

              {/* 액션 버튼 행 */}
              <div className="flex gap-2 mt-2.5 w-full">
                {/* 공유 */}
                <button
                  onClick={() => handleShare(lightbox.dataUrl)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold rounded-xl transition-all active:scale-95 ${
                    copySuccess
                      ? 'bg-emerald-600 text-white'
                      : 'bg-pink-500 hover:bg-pink-400 text-white'
                  }`}
                >
                  {copySuccess ? <Check size={15} /> : <Share2 size={15} />}
                  {copySuccess ? '복사됨' : '공유'}
                </button>

                {/* 파일 열기 */}
                <button
                  onClick={() => window.electronAPI.openFile(lightbox.path)}
                  title="파일 열기"
                  className="px-3 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-xl transition-all"
                >
                  <ExternalLink size={15} />
                </button>

                {/* 삭제 — 2단계 확인 */}
                {confirmDelete ? (
                  <>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="px-3 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm transition-all"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleDelete}
                      className="px-3 py-2.5 bg-red-600 hover:bg-red-500 rounded-xl text-sm font-semibold transition-all active:scale-95"
                    >
                      삭제
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    title="삭제"
                    className="px-3 py-2.5 bg-gray-800 hover:bg-red-900/60 hover:text-red-400 text-gray-400 rounded-xl transition-all"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>

            {/* → 다음 버튼 */}
            <button
              onClick={goNext}
              disabled={!hasNext}
              className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
              title="다음 사진 (→)"
            >
              <ChevronRight size={22} />
            </button>
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
