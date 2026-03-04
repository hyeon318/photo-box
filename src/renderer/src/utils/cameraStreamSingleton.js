/**
 * cameraStreamSingleton
 *
 * 촬영 시작 전에 카메라 스트림을 미리 열어두는 싱글톤.
 * BackgroundBlurCamera가 마운트될 때 getUserMedia를 직접 호출하는 대신
 * pre-warmed 스트림을 바로 사용하여 "카메라 연결 중…" 대기 시간을 제거합니다.
 *
 * - prewarmCamera()     : getUserMedia를 미리 호출, Promise 반환
 * - getPrewarmStream()  : prewarm이 진행 중이면 완료까지 대기 후 스트림 반환.
 *                         병렬 getUserMedia 호출 충돌을 방지하는 핵심 API.
 * - cancelPrewarm()     : 스트림 정리 (촬영 불필요 경로로 이탈 시)
 */

let prewarmedStream = null
let prewarmPromise  = null   // 진행 중인 getUserMedia Promise 추적
let rev = 0                  // cancelPrewarm 호출 감지용

export function prewarmCamera() {
  if (prewarmedStream?.active) return Promise.resolve(prewarmedStream)
  if (prewarmPromise) return prewarmPromise  // 이미 진행 중이면 같은 Promise 재사용

  const myRev = ++rev
  prewarmPromise = navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
    audio: false,
  }).then(stream => {
    prewarmPromise = null
    if (rev === myRev) {
      prewarmedStream = stream
    } else {
      // cancelPrewarm()이 호출된 이후 resolve됨 — 즉시 폐기
      stream.getTracks().forEach(t => t.stop())
    }
    return stream
  }).catch(err => {
    prewarmPromise = null
    throw err
  })

  return prewarmPromise
}

/**
 * prewarm 완료까지 대기 후 스트림 반환.
 * BackgroundBlurCamera는 consumePrewarmedStream() 대신 이 함수를 사용해
 * prewarm과 병렬로 자체 getUserMedia를 열어 충돌하는 문제를 방지한다.
 * cancelPrewarm() 이후라면 null 반환.
 */
export async function getPrewarmStream() {
  if (prewarmedStream) {
    const s = prewarmedStream
    prewarmedStream = null
    return s
  }
  if (prewarmPromise) {
    try { await prewarmPromise } catch { return null }
    // prewarmPromise resolve 후 prewarmedStream에 저장되어 있으면 소비
    const s = prewarmedStream
    prewarmedStream = null
    return s   // cancelPrewarm()으로 취소됐으면 null
  }
  return null
}

/** 스트림이 필요 없어진 경우 트랙 정지 + pending promise 무효화 */
export function cancelPrewarm() {
  rev++  // pending promise가 resolve 시 prewarmedStream에 저장하지 못하게 무효화
  prewarmedStream?.getTracks().forEach(t => t.stop())
  prewarmedStream = null
}
