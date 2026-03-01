import { useEffect, useState } from 'react'
import { Camera } from 'lucide-react'
import { preloadSeg } from '../utils/selfieSegSingleton'

/**
 * IntroScreen
 *
 * 앱 최초 진입 시 표시되는 인트로 화면.
 * 마운트 즉시 MediaPipe WASM 모델을 백그라운드에서 로드합니다.
 * 로딩 완료 후 "시작하기" 버튼이 활성화됩니다.
 *
 * Props:
 *   onReady : () => void  — 사용자가 시작하기를 누를 때 호출
 */
export default function IntroScreen({ onReady }) {
  const [loadState, setLoadState] = useState('loading') // 'loading' | 'ready' | 'error'
  const [errorMsg,  setErrorMsg]  = useState('')

  useEffect(() => {
    preloadSeg()
      .then(() => setLoadState('ready'))
      .catch(err => {
        console.error('[IntroScreen] preloadSeg failed:', err)
        setErrorMsg(err?.message ?? String(err))
        setLoadState('error')
      })
  }, [])

  return (
    <div className="flex flex-col items-center justify-center h-full gap-10">
      {/* Logo */}
      <div className="flex flex-col items-center gap-4">
        <div className="w-20 h-20 rounded-3xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center shadow-2xl shadow-pink-500/10">
          <Camera size={40} className="text-pink-400" />
        </div>
        <div className="text-center">
          <h1 className="text-5xl font-black tracking-tight text-white">PhotoBooth</h1>
          <p className="text-gray-500 text-sm mt-2">인생네컷 스타일 포토부스</p>
        </div>
      </div>

      {/* Status */}
      <div className="flex flex-col items-center gap-3 min-h-[56px] justify-center">
        {loadState === 'loading' && (
          <>
            <div className="w-6 h-6 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400">AI 모델 초기화 중…</p>
            <p className="text-xs text-gray-600">처음 실행 시 잠시 시간이 걸릴 수 있습니다.</p>
          </>
        )}

        {loadState === 'error' && (
          <>
            <p className="text-sm text-yellow-400">AI 모델 로드에 실패했습니다.</p>
            {errorMsg && (
              <p className="text-xs text-gray-600 max-w-sm text-center break-all">{errorMsg}</p>
            )}
            <p className="text-xs text-gray-500">블러·단색 배경 기능을 사용할 수 없지만, 일반 촬영은 가능합니다.</p>
          </>
        )}
      </div>

      {/* Start button */}
      <button
        onClick={onReady}
        disabled={loadState === 'loading'}
        className="px-12 py-4 bg-pink-500 hover:bg-pink-400 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold text-lg rounded-2xl transition-all shadow-xl shadow-pink-500/20"
      >
        시작하기
      </button>
    </div>
  )
}
