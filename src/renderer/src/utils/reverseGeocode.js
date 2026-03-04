/**
 * Kakao Local API — 좌표 → 주소 변환 (Reverse Geocoding)
 * https://developers.kakao.com/docs/latest/ko/local/dev-guide#coord-to-address
 *
 * API 키: .env 파일의 VITE_KAKAO_REST_API_KEY
 */

const API_KEY = import.meta.env.VITE_KAKAO_REST_API_KEY

// 같은 좌표를 반복 요청하지 않도록 메모리 캐시
const cache = new Map()

/**
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<string|null>}  "서울 용산구" / "경기 하남시" 형태, 실패 시 null
 */
export async function reverseGeocode(lat, lng) {
  if (!API_KEY || API_KEY.startsWith('여기에')) return null

  // 소수점 4자리로 캐시 키 생성 (~11m 단위)
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`
  if (cache.has(key)) return cache.get(key)

  try {
    const url = `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${lng}&y=${lat}`
    const res = await fetch(url, {
      headers: { Authorization: `KakaoAK ${API_KEY}` },
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return null

    const data = await res.json()
    const doc = data.documents?.[0]
    if (!doc) return null

    // 시/도 + 시/군/구 조합으로 도시명 반환 (예: "서울 용산구", "경기 하남시")
    const src = doc.road_address || doc.address
    const city = [src?.region_1depth_name, src?.region_2depth_name]
      .filter(Boolean).join(' ') || null
    cache.set(key, city)
    return city
  } catch {
    return null
  }
}
