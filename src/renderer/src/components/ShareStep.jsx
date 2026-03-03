import { useState } from 'react'
import { Download, RotateCcw, Folder, CheckCircle, XCircle } from 'lucide-react'
import ShareButton from './ShareButton'

export default function ShareStep({ compositeImage, location, onRestart }) {
  const [saveState, setSaveState] = useState('idle') // idle|saving|saved|error
  const [savedPath, setSavedPath] = useState(null)

  // ── 로컬 저장 ────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (saveState === 'saving' || saveState === 'saved') return
    setSaveState('saving')
    try {
      const filename = `photobooth_${Date.now()}.jpg`
      const result = await window.electronAPI.savePhoto({ dataUrl: compositeImage, filename, location })
      if (result.success) {
        setSaveState('saved')
        setSavedPath(result.path)
      } else {
        throw new Error(result.error)
      }
    } catch {
      setSaveState('error')
    }
  }

  return (
    <div className="flex items-center justify-center h-full py-8 px-6">
      <div className="w-full max-w-3xl">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-green-500/10 rounded-full mb-4">
            <CheckCircle size={28} className="text-green-400" />
          </div>
          <h2 className="text-2xl font-black">완성!</h2>
          <p className="text-gray-400 text-sm mt-1">저장하거나 공유해보세요.</p>
        </div>

        <div className="flex gap-8 items-start">
          {/* Composite preview */}
          <div className="w-64 flex-shrink-0">
            <div className="bg-gray-900 rounded-2xl overflow-hidden border border-gray-800 shadow-2xl">
              {compositeImage && (
                <img src={compositeImage} alt="composite" className="w-full object-contain" />
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex-1 space-y-3">

            {/* ── 저장 상태 배너 ── */}
            {saveState === 'saved' && (
              <div className="flex items-start gap-3 bg-green-900/25 border border-green-800/60 rounded-xl p-3.5 text-sm text-green-400">
                <CheckCircle size={15} className="mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold leading-tight">저장 완료</p>
                  <p className="text-green-500/60 text-xs mt-0.5 break-all">{savedPath}</p>
                </div>
              </div>
            )}
            {saveState === 'error' && (
              <div className="flex items-center gap-2 bg-red-900/25 border border-red-800/60 rounded-xl p-3.5 text-sm text-red-400">
                <XCircle size={15} className="flex-shrink-0" />
                저장에 실패했습니다. 다시 시도해주세요.
              </div>
            )}

            {/* ── 공유하기 — ShareButton이 전략(native→clipboard→download)을 자동 선택 ── */}
            <ShareButton dataUrl={compositeImage} />

            {/* ── 파일로 저장 ── */}
            <button
              onClick={handleSave}
              disabled={saveState === 'saving' || saveState === 'saved'}
              className="w-full flex items-center justify-center gap-2.5 py-4 bg-gray-800 hover:bg-gray-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all"
            >
              <Download size={19} />
              {saveState === 'saving' ? '저장 중...' : saveState === 'saved' ? '저장됨 ✓' : '파일로 저장'}
            </button>

            {/* ── 폴더 열기 (저장 후 표시) ── */}
            {saveState === 'saved' && (
              <button
                onClick={() => window.electronAPI.openFolder()}
                className="w-full flex items-center justify-center gap-2 py-3 bg-transparent hover:bg-gray-800/60 text-gray-500 hover:text-gray-300 text-sm rounded-xl border border-gray-800 transition-all"
              >
                <Folder size={15} />
                저장 폴더 열기
              </button>
            )}

            <div className="border-t border-gray-800 pt-3">
              <button
                onClick={onRestart}
                className="w-full flex items-center justify-center gap-2 py-3 text-gray-500 hover:text-white text-sm transition-colors"
              >
                <RotateCcw size={15} />
                처음으로 돌아가기
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
