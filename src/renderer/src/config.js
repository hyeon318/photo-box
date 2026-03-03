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

  // ── Background effect options (촬영 중 카메라 배경 처리 — 합성과 무관) ────────
  bgEffects: [
    { id: 'none',  label: '없음' },
    { id: 'solid', label: '단색' },
    { id: 'blur',  label: '블러' },
  ],

  // ── Frame design types (촬영 후 합성 시 배경 — bgEffect 와 독립적) ────────────
  frameDesignTypes: [
    { id: 'solid',   label: '단색',  desc: '선택한 색상으로 배경 채움' },
    { id: 'blur',    label: '블러',  desc: '촬영 사진을 블러 처리해 배경으로 사용' },
    { id: 'pattern', label: '패턴',  desc: '이미지 패턴을 반복 배치해 배경으로 사용' },
  ],

  // ── Pattern assets — 파일 위치: src/renderer/public/patterns/ ────────────────
  framePatterns: [
    { id: 'kraft',  label: '크라프트', src: '/patterns/kraft.jpg'  },
    { id: 'paper',  label: '종이',     src: '/patterns/paper.jpg'  },
    { id: 'linen',  label: '린넨',     src: '/patterns/linen.jpg'  },
    { id: 'marble', label: '마블',     src: '/patterns/marble.jpg' },
  ],

  // ── Photo filter presets ─────────────────────────────────────────────────
  // Canvas ctx.filter 문자열로 사용됨. 'none' = 필터 없음.
  photoFilters: [
    { id: 'original', label: 'Original', filter: 'none' },
    // 뽀샤시: 밝게 + 대비 낮춤(피부 부드럽게) + 채도 살짝
    { id: 'bright',   label: '뽀샤시',   filter: 'brightness(1.18) contrast(0.9) saturate(1.08)' },
    // 흑백: 클래식 필름 느낌, 살짝 밝게
    { id: 'bw',       label: '흑백',     filter: 'grayscale(100%) contrast(1.12) brightness(1.04)' },
    // 빈티지: 세피아 + 살짝 따뜻하게
    { id: 'warm',     label: '빈티지',   filter: 'sepia(30%) brightness(1.06) contrast(1.08) saturate(1.2)' },
    // 청량: 색온도 쿨하게 + 선명하게
    { id: 'cool',     label: '청량',     filter: 'hue-rotate(-20deg) saturate(1.2) brightness(1.08) contrast(1.06)' },
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
