import { useState, useEffect, useRef, useCallback } from 'react'
import { getLocation } from '../utils/getLocation'

const IDLE_LOCATION = { lat: null, lng: null, accuracy: null, status: 'IDLE' }

/**
 * useLocation
 *
 * @param {{ prefetch?: boolean }} options
 *   prefetch: true → 훅 마운트 즉시 위치를 백그라운드 fetch.
 *             ShootingStep에서 사용하면 카메라 준비(~1.2s) 동안 위치를 미리 취득해
 *             첫 촬영 시 지연이 0이 된다.
 *
 * @returns {{
 *   location : { lat, lng, accuracy, status },
 *   loading  : boolean,
 *   fetchLocation : () => Promise<{ lat, lng, accuracy, status }>,
 *   getSnapshot   : () => { lat, lng, accuracy, status },
 * }}
 *
 * getSnapshot() 활용 예시 (captureFrame 같은 동기 컨텍스트):
 *   const { getSnapshot } = useLocation({ prefetch: true })
 *   const loc = getSnapshot()  // await 없이 최신 위치 즉시 반환
 */
export function useLocation({ prefetch = false } = {}) {
  const [location, setLocation] = useState(IDLE_LOCATION)
  const [loading, setLoading]   = useState(false)

  // ref: 비동기 캡처 함수에서 클로저 없이 최신 위치를 읽기 위함
  const locationRef = useRef(IDLE_LOCATION)

  const fetchLocation = useCallback(async () => {
    setLoading(true)
    const result = await getLocation()
    locationRef.current = result
    setLocation(result)
    setLoading(false)
    return result
  }, [])

  useEffect(() => {
    if (prefetch) {
      fetchLocation()
    }
  }, [prefetch, fetchLocation])

  // 동기 함수에서 ref를 통해 최신 위치를 즉시 반환
  const getSnapshot = useCallback(() => locationRef.current, [])

  return { location, loading, fetchLocation, getSnapshot }
}
