/**
 * 현재 위치를 가져오는 비동기 유틸 함수.
 *
 * 전략:
 *  1차) navigator.geolocation — Wi-Fi/GPS 기반, 정확도 높음
 *  2차) IP 기반 폴백 (ip-api.com) — Windows 위치 서비스 꺼져있거나 Electron에서
 *       UNAVAILABLE/TIMEOUT 반환 시 자동으로 시도. 도시 수준 정확도.
 *
 * 항상 resolve만 하고 절대 reject하지 않는다.
 */

async function getGpsLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ lat: null, lng: null, accuracy: null, status: 'UNSUPPORTED' })
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({
        lat: coords.latitude,
        lng: coords.longitude,
        accuracy: coords.accuracy,
        status: 'OK',
      }),
      (err) => resolve({
        lat: null,
        lng: null,
        accuracy: null,
        status: err.code === 1 ? 'PERMISSION_DENIED' : err.code === 3 ? 'TIMEOUT' : 'UNAVAILABLE',
      }),
      { enableHighAccuracy: false, timeout: 2000, maximumAge: 60_000 }
    )
  })
}

// IP 기반 폴백 — 메인 프로세스 IPC 경유로 CORS 없이 호출
async function getIpLocation() {
  try {
    const result = await window.electronAPI.getIpLocation()
    if (result?.lat && result?.lng) {
      return { lat: result.lat, lng: result.lng, accuracy: null, status: 'OK' }
    }
  } catch { /* IPC 실패 */ }
  return null
}

export async function getLocation() {
  // 1순위: navigator.geolocation (Chromium)
  const gpsResult = await getGpsLocation()
  if (gpsResult.status === 'OK') return gpsResult
  if (gpsResult.status === 'PERMISSION_DENIED') {
    return { lat: null, lng: null, accuracy: null, status: 'PERMISSION_DENIED' }
  }

  // 2순위: Windows .NET GeoCoordinateWatcher (OS 레벨, Chromium 우회)
  try {
    const win = await window.electronAPI.getWindowsLocation()
    if (win?.lat && win?.lng) {
      return { lat: win.lat, lng: win.lng, accuracy: null, status: 'OK' }
    }
  } catch { /* 미지원 환경 */ }

  // 3순위: IP 기반 폴백 (도시 수준, ISP 주소)
  const ipResult = await getIpLocation()
  return ipResult ?? { lat: null, lng: null, accuracy: null, status: 'UNKNOWN' }
}
