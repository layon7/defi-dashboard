const CG = 'https://api.coingecko.com/api/v3'

// ── Top 500 ───────────────────────────────────────────────────
export async function fetchCoinGeckoPrices() {
  const results = await Promise.all(
    [1,2,3,4,5].map(page =>
      fetch(`${CG}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=${page}&sparkline=false&price_change_percentage=24h`)
        .then(r => r.ok ? r.json() : []).catch(() => [])
    )
  )
  return results.flat()
}

// ── Búsqueda global ───────────────────────────────────────────
export async function searchCoins(query) {
  if (!query || query.length < 2) return []
  try {
    const res = await fetch(`${CG}/search?query=${encodeURIComponent(query)}`)
    if (!res.ok) return []
    return (await res.json()).coins?.slice(0, 12) || []
  } catch { return [] }
}

export async function fetchCoinsByIds(ids) {
  if (!ids?.length) return []
  try {
    const res = await fetch(`${CG}/coins/markets?vs_currency=usd&ids=${ids.join(',')}&sparkline=false&price_change_percentage=24h`)
    return res.ok ? res.json() : []
  } catch { return [] }
}

// ── Stats globales ────────────────────────────────────────────
export async function fetchGlobalStats() {
  const res = await fetch(`${CG}/global`)
  if (!res.ok) throw new Error('CoinGecko global error')
  return res.json()
}

// ── Velas OHLC para gráfico ───────────────────────────────────
export async function fetchOHLC(coinId, days = 7) {
  const res = await fetch(`${CG}/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`)
  if (!res.ok) throw new Error('OHLC error')
  return res.json() // [[timestamp, open, high, low, close], ...]
}

// Historial de precio para ETH (sparkline)
export async function fetchCoinHistory(coinId, days = 7) {
  const res = await fetch(`${CG}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=daily`)
  if (!res.ok) throw new Error('History error')
  return res.json()
}

// ── Fear & Greed Index ────────────────────────────────────────
export async function fetchFearGreed() {
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1')
    if (!res.ok) return null
    const data = await res.json()
    return data.data?.[0] || null
  } catch { return null }
}

// ── Zerion Wallet API ─────────────────────────────────────────
// CORS fix: Zerion requiere llamadas server-side en producción.
// Usamos un proxy público de Zerion o llamamos directamente.
// Si falla por CORS en el browser, usar Vercel Edge Function.
const ZERION_KEY = import.meta.env.VITE_ZERION_API_KEY || ''
const ZERION     = 'https://api.zerion.io/v1'

function zerionAuth() {
  // Zerion usa Basic Auth: base64(apiKey + ":")
  return { 
    'accept': 'application/json',
    'authorization': `Basic ${btoa(ZERION_KEY + ':')}`,
  }
}

export const hasZerionKey = () => Boolean(ZERION_KEY)

export async function fetchZerionPortfolio(address) {
  if (!ZERION_KEY) return null
  const res = await fetch(
    `${ZERION}/wallets/${address}/portfolio?currency=usd`,
    { headers: zerionAuth() }
  )
  if (!res.ok) {
    const txt = await res.text().catch(()=>'')
    throw new Error(`Zerion ${res.status}: ${txt.slice(0,80)}`)
  }
  return res.json()
}

export async function fetchZerionPositions(address) {
  if (!ZERION_KEY) return null
  const res = await fetch(
    `${ZERION}/wallets/${address}/positions/?filter[position_types]=wallet&currency=usd&sort=-value&page[size]=100`,
    { headers: zerionAuth() }
  )
  if (!res.ok) throw new Error(`Zerion positions ${res.status}`)
  return res.json()
}

export async function fetchZerionTransactions(address) {
  if (!ZERION_KEY) return null
  const res = await fetch(
    `${ZERION}/wallets/${address}/transactions/?currency=usd&page[size]=30`,
    { headers: zerionAuth() }
  )
  if (!res.ok) throw new Error(`Zerion transactions ${res.status}`)
  return res.json()
}