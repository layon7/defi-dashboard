const CG = 'https://api.coingecko.com/api/v3'

export async function fetchCoinGeckoPrices() {
  const results = await Promise.all(
    [1,2,3,4,5].map(page =>
      fetch(`${CG}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=${page}&sparkline=false&price_change_percentage=24h`)
        .then(r => r.ok ? r.json() : []).catch(() => [])
    )
  )
  return results.flat()
}

export async function searchCoins(query) {
  if (!query || query.length < 2) return []
  try {
    const res = await fetch(`${CG}/search?query=${encodeURIComponent(query)}`)
    return res.ok ? (await res.json()).coins?.slice(0,12)||[] : []
  } catch { return [] }
}

export async function fetchCoinsByIds(ids) {
  if (!ids?.length) return []
  try {
    const res = await fetch(`${CG}/coins/markets?vs_currency=usd&ids=${ids.join(',')}&sparkline=false&price_change_percentage=24h`)
    return res.ok ? res.json() : []
  } catch { return [] }
}

export async function fetchGlobalStats() {
  const res = await fetch(`${CG}/global`)
  if (!res.ok) throw new Error('CoinGecko global error')
  return res.json()
}

// OHLC para velas — usa market_chart con interval hourly para más datos
export async function fetchOHLC(coinId, days = 7) {
  // CoinGecko OHLC endpoint
  const res = await fetch(`${CG}/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`)
  if (!res.ok) throw new Error(`OHLC error ${res.status}`)
  const raw = await res.json()
  // raw = [[ts, open, high, low, close], ...]
  if (!Array.isArray(raw) || raw.length === 0) throw new Error('No OHLC data')
  return raw
}

// Precios históricos para calcular indicadores técnicos (RSI, MACD, etc.)
export async function fetchPriceHistory(coinId, days = 90) {
  const res = await fetch(`${CG}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=daily`)
  if (!res.ok) throw new Error(`History error ${res.status}`)
  return res.json()
}

export async function fetchFearGreed() {
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1')
    return res.ok ? (await res.json()).data?.[0] || null : null
  } catch { return null }
}

// ── Zerion — llamadas a través del proxy /api/zerion ──────────
// El proxy en /api/zerion.js reenvía a Zerion server-side (sin CORS)
// NUNCA llamamos a api.zerion.io directamente desde el browser

export const hasZerionKey = () => Boolean(import.meta.env.VITE_ZERION_API_KEY)

function zerionProxy(path, params = {}) {
  const qs = new URLSearchParams({ path, ...params }).toString()
  return fetch(`/api/zerion?${qs}`).then(r => {
    if (!r.ok) return r.json().then(e => { throw new Error(e.error || `HTTP ${r.status}`) })
    return r.json()
  })
}

export async function fetchZerionPortfolio(address) {
  return zerionProxy(`wallets/${address}/portfolio`, { currency: 'usd' })
}

export async function fetchZerionPositions(address) {
  return zerionProxy(`wallets/${address}/positions/`, {
    'filter[position_types]': 'wallet',
    currency: 'usd',
    'sort': '-value',
    'page[size]': '100',
  })
}

export async function fetchZerionTransactions(address) {
  return zerionProxy(`wallets/${address}/transactions/`, {
    currency: 'usd',
    'page[size]': '30',
  })
}