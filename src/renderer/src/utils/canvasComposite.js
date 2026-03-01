import { config } from '../config'

/**
 * Composite selected photos into a framed strip using Canvas API.
 *
 * @param {string[]} photoDataUrls - Ordered array of photo dataURLs
 * @param {{ id: string, cols: number, rows: number }} layout
 * @param {string} frameColor - CSS hex colour for the background frame
 * @returns {Promise<string>} - Composite image as PNG dataURL
 */
export async function compositePhotos(photoDataUrls, layout, frameColor) {
  const { cols, rows } = layout
  const totalSlots = cols * rows

  // Pick canvas dimensions from the layout id lookup table
  const dims       = config.frameDimensions[layout.id] || { width: 640, height: 1280 }
  const frameWidth  = dims.width
  const frameHeight = dims.height

  const { photoMargin, footerHeight } = config

  const canvas = document.createElement('canvas')
  canvas.width  = frameWidth
  canvas.height = frameHeight
  const ctx = canvas.getContext('2d')

  // ── Background ─────────────────────────────────────────────────────────────
  ctx.fillStyle = frameColor
  ctx.fillRect(0, 0, frameWidth, frameHeight)

  // ── Photo grid ─────────────────────────────────────────────────────────────
  const usableW = frameWidth  - photoMargin * (cols + 1)
  const usableH = frameHeight - footerHeight - photoMargin * (rows + 1)
  const photoW  = usableW / cols
  const photoH  = usableH / rows

  const images = await Promise.all(
    photoDataUrls.slice(0, totalSlots).map(loadImage)
  )

  for (let i = 0; i < totalSlots; i++) {
    const img = images[i]
    if (!img) continue

    const col = i % cols
    const row = Math.floor(i / cols)
    const x = photoMargin + col * (photoW + photoMargin)
    const y = photoMargin + row * (photoH + photoMargin)

    ctx.save()
    roundedClip(ctx, x, y, photoW, photoH, 14)

    // Cover-fit (object-fit: cover behaviour)
    const scale = Math.max(photoW / img.width, photoH / img.height)
    const sw = photoW / scale
    const sh = photoH / scale
    const sx = (img.width  - sw) / 2
    const sy = (img.height - sh) / 2

    ctx.drawImage(img, sx, sy, sw, sh, x, y, photoW, photoH)
    ctx.restore()
  }

  // ── Footer ─────────────────────────────────────────────────────────────────
  const footerY   = frameHeight - footerHeight
  const textColor = isLightColor(frameColor) ? '#374151' : '#f9fafb'
  const subColor  = isLightColor(frameColor) ? '#9ca3af' : 'rgba(255,255,255,0.45)'

  // Thin divider
  ctx.strokeStyle = isLightColor(frameColor) ? '#d1d5db' : 'rgba(255,255,255,0.15)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(photoMargin * 2, footerY + 12)
  ctx.lineTo(frameWidth - photoMargin * 2, footerY + 12)
  ctx.stroke()

  // Date
  const dateStr = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
  // Scale text to canvas width (narrower strips get smaller text)
  const dateFontSize = Math.round(frameWidth * 0.048)  // 640→30, 1200→57
  const subFontSize  = Math.round(frameWidth * 0.034)  // 640→21, 1200→40

  ctx.fillStyle    = textColor
  ctx.font         = `bold ${dateFontSize}px -apple-system, Arial, sans-serif`
  ctx.textAlign    = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(dateStr, frameWidth / 2, footerY + 45)

  // Logo / watermark
  ctx.fillStyle = subColor
  ctx.font      = `${subFontSize}px -apple-system, Arial, sans-serif`
  ctx.fillText('PhotoBooth', frameWidth / 2, footerY + 80)

  return canvas.toDataURL('image/png')
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
