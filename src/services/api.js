// src/services/api.js — v10.4
// CAMBIOS vs v10.3:
// - Top 500 → Top 100 solamente (1 página, ~0.7s, sin background ni rate limit)
// - fetchPriceHistory ahora acepta timeframe: '1h' | '4h' | '1d'
//   CoinGecko: days=1 → intervalos cada 5min | days=14 → cada hora | days=90 → diario
// - Debounce externo en useAnalysis (cancelación limpia al cambiar moneda)

const CG = 'https://api.coingecko.com/api/v3'

const _c = new Map()
const cGet = (k, ttl) => { const i = _c.get(k); if (!i || Date.now()-i.ts > ttl) { _c.delete(k); return null } return i.data }
const cSet = (k, d) => _c.set(k, { data:d, ts:Date.now() })
const TTL = { prices:300000, history:1800000, hist4h:900000, hist1h:300000, global:300000, ohlc:480000, search:900000, byids:180000 }
const sleep = ms => new Promise(r => setTimeout(r, ms))

function ft(url, ms=9000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(t))
}

async function fx(url, ms=9000) {
  for (let i=0; i<2; i++) {
    try {
      const res = await ft(url, ms)
      if (res.status === 429) {
        if (i===0) { await sleep(3000); continue }
        throw new Error('Rate limit — espera 1 minuto')
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch(e) {
      if (e.name === 'AbortError') {
        if (i===0) { await sleep(800); continue }
        throw new Error('Timeout — verifica tu conexión')
      }
      if (i===1) throw e
      await sleep(800)
    }
  }
}

// ── Top 100 — 1 sola página, sin background ───────────────────
// Antes: 5 páginas (3 en background) → rate limit frecuente
// Ahora: 1 página → ~0.7s, sin riesgo de 429
const mktUrl = p => `${CG}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=${p}&sparkline=false&price_change_percentage=24h`

export async function fetchCoinGeckoPrices(onPartial) {
  const c = cGet('prices_all', TTL.prices)
  if (c) { onPartial?.(c); return c }
  const data = await fx(mktUrl(1))
  const result = data || []
  cSet('prices_all', result)
  onPartial?.(result)
  return result
}

export async function searchCoins(q) {
  if (!q || q.length<2) return []
  const key=`s_${q.toLowerCase()}`
  const c=cGet(key,TTL.search); if(c) return c
  try {
    const d = await fx(`${CG}/search?query=${encodeURIComponent(q)}`)
    const r = d.coins?.slice(0,12)||[]
    cSet(key,r); return r
  } catch { return [] }
}

export async function fetchCoinsByIds(ids) {
  if (!ids?.length) return []
  const key=`bi_${[...ids].sort().join(',')}`
  const c=cGet(key,TTL.byids); if(c) return c
  try {
    const d = await fx(`${CG}/coins/markets?vs_currency=usd&ids=${ids.join(',')}&sparkline=false&price_change_percentage=24h`)
    if (d?.length) cSet(key,d)
    return d||[]
  } catch { return [] }
}

export async function fetchGlobalStats() {
  const c=cGet('global',TTL.global); if(c) return c
  const d = await fx(`${CG}/global`)
  cSet('global',d); return d
}

export async function fetchOHLC(coinId, days=7) {
  const key=`ohlc_${coinId}_${days}`
  const c=cGet(key,TTL.ohlc); if(c) return c
  const raw = await fx(`${CG}/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`)
  if (!Array.isArray(raw)||!raw.length) throw new Error('Sin datos OHLC')
  cSet(key,raw); return raw
}

// ── Historial multi-timeframe ─────────────────────────────────
// CoinGecko free tier:
//   days=2,  sin interval → puntos cada 5min  → usamos como proxy "1H" (últimas 2 días)
//   days=14, sin interval → puntos cada hora   → proxy "4H" (14 días de velas horarias)
//   days=90, interval=daily → 1 punto por día  → "1D" (90 días)
//
// Para BTC solo lo pedimos en timeframe 1D (referencia de correlación larga)
// En 1H/4H no tiene sentido correlacionar con BTC

const TF_CONFIG = {
  '1h': { days: 2,  interval: '',       ttlKey: 'hist1h', ttl: 'hist1h'  },
  '4h': { days: 14, interval: '',       ttlKey: 'hist4h', ttl: 'hist4h'  },
  '1d': { days: 90, interval: 'daily',  ttlKey: 'history',ttl: 'history' },
}

export async function fetchPriceHistory(coinId, tf='1d') {
  const cfg = TF_CONFIG[tf] || TF_CONFIG['1d']
  const kC = `h_${tf}_${coinId}`
  const kB = `h_1d_bitcoin`
  const cC = cGet(kC, TTL[cfg.ttl])
  const cB = tf==='1d' ? cGet(kB, TTL.history) : null

  // Cache hit completo
  if (cC && (tf!=='1d' || cB)) return { coin:cC, btc:cB||null }

  const ivParam = cfg.interval ? `&interval=${cfg.interval}` : ''
  const url = id => `${CG}/coins/${id}/market_chart?vs_currency=usd&days=${cfg.days}${ivParam}`

  // Fetch del activo
  const coinData = cC ? cC : await fx(url(coinId))
  if (!coinData?.prices?.length) throw new Error('Sin datos históricos')
  cSet(kC, coinData)

  // BTC solo en 1D y si no está en cache
  let btcData = null
  if (tf==='1d' && !cB && coinId!=='bitcoin') {
    await sleep(400)
    btcData = await fx(url('bitcoin')).catch(()=>null)
    if (btcData?.prices?.length) cSet(kB, btcData)
  } else if (tf==='1d' && cB) {
    btcData = cB
  }

  return { coin:coinData, btc:btcData }
}

export async function fetchFearGreed() {
  const c=cGet('fg',TTL.global); if(c) return c
  try {
    const res = await ft('https://api.alternative.me/fng/?limit=1', 5000)
    const d = (await res.json()).data?.[0]||null
    if (d) cSet('fg',d); return d
  } catch { return null }
}

export const hasZerionKey = () => Boolean(import.meta.env.VITE_ZERION_API_KEY)

async function zerionProxy(path, params={}) {
  const qs = new URLSearchParams({path,...params}).toString()
  const res = await ft(`/api/zerion?${qs}`, 12000)
  if (!res.ok) throw new Error(`Zerion HTTP ${res.status}`)
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data
}

export const fetchZerionPortfolio    = a => zerionProxy(`wallets/${a}/portfolio`, { currency:'usd' })
export const fetchZerionPositions    = a => zerionProxy(`wallets/${a}/positions/`, { 'filter[position_types]':'wallet', currency:'usd', sort:'-value', 'page[size]':'100' })
export const fetchZerionTransactions = a => zerionProxy(`wallets/${a}/transactions/`, { currency:'usd', 'page[size]':'30' })
