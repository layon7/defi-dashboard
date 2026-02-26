const CG = 'https://api.coingecko.com/api/v3'

// Fetch con reintentos automáticos (resuelve "Failed to fetch" por rate limit)
async function fetchWithRetry(url, options = {}, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options)
      if (res.status === 429) {
        // Rate limited — espera y reintenta
        await new Promise(r => setTimeout(r, delay * (i + 1) * 2))
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

// Top 500 — páginas en serie (no paralelas) para no golpear el rate limit
export async function fetchCoinGeckoPrices() {
  const all = []
  for (const page of [1, 2, 3, 4, 5]) {
    try {
      const res = await fetchWithRetry(
        `${CG}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=${page}&sparkline=false&price_change_percentage=24h`
      )
      const data = await res.json()
      all.push(...data)
      // Pequeña pausa entre páginas
      if (page < 5) await new Promise(r => setTimeout(r, 300))
    } catch { /* continúa con las páginas que sí cargaron */ }
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

// OHLC para velas — devuelve [[ts, open, high, low, close], ...]
export async function fetchOHLC(coinId, days = 7) {
  const res = await fetchWithRetry(`${CG}/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`)
  const raw = await res.json()
  if (!Array.isArray(raw) || raw.length === 0) throw new Error('Sin datos OHLC')
  return raw
}

// Historial de precios para indicadores técnicos
// days=90 da ~90 puntos diarios — suficiente para RSI(14), MACD(26), EMA(50)
export async function fetchPriceHistory(coinId, days = 90) {
  const res = await fetchWithRetry(
    `${CG}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=daily`
  )
  return res.json()
}

export async function fetchFearGreed() {
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1')
    return res.ok ? (await res.json()).data?.[0] || null : null
  } catch { return null }
}

// ── Zerion — proxy server-side en /api/zerion.js ──────────────
// NUNCA se llama a api.zerion.io directo desde el browser (CORS)
export const hasZerionKey = () => Boolean(import.meta.env.VITE_ZERION_API_KEY)

async function zerionProxy(path, params = {}) {
  const qs  = new URLSearchParams({ path, ...params }).toString()
  const res = await fetchWithRetry(`/api/zerion?${qs}`)
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data
}

export async function fetchZerionPortfolio(address) {
  return zerionProxy(`wallets/${address}/portfolio`, { currency: 'usd' })
}

export async function fetchZerionPositions(address) {
  return zerionProxy(`wallets/${address}/positions/`, {
    'filter[position_types]': 'wallet',
    currency: 'usd',
    sort: '-value',
    'page[size]': '100',
  })
}

export async function fetchZerionTransactions(address) {
  return zerionProxy(`wallets/${address}/transactions/`, {
    currency: 'usd',
    'page[size]': '30',
  })
}