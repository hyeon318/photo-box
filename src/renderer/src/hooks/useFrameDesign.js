import { useState } from 'react'
import { config } from '../config'

/**
 * frameDesign 상태 형태:
 * {
 *   type:       'solid' | 'blur' | 'pattern'
 *   color:      string | null   — hex (단색 배경 or 블러 색조, null = 색조 없음)
 *   patternId:  string | null   — config.framePatterns[].id
 *   patternSrc: string | null   — /patterns/*.jpg
 * }
 *
 * 핵심: bgEffect(촬영 중 카메라 처리)와 완전히 독립.
 * 촬영 후 SelectStep에서만 사용.
 */

const DEFAULT_COLOR      = config.frameColors[0].value       // '#FFFFFF'
const DEFAULT_PATTERN_ID = config.framePatterns[0]?.id  ?? null
const DEFAULT_PATTERN_SRC = config.framePatterns[0]?.src ?? null

export function useFrameDesign(initialColor = DEFAULT_COLOR) {
  const [frameDesign, setFrameDesign] = useState({
    type:       'solid',
    color:      initialColor,
    patternId:  DEFAULT_PATTERN_ID,
    patternSrc: DEFAULT_PATTERN_SRC,
  })

  /** 배경 타입 변경 (색상·패턴 선택은 유지) */
  const setType = (type) =>
    setFrameDesign(prev => ({ ...prev, type }))

  /** 단색 또는 블러 색조 변경 */
  const setColor = (color) =>
    setFrameDesign(prev => ({ ...prev, color }))

  /** 패턴 선택 */
  const setPattern = ({ id, src }) =>
    setFrameDesign(prev => ({ ...prev, patternId: id, patternSrc: src }))

  return { frameDesign, setType, setColor, setPattern }
}
