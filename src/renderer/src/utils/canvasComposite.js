import { config } from '../config'

/**
 * Composite selected photos into a framed strip.
 *
 * Canvas layering (bottom → top):
 *   Layer 1 — Frame background  : solid color / blur / repeating pattern
 *   Layer 2 — Photo slots        : cover-fit, rounded corners, optional filter
 *   Layer 3 — Overlay & footer   : frame PNG overlay (optional) + date text
 *
 * @param {string[]} photoDataUrls
 * @param {{ id: string, cols: number, rows: number }} layout
 * @param {{ type: 'solid'|'blur'|'pattern', color: string|null, patternSrc: string|null }} frameDesign
 * @param {string} [photoFilter]  CSS filter string (applied to photos only)
 * @returns {Promise<string>} PNG dataURL
 */
export async function compositePhotos(photoDataUrls, layout, frameDesign, photoFilter = 'none') {
  const { cols, rows } = layout
  const totalSlots = cols * rows

  const dims        = config.frameDimensions[layout.id] || { width: 640, height: 1280 }
  const frameWidth  = dims.width
  const frameHeight = dims.height
  const { photoMargin, footerHeight } = config

  const canvas = document.createElement('canvas')
  canvas.width  = frameWidth
  canvas.height = frameHeight
  const ctx = canvas.getContext('2d', { powerPreference: 'high-performance' })

  // 사진 배치 전 캔버스 초기화 필수 (이전 합성 잔상 방지)
  ctx.clearRect(0, 0, frameWidth, frameHeight)

  // ── Layer 0: 이미지 사전 로드 ────────────────────────────────────────────────
  const images = await Promise.all(
    photoDataUrls.slice(0, totalSlots).map(loadImage)
  )

  // ── Layer 1: 프레임 배경 ──────────────────────────────────────────────────────
  const { type, color, patternSrc } = frameDesign

  if (type === 'blur' && images[0]) {
    // 첫 번째 사진을 가우시안 블러(≥30px) 처리해 배경으로 깔기
    drawBlurBackground(ctx, images[0], frameWidth, frameHeight)
    // 선택적 색조(tint) 오버레이
    if (color) {
      ctx.fillStyle = hexToRgba(color, 0.22)
      ctx.fillRect(0, 0, frameWidth, frameHeight)
    }
  } else if (type === 'pattern' && patternSrc) {
    // 이미지 패턴 반복 배치
    await drawPatternBackground(ctx, patternSrc, frameWidth, frameHeight)
  } else {
    // 단색 (기본)
    ctx.fillStyle = color || '#FFFFFF'
    ctx.fillRect(0, 0, frameWidth, frameHeight)
  }

  // ── Layer 2: 사진 슬롯 ───────────────────────────────────────────────────────
  const usableW = frameWidth  - photoMargin * (cols + 1)
  const usableH = frameHeight - footerHeight - photoMargin * (rows + 1)
  const photoW  = usableW / cols
  const photoH  = usableH / rows

  for (let i = 0; i < totalSlots; i++) {
    const img = images[i]
    if (!img) continue

    const col = i % cols
    const row = Math.floor(i / cols)
    const x   = photoMargin + col * (photoW + photoMargin)
    const y   = photoMargin + row * (photoH + photoMargin)

    ctx.save()
    roundedClip(ctx, x, y, photoW, photoH, 14)

    // Cover-fit (object-fit: cover)
    const scale = Math.max(photoW / img.width, photoH / img.height)
    const sw = photoW / scale
    const sh = photoH / scale
    const sx = (img.width  - sw) / 2
    const sy = (img.height - sh) / 2

    // 사진에만 필터 적용 — 프레임·푸터에 번지지 않도록 save/restore 내부에서 처리
    if (photoFilter && photoFilter !== 'none') ctx.filter = photoFilter
    ctx.drawImage(img, sx, sy, sw, sh, x, y, photoW, photoH)
    ctx.filter = 'none'
    ctx.restore()
  }

  // ── Layer 3-A: 프레임 오버레이 PNG (말풍선·로고 등) ──────────────────────────
  // 프레임 이미지에는 ctx.filter 미적용 — save/restore 로 사진 필터와 격리
  // const overlay = await loadImage('/frames/overlay.png').catch(() => null)
  // if (overlay) {
  //   ctx.save()
  //   ctx.filter = 'none'
  //   ctx.drawImage(overlay, 0, 0, frameWidth, frameHeight)
  //   ctx.restore()
  // }

  // ── Layer 3-B: 푸터 (날짜 + 워터마크) ───────────────────────────────────────
  const footerY = frameHeight - footerHeight

  // 텍스트 색상: blur/pattern → 항상 밝게, solid → 배경 밝기에 따라 결정
  const useLightText = type === 'blur' || type === 'pattern' || !isLightColor(color || '#FFFFFF')
  const textColor = useLightText ? '#f9fafb' : '#374151'
  const subColor  = useLightText ? 'rgba(255,255,255,0.5)' : '#9ca3af'
  const lineColor = useLightText ? 'rgba(255,255,255,0.2)' : '#d1d5db'

  ctx.strokeStyle = lineColor
  ctx.lineWidth   = 1
  ctx.beginPath()
  ctx.moveTo(photoMargin * 2, footerY + 12)
  ctx.lineTo(frameWidth - photoMargin * 2, footerY + 12)
  ctx.stroke()

  const dateStr      = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
  const dateFontSize = Math.round(frameWidth * 0.048)
  const subFontSize  = Math.round(frameWidth * 0.034)

  ctx.fillStyle    = textColor
  ctx.font         = `bold ${dateFontSize}px -apple-system, Arial, sans-serif`
  ctx.textAlign    = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(dateStr, frameWidth / 2, footerY + 45)

  ctx.fillStyle = subColor
  ctx.font      = `${subFontSize}px -apple-system, Arial, sans-serif`
  ctx.fillText('PhotoBooth', frameWidth / 2, footerY + 80)

  return canvas.toDataURL('image/jpeg', 0.95)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * 첫 번째 사진을 cover-fit으로 그린 뒤 강한 블러로 배경 처리.
 * 가장자리 blur-edge 아티팩트 방지를 위해 1.08배 확대해서 draw.
 */
function drawBlurBackground(ctx, img, frameWidth, frameHeight) {
  ctx.save()
  const scale = Math.max(frameWidth / img.width, frameHeight / img.height) * 1.08
  const drawW = img.width  * scale
  const drawH = img.height * scale
  const drawX = (frameWidth  - drawW) / 2
  const drawY = (frameHeight - drawH) / 2
  ctx.filter = 'blur(32px) saturate(1.3) brightness(0.70)'
  ctx.drawImage(img, drawX, drawY, drawW, drawH)
  ctx.filter = 'none'
  ctx.restore()
}

/**
 * 이미지를 Repeat 패턴으로 프레임 배경에 타일링.
 * 패턴 타일 크기는 최대 280px로 스케일 제한.
 * 이미지 로드 실패 시 연회색으로 폴백.
 */
async function drawPatternBackground(ctx, src, frameWidth, frameHeight) {
  try {
    const img     = await loadImage(src)
    const pattern = ctx.createPattern(img, 'repeat')
    if (!pattern) throw new Error('createPattern failed')

    // 타일 크기를 280px 이내로 제한 (너무 크면 반복 패턴처럼 보이지 않음)
    const maxTile = 280
    const scale   = Math.min(1, maxTile / Math.max(img.width, img.height))
    pattern.setTransform(new DOMMatrix([scale, 0, 0, scale, 0, 0]))

    ctx.fillStyle = pattern
    ctx.fillRect(0, 0, frameWidth, frameHeight)
  } catch {
    // 이미지 없음 폴백 — 연회색 배경
    ctx.fillStyle = '#f0ede8'
    ctx.fillRect(0, 0, frameWidth, frameHeight)
  }
}

function hexToRgba(hex, alpha) {
  const c = (hex || '#000000').replace('#', '')
  const r = parseInt(c.slice(0, 2), 16)
  const g = parseInt(c.slice(2, 4), 16)
  const b = parseInt(c.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img   = new Image()
    img.onload  = () => resolve(img)
    img.onerror = reject
    img.src     = src
  })
}

function roundedClip(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y,     x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h,     x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y,         x + r, y)
  ctx.closePath()
  ctx.clip()
}

function isLightColor(hex) {
  const c = (hex || '#ffffff').replace('#', '')
  const r = parseInt(c.slice(0, 2), 16)
  const g = parseInt(c.slice(2, 4), 16)
  const b = parseInt(c.slice(4, 6), 16)
  return 0.299 * r + 0.587 * g + 0.114 * b > 140
}
