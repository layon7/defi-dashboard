const CG = 'https://api.coingecko.com/api/v3'

async function fetchWithRetry(url, options = {}, retries = 3, delay = 1200) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options)
      if (res.status === 429) {
        await new Promise(r => setTimeout(r, delay * (i + 2) * 2))
        continue
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res
    } catch (e) {
      if (i === retries - 1) throw e
      await new Promise(r => setTimeout(r, delay * (i + 1)))
    }
  }
}

export async function fetchCoinGeckoPrices() {
  const all = []
  for (const page of [1, 2, 3, 4, 5]) {
    try {
      const res  = await fetchWithRetry(
        `${CG}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=${page}&sparkline=false&price_change_percentage=24h`
      )
      const data = await res.json()
      all.push(...data)
      if (page < 5) await new Promise(r => setTimeout(r, 350))
    } catch {}
  }
  return all
}

export async function searchCoins(query) {
  if (!query || query.length < 2) return []
  try {
    const res = await fetchWithRetry(`${CG}/search?query=${encodeURIComponent(query)}`)
    return (await res.json()).coins?.slice(0, 12) || []
  } catch { return [] }
}

export async function fetchCoinsByIds(ids) {
  if (!ids?.length) return []
  try {
    const res = await fetchWithRetry(
      `${CG}/coins/markets?vs_currency=usd&ids=${ids.join(',')}&sparkline=false&price_change_percentage=24h`
    )
    return res.json()
  } catch { return [] }
}

export async function fetchGlobalStats() {
  const res = await fetchWithRetry(`${CG}/global`)
  return res.json()
}

export async function fetchOHLC(coinId, days = 7) {
  const res = await fetchWithRetry(`${CG}/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`)
  const raw = await res.json()
  if (!Array.isArray(raw) || raw.length === 0) throw new Error('Sin datos OHLC')
  return raw
}

// Historial completo con PRECIOS y VOLÚMENES para indicadores técnicos
export async function fetchPriceHistory(coinId, days = 90) {
  const res = await fetchWithRetry(
    `${CG}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=daily`
  )
  return res.json()
  // Devuelve: { prices: [[ts,price],...], volumes: [[ts,vol],...], market_caps: [...] }
}

export async function fetchFearGreed() {
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1')
    return res.ok ? (await res.json()).data?.[0] || null : null
  } catch { return null }
}

// ── Zerion — SIEMPRE por proxy /api/zerion (sin CORS) ─────────
export const hasZerionKey = () => Boolean(import.meta.env.VITE_ZERION_API_KEY)

async function zerionProxy(path, params = {}) {
  const qs  = new URLSearchParams({ path, ...params }).toString()
  const res = await fetchWithRetry(`/api/zerion?${qs}`)
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data
}

export const fetchZerionPortfolio    = addr => zerionProxy(`wallets/${addr}/portfolio`, { currency: 'usd' })
export const fetchZerionPositions    = addr => zerionProxy(`wallets/${addr}/positions/`, {
  'filter[position_types]': 'wallet',
  currency: 'usd',
  sort: '-value',
  'page[size]': '100',
})
export const fetchZerionTransactions = addr => zerionProxy(`wallets/${addr}/transactions/`, {
  currency: 'usd',
  'page[size]': '30',
})