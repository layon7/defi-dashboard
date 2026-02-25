const CG = 'https://api.coingecko.com/api/v3'

// ── Top 500 en 5 páginas ──────────────────────────────────────
export async function fetchCoinGeckoPrices() {
  const results = await Promise.all(
    [1,2,3,4,5].map(page =>
      fetch(`${CG}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=${page}&sparkline=false&price_change_percentage=24h`)
        .then(r => r.ok ? r.json() : []).catch(() => [])
    )
  )
  return results.flat()
}

// ── Búsqueda global — CUALQUIER moneda de CoinGecko ──────────
// Paso 1: buscar IDs por nombre/símbolo
export async function searchCoins(query) {
  if (!query || query.length < 2) return []
  try {
    const res = await fetch(`${CG}/search?query=${encodeURIComponent(query)}`)
    if (!res.ok) return []
    const data = await res.json()
    return (data.coins || []).slice(0, 12)
  } catch { return [] }
}

// Paso 2: traer precios reales de esos IDs
export async function fetchCoinsByIds(ids) {
  if (!ids || !ids.length) return []
  try {
    const res = await fetch(`${CG}/coins/markets?vs_currency=usd&ids=${ids.join(',')}&sparkline=false&price_change_percentage=24h`)
    if (!res.ok) return []
    return res.json()
  } catch { return [] }
}

export async function fetchGlobalStats() {
  const res = await fetch(`${CG}/global`)
  if (!res.ok) throw new Error('CoinGecko global error')
  return res.json()
}

export async function fetchCoinHistory(coinId, days = 7) {
  const res = await fetch(`${CG}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=daily`)
  if (!res.ok) throw new Error('CoinGecko history error')
  return res.json()
}

// ── Zerion Wallet API ─────────────────────────────────────────
// Gratis: 2000 calls/día — regístrate en app.zerion.io/developers
// Guarda tu key en Vercel → Settings → Environment Variables
// Nombre: VITE_ZERION_API_KEY
const ZERION_KEY = import.meta.env.VITE_ZERION_API_KEY || ''
const ZERION     = 'https://api.zerion.io/v1'

function zerionHeaders() {
  const encoded = btoa(`${ZERION_KEY}:`)
  return {
    'accept': 'application/json',
    'authorization': `Basic ${encoded}`,
  }
}

export const hasZerionKey = () => Boolean(ZERION_KEY)

// Portfolio total de la wallet
export async function fetchZerionPortfolio(address) {
  if (!ZERION_KEY) return null
  const res = await fetch(`${ZERION}/wallets/${address}/portfolio?currency=usd`, { headers: zerionHeaders() })
  if (!res.ok) throw new Error(`Zerion portfolio error: ${res.status}`)
  return res.json()
}

// Tokens en la wallet (todas las chains)
export async function fetchZerionPositions(address) {
  if (!ZERION_KEY) return null
  const res = await fetch(
    `${ZERION}/wallets/${address}/positions/?filter[position_types]=wallet&currency=usd&sort=-value&page[size]=100`,
    { headers: zerionHeaders() }
  )
  if (!res.ok) throw new Error(`Zerion positions error: ${res.status}`)
  return res.json()
}

// Historial de transacciones
export async function fetchZerionTransactions(address) {
  if (!ZERION_KEY) return null
  const res = await fetch(
    `${ZERION}/wallets/${address}/transactions/?currency=usd&page[size]=30`,
    { headers: zerionHeaders() }
  )
  if (!res.ok) throw new Error(`Zerion transactions error: ${res.status}`)
  return res.json()
}