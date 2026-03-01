/**
 * ShareButton.jsx
 *
 * 공유 전략 (우선순위 순):
 *  1. navigator.share({ files }) — Web Share API
 *       · macOS Electron: NSSharingService 호출 → 카카오톡, AirDrop 등 정상 동작
 *       · Windows (.exe):  WinRT 컨텍스트 없음 → canShare() === false → 다음 단계
 *       · Windows (MSIX):  패키징 후 Windows 앱 ID가 있으면 동작
 *  2. window.electronAPI.copyToClipboard() — IPC 클립보드 복사
 *       · 모든 Electron 환경에서 항상 동작
 *       · 사용자가 카카오톡 채팅창에서 Ctrl+V 로 붙여넣기
 *  3. <a download> — 브라우저/개발 환경 폴백
 *
 * 사용법:
 *   <ShareButton canvasRef={canvasRef} />         // canvas 직접 참조
 *   <ShareButton dataUrl={compositeImage} />       // dataURL 문자열
 */

import { useState, useCallback } from 'react'
import { Share2, Check, Loader2, Copy, AlertCircle } from 'lucide-react'

// ─── Canvas / DataURL → File 변환 ────────────────────────────────────────────

/**
 * HTMLCanvasElement → PNG File
 * canvas.toBlob() 은 비동기라 Promise로 래핑한다.
 * quality=1.0 으로 무손실 최고 품질 유지.
 */
function canvasToFile(canvas, filename) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('canvas.toBlob() 이 null을 반환했습니다'))
        resolve(new File([blob], filename, { type: 'image/png', lastModified: Date.now() }))
      },
      'image/png',
      1.0
    )
  })
}

/**
 * dataURL → PNG File
 * fetch() 를 이용해 dataURL을 Blob으로 변환한 뒤 File로 감싼다.
 */
async function dataUrlToFile(dataUrl, filename) {
  const res  = await fetch(dataUrl)
  const blob = await res.blob()
  return new File([blob], filename, { type: 'image/png', lastModified: Date.now() })
}

