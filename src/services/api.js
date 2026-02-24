const COINGECKO_BASE = 'https://api.coingecko.com/api/v3'
const CG_IDS = { BTC:'bitcoin', ETH:'ethereum', USDC:'usd-coin', UNI:'uniswap', AAVE:'aave', LINK:'chainlink', MATIC:'matic-network', ARB:'arbitrum' }

export async function fetchCoinGeckoPrices() {
  const ids = Object.values(CG_IDS).join(',')
  const res = await fetch(`${COINGECKO_BASE}/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=false&price_change_percentage=24h`)
  if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`)
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
const DEBANK_BASE = 'https://pro-openapi.debank.com/v1'
const DEBANK_API_KEY = import.meta.env.VITE_DEBANK_API_KEY || ''
const debankHeaders = { 'accept': 'application/json', 'AccessKey': DEBANK_API_KEY }

export async function fetchWalletPortfolio(walletAddress) {
  if (!DEBANK_API_KEY) return null
  const res = await fetch(`${DEBANK_BASE}/user/total_balance?id=${walletAddress}`, { headers: debankHeaders })
  if (!res.ok) throw new Error(`DeBank balance error: ${res.status}`)
  return res.json()
}
export async function fetchWalletTokens(walletAddress) {
  if (!DEBANK_API_KEY) return null
  const res = await fetch(`${DEBANK_BASE}/user/token_list?id=${walletAddress}&is_all=false&has_balance=true`, { headers: debankHeaders })
  if (!res.ok) throw new Error(`DeBank tokens error: ${res.status}`)
  return res.json()
}
export async function fetchWalletProtocols(walletAddress) {
  if (!DEBANK_API_KEY) return null
  const res = await fetch(`${DEBANK_BASE}/user/simple_protocol_list?id=${walletAddress}`, { headers: debankHeaders })
  if (!res.ok) throw new Error(`DeBank protocols error: ${res.status}`)
  return res.json()
}