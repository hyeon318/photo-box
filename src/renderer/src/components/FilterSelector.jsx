import { config } from '../config'

/**
 * FilterSelector
 *
 * 사진 필터 선택 UI. 각 버튼에 실제 CSS filter를 적용한 컬러 스와치를 보여줍니다.
 *
 * Props:
 *   selected : { id, label, filter }  — 현재 선택된 필터 객체
 *   onChange  : (filter) => void      — 필터 변경 콜백
 */
export default function FilterSelector({ selected, onChange }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-0.5">
      {config.photoFilters.map(f => {
        const isActive = selected.id === f.id
        return (
          <button
            key={f.id}
            onClick={() => onChange(f)}
            className={`flex-shrink-0 flex flex-col items-center gap-1 px-2 pt-1.5 pb-1 rounded-xl border-2 transition-all ${
              isActive
                ? 'border-pink-500 bg-pink-950/40'
                : 'border-transparent hover:border-gray-700'
            }`}
          >
            {/* 컬러 스와치 — 하늘+피부톤 그래디언트에 해당 filter 적용 */}
            <div
              className="w-10 h-7 rounded-md overflow-hidden flex-shrink-0"
              style={{
                background: 'linear-gradient(160deg, #87CEEB 45%, #D2A679 45%)',
                filter: f.filter === 'none' ? undefined : f.filter,
              }}
            />
            <span className={`text-[10px] font-semibold leading-none ${
              isActive ? 'text-pink-400' : 'text-gray-500'
            }`}>
              {f.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
