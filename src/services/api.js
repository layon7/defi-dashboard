// src/services/api.js — v10.2
// FIXES DE VELOCIDAD:
// - Timeout 7s (antes 9s) — falla rápido, reintenta
// - fetchCoinGeckoPrices: páginas 1+2 paralelas → UI en ~1.2s, 3-5 en background paralelo
// - fetchPriceHistory: activo + BTC en PARALELO (antes secuencial = +3-4s)
// - Cache 25min para histórico — segundo análisis es <50ms
// NUEVOS DATOS ANÁLISIS:
// - BTC devuelto junto al historial → correlación en indicators.js

const CG = 'https://api.coingecko.com/api/v3'

const _c = new Map()
const cGet = (k, ttl) => { const i = _c.get(k); if (!i || Date.now()-i.ts > ttl) { _c.delete(k); return null } return i.data }
const cSet = (k, d) => _c.set(k, { data:d, ts:Date.now() })
const TTL = { prices:180000, history:1500000, global:300000, ohlc:480000, search:900000, byids:120000 }
const sleep = ms => new Promise(r => setTimeout(r, ms))

// Timeout manual compatible con todos los browsers
function ft(url, ms=7000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(t))
}

// 2 intentos con backoff corto
async function fx(url, ms=7000) {
  for (let i=0; i<2; i++) {
    try {
      const res = await ft(url, ms)
      if (res.status === 429) {
        if (i===0) { await sleep(1500); continue }
        throw new Error('Rate limit — espera 30s e intenta de nuevo')
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch(e) {
      if (e.name === 'AbortError') {
        if (i===0) { await sleep(400); continue }
        throw new Error('Timeout — verifica tu conexión')
      }
      if (i===1) throw e
      await sleep(500)
    }
  }
}

// ── Top 500 ───────────────────────────────────────────────────
const mktUrl = p => `${CG}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=${p}&sparkline=false&price_change_percentage=24h`

export async function fetchCoinGeckoPrices(onPartial) {
  const c = cGet('prices_all', TTL.prices)
  if (c) { onPartial?.(c); return c }

  // Páginas 1+2 en paralelo → 200 monedas visibles en ~1.2s
  const [p1, p2] = await Promise.all([
    fx(mktUrl(1)),
    fx(mktUrl(2)).catch(() => []),
  ])
  const partial = [...(p1||[]), ...(p2||[])]
  if (partial.length) onPartial?.(partial)

  // Páginas 3-5 en paralelo en background — nunca bloquean la UI
  ;(async () => {
    try {
      const [p3,p4,p5] = await Promise.all([
        fx(mktUrl(3)).catch(()=>[]),
        fx(mktUrl(4)).catch(()=>[]),
        fx(mktUrl(5)).catch(()=>[]),
      ])
      const all = [...partial,...p3,...p4,...p5]
      cSet('prices_all', all)
      onPartial?.(all)
    } catch {}
  })()

  return partial
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

// ── Historial técnico: activo + BTC en PARALELO ───────────────
// BTC se usa para correlación. Antes era secuencial (+3-4s).
// Si ya está en cache → Promise.resolve() = instantáneo.
export async function fetchPriceHistory(coinId, days=90) {
  const kC=`h_${coinId}_${days}`, kB=`h_bitcoin_${days}`
  const cC=cGet(kC,TTL.history), cB=cGet(kB,TTL.history)
  if (cC && cB) return { coin:cC, btc:cB }

  const url = id => `${CG}/coins/${id}/market_chart?vs_currency=usd&days=${days}&interval=daily`

  const [coinData, btcData] = await Promise.all([
    cC ? Promise.resolve(cC) : fx(url(coinId)),
    cB ? Promise.resolve(cB) : (coinId==='bitcoin' ? Promise.resolve(null) : fx(url('bitcoin')).catch(()=>null)),
  ])

  if (!coinData?.prices?.length) throw new Error('Sin datos históricos')
  cSet(kC, coinData)
  if (btcData?.prices?.length) cSet(kB, btcData)
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

// ── Zerion proxy (sin CORS) ───────────────────────────────────
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