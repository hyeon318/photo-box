/**
 * selfieSegSingleton
 *
 * MediaPipe SelfieSegmentation 인스턴스를 앱 세션 내 단 한 번만 초기화합니다.
 *
 * - preloadSeg()  : WASM + 모델 파일 로드 + initialize() 실행.
 *                   Promise를 캐시하므로 여러 번 호출해도 초기화는 1회.
 * - getSeg()      : 초기화된 seg 인스턴스 반환. 아직 준비 안 됐으면 null.
 * - releaseSeg()  : onResults를 빈 함수로 교체 (close 없이 재사용 가능 상태 유지).
 */

let instance = null
let initPromise = null

export async function preloadSeg() {
  if (initPromise) return initPromise

  initPromise = (async () => {
    // selfie_segmentation.js 는 IIFE → window.SelfieSegmentation 에 등록
    await import('@mediapipe/selfie_segmentation')

    const SelfieSegmentation = window.SelfieSegmentation
    if (!SelfieSegmentation) throw new Error('SelfieSegmentation not found on window')

    const seg = new SelfieSegmentation({
      locateFile: (file) => `./mediapipe/${file}`,
    })
    seg.setOptions({ modelSelection: 1 })
    await seg.initialize()

    instance = seg
    return seg
  })()

  return initPromise
}

export function getSeg() {
  return instance
}

/**
 * BackgroundBlurCamera unmount 시 호출.
 * seg.close() 대신 onResults를 빈 함수로 교체해 in-flight 콜백을 무해하게 처리.
 * 인스턴스 자체는 살려두어 다음 마운트 시 재사용 가능.
 */
export function releaseSeg() {
  if (instance) {
    instance.onResults(() => {})
  }
}
