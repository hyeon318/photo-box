import { config } from '../config'

/**
 * Composite selected photos into a framed strip using Canvas API.
 *
 * @param {string[]} photoDataUrls - Ordered array of photo dataURLs
 * @param {{ id: string, cols: number, rows: number }} layout
 * @param {string} frameColor - CSS hex colour for background / tint overlay
 * @param {'solid'|'blur'} bgEffect - Background rendering mode
 * @returns {Promise<string>} - Composite image as PNG dataURL
 */
export async function compositePhotos(photoDataUrls, layout, frameColor, bgEffect = 'solid') {
  const { cols, rows } = layout
  const totalSlots = cols * rows

  const dims        = config.frameDimensions[layout.id] || { width: 640, height: 1280 }
  const frameWidth  = dims.width
  const frameHeight = dims.height

  const { photoMargin, footerHeight } = config

  const canvas = document.createElement('canvas')
  canvas.width  = frameWidth
  canvas.height = frameHeight
  const ctx = canvas.getContext('2d')

  // ── 이미지 먼저 로드 (blur 배경이 첫 번째 사진을 사용하므로) ─────────────────
  const images = await Promise.all(
    photoDataUrls.slice(0, totalSlots).map(loadImage)
  )

  // ── Background ─────────────────────────────────────────────────────────────
  if (bgEffect === 'blur' && images[0]) {
    // 1. 첫 번째 사진을 전체 프레임에 꽉 차게 블러 처리해서 배경으로 깔기
    drawBlurBackground(ctx, images[0], frameWidth, frameHeight)

    // 2. 프레임 색상을 반투명 오버레이로 얹어 색감·명암 보정
    ctx.fillStyle = hexToRgba(frameColor, 0.25)
    ctx.fillRect(0, 0, frameWidth, frameHeight)
  } else {
    // 단색
    ctx.fillStyle = frameColor
    ctx.fillRect(0, 0, frameWidth, frameHeight)
  }

  // ── Photo grid ─────────────────────────────────────────────────────────────
  const usableW = frameWidth  - photoMargin * (cols + 1)
  const usableH = frameHeight - footerHeight - photoMargin * (rows + 1)
  const photoW  = usableW / cols
  const photoH  = usableH / rows

  for (let i = 0; i < totalSlots; i++) {
    const img = images[i]
    if (!img) continue

    const col = i % cols
    const row = Math.floor(i / cols)
    const x = photoMargin + col * (photoW + photoMargin)
    const y = photoMargin + row * (photoH + photoMargin)

    ctx.save()
    roundedClip(ctx, x, y, photoW, photoH, 14)

    // Cover-fit (object-fit: cover)
    const scale = Math.max(photoW / img.width, photoH / img.height)
    const sw = photoW / scale
    const sh = photoH / scale
    const sx = (img.width  - sw) / 2
    const sy = (img.height - sh) / 2

    ctx.drawImage(img, sx, sy, sw, sh, x, y, photoW, photoH)
    ctx.restore()
  }

  // ── Footer ─────────────────────────────────────────────────────────────────
  const footerY = frameHeight - footerHeight

  // 블러 배경은 항상 밝은 텍스트, 단색은 배경 밝기로 판단
  const useLightText = bgEffect === 'blur' || !isLightColor(frameColor)
  const textColor = useLightText ? '#f9fafb' : '#374151'
  const subColor  = useLightText ? 'rgba(255,255,255,0.5)' : '#9ca3af'
  const lineColor = useLightText ? 'rgba(255,255,255,0.2)' : '#d1d5db'

  ctx.strokeStyle = lineColor
  ctx.lineWidth = 1
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

  return canvas.toDataURL('image/png')
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * 이미지를 전체 프레임에 cover-fit으로 그린 뒤 블러 필터를 적용해 배경으로 사용한다.
 * ctx.filter 는 Chromium(Electron)에서 정상 지원된다.
 */
function drawBlurBackground(ctx, img, frameWidth, frameHeight) {
  ctx.save()

  // 약간 확대해서 blur edge(가장자리 투명) 아티팩트 방지
  const scale  = Math.max(frameWidth / img.width, frameHeight / img.height) * 1.08
  const drawW  = img.width  * scale
  const drawH  = img.height * scale
  const drawX  = (frameWidth  - drawW) / 2
  const drawY  = (frameHeight - drawH) / 2

  ctx.filter = 'blur(28px) saturate(1.3) brightness(0.72)'
  ctx.drawImage(img, drawX, drawY, drawW, drawH)
  ctx.filter = 'none'

  ctx.restore()
}

/** hex 색상에 알파값을 적용해 rgba() 문자열로 변환 */
function hexToRgba(hex, alpha) {
  const c = hex.replace('#', '')
  const r = parseInt(c.slice(0, 2), 16)
  const g = parseInt(c.slice(2, 4), 16)
  const b = parseInt(c.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
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
  const c = hex.replace('#', '')
  const r = parseInt(c.slice(0, 2), 16)
  const g = parseInt(c.slice(2, 4), 16)
  const b = parseInt(c.slice(4, 6), 16)
  return 0.299 * r + 0.587 * g + 0.114 * b > 140
}
