import { Palette, Layers, LayoutGrid } from 'lucide-react'
import { config } from '../config'

// 타입별 아이콘 매핑
const TYPE_ICON = { solid: Palette, blur: Layers, pattern: LayoutGrid }

/**
 * FrameDesignPicker
 *
 * props:
 *   frameDesign  — { type, color, patternId, patternSrc }
 *   setType      — (type) => void
 *   setColor     — (hex) => void
 *   setPattern   — ({ id, src }) => void
 *   previewPhoto — 블러 미리보기에 사용할 사진 dataURL (optional)
 */
export default function FrameDesignPicker({ frameDesign, setType, setColor, setPattern, previewPhoto }) {
  const { type, color, patternId } = frameDesign

  return (
    <div className="space-y-3">
      {/* ── 타입 탭 ─────────────────────────────────────────────────────── */}
      <div>
        <span className="text-sm font-semibold text-gray-300 block mb-2">프레임 디자인</span>
        <div className="flex gap-2">
          {config.frameDesignTypes.map(t => {
            const Icon   = TYPE_ICON[t.id]
            const active = type === t.id
            return (
              <button
                key={t.id}
                onClick={() => setType(t.id)}
                title={t.desc}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border-2 transition-all ${
                  active
                    ? 'border-pink-500 bg-pink-950/40 text-pink-400'
                    : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-300'
                }`}
              >
                <Icon size={13} />
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── 단색: 컬러 팔레트 ────────────────────────────────────────────── */}
      {type === 'solid' && (
        <div className="flex gap-2 flex-wrap">
          {config.frameColors.map(c => (
            <ColorDot
              key={c.id}
              title={c.label}
              bg={c.value}
              active={color === c.value}
              onClick={() => setColor(c.value)}
            />
          ))}
        </div>
      )}

      {/* ── 블러: 색조 팔레트 + 인라인 미리보기 ─────────────────────────── */}
      {type === 'blur' && (
        <div className="space-y-2.5">
          {/* 블러 배경 인라인 미리보기 */}
          {previewPhoto && (
            <div className="relative w-full h-14 rounded-xl overflow-hidden">
              <img
                src={previewPhoto}
                className="w-full h-full object-cover"
                style={{ filter: 'blur(10px) brightness(0.7)', transform: 'scale(1.1)' }}
                alt="blur preview"
              />
              {color && (
                <div
                  className="absolute inset-0"
                  style={{ backgroundColor: color, opacity: 0.22 }}
                />
              )}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[11px] text-white/80 font-medium drop-shadow">블러 배경 미리보기</span>
              </div>
            </div>
          )}

          {/* 색조 선택 (없음 포함) */}
          <div>
            <p className="text-xs text-gray-500 mb-1.5">색조 오버레이</p>
            <div className="flex gap-2 flex-wrap">
              {/* 색조 없음 */}
              <button
                onClick={() => setColor(null)}
                title="색조 없음"
                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                  color === null
                    ? 'border-pink-500 scale-110 bg-gray-700'
                    : 'border-gray-600 bg-gray-800 hover:border-gray-400'
                }`}
              >
                <span className="text-gray-400 text-xs font-bold leading-none">∅</span>
              </button>

              {config.frameColors.filter(c => c.id !== 'white').map(c => (
                <ColorDot
                  key={c.id}
                  title={c.label}
                  bg={c.value}
                  active={color === c.value}
                  onClick={() => setColor(c.value)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 패턴: 이미지 썸네일 그리드 ─────────────────────────────────── */}
      {type === 'pattern' && (
        <div>
          <p className="text-xs text-gray-500 mb-2">
            이미지 파일 위치:&nbsp;
            <code className="text-pink-400/80 text-[10px]">public/patterns/</code>
          </p>
          <div className="grid grid-cols-4 gap-2">
            {config.framePatterns.map(p => (
              <PatternTile
                key={p.id}
                pattern={p}
                active={patternId === p.id}
                onClick={() => setPattern({ id: p.id, src: p.src })}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ColorDot({ bg, title, active, onClick }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-8 h-8 rounded-full border-2 transition-all flex-shrink-0 ${
        active
          ? 'border-pink-500 scale-110 shadow-md shadow-pink-500/30'
          : 'border-gray-700 hover:border-gray-400'
      }`}
      style={{ backgroundColor: bg }}
    />
  )
}

function PatternTile({ pattern, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`relative h-14 rounded-xl overflow-hidden border-2 transition-all ${
        active
          ? 'border-pink-500 shadow-md shadow-pink-500/30'
          : 'border-gray-700 hover:border-gray-500'
      }`}
      style={{
        backgroundImage:    `url(${pattern.src})`,
        backgroundSize:     '60px',
        backgroundRepeat:   'repeat',
        backgroundColor:    '#f0ede8',  // 이미지 로드 전 폴백 색
      }}
    >
      {/* 반투명 레이블 배경 */}
      <div className="absolute inset-x-0 bottom-0 bg-black/45 py-0.5 px-1">
        <span className="text-[9px] text-white font-semibold leading-none block truncate">
          {pattern.label}
        </span>
      </div>

      {/* 선택 체크 */}
      {active && (
        <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-pink-500 flex items-center justify-center shadow">
          <span className="text-[8px] text-white font-black">✓</span>
        </div>
      )}
    </button>
  )
}