/**
 * File → dataURL (클립보드 IPC 폴백에서 사용)
 */
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = (e) => resolve(e.target.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ─── 핵심 공유 함수 ───────────────────────────────────────────────────────────

/**
 * @typedef {'native-share' | 'clipboard' | 'download'} ShareMethod
 *
 * @param {File} file - 공유할 PNG File 객체
 * @returns {Promise<ShareMethod>} 실제로 사용된 공유 방식
 *
 * [Electron webPreferences 체크리스트]
 * - contextIsolation: true   → preload.js의 contextBridge 정상 동작에 필수
 * - nodeIntegration: false   → 보안; IPC로만 Node 접근
 * - (구버전 Electron < 20 한정) enableBlinkFeatures: 'WebShare'
 *   → Electron 20+ (Chromium 104+) 부터는 기본 활성화되어 불필요
 *
 * [Windows에서 navigator.share가 안 되는 이유]
 * Web Share API의 파일 공유는 내부적으로 WinRT DataTransferManager를 사용한다.
 * DataTransferManager.GetForCurrentView() 는 HWND가 아닌 CoreWindow에 바인딩되어 있어서
 * 일반 Win32(.exe) 기반 Electron 앱에서는 호출이 차단된다.
 * MSIX 패키징(.msix)을 통해 Windows 앱 ID를 부여하면 이 제한이 해제된다.
 */
async function shareImageFile(file) {
  // ── 1단계: Web Share API (파일 공유 가능 여부 먼저 체크) ─────────────────
  if (typeof navigator.share === 'function') {
    const canShare = navigator.canShare?.({ files: [file] }) ?? false

    if (canShare) {
      // ✅ macOS, MSIX Windows: 네이티브 공유 시트 호출
      await navigator.share({
        files: [file],
        title: 'PhotoBooth 사진',
        // text 는 파일 공유 시 일부 앱에서 무시되므로 생략
      })
      return 'native-share'
    }
    // canShare === false → Windows 일반 앱. 다음 단계로.
  }

  // ── 2단계: Electron 클립보드 IPC (항상 동작) ─────────────────────────────
  if (typeof window.electronAPI?.copyToClipboard === 'function') {
    const dataUrl = await fileToDataUrl(file)
    const result  = await window.electronAPI.copyToClipboard(dataUrl)
    if (result?.success) return 'clipboard'
  }

  // ── 3단계: <a download> 폴백 (브라우저/개발 환경) ────────────────────────
  const objectUrl = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(objectUrl)
  return 'download'
}

// ─── React 컴포넌트 ───────────────────────────────────────────────────────────

/**
 * @param {{
 *   canvasRef?: React.RefObject<HTMLCanvasElement>,
 *   dataUrl?:   string,
 *   filename?:  string,
 *   className?: string,
 * }} props
 */
export default function ShareButton({
  canvasRef,
  dataUrl,
  filename = `photobooth_${new Date().toISOString().slice(0, 10)}.png`,
  className = '',
}) {
  // 'idle' | 'loading' | 'native' | 'clipboard' | 'download' | 'error'
  const [state, setState] = useState('idle')

  const handleShare = useCallback(async () => {
    if (state === 'loading') return
    setState('loading')

    try {
      // ── 소스에서 File 생성 ──────────────────────────────────────────────
      let file
      if (canvasRef?.current) {
        file = await canvasToFile(canvasRef.current, filename)
      } else if (dataUrl) {
        file = await dataUrlToFile(dataUrl, filename)
      } else {
        throw new Error('canvasRef 또는 dataUrl prop이 필요합니다')
      }

      // ── 공유 실행 ──────────────────────────────────────────────────────
      const method = await shareImageFile(file)

      // 결과 상태 반영
      setState(method === 'native-share' ? 'native' : method)
      setTimeout(() => setState('idle'), method === 'clipboard' ? 5000 : 3000)

    } catch (err) {
      if (err.name === 'AbortError') {
        // 사용자가 공유 시트를 닫음 — 정상적인 취소, 에러 아님
        setState('idle')
        return
      }
      console.error('[ShareButton]', err)
      setState('error')
      setTimeout(() => setState('idle'), 3000)
    }
  }, [state, canvasRef, dataUrl, filename])

  // ── 버튼 렌더 ──────────────────────────────────────────────────────────────
  const isLoading = state === 'loading'
  const isDone    = state === 'native' || state === 'clipboard' || state === 'download'
  const isError   = state === 'error'

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {/* 공유 버튼 */}
      <button
        onClick={handleShare}
        disabled={isLoading || isDone}
        className={`
          w-full flex items-center justify-center gap-2.5
          py-4 rounded-xl font-bold text-base
          transition-all duration-200 active:scale-95
          disabled:cursor-not-allowed
          ${isDone
            ? state === 'clipboard'
              ? 'bg-emerald-600 text-white'
              : 'bg-emerald-500 text-white'
            : isError
              ? 'bg-red-600/80 text-white'
              : 'bg-pink-500 hover:bg-pink-400 text-white shadow-lg shadow-pink-500/25'
          }
          ${isLoading ? 'opacity-70' : ''}
        `}
      >
        {isLoading && <Loader2 size={19} className="animate-spin" />}
        {isDone     && <Check   size={19} />}
        {isError    && <AlertCircle size={19} />}
        {!isLoading && !isDone && !isError && <Share2 size={19} />}

        <span>
          {isLoading   ? '준비 중...'
           : state === 'native'     ? '공유 완료!'
           : state === 'clipboard'  ? '클립보드에 복사됨'
           : state === 'download'   ? '파일 저장됨'
           : isError                ? '공유 실패'
           : '공유하기'}
        </span>
      </button>

      {/* 클립보드 폴백 안내 (Windows에서 표시) */}
      {state === 'clipboard' && <ClipboardGuide />}

      {/* 에러 안내 */}
      {isError && (
        <p className="text-center text-xs text-red-400 px-2">
          공유 중 오류가 발생했습니다. 다시 시도해주세요.
        </p>
      )}
    </div>
  )
}

// ─── 클립보드 안내 배너 ───────────────────────────────────────────────────────

function ClipboardGuide() {
  return (
    <div className="bg-emerald-900/30 border border-emerald-700/50 rounded-xl p-4">
      <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm mb-2">
        <Copy size={14} />
        이미지가 클립보드에 복사됐습니다
      </div>
      <ol className="text-xs text-emerald-500/80 space-y-1.5 list-decimal list-inside">
        <li>
          카카오톡, 슬랙 등 원하는 앱을 엽니다
        </li>
        <li>
          채팅 입력창을 클릭한 뒤{' '}
          <kbd className="bg-emerald-900/60 border border-emerald-700/50 px-1.5 py-0.5 rounded font-mono text-emerald-300">
            Ctrl+V
          </kbd>
          {' '}를 누릅니다
        </li>
      </ol>
      <p className="text-xs text-emerald-600/60 mt-3 leading-relaxed">
        * Windows 환경에서는 OS 공유 시트 대신 클립보드를 사용합니다.
        <br />
        MSIX 패키징 빌드에서는 네이티브 공유 시트가 활성화됩니다.
      </p>
    </div>
  )
}
