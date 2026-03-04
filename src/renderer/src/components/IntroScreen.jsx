import { Camera, Check, AlertTriangle } from 'lucide-react'

/**
 * IntroScreen
 *
 * Props:
 *   onReady      : () => void
 *   isReady      : boolean                        — 모든 항목 done
 *   loadingItems : { id, label, done, failed }[]  — 로딩 항목 목록
 */
export default function IntroScreen({ onReady, isReady, loadingItems = [] }) {
  const wasmFailed = loadingItems.find(i => i.id === 'wasm')?.failed ?? false

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

      {/* Loading items */}
      {loadingItems.length > 0 && (
        <div className="flex flex-col items-start gap-2 min-w-[200px]">
          {loadingItems.map(item => (
            <div key={item.id} className="flex items-center gap-2.5 text-xs">
              {!item.done ? (
                <div className="w-3.5 h-3.5 border border-gray-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              ) : item.failed ? (
                <AlertTriangle size={13} className="text-yellow-500 flex-shrink-0" />
              ) : (
                <Check size={13} className="text-pink-400 flex-shrink-0" />
              )}
              <span className={
                !item.done ? 'text-gray-400' :
                item.failed ? 'text-yellow-500' :
                'text-gray-500'
              }>
                {item.label}
                {!item.done ? ' 로딩 중…' : item.failed ? ' 로드 실패' : ' 완료'}
              </span>
            </div>
          ))}

          {/* WASM 실패 시 안내 */}
          {isReady && wasmFailed && (
            <p className="text-xs text-gray-500 mt-1 max-w-[260px]">
              AI 배경(블러·단색) 기능을 사용할 수 없습니다. 일반 촬영은 정상 동작합니다.
            </p>
          )}
        </div>
      )}

      {/* Start button — WASM 실패해도 활성화 (일반 촬영은 가능) */}
      <button
        onClick={onReady}
        disabled={!isReady}
        className="px-12 py-4 bg-pink-500 hover:bg-pink-400 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold text-lg rounded-2xl transition-all shadow-xl shadow-pink-500/20"
      >
        {isReady ? '시작하기' : '준비 중…'}
      </button>
    </div>
  )
}
