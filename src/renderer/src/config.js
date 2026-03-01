/**
 * Global configuration — change these values to tune the app behaviour.
 * All time values are in seconds.
 */
export const config = {
  // ── Shooting ──────────────────────────────────────────────────────────────
  totalShots: 8,           // default number of shots per session
  intervalSeconds: 8,      // time between shots (includes countdown)
  countdownSeconds: 3,     // countdown shown before each shot

  // ── Layout options ────────────────────────────────────────────────────────
  // cols × rows = number of photos selected by the user
  layouts: [
    { id: '1x1', label: '1컷',      cols: 1, rows: 1 },
    { id: '1x2', label: '세로 2컷', cols: 1, rows: 2 },
    { id: '1x4', label: '세로 4컷', cols: 1, rows: 4 },
    { id: '2x2', label: '2×2',      cols: 2, rows: 2 },
  ],

  // ── Canvas output dimensions (pixels) per layout id ───────────────────────
  frameDimensions: {
    '1x1': { width: 640,  height: 760  },
    '1x2': { width: 640,  height: 1040 },
    '1x4': { width: 640,  height: 1920 },
    '2x2': { width: 1200, height: 1300 },
  },

  photoMargin: 18,         // gap between photos and frame edge (px)
  footerHeight: 110,       // reserved space at bottom for date/logo

  // ── Background effect options ─────────────────────────────────────────────
  bgEffects: [
    { id: 'none',  label: '없음' },
    { id: 'solid', label: '단색' },
    { id: 'blur',  label: '블러' },
  ],

  // ── Photo filter presets ─────────────────────────────────────────────────
  // Canvas ctx.filter 문자열로 사용됨. 'none' = 필터 없음.
  photoFilters: [
    { id: 'original', label: 'Original', filter: 'none' },
    { id: 'bright',   label: '뽀샤시',   filter: 'brightness(1.15) contrast(1.1) saturate(1.1)' },
    { id: 'bw',       label: '흑백',     filter: 'grayscale(100%) contrast(1.2)' },
    { id: 'warm',     label: '빈티지',   filter: 'sepia(25%) brightness(1.1) saturate(1.3)' },
    { id: 'cool',     label: '청량',     filter: 'hue-rotate(-10deg) saturate(1.2) brightness(1.05)' },
  ],

  // ── Frame colour palette ──────────────────────────────────────────────────
  frameColors: [
    { id: 'white',    label: '화이트',  value: '#FFFFFF' },
    { id: 'black',    label: '블랙',    value: '#1a1a1a' },
    { id: 'pink',     label: '핑크',    value: '#FADADD' },
    { id: 'mint',     label: '민트',    value: '#C8F7E2' },
    { id: 'lavender', label: '라벤더',  value: '#E6E0F8' },
    { id: 'cream',    label: '크림',    value: '#FFFDD0' },
  ],
}
