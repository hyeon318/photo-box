/**
 * 현재 위치를 가져오는 비동기 유틸 함수.
 *
 * - 성공: { lat, lng, accuracy, status: 'OK' }
 * - 실패: { lat: null, lng: null, accuracy: null, status: 'PERMISSION_DENIED' | 'UNAVAILABLE' | 'TIMEOUT' | 'UNSUPPORTED' | 'UNKNOWN' }
 *
 * 항상 resolve만 하고 절대 reject하지 않으므로,
 * 호출자는 try/catch 없이 await만으로 안전하게 사용할 수 있다.
 */
export async function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ lat: null, lng: null, accuracy: null, status: 'UNSUPPORTED' })
      return
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        resolve({
          lat: coords.latitude,
          lng: coords.longitude,
          accuracy: coords.accuracy,
          status: 'OK',
        })
      },
      (err) => {
        const statusMap = {
          1: 'PERMISSION_DENIED',
          2: 'UNAVAILABLE',
          3: 'TIMEOUT',
        }
        resolve({
          lat: null,
          lng: null,
          accuracy: null,
          status: statusMap[err.code] ?? 'UNKNOWN',
        })
      },
      {
        enableHighAccuracy: true, // 노트북 환경: Wi-Fi 기반 정밀도 향상
        timeout: 4000,            // 4초 초과 시 TIMEOUT 폴백
        maximumAge: 60_000,       // 1분 내 캐시 위치 재사용 (반복 촬영 최적화)
      }
    )
  })
}
