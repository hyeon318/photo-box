/**
 * 현재 위치를 가져오는 비동기 유틸 함수.
 *
 * 전략:
 *  1차) navigator.geolocation — Wi-Fi/GPS 기반 (Electron에서는 UNAVAILABLE)
 *  2차) Windows .NET GeoCoordinateWatcher — OS 레벨 측위, 실제 값
 *  * IP 폴백 제거 — ISP 주소(부정확)를 실제 위치로 오인할 수 있어 사용 안 함
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

export async function getLocation() {
  // 1순위: navigator.geolocation (Chromium — Electron에서는 항상 UNAVAILABLE)
  const gpsResult = await getGpsLocation()
  console.log('[getLocation] geolocation ->', gpsResult.status)
  if (gpsResult.status === 'OK') {
    console.log('[getLocation] ✅ source: navigator.geolocation')
    return { ...gpsResult, source: 'geolocation' }
  }
  if (gpsResult.status === 'PERMISSION_DENIED') {
    return { lat: null, lng: null, accuracy: null, status: 'PERMISSION_DENIED', source: 'geolocation' }
  }

  // 2순위: Windows .NET GeoCoordinateWatcher (OS 레벨, 실제 측위값)
  try {
    const win = await window.electronAPI.getWindowsLocation()
    console.log('[getLocation] GeoCoordinateWatcher ->', win)
    if (win?.lat && win?.lng) {
      console.log('[getLocation] ✅ source: GeoCoordinateWatcher')
      return { lat: win.lat, lng: win.lng, accuracy: null, status: 'OK', source: 'watcher' }
    }
  } catch { /* 미지원 환경 */ }

  // 위치를 특정할 수 없음 — IP 폴백 없이 UNKNOWN 반환
  console.log('[getLocation] 위치 특정 불가 → UNKNOWN')
  return { lat: null, lng: null, accuracy: null, status: 'UNKNOWN', source: 'none' }
}
