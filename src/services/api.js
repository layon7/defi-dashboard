const COINGECKO_BASE = 'https://api.coingecko.com/api/v3'

// Top 500 en 5 páginas
export async function fetchCoinGeckoPrices() {
  const pages = [1, 2, 3, 4, 5]
  const results = await Promise.all(
    pages.map(page =>
      fetch(`${COINGECKO_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=${page}&sparkline=false&price_change_percentage=24h`)
        .then(r => r.ok ? r.json() : []).catch(() => [])
    )
  )
  return results.flat()
}

// Búsqueda global — encuentra cualquier moneda fuera del top 500
export async function searchCoins(query) {
  if (!query || query.length < 2) return []
  const res = await fetch(`${COINGECKO_BASE}/search?query=${encodeURIComponent(query)}`)
  if (!res.ok) return []
  const data = await res.json()
  return data.coins?.slice(0, 10) || []
}

// Trae precios de monedas específicas por ID (para resultados de búsqueda global)
export async function fetchCoinsByIds(ids) {
  if (!ids.length) return []
  const res = await fetch(`${COINGECKO_BASE}/coins/markets?vs_currency=usd&ids=${ids.join(',')}&sparkline=false&price_change_percentage=24h`)
  if (!res.ok) return []
  return res.json()
}

export async function fetchGlobalStats() {
  const res = await fetch(`${COINGECKO_BASE}/global`)
  if (!res.ok) throw new Error(`CoinGecko global error: ${res.status}`)
  return res.json()
}

export async function fetchCoinHistory(coinId, days = 7) {
  const res = await fetch(`${COINGECKO_BASE}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=daily`)
  if (!res.ok) throw new Error(`CoinGecko history error: ${res.status}`)
  return res.json()
}

const DEBANK_BASE     = 'https://pro-openapi.debank.com/v1'
const DEBANK_API_KEY  = import.meta.env.VITE_DEBANK_API_KEY || ''
const debankHeaders   = { 'accept': 'application/json', 'AccessKey': DEBANK_API_KEY }

export const hasDebankKey = () => Boolean(DEBANK_API_KEY)

export async function fetchWalletPortfolio(address) {
  if (!DEBANK_API_KEY) return null
  const res = await fetch(`${DEBANK_BASE}/user/total_balance?id=${address}`, { headers: debankHeaders })
  if (!res.ok) throw new Error(`DeBank balance error: ${res.status}`)
  return res.json()
}
export async function fetchWalletTokens(address) {
  if (!DEBANK_API_KEY) return null
  const res = await fetch(`${DEBANK_BASE}/user/token_list?id=${address}&is_all=false&has_balance=true`, { headers: debankHeaders })
  if (!res.ok) throw new Error(`DeBank tokens error: ${res.status}`)
  return res.json()
}
export async function fetchWalletProtocols(address) {
  if (!DEBANK_API_KEY) return null
  const res = await fetch(`${DEBANK_BASE}/user/simple_protocol_list?id=${address}`, { headers: debankHeaders })
  if (!res.ok) throw new Error(`DeBank protocols error: ${res.status}`)
  return res.json()
}
export async function fetchWalletHistory(address) {
  if (!DEBANK_API_KEY) return null
  const res = await fetch(`${DEBANK_BASE}/user/history_list?id=${address}&chain_id=eth&page_count=20`, { headers: debankHeaders })
  if (!res.ok) throw new Error(`DeBank history error: ${res.status}`)
  return res.json()
}